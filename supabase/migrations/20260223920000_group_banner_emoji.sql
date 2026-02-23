-- Migration: Add emoji and bannerUrl columns to Group table,
-- UPDATE RLS policy, and group-banners storage bucket

--------------------------------------------------------------------------------
-- 1. Add columns to Group table
--------------------------------------------------------------------------------

ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "emoji" text;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "bannerUrl" text;

--------------------------------------------------------------------------------
-- 2. RLS policy: members can update their group's settings
--------------------------------------------------------------------------------

CREATE POLICY "Members can update their groups"
  ON "Group" FOR UPDATE
  TO authenticated
  USING (is_group_member(id))
  WITH CHECK (is_group_member(id));

--------------------------------------------------------------------------------
-- 3. Storage bucket: group-banners
--------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-banners',
  'group-banners',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

--------------------------------------------------------------------------------
-- 4. Storage RLS policies
--------------------------------------------------------------------------------

-- Members can upload/update banner for their group
CREATE POLICY "Members can upload group banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-banners'
    AND is_group_member((storage.foldername(name))[1])
  );

CREATE POLICY "Members can update group banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'group-banners'
    AND is_group_member((storage.foldername(name))[1])
  );

CREATE POLICY "Members can delete group banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-banners'
    AND is_group_member((storage.foldername(name))[1])
  );

-- Public read (bucket is public, but explicit policy for belt-and-suspenders)
CREATE POLICY "Anyone can read group banners"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'group-banners');
