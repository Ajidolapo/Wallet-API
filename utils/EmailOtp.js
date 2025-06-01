const nodemailer = require("nodemailer")
const Otp = require("../models/Otp")
const resend = require('resend')
const Resend = new resend.Resend(process.env.RESEND_API_KEY)

const sendEmailOtp = async (email, userId) =>{
 const otp = Math.floor(100000 + Math.random()*900000).toString()
 const expiry = new Date(Date.now() + 5 *60*1000)

 await Otp.findOneAndUpdate({
  user: userId
 }, {
  otp, expiresAt: expiry
 },
{
 upsert: true, new: true
})

// const transporter = nodemailer.createTransport({
//  service:"Gmail",
//  auth:{
//   user: process.env.EMAIL,
//   pass: process.env.PASS
//  }
// })

// const mailOptions = {
//  from: process.env.EMAIL,
//  to: email,
//  subject: "Your OTP for Login",
//  text: `Your OTP is ${otp}. It will expire in 5 minutes`
// }
// await transporter.sendMail(mailOptions)
await Resend.emails.send({
  from: "OTPnoreply <olakay739@gmail.com>",
  to: email,
  subject: "Your OTP for login",
  text: `Your OTP is ${otp}. It will expire in 5 minutes`,
});
}

const verifyOtp = async(userId, otp) => {
 const record = await Otp.findOne({user:userId})
 if (!record || record.otp !== otp) return false
 const isExpired = new Date() > record.expiresAt
 if(isExpired) return false

 await Otp.deleteOne({user: userId})
 return true
}

module.exports = {
 sendEmailOtp,
 verifyOtp
}