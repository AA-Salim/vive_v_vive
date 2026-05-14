-- Phase 8: Debt System (allow balance down to -300)

-- Replace positive_balance constraint with -300 floor
ALTER TABLE point_balances DROP CONSTRAINT positive_balance;
ALTER TABLE point_balances ADD CONSTRAINT min_balance CHECK (balance >= -300);

-- Update adjust_balance to allow debt up to -300
CREATE OR REPLACE FUNCTION adjust_balance(
  p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_reference_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE new_balance INTEGER;
BEGIN
  UPDATE point_balances SET balance = balance + p_amount, updated_at = now()
  WHERE user_id = p_user_id RETURNING balance INTO new_balance;
  IF NOT FOUND THEN RAISE EXCEPTION 'User balance not found'; END IF;
  IF new_balance < -300 THEN RAISE EXCEPTION 'Debt limit reached'; END IF;
  INSERT INTO point_transactions (user_id, amount, reason, reference_id)
  VALUES (p_user_id, p_amount, p_reason, p_reference_id);
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
