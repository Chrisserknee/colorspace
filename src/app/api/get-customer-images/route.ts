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
  const results: { email: string; imageId: string | null; link: string | null }[] = [];

  for (const email of TARGET_CUSTOMERS) {
    // First check paying_customers table
    const { data: customer } = await supabase
      .from("paying_customers")
      .select("image_ids")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    
    let imageId: string | null = customer?.image_ids?.[0] || null;
    
    // Fallback: search metadata table
    if (!imageId) {
      const { data: metadata } = await supabase
        .from("metadata")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .order("created_at", { ascending: false })
        .limit(1);
      
      imageId = metadata?.[0]?.id || null;
    }
    
    results.push({
      email,
      imageId,
      link: imageId ? `https://lumepet.app/success?imageId=${imageId}` : null
    });
  }

  return NextResponse.json({ results });
}

