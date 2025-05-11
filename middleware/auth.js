const jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  const token = req.header("x-auth-token");

  if (!token) {
    return res.status(401).json({ msg: "no token, authorization denied" });
  }
  try {
    const decoded = jwt.verify(token, process.env.JwtSecret);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Token not valid" });
    console.error(err.message);
  }
};
