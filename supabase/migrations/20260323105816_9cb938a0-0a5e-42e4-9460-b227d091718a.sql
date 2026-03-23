INSERT INTO chat_history (session_id, role, content, source)
SELECT session_id, 'assistant', 'Sorry for the delay! We''re currently transitioning our support system. For faster assistance, please email us directly at **support@propscholar.com** — our team will get back to you within 4 hours. Thank you for your patience! 🙏', 'agent'
FROM support_tickets
WHERE status IN ('open', 'in_progress')
AND session_id IS NOT NULL
AND session_id != '';

UPDATE support_tickets SET status = 'resolved', updated_at = now() WHERE status IN ('open', 'in_progress');