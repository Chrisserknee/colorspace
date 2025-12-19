import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portrait Studio | Transform Yourself Into a Classical Masterpiece",
  description: "Transform yourself into a stunning aristocratic oil portrait. Upload a photo and watch as AI creates a timeless masterpiece, as if painted by a Renaissance master.",
  keywords: ["portrait", "oil painting", "classical portrait", "aristocratic portrait", "AI portrait", "renaissance art", "masterpiece"],
  openGraph: {
    title: "Portrait Studio | Become a Timeless Masterpiece",
    description: "Transform yourself into a stunning aristocratic oil portrait, painted in the style of the Renaissance masters.",
    type: "website",
    siteName: "Portrait Studio",
  },
};

export default function HumanPortraitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

