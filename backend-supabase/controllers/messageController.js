const { supabaseAdmin } = require("../config/supabase");

// Helper to format message with nested sender and chat
const formatMessage = async (msgRow) => {
  if (!msgRow) return null;

  // Fetch sender profile
  const { data: senderProfile } = await supabaseAdmin
    .from("profiles")
    .select("id, name, pic, email")
    .eq("id", msgRow.sender_id)
    .maybeSingle();

  // Fetch chat info and members
  const { data: chatRow } = await supabaseAdmin
    .from("chats")
    .select("*")
    .eq("id", msgRow.chat_id)
    .maybeSingle();

  let chat = null;
  if (chatRow) {
    const { data: members } = await supabaseAdmin
      .from("chat_members")
      .select(`
        user_id,
        profiles:user_id (id, name, email, pic)
      `)
      .eq("chat_id", chatRow.id);

    const users = (members || []).map((m) => ({
      ...m.profiles,
      _id: m.profiles?.id,
    }));

    chat = {
      _id: chatRow.id,
      id: chatRow.id,
      chatName: chatRow.chat_name,
      isGroupChat: chatRow.is_group_chat,
      users,
    };
  }

  return {
    _id: msgRow.id,
    id: msgRow.id,
    content: msgRow.content,
    sender: senderProfile ? { ...senderProfile, _id: senderProfile.id } : null,
    chat,
    createdAt: msgRow.created_at,
    updatedAt: msgRow.updated_at,
  };
};

// @desc    Get all messages for a chat
// @route   GET /api/message/:chatId
// @access  Protected
exports.getAllMessage = async (req, res) => {
  try {
    const { chatId } = req.params;

    if (!chatId) {
      return res.status(400).json({ message: "Chat id is required" });
    }

    const { data: messageRows, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ message: error.message });
    }

    const formattedMessages = await Promise.all(
      (messageRows || []).map((m) => formatMessage(m))
    );

    return res.status(200).json(formattedMessages);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Send a new message
// @route   POST /api/message/
// @access  Protected
exports.sendMessage = async (req, res) => {
  try {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
      return res.status(400).json({ message: "Invalid data passed into request" });
    }

    const senderId = req.user._id;

    // Insert message into database
    const { data: newMsg, error: insertErr } = await supabaseAdmin
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: senderId,
        content: content.trim(),
      })
      .select()
      .single();

    if (insertErr || !newMsg) {
      return res.status(500).json({ message: insertErr?.message || "Failed to create message" });
    }

    // Update chat latest message and updated_at
    await supabaseAdmin
      .from("chats")
      .update({
        latest_message_id: newMsg.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", chatId);

    const formattedMessage = await formatMessage(newMsg);
    return res.status(200).json(formattedMessage);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
