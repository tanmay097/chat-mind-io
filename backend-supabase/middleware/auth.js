const { supabaseAdmin } = require("../config/supabase");
const jwt = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to access this route, token missing",
      });
    }

    let userId = null;

    // First attempt to decode as Supabase JWT
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (user && !error) {
        userId = user.id;
      }
    } catch (e) {
      // Fallback to custom JWT verification if JWT_SECRET is configured
    }

    if (!userId && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id || decoded._id;
      } catch (err) {
        // Token invalid
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, invalid token",
      });
    }

    // Fetch user profile from Supabase
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({
        success: false,
        message: "User profile not found in database",
      });
    }

    req.user = {
      _id: profile.id,
      id: profile.id,
      name: profile.name,
      email: profile.email,
      pic: profile.pic,
      isAdmin: profile.is_admin,
    };

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Authentication server error: " + err.message,
    });
  }
};

module.exports = authMiddleware;
