const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  dob: {
    type: Date,
    required: true,
  },
  phone:{
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  account_number:{
    type: String,
    required: true,
  },
  verified : {
    type: Boolean,
    default: false
  },
  beneficiary: [
    {
      name: {
        type: String,
      },
      account_number: {
        type: String,
      },
      bank: {
        type: String,
      },
      favorite:{
        type: Boolean,
        default: false
      }
    },
  ],
});

module.exports = User = mongoose.model("user", UserSchema);
