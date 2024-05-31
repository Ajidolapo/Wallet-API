const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
 name:{
  type:String,
  required: true
 },
 email:{
  type: String,
  required: true
 },
 dob:{
  type: Date,
  required: true
 },
 username:{
  type: String,
  required: true
 },
 password:{
  type: String,
  required: true
 },
 date:{
  type: Date,
  default: Date.now
 },
 beneficiary:[{
  name:{
   type: String
  },
  account_number:{
   type: String
  },
  bank:{
   type: String
  }
 }]
})

module.exports = User = mongoose.model('user', UserSchema)