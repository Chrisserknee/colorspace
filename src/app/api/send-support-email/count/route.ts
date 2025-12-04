import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/send-support-email/count
 * 
 * Returns the count of unique email addresses in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminSecret } = body;

    // Verify admin secret
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch all unique emails from lume_leads
    const { data: leads, error: leadsError } = await supabase
      .from("lume_leads")
      .select("email")
      .not("email", "is", null);

    if (leadsError) {
      console.error("Failed to fetch leads:", leadsError);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    // Also fetch from pet_emails table if it exists
    const { data: petEmails } = await supabase
      .from("pet_emails")
      .select("email")
      .not("email", "is", null);

    // Combine and deduplicate emails
    const allEmails = new Set<string>();
    
    leads?.forEach((lead: { email: string }) => {
      if (lead.email) allEmails.add(lead.email.toLowerCase());
    });
    
    petEmails?.forEach((record: { email: string }) => {
      if (record.email) allEmails.add(record.email.toLowerCase());
    });

    return NextResponse.json({
      count: allEmails.size,
    });

  } catch (error) {
    console.error("Count error:", error);
    return NextResponse.json(
      { error: "Failed to count emails" },
      { status: 500 }
    );
  }
}

