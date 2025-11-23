// routers/chatRouter.js
const express = require("express");
const { productChat } = require("../controllers/chatController");

const router = express.Router();

router.post("/", productChat);

module.exports = router;