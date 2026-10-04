const express = require("express");
const {
  registerUser,
  loginController,
  allSearchUser,
  loadUser,
  logoutUser,
} = require("../controllers/userController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.route("/").post(registerUser).get(authMiddleware, allSearchUser);
router.route("/login").post(loginController);
router.route("/me").get(authMiddleware, loadUser);
router.route("/logout").get(logoutUser);

module.exports = router;
