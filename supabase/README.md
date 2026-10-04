# 🗄️ ChatMind - Supabase Backend Setup Guide

This directory contains the database schema, security policies, triggers, and configuration for running ChatMind entirely on **Supabase (PostgreSQL + Realtime + Auth + Storage)**.

---

## ⚡ 1-Minute Quick Setup

### Step 1: Create a Supabase Project
1. Go to [database.new](https://database.new) (Supabase Dashboard).
2. Sign in and create a new project (e.g. `chatmind`).
3. Choose a secure database password and region.

---

### Step 2: Run the SQL Schema Migration
1. In your Supabase project dashboard, open the **SQL Editor** tab from the left sidebar.
2. Click **New query**.
3. Copy the entire content of [`supabase/schema.sql`](./schema.sql) and paste it into the editor.
4. Click **Run** (or `Ctrl/Cmd + Enter`).

This script will automatically set up:
- ✅ `public.profiles` table with automatic user creation trigger on Supabase Auth signup.
- ✅ `public.chats` table (supporting 1-on-1 and group chats).
- ✅ `public.chat_members` table for managing chat participants.
- ✅ `public.messages` table with real-time sync.
- ✅ Row Level Security (RLS) policies for user data protection.
- ✅ Auto-updating `updated_at` timestamps on new messages.
- ✅ Realtime publication enabled for messages, chats, and chat members.
- ✅ Storage bucket `avatars` for user profile photos with public read policy.

---

### Step 3: Get Your API Keys
1. In your Supabase Dashboard, navigate to **Project Settings** (gear icon) -> **API**.
2. Copy the following keys:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **anon / public key**: `eyJhbGciOiJIUzI1...`
   - **service_role key**: `eyJhbGciOiJIUzI1...` (Keep this secret!)

---

### Step 4: Configure Local `.env`
In your project root directory, create `.env` (or copy `.env.example`):

```bash
PORT=5000
NODE_ENV=development
JWT_SECRET=your_custom_jwt_secret_key_here
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

And in `frontend/.env`:
```bash
REACT_APP_SUPABASE_URL=https://<your-project-ref>.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

### Step 5: Start the App!

```bash
# In the project root (Start Supabase Backend):
npm run start:supabase

# In another terminal tab (Start Frontend):
cd frontend && npm start
```

---

## 🏗️ Database Architecture Diagram

```
+-------------------------------------------------------------+
|                        auth.users                           |
+-------------------------------------------------------------+
                               | (1-to-1 sync trigger)
                               v
+-------------------------------------------------------------+
|                      public.profiles                        |
| - id (UUID, PK)                                             |
| - auth_user_id (UUID, FK -> auth.users)                     |
| - name, email, pic, is_admin                                |
+-------------------------------------------------------------+
         |                                           |
         | (1-to-many)                               | (1-to-many)
         v                                           v
+------------------+                       +------------------+
|   chat_members   |                       |     messages     |
| - chat_id (FK)   | <----+                | - chat_id (FK)   |
| - user_id (FK)   |      |                | - sender_id (FK) |
+------------------+      |                | - content        |
                          |                +------------------+
                          |                          ^
                          | (many-to-1)              | (many-to-1)
                          v                          |
+----------------------------------------------------+--------+
|                        public.chats                         |
| - id (UUID, PK)                                             |
| - chat_name (TEXT)                                          |
| - is_group_chat (BOOLEAN)                                   |
| - group_admin_id (UUID, FK -> profiles)                     |
| - latest_message_id (UUID, FK -> messages)                  |
| - updated_at                                                |
+-------------------------------------------------------------+
```
