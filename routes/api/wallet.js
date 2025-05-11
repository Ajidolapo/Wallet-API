const express = require("express");
const router = express.Router();
const Wallet = require("../../models/Wallet");
const User = require("../../models/Users")
const auth = require("../../middleware/auth");
const { check, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const config = require("config");
const Flutterwave = require('flutterwave-node-v3')



//Create wallet for USer
router.post(
  "/",
  [
    auth,
    [
      check("pin", "You are required to set a four-digit transaction Pin")
        .isNumeric()
        .isLength({ min: 4, max: 4 }),
    ],
  ],
  async (req, res) => {
    const error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    const { pin } = req.body;
    try {
      let wallet = await Wallet.findOne({ user: req.user.id });
      if (wallet) {
        // wallet = await Wallet.findOneAndUpdate(
        //   { user: req.user.id },
        //   { $set: pin },
        //   { new: true }
        // );

        // return res.json(wallet);
        res
          .status(400)
          .json({ errors: [{ msg: "You already have an active wallet" }] });
      }
      wallet = new Wallet({
        user: req.user.id,
      });
      const salt = await bcrypt.genSalt(10);

      wallet.pin = await bcrypt.hash(String(pin), salt);
      await wallet.save();
      return res.json(wallet);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

//Get user wallet
router.get("/", auth, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user.id }).populate(
      "user",
      ["username"]
    );
    if (!wallet) {
      return res.status(404).json({ msg: "Wallet not availabe" });
    }
    res.json(wallet);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("server error");
  }
});

//Deposit into wallet
router.post(
  "/deposit",
  [auth, [check("amount", "Enter a valid amount").isNumeric()]],
  async (req, res) => {
    const error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    try {
      const { amount } = req.body;
      const wallet = await Wallet.findOne({ user: req.user.id });
      if (!wallet) {
        return res.status(404).json({ msg: "Wallet does not exist" });
      }
      wallet.balance += amount;

      const newTransaction = {
        amount,
        t_type: "Credit",
      };
      wallet.transactions.push(newTransaction);
      wallet.save();
      res.json({
        msg: `${amount} has been deposited into your wallet`,
        newTransaction,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

//Transfer or withdraw from funds
router.post(
  "/transfer",
  [
    auth,
    [
      check("amount", "Please input a valid amount").isNumeric(),
      check("pin", "Enter a valid 4 digit pin")
        .isNumeric()
        .isLength({ min: 4, max: 4 }),
      check("bank", "Please enter beneficiary bank").not().isEmpty(),
      check("acc_num", "Please enter valid beneficiary account number")
        .isNumeric()
        .isLength({ min: 10, max: 10 }),
    ],
  ],
  async (req, res) => {
    const error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    try {
      const { amount, acc_num, bank, pin, description } = req.body;
      const wallet = await Wallet.findOne({ user: req.user.id });
      if (!wallet) {
        return res.status(404).json({ msg: "Wallet does not exist" });
      }
      const test = await bcrypt.compare(String(pin), wallet.pin);
      if (!test) {
        return res.status(400).json({ errors: [{ msg: "Incorrect Pin" }] });
      }
      if (amount > wallet.balance) {
        return res.status(400).json({ msg: "Insufficient funds" });
      }
      wallet.balance -= amount;
      const newTransaction = {
        amount,
        t_type: "Debit",
        ben_number: acc_num,
        description: description,
      };
      wallet.transactions.push(newTransaction);
      wallet.save();
      res.json({
        msg: `You have successfully sent N${amount}`,
        newTransaction,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

//Get transaction history
router.get('/history', auth, async(req, res)=>{
  try {
    const wallet = await Wallet.findOne({ user: req.user.id }).select("transactions")
    if (!wallet) {
      return res.status(404).json({ msg: "Wallet not availabe" });
    }
    res.json(wallet);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("server error");
  }
})

//Transfer to a member of beneficiary
router.post(
  "/transfer/:ben_id",
  [
    auth,
    [
      check("amount", "Please input a valid amount").isNumeric(),
      check("pin", "Enter a valid 4 digit pin")
        .isNumeric()
        .isLength({ min: 4, max: 4 }),
    ],
  ],
  async (req, res) => {
    const error = validationResult(req);
    if (!error.isEmpty()) {
      return res.status(400).json({ errors: error.array() });
    }
    try {
      const user = await User.findById(req.user.id)
      const ben = user.beneficiary.id(req.params.ben_id)
      if(!ben){
        return res.status(404).json({msg:"Invalid Beneficiary"})
      }
      const bank = ben.bank
      const acc_num = ben.account_number
      const { amount, pin, description } = req.body;
      const wallet = await Wallet.findOne({ user: req.user.id });
      if (!wallet) {
        return res.status(404).json({ msg: "Wallet does not exist" });
      }
      const test = await bcrypt.compare(String(pin), wallet.pin);
      if (!test) {
        return res.status(400).json({ errors: [{ msg: "Incorrect Pin" }] });
      }
      if (amount > wallet.balance) {
        return res.status(400).json({ msg: "Insufficient funds" });
      }
      wallet.balance -= amount;
      const newTransaction = {
        amount,
        t_type: "Debit",
        ben_number: acc_num,
        description: description,
      };
      wallet.transactions.push(newTransaction);
      wallet.save();
      res.json({
        msg: `You have successfully sent N${amount}`,
        newTransaction,
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

//Request for money
module.exports = router;

