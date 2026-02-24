
-- 1. Fix chat_history: remove public read, add admin-only read
DROP POLICY IF EXISTS "Chat history is publicly readable" ON chat_history;
CREATE POLICY "Admins can view all chat history"
ON chat_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix discord_users: remove public read, add admin-only read
DROP POLICY IF EXISTS "Discord users are publicly readable" ON discord_users;
CREATE POLICY "Admins can view discord users"
ON discord_users FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix coupons: remove public read, add admin-only read
DROP POLICY IF EXISTS "Coupons are publicly readable" ON coupons;
CREATE POLICY "Admins can view coupons"
ON coupons FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
