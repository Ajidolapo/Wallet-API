const QRCode = require("qrcode")

async function triggerQR(userId){
 const otp = Math.floor(100000 + Math.random() * 900000).toString();
 const expiry = new Date(Date.now() + 5 * 60 * 1000);

 await Otp.findOneAndUpdate(
   {
     user: userId,
   },
   {
     otp,
     expiresAt: expiry,
   },
   {
     upsert: true,
     new: true,
   }
 );

 const qrData = await QRCode.toDataURL(otp)
 return qrData
}

module.exports = triggerQR

