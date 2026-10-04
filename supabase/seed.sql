-- Sample Seed Data for ChatMind Supabase Setup
-- Insert demo users if needed for testing

INSERT INTO public.profiles (id, name, email, pic, is_admin)
VALUES 
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Demo User 1', 'demo1@chatmind.io', 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg', false),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Demo User 2', 'demo2@chatmind.io', 'https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg', false)
ON CONFLICT (email) DO NOTHING;
