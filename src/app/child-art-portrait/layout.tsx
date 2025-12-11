import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Child Art Portrait | Turn Your Child Into a Storybook Character",
  description: "Transform your child's photo into a magical, whimsical artwork that captures their unique spirit. Create stunning storybook-style portraits in seconds.",
  keywords: ["child portrait", "storybook art", "kid portrait", "children illustration", "magical portrait", "fairy tale art"],
  openGraph: {
    title: "Child Art Portrait | Turn Your Child Into a Storybook Character",
    description: "Transform your child's photo into a magical storybook artwork.",
    type: "website",
    siteName: "Child Art Portrait",
  },
};

export default function ChildArtPortraitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}


