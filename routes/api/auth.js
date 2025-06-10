const express = require("express");
const router = express.Router();
const User = require("../../models/Users");
const auth = require("../../middleware/auth");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const {sendEmailOtp, verifyOtp} = require("../../utils/EmailOtp")
const predictRisk = require("../../utils/riskModel")
const axios = require("axios")
const triggerQR = require("../../utils/QrCode");
const { generateAuthenticationOptions, generateRegistrationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } = require("@simplewebauthn/server");
const { isoUint8Array } = require("@simplewebauthn/server/helpers");
const base64url = require("base64url")
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

      const ipHeader = req.headers['x-forwarded-for'];
      const ip = ipHeader ? ipHeader.split(',')[0].trim() : req.connection.remoteAddress;
      const device = req.headers['user-agent'] || ""
      let location = "Unknown"
      let coordinates = {
        lat:null,
        lon: null
      }
      let is_vpn = 0
      if(!isLocalhost(ip)){
        const geoRes = await axios.get(
          `https://ipqualityscore.com/api/json/ip/AfDQ2R79QdigkZe6idS7mLTRWz4wrm49/${ip}`
        );
        console.log(geoRes)
        if (geoRes.data.success === true){
          location = `${geoRes.data.city}, ${geoRes.data.region}, ${geoRes.data.country_code}`;
          coordinates.lat = geoRes.data.latitude;
          coordinates.lon = geoRes.data.longitude; 
          if(geoRes.data.vpn === true){
            is_vpn = 1
          }
          is_vpn = 0
        }
      }
      else{location = "Agege, Ogun, NG";
      coordinates = {
        lat: 6.624225,
        lon: 3.326148,
      };
      is_vpn = 0
    }      
      req.user = user;
      req.headers["user-agent"] = device
      req.connection.remoteAddress = ip
      req.location = location
      req.coordinates = coordinates
      req.is_vpn = is_vpn
      
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
          email:user.email
        });
      }
      if(risk==="medium(QR)"){
        const qr = await triggerQR(user.id)
        return res.status(202).json({
          message:
            "Suspicious Login. scan the QR code to verify your identity",
          risk,
          step: "qr_code",
          qr,
          email: user.email
        });
      }
      return res.status(202).json({
        message: "High risk detected. Biometric authentication required.",
        risk,
        step: "biometric",
        userId: user.id
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send("User with email not found");
    }

    const verified = await verifyOtp(user.id, otp);
    if (!verified) {
      return res.status(400).send("Invalid or Expired OTP");
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
        return res.json({ user, token });
      }
    );
  } catch (err) {
    console.error(err);
    return res.status(500).send(err.message);
  }
});



router.post("/biometric/register", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    const options = await generateRegistrationOptions({
      rpName: "Wallet",
      rpID: "wallet-fe-nu.vercel.app", // update to real domain in production
      userID: isoUint8Array.fromUTF8String(userId),
      userName: user.email,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
    });

    user.challenge = options.challenge;
    await user.save();

    res.json({ options });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// --- 2. BIOMETRIC REGISTRATION VERIFICATION ---
router.post("/biometric/register-verify", async (req, res) => {
  try {
    const { userId, credentialResponse } = req.body;
    const user = await User.findById(userId);
    if (!user || !user.challenge) {
      return res.status(400).json({ message: "No challenge found" });
    }
    
    const verification = await verifyRegistrationResponse({
      response: credentialResponse,
      expectedChallenge: user.challenge,
      expectedOrigin: "https://wallet-fe-nu.vercel.app",
      expectedRPID: "wallet-fe-nu.vercel.app",
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false });
    }

    console.log("Registration verification:", verification);

    const credentialID = verification.registrationInfo.credential.id;
    const credentialPublicKey =
      verification.registrationInfo.credential.publicKey;
    const counter = verification.registrationInfo.credential.counter;

    // Convert Uint8Array to Buffer explicitly
    const credentialIDBuffer = Buffer.from(credentialID);
    const credentialPublicKeyBuffer = Buffer.from(credentialPublicKey);

    console.log("Converted types:", {
      credentialID: typeof credentialIDBuffer,
      credentialPublicKey: typeof credentialPublicKeyBuffer,
      isBuffer1: Buffer.isBuffer(credentialIDBuffer),
      isBuffer2: Buffer.isBuffer(credentialPublicKeyBuffer),
    });

    user.credentials.push({
      credentialID: credentialIDBuffer,
      credentialPublicKey: credentialPublicKeyBuffer,
      counter,
    });

    user.challenge = undefined;
    await user.save();
    console.log(user.credentials);
    res.json({ verified: true });
    
  } catch (err) {
    console.error("Registration verification error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/biometric/generate", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(userId);
    const user = await User.findById(userId);
    if (!user || !user.credentials.length) {
      return res
        .status(404)
        .json({ message: "No credentials found", step: "bio-reg" });
    }

    console.log("User has", user.credentials.length, "credentials");

    // Generate options without allowCredentials to avoid formatting issues
    let options
    if(process.env.PROD === "true"){
      options = await generateAuthenticationOptions({
      rpID: "wallet-fe-nu.vercel.app",
      timeout: 60000,
      userVerification: "required",
      authenticatorAttachment:"platform",
      // allowCredentials: user.credentials.map((cred) => ({
      //   id: base64url.encode(cred.credentialID),
      //   type: "public-key"
      // })),
    });

    user.challenge = options.challenge;
    await user.save();
  }
    else{
      options = await generateAuthenticationOptions({
      rpID: "localhost",
      timeout: 60000,
      userVerification: "required",
      authenticatorAttachment: "platform",
      // allowCredentials: user.credentials.map((cred) => ({
      //   id: base64url.encode(cred.credentialID),
      //   type: "public-key"
      // })),
    });

    user.challenge = options.challenge;
    await user.save();}
    console.log("Generated authentication options successfully");
    console.log(options)
    res.json(options);
  } catch (err) {
    console.error("Generate options error:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- 4. AUTHENTICATION VERIFICATION ---
router.post("/biometric/verify", async (req, res) => {
  try {
    const { userId, credentialResponse } = req.body;
    console.log("Credential response:", credentialResponse);
    
    const user = await User.findById(userId);
    if (!user || !user.challenge || !user.credentials.length) {
      return res
        .status(400)
        .json({ message: "Challenge or credentials missing" });
    }

    // Just use the first credential for demo purposes
    const credential = user.credentials[0];
    console.log("Using first credential for demo");

    let verification;
    try {
      if(process.env.PROD==="true"){
        verification = await verifyAuthenticationResponse({
        response: credentialResponse,
        expectedChallenge: user.challenge,
        expectedOrigin: "https://wallet-fe-nu.vercel.app",
        expectedRPID: "wallet-fe-nu.vercel.app",
        credential: {
          // Use the credential data from the response itself
          id: base64url.decode(credentialResponse.id),
          publicKey: credential.credentialPublicKey, // Keep the stored public key
          counter: credential.counter,
        },
      });
    }
      else {
        verification = await verifyAuthenticationResponse({
        response: credentialResponse,
        expectedChallenge: user.challenge,
        expectedOrigin: "http://localhost:3000",
        expectedRPID: "localhost",
        credential: {
          // Use the credential data from the response itself
          id: base64url.decode(credentialResponse.id),
          publicKey: credential.credentialPublicKey, // Keep the stored public key
          counter: credential.counter,
        },
      });}
    } catch (error) {
      console.error("Error verifying authentication response:", error);
      return res.status(400).json({
        message: "Authentication verification failed",
        error: error.message,
      });
    }

    console.log("Verification result:", verification);

    if (verification) {
      credential.counter = verification.authenticationInfo.newCounter;
      user.challenge = undefined;
      await user.save();

      const payload = { user: { id: user.id } };
      jwt.sign(
        payload,
        process.env.JwtSecret,
        { expiresIn: "1h" },
        (err, token) => {
          if (err) throw err;
          res.json({ user, token });
        }
      );
    } else {
      res.status(401).json({ verified: false });
    }
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: err.message });
  }
});






module.exports = router;
