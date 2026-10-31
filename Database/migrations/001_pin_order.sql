-- Only for a database created before drag and drop (no pin_order column yet).
-- A fresh import of chatgpt_clone.sql or schema.sql already has it.
-- mysql -u chat_app -p chatgpt_clone < Database/migrations/001_pin_order.sql
ALTER TABLE conversations
  ADD COLUMN pin_order INT NULL AFTER pinned,
  DROP INDEX idx_conversations_list,
  ADD KEY idx_conversations_list (pinned, pin_order, updated_at);

-- keep the current order of the pinned conversations (most recent first)
SET @n := -1;
UPDATE conversations SET pin_order = (@n := @n + 1) WHERE pinned ORDER BY updated_at DESC;
