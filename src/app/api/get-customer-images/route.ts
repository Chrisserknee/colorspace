import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TARGET_CUSTOMERS = [
  "chrisserknee@gmail.com",
  "rdeleon6@aol.com",
  "doltongang@cox.net",
  "verbie@comcast.net",
  "carmenwolff@icloud.com",
  "heidi@cypresspointclub.org",
];

export async function GET() {
  const results: { email: string; imageId: string | null; link: string | null; debug?: string }[] = [];

  for (const email of TARGET_CUSTOMERS) {
    const normalizedEmail = email.toLowerCase().trim();
    
    // First check paying_customers table
    const { data: customer, error: custErr } = await supabase
      .from("paying_customers")
      .select("image_ids")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    let imageId: string | null = customer?.image_ids?.[0] || null;
    let debug = custErr ? `paying_customers error: ${custErr.message}` : (customer ? "found in paying_customers" : "not in paying_customers");
    
    // Fallback: search metadata table by email
    if (!imageId) {
      const { data: metadata, error: metaErr } = await supabase
        .from("metadata")
        .select("id, email")
        .eq("email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1);
      
      if (metaErr) {
        debug += `, metadata error: ${metaErr.message}`;
      } else if (metadata && metadata.length > 0) {
        imageId = metadata[0].id;
        debug += `, found in metadata`;
      } else {
        debug += `, not in metadata`;
        
        // Try partial match - look for emails containing this domain or similar
        const { data: allMeta } = await supabase
          .from("metadata")
          .select("id, email")
          .not("email", "is", null)
          .order("created_at", { ascending: false })
          .limit(50);
        
        if (allMeta) {
          // Find similar emails
          const similar = allMeta.filter(m => 
            m.email && (
              m.email.toLowerCase().includes(email.split('@')[0].toLowerCase()) ||
              email.split('@')[0].toLowerCase().includes(m.email?.split('@')[0]?.toLowerCase() || '')
            )
          );
          if (similar.length > 0) {
            debug += `, similar emails found: ${similar.map(s => s.email).join(', ')}`;
          }
        }
      }
    }
    
    results.push({
      email,
      imageId,
      link: imageId ? `https://lumepet.app/success?imageId=${imageId}` : null,
      debug
    });
  }
  
  // Also get list of all emails in metadata for reference
  const { data: allEmails } = await supabase
    .from("metadata")
    .select("email")
    .not("email", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ 
    results,
    recentEmails: allEmails?.map(e => e.email) || []
  });
}
