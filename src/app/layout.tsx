import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/react";
import { PostHogProvider } from "@/components/PostHogProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "LumePet | Turn Your Pet Into a Masterpiece",
  description: "Transform your beloved pet into a stunning royal oil painting portrait. Upload a photo and watch the magic happen.",
  keywords: ["pet portrait", "royal art", "pet painting", "oil painting", "pet masterpiece"],
  openGraph: {
    title: "LumePet | Turn Your Pet Into a Masterpiece",
    description: "Transform your beloved pet into a stunning royal oil painting portrait.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-renaissance antialiased">
        <Suspense>
          <PostHogProvider>
            {children}
          </PostHogProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
