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
export async function saveEmail(
  email: string, 
  imageId?: string, 
  source: string = "checkout",
  hasPurchased: boolean = false
) {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Build the upsert data
  const upsertData: {
    email: string;
    image_id: string | null;
    source: string;
    created_at: string;
    has_purchased?: boolean;
    purchased_at?: string;
  } = {
    email: normalizedEmail,
    image_id: imageId || null,
    source,
    created_at: new Date().toISOString(),
  };
  
  // Only set has_purchased if true (don't reset existing purchases)
  if (hasPurchased) {
    upsertData.has_purchased = true;
    upsertData.purchased_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from("emails")
    .upsert(upsertData, {
      onConflict: "email",
    });

  if (error) {
    console.error("Failed to save email:", error);
    return false;
  }
  
  console.log(`📧 Email saved: ${normalizedEmail} (purchased: ${hasPurchased})`);
  return true;
}

// Helper to mark email as purchased in emails table
export async function markEmailAsPurchased(email: string, imageId?: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // First try to update existing record
  const { data: existing } = await supabase
    .from("emails")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  
  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from("emails")
      .update({ 
        has_purchased: true,
        purchased_at: new Date().toISOString(),
        image_id: imageId || undefined,
      })
      .eq("email", normalizedEmail);
    
    if (error) {
      console.error("Error updating email as purchased:", error);
      return false;
    }
  } else {
    // Insert new record with purchased flag
    const { error } = await supabase
      .from("emails")
      .insert({
        email: normalizedEmail,
        image_id: imageId || null,
        source: "purchase",
        has_purchased: true,
        purchased_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error("Error inserting purchased email:", error);
      return false;
    }
  }
  
  console.log(`✅ Email marked as purchased: ${normalizedEmail}`);
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
      console.log("Contacts table error:", error.code, error.message);
      
      // If contacts table doesn't exist, fall back to emails table with metadata
      // Check for various error patterns that indicate missing table
      const isTableMissing = 
        error.code === "42P01" || 
        error.message.includes("does not exist") ||
        error.message.includes("relation") ||
        error.code === "PGRST116";
      
      if (isTableMissing) {
        console.warn("Contacts table not found, saving to emails table as fallback");
      }
      
      // Always try the fallback for any error - save to emails table
      // Use upsert to handle duplicate emails
      const { error: emailError } = await supabase
        .from("emails")
        .upsert({
          email: data.email.toLowerCase().trim(),
          image_id: null,
          source: `contact: ${data.name} - ${data.message.substring(0, 100)}`,
          created_at: new Date().toISOString(),
        }, {
          onConflict: "email",
        });

      if (emailError) {
        console.error("Failed to save contact to emails fallback:", emailError);
        return { success: false, error: emailError.message };
      }
      
      console.log("Contact saved to emails table successfully");
      return { success: true };
    }

    console.log("Contact saved to contacts table successfully");
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
  maxFreeGenerations: number = 3,
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

// ============================================
// LUME LEADS HELPERS (Email Sequence)
// ============================================

export interface LumeLeadContext {
  style?: string;
  petType?: string;
  petName?: string;
  source?: string;
  [key: string]: unknown;
}

export interface LumeLead {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  has_purchased: boolean;
  purchased_at: string | null;
  last_email_step_sent: number;
  context: LumeLeadContext | null;
  source: string;
  unsubscribed: boolean;
  unsubscribed_at: string | null;
}

/**
 * Upsert a lead - creates new or updates existing
 * Does NOT reset has_purchased if already true
 */
export async function upsertLumeLead(
  email: string, 
  context?: LumeLeadContext,
  source: string = 'checkout'
): Promise<{ lead: LumeLead | null; isNew: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // First check if lead exists
    const { data: existingLead, error: selectError } = await supabase
      .from("lume_leads")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error("Error checking for existing lead:", selectError);
      return { lead: null, isNew: false, error: selectError.message };
    }
    
    if (existingLead) {
      // Update existing lead - preserve has_purchased, update context if provided
      const updateData: Partial<LumeLead> = {
        updated_at: new Date().toISOString(),
      };
      
      if (context) {
        // Merge context, don't overwrite
        updateData.context = { ...(existingLead.context || {}), ...context };
      }
      
      const { data: updatedLead, error: updateError } = await supabase
        .from("lume_leads")
        .update(updateData)
        .eq("id", existingLead.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating lead:", updateError);
        return { lead: existingLead, isNew: false, error: updateError.message };
      }
      
      return { lead: updatedLead, isNew: false };
    }
    
    // Create new lead
    const { data: newLead, error: insertError } = await supabase
      .from("lume_leads")
      .insert({
        email: normalizedEmail,
        context: context || null,
        source,
        has_purchased: false,
        last_email_step_sent: 0,
      })
      .select()
      .single();
    
    if (insertError) {
      // Handle duplicate key (race condition)
      if (insertError.code === '23505') {
        // Retry fetch
        const { data: retryLead } = await supabase
          .from("lume_leads")
          .select("*")
          .eq("email", normalizedEmail)
          .single();
        return { lead: retryLead, isNew: false };
      }
      console.error("Error creating lead:", insertError);
      return { lead: null, isNew: false, error: insertError.message };
    }
    
    console.log(`✅ New lead created: ${normalizedEmail}`);
    return { lead: newLead, isNew: true };
  } catch (err) {
    console.error("upsertLumeLead error:", err);
    return { lead: null, isNew: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get a lead by email
 */
export async function getLumeLeadByEmail(email: string): Promise<LumeLead | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from("lume_leads")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching lead:", error);
    return null;
  }
  
  return data;
}

/**
 * Update the last email step sent for a lead
 */
export async function updateLeadEmailStep(leadId: string, step: number): Promise<boolean> {
  const { error } = await supabase
    .from("lume_leads")
    .update({ 
      last_email_step_sent: step,
      updated_at: new Date().toISOString()
    })
    .eq("id", leadId);
  
  if (error) {
    console.error("Error updating lead email step:", error);
    return false;
  }
  
  return true;
}

/**
 * Mark a lead as having purchased
 */
export async function markLeadAsPurchased(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { error } = await supabase
    .from("lume_leads")
    .update({ 
      has_purchased: true,
      purchased_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("email", normalizedEmail);
  
  if (error) {
    console.error("Error marking lead as purchased:", error);
    return false;
  }
  
  console.log(`✅ Lead marked as purchased: ${normalizedEmail}`);
  return true;
}

/**
 * Get leads that are due for follow-up emails
 * Returns leads where:
 * - has_purchased = false
 * - unsubscribed = false
 * - last_email_step_sent < 6 (haven't completed sequence)
 */
export async function getLeadsDueForFollowup(): Promise<LumeLead[]> {
  const { data, error } = await supabase
    .from("lume_leads")
    .select("*")
    .eq("has_purchased", false)
    .eq("unsubscribed", false)
    .lt("last_email_step_sent", 6)
    .order("created_at", { ascending: true });
  
  if (error) {
    console.error("Error fetching leads for followup:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Unsubscribe a lead
 */
export async function unsubscribeLead(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { error } = await supabase
    .from("lume_leads")
    .update({ 
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("email", normalizedEmail);
  
  if (error) {
    console.error("Error unsubscribing lead:", error);
    return false;
  }
  
  console.log(`✅ Lead unsubscribed: ${normalizedEmail}`);
  return true;
}


