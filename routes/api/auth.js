const express = require("express");
const router = express.Router();
const User = require("../../models/Users");
const auth = require("../../middleware/auth");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const {sendEmailOtp, verifyOtp} = require("../../utils/EmailOtp")
const predictRisk = require("../../utils/riskModel")
require("dotenv").config()

function isLocalhost(ip) {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") || // common private IPv4
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.31.") ||
    ip.startsWith("::ffff:127.0.0.1") // IPv4 mapped IPv6 localhost
  );
}


//Get Logged in User
router.get("/", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

//Login
router.post(
  "/",
  [
    check("username", "Please input Username").not().isEmpty(),
    check("password", "please input password").exists(),
  ],
  async (req, res) => {
    const error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    let { username, password } = req.body;
    username = username.toLowerCase();
    try {
      let user = await User.findOne({ username });
      if (!user) {
        res.status(404).json({ errors: [{ msg: "Username not found" }] });
      }
      const test = await bcrypt.compare(password, user.password);
      if (!test) {
        return res
          .status(400)
          .json({ errors: [{ msg: "Invalid Credentials" }] });
      }
      if(!user.verified){
        return res.status(400).json({errors:[{msg:"Email is unverified"}]})
      }

      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
      const device = req.headers['user-agent'] || ""
      let location = "Unknown"
      let coordinates = {
        lat:null,
        lon: null
      }
      if(!isLocalhost(ip)){
        const geoRes = await axios.get(`http://ip-api.com/json/${ip}`)
        if (geoRes.data.status === "success"){
          location = `${geoRes.data.city}, ${geoRes.data.regionName}, ${geoRes.data.country}`;
          coordinates.lat = geoRes.data.lat;
          coordinates.lon = geoRes.data.lon; 
        }
      }
      location = "Agege, Ogun, Nigeria";
      coordinates = {
        lat: 6.624225,
        lon: 3.326148,
      };
      req.user = user;
      req.headers["user-agent"] = device
      req.connection.remoteAddress = ip
      req.location = location
      req.coordinates = coordinates

      const risk = await predictRisk(req)
      console.log("risk:",risk)
      user.login_history.push({
        ip,
        device,
        location,
        coordinates,
        time: new Date()
      })
      await user.save()

      if(risk === 'low'){const payload = {
        user: {
          id: user.id,
        },
      };
      return jwt.sign(
        payload,
        process.env.JwtSecret,
        {
          expiresIn: 3600000,
        },
        (err, token) => {
          if (err) throw err;
          return res.status(200).json({ user, token });
        }
      );}
      if(risk === "medium"){
        await sendEmailOtp(user.email, user.id)
        return res.status(202).json({
          message: "Suspicious Login. an OTP sent to email. Please verify to continue.",
          risk,
          step: "email_otp",
        });
      }
      return res.status(403).json({
        message: "High risk detected. Biometric authentication required.",
        risk,
        step: "biometric",
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

router.post("/verify-otp", async(req, res) => {
  const {email, otp} = req.body
  try{
    const user = await User.findOne({email})
    if(!user){
      res.status(404).send("User with email not found")
    }
    const verified = await verifyOtp(user.id,otp)
    if(!verified){
      res.status(400).send("Invalid or Expired OTP")
    }
    const payload = {
        user: {
          id: user.id,
        },
      };
      jwt.sign(
        payload,
        process.env.JwtSecret,
        {
          expiresIn: 3600000,
        },
        (err, token) => {
          if (err) throw err;
          res.json({ user, token });
        }
      )
  }catch(err){
    res.status(500).send(err.message)
  }
})

module.exports = router;
