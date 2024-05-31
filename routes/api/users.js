const express = require("express");
const router = express.Router();
const User = require("../../models/Users");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("config");
const moment = require("moment");
router.post(
  "/",
  [
    check("name", "Name is Required").not().isEmpty(),
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
    const error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    let { name, email, username, dob, password } = req.body;
    username = username.toLowerCase()
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
      user = new User({
        name,
        email,
        dob,
        username,
        password,
      });

      const salt = await bcrypt.genSalt(10);

      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id,
        },
      };
      jwt.sign(
        payload,
        config.get("JwtSecret"),
        {
          expiresIn: 3600000,
        },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

module.exports = router;
