-- Increase group-banners bucket file size limit from 2MB to 5MB
-- to accommodate higher-resolution banner images (2400×800 2× retina).

UPDATE storage.buckets
SET file_size_limit = 5242880 -- 5 MB
WHERE id = 'group-banners';
