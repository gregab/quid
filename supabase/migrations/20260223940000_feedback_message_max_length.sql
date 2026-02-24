-- Add max-length constraint on Feedback.message to match the API-layer limit.
ALTER TABLE "Feedback"
  ADD CONSTRAINT "Feedback_message_max_length" CHECK (char_length("message") <= 5000);
