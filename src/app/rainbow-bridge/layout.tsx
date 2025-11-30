import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rainbow Bridge Portraits | LumePet Memorial",
  description: "Create a beautiful memorial portrait for your beloved pet who has crossed the Rainbow Bridge. Honor their memory with a heavenly, angelic tribute.",
  keywords: ["pet memorial", "rainbow bridge", "pet tribute", "memorial portrait", "pet remembrance"],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Rainbow Bridge Portraits | LumePet Memorial",
    description: "Create a beautiful memorial portrait for your beloved pet who has crossed the Rainbow Bridge.",
    type: "website",
  },
};

export default function RainbowBridgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

