const express = require("express");
const connectDB = require("./config/db");
const users = require("./routes/api/users");
const wallet = require("./routes/api/wallet");
const auth = require("./routes/api/auth");
require("dotenv").config();

const app = express();
connectDB();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API running");
});

app.use("/api/users", users);
app.use("/api/wallet", wallet);
app.use("/api/auth", auth);


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-auth-token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  next();
});

module.exports = app;
