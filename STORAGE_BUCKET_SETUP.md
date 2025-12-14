# Supabase Storage Bucket Configuration

## Issue: Images returning 400 errors

If images are uploaded successfully but return 400 errors when accessed, the storage bucket may not be configured correctly.

## Solution: Ensure the "Generations" bucket is public

### Steps:

1. Go to your Supabase Dashboard
2. Navigate to **Storage** → **Buckets**
3. Find the bucket named **"Generations"**
4. Click on it to open settings
5. Ensure **"Public bucket"** is enabled/toggled ON
6. Save changes

### Verify bucket is public:

The bucket should have these settings:
- **Public bucket**: ✅ Enabled
- **File size limit**: Set appropriately (e.g., 10MB or higher)
- **Allowed MIME types**: `image/png`, `image/jpeg`, `image/webp` (or leave empty for all)

### Alternative: Use RLS Policies

If you prefer not to make the bucket fully public, you can use Row Level Security (RLS) policies:

```sql
-- Allow public read access to Generations bucket
CREATE POLICY "Public Access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'Generations');
```

### Testing:

After configuring, test by:
1. Uploading a test image
2. Copying the public URL from the upload response
3. Opening the URL directly in a browser (should display the image)
4. If you get a 400 error, the bucket is not properly configured

## Common Issues:

1. **400 Bad Request**: Bucket not public or RLS policy missing
2. **403 Forbidden**: Bucket exists but access is restricted
3. **404 Not Found**: File doesn't exist (check filename/path)
4. **CORS errors**: Usually not an issue with Supabase public buckets

## Current Configuration:

- **Bucket Name**: `Generations`
- **Files**: `{imageId}-hd.png` and `{imageId}-preview.png`
- **Expected Behavior**: Public URLs should be accessible immediately after upload
