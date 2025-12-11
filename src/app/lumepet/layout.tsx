import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LumePet | Turn Your Pet Into a Masterpiece",
  description: "Transform your beloved pet into a stunning royal oil painting portrait. Upload a photo and watch the magic happen.",
  keywords: ["pet portrait", "royal art", "pet painting", "oil painting", "pet masterpiece"],
  openGraph: {
    title: "LumePet | Turn Your Pet Into a Masterpiece",
    description: "Transform your beloved pet into a stunning royal oil painting portrait.",
    type: "website",
    siteName: "LumePet",
  },
};

export default function LumePetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


