const { supabaseAdmin } = require("../config/supabase");

// Helper to format chat object with MongoDB-like structure for frontend
const formatChat = async (chatRow) => {
  if (!chatRow) return null;

  // Fetch chat members and their profiles
  const { data: members } = await supabaseAdmin
    .from("chat_members")
    .select(`
      user_id,
      profiles:user_id (id, name, email, pic, is_admin)
    `)
    .eq("chat_id", chatRow.id);

  const users = (members || []).map((m) => ({
    ...m.profiles,
    _id: m.profiles?.id,
  }));

  // Fetch group admin profile if exists
  let groupAdmin = null;
  if (chatRow.group_admin_id) {
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, pic, is_admin")
      .eq("id", chatRow.group_admin_id)
      .maybeSingle();

    if (adminProfile) {
      groupAdmin = { ...adminProfile, _id: adminProfile.id };
    }
  }

  // Fetch latest message if exists
  let latestMessage = null;
  if (chatRow.latest_message_id) {
    const { data: msg } = await supabaseAdmin
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        sender:sender_id (id, name, email, pic)
      `)
      .eq("id", chatRow.latest_message_id)
      .maybeSingle();

    if (msg) {
      latestMessage = {
        _id: msg.id,
        content: msg.content,
        createdAt: msg.created_at,
        sender: msg.sender ? { ...msg.sender, _id: msg.sender.id } : null,
      };
    }
  }

  return {
    _id: chatRow.id,
    id: chatRow.id,
    chatName: chatRow.chat_name,
    isGroupChat: chatRow.is_group_chat,
    users,
    groupAdmin,
    latestMessage,
    createdAt: chatRow.created_at,
    updatedAt: chatRow.updated_at,
  };
};

// @desc    Create or fetch One to One Chat
// @route   POST /api/chat/
// @access  Protected
exports.getCreateChatController = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "UserId param not sent with request" });
    }

    const currentUserId = req.user._id;

    // Find 1-on-1 chats where both current user and requested user are members
    const { data: user1Chats } = await supabaseAdmin
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", currentUserId);

    const user1ChatIds = (user1Chats || []).map((c) => c.chat_id);

    if (user1ChatIds.length > 0) {
      const { data: matchingMembers } = await supabaseAdmin
        .from("chat_members")
        .select("chat_id")
        .eq("user_id", userId)
        .in("chat_id", user1ChatIds);

      const commonChatIds = (matchingMembers || []).map((c) => c.chat_id);

      if (commonChatIds.length > 0) {
        // Check if any of these common chats is NOT a group chat
        const { data: existingChats } = await supabaseAdmin
          .from("chats")
          .select("*")
          .in("id", commonChatIds)
          .eq("is_group_chat", false)
          .limit(1);

        if (existingChats && existingChats.length > 0) {
          const fullChat = await formatChat(existingChats[0]);
          return res.status(200).json(fullChat);
        }
      }
    }

    // Chat doesn't exist, create a new 1-on-1 chat
    const { data: newChat, error: chatErr } = await supabaseAdmin
      .from("chats")
      .insert({
        chat_name: "sender",
        is_group_chat: false,
      })
      .select()
      .single();

    if (chatErr || !newChat) {
      return res.status(500).json({ message: chatErr?.message || "Failed to create chat" });
    }

    // Add both members
    await supabaseAdmin.from("chat_members").insert([
      { chat_id: newChat.id, user_id: currentUserId, joined_at: new Date().toISOString() },
      { chat_id: newChat.id, user_id: userId, joined_at: new Date().toISOString() },
    ]);

    const fullChat = await formatChat(newChat);
    return res.status(200).json(fullChat);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch all chats for logged-in user
// @route   GET /api/chat/
// @access  Protected
exports.getAllChats = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get all chat IDs for user
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from("chat_members")
      .select("chat_id")
      .eq("user_id", currentUserId);

    if (memErr) {
      return res.status(500).json({ message: memErr.message });
    }

    const chatIds = (memberships || []).map((m) => m.chat_id);

    if (chatIds.length === 0) {
      return res.status(200).json([]);
    }

    const { data: chatRows, error: chatsErr } = await supabaseAdmin
      .from("chats")
      .select("*")
      .in("id", chatIds)
      .order("updated_at", { ascending: false });

    if (chatsErr) {
      return res.status(500).json({ message: chatsErr.message });
    }

    const formattedChats = await Promise.all(
      (chatRows || []).map((c) => formatChat(c))
    );

    return res.status(200).json(formattedChats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create New Group Chat
// @route   POST /api/chat/group
// @access  Protected
exports.createGroupChat = async (req, res) => {
  try {
    if (!req.body.users || !req.body.name) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    let users = typeof req.body.users === "string" ? JSON.parse(req.body.users) : req.body.users;

    if (users.length < 2) {
      return res.status(400).json({ message: "More than 2 users are required to form a group chat" });
    }

    const currentUserId = req.user._id;

    // Create chat record
    const { data: groupChat, error: groupErr } = await supabaseAdmin
      .from("chats")
      .insert({
        chat_name: req.body.name,
        is_group_chat: true,
        group_admin_id: currentUserId,
      })
      .select()
      .single();

    if (groupErr || !groupChat) {
      return res.status(500).json({ message: groupErr?.message || "Failed to create group" });
    }

    // Build member list including admin
    const memberUserIds = new Set([
      currentUserId,
      ...users.map((u) => (typeof u === "object" ? u._id || u.id : u)),
    ]);

    const memberInserts = Array.from(memberUserIds).map((uid) => ({
      chat_id: groupChat.id,
      user_id: uid,
      joined_at: new Date().toISOString(),
    }));

    await supabaseAdmin.from("chat_members").insert(memberInserts);

    const fullGroupChat = await formatChat(groupChat);
    return res.status(200).json(fullGroupChat);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Rename Group Chat
// @route   PUT /api/chat/rename
// @access  Protected
exports.renameGroup = async (req, res) => {
  try {
    const { chatId, chatName } = req.body;

    if (!chatId || !chatName) {
      return res.status(400).json({ message: "ChatId and chatName are required" });
    }

    const { data: updatedChat, error } = await supabaseAdmin
      .from("chats")
      .update({ chat_name: chatName, updated_at: new Date().toISOString() })
      .eq("id", chatId)
      .select()
      .single();

    if (error || !updatedChat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const fullChat = await formatChat(updatedChat);
    return res.status(200).json(fullChat);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add User to Group
// @route   PUT /api/chat/groupadd
// @access  Protected
exports.addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    // Check if already in group
    const { data: existing } = await supabaseAdmin
      .from("chat_members")
      .select("*")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: "User already in group" });
    }

    // Add user
    await supabaseAdmin.from("chat_members").insert({
      chat_id: chatId,
      user_id: userId,
      joined_at: new Date().toISOString(),
    });

    const { data: chatRow } = await supabaseAdmin
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .single();

    const fullChat = await formatChat(chatRow);
    return res.status(200).json(fullChat);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Remove User from Group / Leave Group
// @route   PUT /api/chat/groupremove
// @access  Protected
exports.removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;

    if (!chatId || !userId) {
      return res.status(400).json({ message: "Please fill all fields" });
    }

    await supabaseAdmin
      .from("chat_members")
      .delete()
      .eq("chat_id", chatId)
      .eq("user_id", userId);

    const { data: chatRow } = await supabaseAdmin
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .single();

    const fullChat = await formatChat(chatRow);
    return res.status(200).json(fullChat);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
