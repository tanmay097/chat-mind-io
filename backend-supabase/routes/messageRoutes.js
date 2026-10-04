const express = require("express");
const {
  sendMessage,
  getAllMessage,
} = require("../controllers/messageController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.route("/").post(authMiddleware, sendMessage);
router.route("/:chatId").get(authMiddleware, getAllMessage);

module.exports = router;
