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
  const results: { email: string; imageId: string | null; link: string | null; allImageIds?: string[] }[] = [];

  for (const email of TARGET_CUSTOMERS) {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Check paying_customers table for all image_ids
    const { data: customer } = await supabase
      .from("paying_customers")
      .select("image_ids")
      .eq("email", normalizedEmail)
      .maybeSingle();
    
    const imageIds = customer?.image_ids || [];
    const imageId = imageIds[0] || null;
    
    results.push({
      email,
      imageId,
      link: imageId ? `https://lumepet.app/success?imageId=${imageId}` : null,
      allImageIds: imageIds
    });
  }
  
  // Also list all paying customers with their image_ids
  const { data: allCustomers } = await supabase
    .from("paying_customers")
    .select("email, image_ids")
    .order("created_at", { ascending: false });

  return NextResponse.json({ 
    results,
    allPayingCustomers: allCustomers?.map(c => ({ 
      email: c.email, 
      imageIds: c.image_ids,
      hasImages: c.image_ids && c.image_ids.length > 0
    })) || []
  });
}
