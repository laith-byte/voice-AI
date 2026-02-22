ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS twilio_sid TEXT;
