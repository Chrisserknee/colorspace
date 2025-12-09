import { createClient } from "@supabase/supabase-js";
import { fixEmailTypos } from "./validation";

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

// ============================================
// ROYAL CLUB EMAIL SUBSCRIBERS (emails table)
// For newsletter signups - separate from customers
// ============================================

/**
 * Add a Royal Club subscriber
 * This is the main function for newsletter/Royal Club signups
 */
export async function addRoyalClubSubscriber(
  email: string,
  options: {
    signupLocation?: string;
    context?: Record<string, unknown>;
  } = {}
): Promise<{ success: boolean; isNew: boolean; error?: string }> {
  try {
    // Auto-fix email typos before saving
    const { email: fixedEmail, wasFixed, fixes } = fixEmailTypos(email);
    const normalizedEmail = fixedEmail.toLowerCase().trim();
    
    if (wasFixed) {
      console.log(`📧 Auto-fixed email typo: "${email}" → "${normalizedEmail}" (${fixes.join(", ")})`);
    }
    const now = new Date().toISOString();
    
    // Check if already subscribed
    const { data: existing, error: selectError } = await supabase
      .from("emails")
      .select("id, unsubscribed")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error("Error checking for existing subscriber:", selectError);
      return { success: false, isNew: false, error: selectError.message };
    }
    
    if (existing) {
      // Already exists - resubscribe if unsubscribed
      if (existing.unsubscribed) {
        await supabase
          .from("emails")
          .update({
            subscribed: true,
            unsubscribed: false,
            unsubscribed_at: null,
            updated_at: now,
          })
          .eq("id", existing.id);
        console.log(`📧 Resubscribed: ${normalizedEmail}`);
      } else {
        console.log(`📧 Already subscribed: ${normalizedEmail}`);
      }
      return { success: true, isNew: false };
    }
    
    // Create new subscriber
    const { error: insertError } = await supabase
      .from("emails")
      .insert({
        email: normalizedEmail,
        source: "royal-club",
        signup_location: options.signupLocation || "homepage-footer",
        subscribed: true,
        unsubscribed: false,
        has_purchased: false,
        context: options.context || null,
      });
    
    if (insertError) {
      if (insertError.code === '23505') {
        // Duplicate - already exists
        return { success: true, isNew: false };
      }
      console.error("Error adding subscriber:", insertError);
      return { success: false, isNew: false, error: insertError.message };
    }
    
    console.log(`🎉 New Royal Club subscriber: ${normalizedEmail}`);
    return { success: true, isNew: true };
  } catch (err) {
    console.error("addRoyalClubSubscriber error:", err);
    return { success: false, isNew: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get all Royal Club subscribers (for export/marketing)
 */
export async function getRoyalClubSubscribers(options: {
  activeOnly?: boolean;
  limit?: number;
} = {}): Promise<{ email: string; created_at: string; source: string }[]> {
  let query = supabase
    .from("emails")
    .select("email, created_at, source, signup_location")
    .order("created_at", { ascending: false });
  
  if (options.activeOnly !== false) {
    query = query.eq("subscribed", true).eq("unsubscribed", false);
  }
  
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching subscribers:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Mark a Royal Club subscriber as having purchased
 * (for conversion tracking)
 */
export async function markSubscriberAsPurchased(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { error } = await supabase
    .from("emails")
    .update({
      has_purchased: true,
      purchased_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("email", normalizedEmail);
  
  if (error) {
    // Not an error if they weren't subscribed
    return false;
  }
  
  console.log(`📧 Subscriber marked as purchased: ${normalizedEmail}`);
  return true;
}

// ============================================
// LEGACY EMAIL LEAD HELPERS (for backwards compatibility)
// These still work but prefer the new functions above
// ============================================

export interface LumeLeadContext {
  style?: string;
  petType?: string;
  petName?: string;
  source?: string;
  uploadedImageUrl?: string;
  imageId?: string | null;
  previewUrl?: string | null;
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
 * Upsert a lead - creates new or updates existing in emails table
 * Does NOT reset has_purchased if already true
 */
export async function upsertLumeLead(
  email: string, 
  context?: LumeLeadContext,
  source: string = 'checkout'
): Promise<{ lead: LumeLead | null; isNew: boolean; error?: string }> {
  try {
    // Auto-fix email typos before saving
    const { email: fixedEmail, wasFixed, fixes } = fixEmailTypos(email);
    const normalizedEmail = fixedEmail.toLowerCase().trim();
    
    if (wasFixed) {
      console.log(`📧 Auto-fixed email typo: "${email}" → "${normalizedEmail}" (${fixes.join(", ")})`);
    }
    
    // First check if email exists
    const { data: existingLead, error: selectError } = await supabase
      .from("emails")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error("Error checking for existing email:", selectError);
      return { lead: null, isNew: false, error: selectError.message };
    }
    
    if (existingLead) {
      // Update existing email - preserve has_purchased, update context if provided
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      
      if (context) {
        // Merge context, don't overwrite
        updateData.context = { ...(existingLead.context || {}), ...context };
      }
      
      const { data: updatedLead, error: updateError } = await supabase
        .from("emails")
        .update(updateData)
        .eq("id", existingLead.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating email:", updateError);
        return { lead: existingLead, isNew: false, error: updateError.message };
      }
      
      return { lead: updatedLead, isNew: false };
    }
    
    // Create new email entry
    const { data: newLead, error: insertError } = await supabase
      .from("emails")
      .insert({
        email: normalizedEmail,
        context: context || null,
        source,
        has_purchased: false,
        last_email_step_sent: 0,
        unsubscribed: false,
      })
      .select()
      .single();
    
    if (insertError) {
      // Handle duplicate key (race condition)
      if (insertError.code === '23505') {
        // Retry fetch
        const { data: retryLead } = await supabase
          .from("emails")
          .select("*")
          .eq("email", normalizedEmail)
          .single();
        return { lead: retryLead, isNew: false };
      }
      console.error("Error creating email entry:", insertError);
      return { lead: null, isNew: false, error: insertError.message };
    }
    
    console.log(`✅ New email captured: ${normalizedEmail}`);
    return { lead: newLead, isNew: true };
  } catch (err) {
    console.error("upsertLumeLead error:", err);
    return { lead: null, isNew: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get an email/lead by email address
 */
export async function getLumeLeadByEmail(email: string): Promise<LumeLead | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching email:", error);
    return null;
  }
  
  return data;
}

/**
 * Update the last email step sent for an email
 */
export async function updateLeadEmailStep(leadId: string, step: number): Promise<boolean> {
  const { error } = await supabase
    .from("emails")
    .update({ 
      last_email_step_sent: step,
      updated_at: new Date().toISOString()
    })
    .eq("id", leadId);
  
  if (error) {
    console.error("Error updating email step:", error);
    return false;
  }
  
  return true;
}

/**
 * Mark an email as having purchased (in emails table)
 * This is now the primary function for marking purchases
 */
export async function markLeadAsPurchased(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // First check if email exists
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
        updated_at: new Date().toISOString()
      })
      .eq("email", normalizedEmail);
    
    if (error) {
      console.error("Error marking email as purchased:", error);
      return false;
    }
  } else {
    // Insert new record with purchased flag
    const { error } = await supabase
      .from("emails")
      .insert({
        email: normalizedEmail,
        source: "purchase",
        has_purchased: true,
        purchased_at: new Date().toISOString(),
        last_email_step_sent: 6, // Skip email sequence for purchasers
        unsubscribed: false,
      });
    
    if (error) {
      console.error("Error inserting purchased email:", error);
      return false;
    }
  }
  
  console.log(`✅ Email marked as purchased: ${normalizedEmail}`);
  return true;
}

/**
 * Get leads due for follow-up emails
 * 
 * NOTE: This function is DISABLED because the emails table is now
 * used only for Royal Club subscribers, not checkout abandonments.
 * The nurture email sequence is no longer active.
 * 
 * Returns empty array to prevent sending nurture emails to Royal Club members.
 */
export async function getLeadsDueForFollowup(): Promise<LumeLead[]> {
  // DISABLED - emails table is now Royal Club only, not for nurture sequence
  console.log("⏸️ Nurture email sequence is disabled - emails table is for Royal Club only");
  return [];
}

/**
 * Unsubscribe an email
 */
export async function unsubscribeLead(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { error } = await supabase
    .from("emails")
    .update({ 
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("email", normalizedEmail);
  
  if (error) {
    console.error("Error unsubscribing email:", error);
    return false;
  }
  
  console.log(`✅ Email unsubscribed: ${normalizedEmail}`);
  return true;
}

// ============================================
// PAYING CUSTOMERS TABLE HELPERS
// Separate from emails (Royal Club) - these are paying customers
// ============================================

export interface Customer {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
  first_purchase_at: string;
  last_purchase_at: string;
  total_purchases: number;
  purchase_type: string;
  image_ids: string[] | null;
  stripe_customer_id: string | null;
  stripe_session_ids: string[] | null;
  marketing_opt_in: boolean;
  unsubscribed: boolean;
  unsubscribed_at: string | null;
  context: Record<string, unknown> | null;
}

/**
 * Add or update a customer after purchase
 * This is the main function to call when someone makes a purchase
 */
export async function addCustomer(
  email: string,
  options: {
    purchaseType?: 'portrait' | 'pack' | 'rainbow-bridge' | 'canvas' | 'unlimited-session';
    imageId?: string;
    stripeSessionId?: string;
    stripeCustomerId?: string;
    context?: Record<string, unknown>;
  } = {}
): Promise<{ customer: Customer | null; isNew: boolean; error?: string }> {
  try {
    // Auto-fix email typos before saving
    const { email: fixedEmail, wasFixed, fixes } = fixEmailTypos(email);
    const normalizedEmail = fixedEmail.toLowerCase().trim();
    
    if (wasFixed) {
      console.log(`📧 Auto-fixed email typo: "${email}" → "${normalizedEmail}" (${fixes.join(", ")})`);
    }
    const now = new Date().toISOString();
    
    // Check if customer already exists
    const { data: existing, error: selectError } = await supabase
      .from("paying_customers")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    if (selectError && selectError.code !== 'PGRST116') {
      console.error("Error checking for existing customer:", selectError);
      return { customer: null, isNew: false, error: selectError.message };
    }
    
    if (existing) {
      // Update existing customer - increment purchase count
      const updateData: Record<string, unknown> = {
        last_purchase_at: now,
        total_purchases: (existing.total_purchases || 1) + 1,
        updated_at: now,
      };
      
      // Add new image ID if provided
      if (options.imageId) {
        const existingIds = existing.image_ids || [];
        if (!existingIds.includes(options.imageId)) {
          updateData.image_ids = [...existingIds, options.imageId];
        }
      }
      
      // Add new Stripe session ID if provided
      if (options.stripeSessionId) {
        const existingSessionIds = existing.stripe_session_ids || [];
        if (!existingSessionIds.includes(options.stripeSessionId)) {
          updateData.stripe_session_ids = [...existingSessionIds, options.stripeSessionId];
        }
      }
      
      // Update Stripe customer ID if provided
      if (options.stripeCustomerId) {
        updateData.stripe_customer_id = options.stripeCustomerId;
      }
      
      // Merge context
      if (options.context) {
        updateData.context = { ...(existing.context || {}), ...options.context };
      }
      
      const { data: updated, error: updateError } = await supabase
        .from("paying_customers")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating customer:", updateError);
        return { customer: existing, isNew: false, error: updateError.message };
      }
      
      console.log(`📦 Repeat customer updated in paying_customers: ${normalizedEmail} (purchase #${updated.total_purchases})`);
      return { customer: updated, isNew: false };
    }
    
    // Create new customer
    const insertData: Record<string, unknown> = {
      email: normalizedEmail,
      first_purchase_at: now,
      last_purchase_at: now,
      total_purchases: 1,
      purchase_type: options.purchaseType || 'portrait',
      marketing_opt_in: true,
      unsubscribed: false,
    };
    
    if (options.imageId) {
      insertData.image_ids = [options.imageId];
    }
    
    if (options.stripeSessionId) {
      insertData.stripe_session_ids = [options.stripeSessionId];
    }
    
    if (options.stripeCustomerId) {
      insertData.stripe_customer_id = options.stripeCustomerId;
    }
    
    if (options.context) {
      insertData.context = options.context;
    }
    
    const { data: newCustomer, error: insertError } = await supabase
      .from("paying_customers")
      .insert(insertData)
      .select()
      .single();
    
    if (insertError) {
      // Handle duplicate key (race condition)
      if (insertError.code === '23505') {
        const { data: retryCustomer } = await supabase
          .from("paying_customers")
          .select("*")
          .eq("email", normalizedEmail)
          .single();
        return { customer: retryCustomer, isNew: false };
      }
      console.error("Error creating customer:", insertError);
      return { customer: null, isNew: false, error: insertError.message };
    }
    
    console.log(`🎉 New customer added: ${normalizedEmail}`);
    return { customer: newCustomer, isNew: true };
  } catch (err) {
    console.error("addCustomer error:", err);
    return { customer: null, isNew: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get a customer by email
 */
export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from("paying_customers")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();
  
  if (error) {
    console.error("Error fetching customer:", error);
    return null;
  }
  
  return data;
}

/**
 * Get all customers (for export/marketing)
 */
export async function getAllCustomers(options: {
  marketingOnly?: boolean;
  limit?: number;
} = {}): Promise<Customer[]> {
  let query = supabase
    .from("paying_customers")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (options.marketingOnly) {
    query = query.eq("marketing_opt_in", true).eq("unsubscribed", false);
  }
  
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Unsubscribe a customer from marketing
 */
export async function unsubscribeCustomer(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { error } = await supabase
    .from("paying_customers")
    .update({
      unsubscribed: true,
      unsubscribed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("email", normalizedEmail);
  
  if (error) {
    console.error("Error unsubscribing customer:", error);
    return false;
  }
  
  console.log(`✅ Customer unsubscribed: ${normalizedEmail}`);
  return true;
}

/**
 * Check if an email is a customer (has purchased)
 */
export async function isCustomer(email: string): Promise<boolean> {
  const customer = await getCustomerByEmail(email);
  return customer !== null;
}

