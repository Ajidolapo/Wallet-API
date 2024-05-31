const mongoose = require('mongoose')

const WalletSchema = new mongoose.Schema({
 user:{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'user'
 },
 balance:{
  type: Number,
  default: 0
 },
 pin:{
  type: String,
  required: true
 },
 transactions:[{
  amount:{
   type: Number,
  },
  t_type:{
   type: String
  },
  ben_number:{
   type: Number
  },
  description:{
   type: String
  },
  date:{
   type: Date,
   default: Date.now()
  }
 }]
})

module.exports = Wallet = mongoose.model("wallet", WalletSchema)