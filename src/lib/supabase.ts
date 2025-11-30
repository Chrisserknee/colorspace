import { createClient } from "@supabase/supabase-js";

// Create Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket names
export const STORAGE_BUCKET = "pet-portraits";
export const UPLOADS_BUCKET = "pet-uploads";

// Helper to upload image to Supabase Storage
export async function uploadImage(
  buffer: Buffer,
  fileName: string,
  contentType: string = "image/png"
): Promise<string> {
  console.log(`📦 Uploading to Supabase Storage bucket "${STORAGE_BUCKET}": ${fileName} (${(buffer.length / 1024).toFixed(2)} KB)`);
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error(`❌ Upload failed for ${fileName}:`, error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  console.log(`✅ Successfully uploaded to ${STORAGE_BUCKET} bucket: ${fileName}`);
  return urlData.publicUrl;
}

// Helper to upload original pet photo to pet-uploads bucket
export async function uploadPetPhoto(
  buffer: Buffer,
  fileName: string,
  contentType: string = "image/png"
): Promise<string> {
  console.log(`📷 Uploading original pet photo to "${UPLOADS_BUCKET}": ${fileName} (${(buffer.length / 1024).toFixed(2)} KB)`);
  
  const { data, error } = await supabase.storage
    .from(UPLOADS_BUCKET)
    .upload(fileName, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error(`❌ Pet photo upload failed for ${fileName}:`, error);
    // Don't throw - this is a non-critical operation
    return "";
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(UPLOADS_BUCKET)
    .getPublicUrl(fileName);

  console.log(`✅ Successfully uploaded pet photo to ${UPLOADS_BUCKET} bucket: ${fileName}`);
  return urlData.publicUrl;
}

// Helper to get public URL for an image
export function getImageUrl(fileName: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

// Helper to save metadata to Supabase database
export async function saveMetadata(imageId: string, metadata: Record<string, unknown>) {
  const { error } = await supabase
    .from("portraits")
    .upsert({
      id: imageId,
      ...metadata,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Failed to save metadata:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.details);
    console.error("Error hint:", error.hint);
    console.error("Full error:", JSON.stringify(error, null, 2));
    console.error("ImageId:", imageId);
    console.error("Metadata keys:", Object.keys(metadata));
    console.error("pet_description length:", (metadata.pet_description as string)?.length);
    console.error("pet_description preview:", (metadata.pet_description as string)?.substring(0, 100));
    
    // Extract the most useful error message
    const errorMessage = error.message || error.details || error.hint || JSON.stringify(error);
    throw new Error(`Failed to save metadata: ${errorMessage}`);
  }
}

// Helper to get metadata from Supabase database
export async function getMetadata(imageId: string) {
  const { data, error } = await supabase
    .from("portraits")
    .select("*")
    .eq("id", imageId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

// Helper to save email to emails table
export async function saveEmail(email: string, imageId?: string, source: string = "checkout") {
  const { error } = await supabase
    .from("emails")
    .upsert({
      email: email.toLowerCase().trim(),
      image_id: imageId || null,
      source,
      created_at: new Date().toISOString(),
    }, {
      onConflict: "email",
    });

  if (error) {
    console.error("Failed to save email:", error);
    return false;
  }
  return true;
}

// Helper to save contact form submission
export async function saveContact(data: {
  name: string;
  email: string;
  message: string;
  ip_address?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // First, try to insert into contacts table
    const { error } = await supabase
      .from("contacts")
      .insert({
        name: data.name,
        email: data.email,
        message: data.message,
        ip_address: data.ip_address || null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      // If contacts table doesn't exist, fall back to emails table with metadata
      if (error.code === "42P01" || error.message.includes("does not exist")) {
        console.warn("Contacts table not found, saving to emails table as fallback");
        
        // Save to emails table with contact info in source
        const { error: emailError } = await supabase
          .from("emails")
          .insert({
            email: data.email.toLowerCase().trim(),
            image_id: null,
            source: `contact: ${data.name} - ${data.message.substring(0, 100)}`,
            created_at: new Date().toISOString(),
          });

        if (emailError) {
          console.error("Failed to save contact to emails fallback:", emailError);
          return { success: false, error: emailError.message };
        }
        
        return { success: true };
      }
      
      console.error("Failed to save contact:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Contact save error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// Helper to get all emails (for export)
export async function getAllEmails() {
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to get emails:", error);
    return [];
  }

  return data;
}

// Server-side generation limit check
// This provides a backup to client-side limits and prevents bypass
export async function checkServerGenerationLimit(
  ipAddress: string,
  maxFreeGenerations: number = 2,
  resetHours: number = 24
): Promise<{ allowed: boolean; currentCount: number; remaining: number; resetAt: Date | null }> {
  try {
    const { data, error } = await supabase.rpc("check_generation_limit", {
      p_ip_address: ipAddress,
      p_max_free_generations: maxFreeGenerations,
      p_reset_hours: resetHours,
    });

    if (error) {
      // If the function doesn't exist, allow the request but log warning
      console.warn("Server-side limit check failed (function may not exist):", error.message);
      return { allowed: true, currentCount: 0, remaining: maxFreeGenerations, resetAt: null };
    }

    if (data && data.length > 0) {
      const result = data[0];
      return {
        allowed: result.allowed,
        currentCount: result.current_count,
        remaining: result.remaining,
        resetAt: result.reset_at ? new Date(result.reset_at) : null,
      };
    }

    return { allowed: true, currentCount: 0, remaining: maxFreeGenerations, resetAt: null };
  } catch (err) {
    console.error("Server generation limit check error:", err);
    // Fail open to not block legitimate users
    return { allowed: true, currentCount: 0, remaining: maxFreeGenerations, resetAt: null };
  }
}

// Helper to check if an IP has made a purchase (for server-side verification)
export async function hasIPMadePurchase(ipAddress: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from("portraits")
      .select("*", { count: "exact", head: true })
      .eq("paid", true)
      .ilike("customer_ip", ipAddress);

    if (error) {
      console.warn("Purchase check failed:", error.message);
      return false;
    }

    return (count || 0) > 0;
  } catch (err) {
    console.error("Purchase check error:", err);
    return false;
  }
}

// Get current portrait count
export async function getPortraitCount(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("stats")
      .select("portraits_created")
      .eq("id", "global")
      .single();

    if (error) {
      console.warn("Failed to get portrait count:", error.message);
      return 335; // Fallback to starting number
    }

    return data?.portraits_created || 335;
  } catch (err) {
    console.error("Portrait count error:", err);
    return 335;
  }
}

// Increment portrait count and return new value
export async function incrementPortraitCount(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("increment_portrait_count");

    if (error) {
      console.warn("Failed to increment portrait count:", error.message);
      // Fallback: try direct update
      const { data: updateData, error: updateError } = await supabase
        .from("stats")
        .update({ 
          portraits_created: supabase.rpc("increment_portrait_count"),
          updated_at: new Date().toISOString() 
        })
        .eq("id", "global")
        .select("portraits_created")
        .single();
      
      if (updateError) {
        console.error("Fallback increment failed:", updateError.message);
        return 335;
      }
      return updateData?.portraits_created || 335;
    }

    return data || 335;
  } catch (err) {
    console.error("Increment portrait count error:", err);
    return 335;
  }
}


