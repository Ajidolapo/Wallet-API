const express = require("express");
const router = express.Router();
const User = require("../../models/Users");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const auth = require("../../middleware/auth");
const {passport, generateToken} = require('./02Auth')
const nodemailer = require("nodemailer");
const { default: axios } = require("axios");
require("dotenv").config()
const transporter = nodemailer.createTransport({
  service:"gmail",
  auth:{
    "user":process.env.EMAIL,
    pass:process.env.PASS
  }
})

router.get('/google', passport.authenticate('google',{scope:['profile', 'email']}))

router.get('/google/callback', passport.authenticate('google',{failureRedirect:'/'}), (res, req)=>{
  const token = generateToken(req.user)
  res.redirect(`http://localhost:5000/api/auth`)
})

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
router.post(
  "/",
  [
    check("first_name", "First Name is Required").not().isEmpty(),
    check("last_name", "Last Name is Required").not().isEmpty(),
    check("email", "Please include avalid email address").isEmail(),
    check("dob", "Put a valid date").custom((value) => {
      if (!moment(value, "MM/DD/YYYY", true).isValid()) {
        throw new Error("Invalid date format. Use MM/DD/YYYY");
      }
      const inputDate = moment(value, "MM/DD/YYYY");
      const currentDate = moment();
      if (inputDate.isAfter(currentDate)) {
        throw new Error("Date of birth cannot be a future date");
      }
      return true;
    }),
    check("username", "Please enter your username").not().isEmpty(),
    check("password", "Password cannot be less than 8 characters").isLength({
      min: 8,
    }),
  ],
  async (req, res) => {
    console.log("register route hit")
    const error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    let { first_name, last_name, email, username, dob, password, phone } = req.body;
    username = username.toLowerCase();
    try {
      let user_email = await User.findOne({ email });
      let user_username = await User.findOne({ username });
      if (user_email) {
        return res
          .status(400)
          .json({ errors: [{ msg: "Email address Already exists" }] });
      }
      if (user_username) {
        return res.status(400).json({ errors: [{ msg: "Username Taken" }] });
      }
      const name = first_name+" "+last_name
      const account_number = String(Math.floor(
        1000000000 + Math.random() * 9000000000
      ));

      const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
      console.log(ip)
    
      const device = req.headers['user-agent']
      let location = "Unknown"
      let coordinates = {lat:null, lon:null}
      if(!isLocalhost(ip)){
        const geoRes = await axios.get(
                  `https://ipqualityscore.com/api/json/ip/AfDQ2R79QdigkZe6idS7mLTRWz4wrm49/${ip}`
                );
                console.log(geoRes)
                if (geoRes.data.success === true){
                  location = `${geoRes.data.city}, ${geoRes.data.region}, ${geoRes.data.country_code}`;
                  coordinates.lat = geoRes.data.latitude;
                  coordinates.lon = geoRes.data.longitude;
        }
      }
      location = "Agege, Ogun, Nigeria"
      coordinates = {
        lat: 6.624225,
        lon: 3.326148,
      };
      user = new User({
        name,
        email,
        dob,
        username,
        password,
        phone,
        account_number,
        current_device:{
          ip,
          device,
          location,
          coordinates
        },
        login_history:[
          {
            ip,
            device,
            location,
            coordinates,
            time: new Date()
          }
        ]

      });

      const salt = await bcrypt.genSalt(10);

      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(
        payload,
        process.env.JwtSecret,
        {
          expiresIn: 300,
        }
      );
      transporter.sendMail({
        from: process.env.EMAIL,
        to: user.email,
        subject: "Email Verification!",
        text: `Your verification link is https://wallet-alpha-three.vercel.app/api/users/verify?token=${token}`,
      });
      res.json({
        "message":"User created successfully. An email verification link has been sent to you."
      })

    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

router.get('/verify', async(req, res)=>{
  try{
    const decoded = jwt.verify(req.query.token, process.env.JwtSecret)
    const owner = decoded.user;
    const user = await User.findById(owner.id);
    if (!user) {
      res.status(404).json({
        errors: [{ msg: "User does not exist" }],
      });
    }
    user.verified = true;
    user.save()
    res.status(200).json({
      message: "User email verified",
      user: user,
    });
  }catch(err){
    res.json({
      "message":err.message
    })
  }

})

//Add to beneficiary
router.post(
  "/beneficiary",
  [
    auth,
    [
      check("name", "Please input beneficiary name").not().isEmpty(),
      check("account_number", "Please input valid account number")
        .isNumeric()
        .isLength({ min: 10, max: 10 }),
      check("bank", "Please input beneficary bank").not().isEmpty(),
    ],
  ],
  async (req, res) => {
    error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    try {
      const { name, account_number, bank } = req.body;
      const user = await User.findById(req.user.id);
      if (!user) {
        return res
          .status(404)
          .json({ errors: [{ msg: "User does not exist" }] });
      }
      const newBen = {
        name,
        account_number,
        bank,
      };
      const benIndex = await user.beneficiary.findIndex(
        (ben) => ben.name === name
      );
      if (benIndex !== -1) {
        user.beneficiary[benIndex] = { name, account_number, bank };
        user.save();
        return res.json({
          msg: `we have successfully update beneficiary ${name}`,
        });
      }
      user.beneficiary.push(newBen);
      user.save();
      return res.json(newBen);
    } catch (err) {
      console.error(err.message), res.status(500).send("server error");
    }
  }
);
//Favorite or unfavorite a beneficiary
router.put('/beneficiary/:id',[auth], async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ msg: "User does not exist" });
    }
    const ben = user.beneficiary.id(req.params.id)
    if(!ben){
      return res.status(404).json({ msg: "Invalid Beneficiary" });
    }
    ben.favorite = !ben.favorite
    await user.save()
    return res.json(ben)
  } catch (err) {
    console.error(err.message)
    return res.status(500).send("Server Error")
  }
})

//Get all beneficiary
router.get('/beneficiary', auth, async (req, res)=>{
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ msg: "User does not exist" });
    }
    const ben = user.beneficiary
    return res.json(ben)
  } catch (err) {
    console.error(err.message)
    return res.status(500).send("server error")    
  }
})

//get favorite beneficiaries
router.get('/beneficiary/fave', auth, async(req, res)=>{
  try {
    const user = await User.findById(req.user.id)
    if(!user){
      return res.status(404).json({msg:"User does not exist"})
    }
    const ben = user.beneficiary.filter(b => b.favorite === true)
    res.json(ben)
  } catch (err) {
    console.error(err.message)
    res.status(500).send("Server Error")    
  }
})
module.exports = router;
