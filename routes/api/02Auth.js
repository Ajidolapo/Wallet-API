const passport = require("passport")
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const AppleStrategy = require("passport-apple").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../../models/Users");
const config = require("config")

passport.use(new GoogleStrategy({
 clientID: config.get('CLIENT_ID'),
 clientSecret: config.get("CLIENT_SECRET"),
 callbackURL: 'http://localhost:5000/api/users/google/callback'
},
async(accessToken, refreshToken, profile, done)=>{
 try {
  let user = await User.findOne({email:profile.emails[0].value})
  if(!user){
   user = new User({
    name:profile.displayName,
    email: profile.emails[0].value,
    username: profile.emails[0].value.split('@')[0],
    password:'',
    dob:''
   })
   await user.save()
  }
  return done(null, user)
 } catch (err) {
  return done(null, false)
 }
}))

passport.serializeUser((user, done)=>{
 done(null, user.id)
})

passport.deserializeUser(async (id, done)=>{
 try {
  const user = await User.findById(id)
 } catch (err) {
  done(err,false)
 }
})

const generateToken = (user) => {
 return jwt.sign({ user: { id: user.id } }, config.get("JwtSecret"), {expiresIn:'360000000'});
}

module.exports = {passport, generateToken}