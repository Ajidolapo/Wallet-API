const express = require('express')
const router = express.Router()
const User = require('../../models/Users')
const auth = require('../../middleware/auth')
const jwt = require('jsonwebtoken')
const {check, validationResult} = require('express-validator')
const config = require('config')
const bcrypt = require('bcryptjs')

//Get Logged in User
router.get('/', auth, async (req, res)=>{
 try {
  const user = await User.findById(req.user.id).select('-password')
  res.json(user)
 } catch (err) {
  console.error(err.message)
  res.status(500).send("Server Error")
  
 }
})

//Login
router.post('/',[
 check('username','Please input Username').not().isEmpty(),
 check('password', 'please input password').exists()
], async (req, res)=>{
 const error = validationResult(req)
 if(!error.isEmpty()){
  return res.status(400).json({errors: error.array()})
 }
 let{username, password} = req.body
 username = username.toLowerCase()
 try {
  let user = await User.findOne({username})
  if(!user){
   res.status(404).json({errors:[{msg:"Username not found"}]})
  }
  const test = await bcrypt.compare(password, user.password);
  if(!test){
   return res.status(400).json({errors:[{msg:"Invalid Credentials"}]})
  }
  const payload = {
   user:{
    id: user.id
   }
  }
  jwt.sign(payload, config.get('JwtSecret'),{
   expiresIn: 3600000
  },
 (err, token)=>{
  if(err) throw err
  res.json({token})
 })
 } catch (err) {
  console.error(err.message)
  res.status(500).send("Server Error")
  
 }
})

module.exports = router