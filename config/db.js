const mongoose = require("mongoose")
require('dotenv').config()
const URI = process.env.URI
const connectDB = async () => {
 try {
  await mongoose.connect(URI)
  console.log(`DB connected`)
 } catch (err) {
  console.error(err.message)
  process.exit(1)
  
 }
}

module.exports = connectDB