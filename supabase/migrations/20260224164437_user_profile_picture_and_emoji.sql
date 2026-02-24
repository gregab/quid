-- Add profile picture (manually set by user) and default emoji columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profilePictureUrl" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultEmoji" text NOT NULL DEFAULT '🦊';

-- Backfill existing users with varied emojis based on id hash
UPDATE "User" SET "defaultEmoji" = (
  ARRAY['🦊','🐼','🧙','🦄','🐬','🦁','🐙','🐢','🦝','🐻',
        '🐺','🐲','🦈','🐸','🦇','🐿️','🐨','🐯','🦦',
        '🦥','🦔','🐵','🦋','🐱']
)[1 + abs(hashtext(id)) % 24];

-- Storage bucket for user profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-profiles',
  'user-profiles',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can only manage their own folder ({userId}/profile.jpg)
CREATE POLICY "Users can upload own profile picture"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-profiles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own profile picture"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-profiles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own profile picture"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-profiles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can read profile pictures"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'user-profiles');
