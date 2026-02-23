-- Feedback table: stores user-submitted feedback with session metadata.
-- RLS allows users to insert their own rows only.
-- No SELECT policy via RLS — admin reads directly via Supabase dashboard (service role).

CREATE TABLE "Feedback" (
  "id"          text        NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"      text        NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "message"     text        NOT NULL,
  "metadata"    jsonb       NOT NULL DEFAULT '{}',
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Feedback_message_not_empty" CHECK (char_length(trim("message")) > 0)
);

ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own feedback rows.
CREATE POLICY "feedback_insert_own"
  ON "Feedback"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = "userId");
