-- Change the DB default for defaultEmoji from static '🦊' to a random pick,
-- so any code path that inserts a User without explicitly setting defaultEmoji
-- still gets a varied emoji.
ALTER TABLE "User" ALTER COLUMN "defaultEmoji"
  SET DEFAULT (
    ARRAY['🦊','🐼','🧙','🦄','🐬','🦁','🐙','🐢','🦝','🐻',
          '🐺','🐲','🦈','🐸','🦇','🐿️','🐨','🐯','🦦',
          '🦥','🦔','🐵','🦋','🐱']
  )[1 + floor(random() * 24)::int];

-- Fix existing users who still have the old static default
UPDATE "User" SET "defaultEmoji" = (
  ARRAY['🦊','🐼','🧙','🦄','🐬','🦁','🐙','🐢','🦝','🐻',
        '🐺','🐲','🦈','🐸','🦇','🐿️','🐨','🐯','🦦',
        '🦥','🦔','🐵','🦋','🐱']
)[1 + abs(hashtext(id)) % 24]
WHERE "defaultEmoji" = '🦊';
