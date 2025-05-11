const express = require("express");
const app = express();
const PORT = 5000;
const connectDB = require("./config/db");
const users = require("./routes/api/users");
const wallet = require("./routes/api/wallet");
const auth = require("./routes/api/auth");
require("dotenv").config()

connectDB();
app.use(express.json({ extended: false }));
app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/api/users", users);
app.use("/api/wallet", wallet);
app.use("/api/auth", auth);

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`);
});

module.exports=app

