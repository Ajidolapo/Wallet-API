const mongoose = require("mongoose")

const OtpSchema = new mongoose.Schema({
 user:{
  type: mongoose.Schema.Types.ObjectId,
  ref: "user"
 },
 otp: String,
 expiresAt: {
  type: Date
 }
})

module.exports = Otp = mongoose.model("otp", OtpSchema)