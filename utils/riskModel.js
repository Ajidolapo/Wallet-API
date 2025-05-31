const axios = require("axios")
const moment = require("moment")

async function predictRisk(req){
 const user = req.user
 const current = {
  device: req.headers["user-agent"] || "",
  location: req.location,
  coordinates : req.coordinates,
  time: new Date(),
  is_vpn: req.is_vpn
 }
 const ip = req.connection.remoteAddress
 const lastLogin = user.login_history?.[user.login_history.length - 1]
 if(!lastLogin) return "high"

 const distance = calculateDistance(current.coordinates.lat, current.coordinates.lon, lastLogin.coordinates.lat, lastLogin.coordinates.lon)

 const payload = {
   is_new_device: current.device !== lastLogin.device ? 1 : 0,
   is_new_location: current.location !== lastLogin.location ? 1 : 0,
   hour: moment(current.time).hour(),
   day_of_the_week: moment(current.time).day(),
   distance_km: distance,
   is_vpn: current.is_vpn
 }
//  const payload = {
//    is_new_device: 1,
//    is_new_location: 1,
//    hour: moment(current.time).hour(),
//    day_of_the_week: moment(current.time).day(),
//    distance_km: 100,
//    is_vpn: 1
//  };
 try {
   const res = await axios.post(
     "https://risk-model.onrender.com/predict",
     payload
   );
   const riskNum = res.data.risk;
   console.log(riskNum)

   switch (riskNum) {
     case 0:
       return "low";
     case 1:
       return "medium";
     case 2:
       return "medium(QR)";
      case 3:
        return "high"
     default:
       return "high";
   }
 } catch (err) {
   console.error("Risk prediction API error:", err.message);
   return "high"; // Fallback to safe
 }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = (val) => (val * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = predictRisk