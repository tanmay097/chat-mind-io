const express = require("express");
const {
  getCreateChatController,
  getAllChats,
  createGroupChat,
  renameGroup,
  addToGroup,
  removeFromGroup,
} = require("../controllers/chatController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.route("/").post(authMiddleware, getCreateChatController).get(authMiddleware, getAllChats);
router.route("/group").post(authMiddleware, createGroupChat);
router.route("/rename").put(authMiddleware, renameGroup);
router.route("/groupadd").put(authMiddleware, addToGroup);
router.route("/groupremove").put(authMiddleware, removeFromGroup);

module.exports = router;
