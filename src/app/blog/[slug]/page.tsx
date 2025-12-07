import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getAllPostSlugs, blogPosts } from "../posts";

// Generate static params for all blog posts
export async function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({
    slug,
  }));
}

// Generate metadata for each blog post
export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  
  if (!post) {
    return {
      title: "Post Not Found | LumePet Blog",
    };
  }

  return {
    title: `${post.title} | LumePet Blog`,
    description: post.excerpt,
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      siteName: "LumePet",
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Simple markdown-like rendering
function renderContent(content: string) {
  const lines = content.trim().split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];
  let key = 0;

  const processListItems = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="space-y-2 mb-6 ml-6">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-[#B8B2A8] leading-relaxed relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-[#C5A572]">
              {item}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Empty line
    if (!trimmedLine) {
      processListItems();
      continue;
    }

    // H1 heading
    if (trimmedLine.startsWith('# ')) {
      processListItems();
      elements.push(
        <h1 key={key++} className="font-['Cormorant_Garamond',Georgia,serif] text-3xl md:text-4xl lg:text-5xl font-semibold text-[#F0EDE8] mb-6 mt-8 first:mt-0 leading-tight">
          {trimmedLine.substring(2)}
        </h1>
      );
      continue;
    }

    // H2 heading
    if (trimmedLine.startsWith('## ')) {
      processListItems();
      elements.push(
        <h2 key={key++} className="font-['Cormorant_Garamond',Georgia,serif] text-2xl md:text-3xl font-semibold text-[#F0EDE8] mb-4 mt-12 leading-tight">
          {trimmedLine.substring(3)}
        </h2>
      );
      continue;
    }

    // H3 heading
    if (trimmedLine.startsWith('### ')) {
      processListItems();
      elements.push(
        <h3 key={key++} className="font-['Cormorant_Garamond',Georgia,serif] text-xl md:text-2xl font-semibold text-[#C5A572] mb-3 mt-8">
          {trimmedLine.substring(4)}
        </h3>
      );
      continue;
    }

    // Horizontal rule
    if (trimmedLine === '---') {
      processListItems();
      elements.push(
        <hr key={key++} className="my-12 border-0 h-px bg-gradient-to-r from-transparent via-[rgba(197,165,114,0.3)] to-transparent" />
      );
      continue;
    }

    // Italic text (entire line starting with *)
    if (trimmedLine.startsWith('*') && trimmedLine.endsWith('*') && !trimmedLine.startsWith('**')) {
      processListItems();
      elements.push(
        <p key={key++} className="text-[#B8B2A8] italic text-lg leading-relaxed mb-6 text-center">
          {trimmedLine.slice(1, -1)}
        </p>
      );
      continue;
    }

    // Bold text (entire line)
    if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
      processListItems();
      elements.push(
        <p key={key++} className="text-[#F0EDE8] font-semibold text-lg leading-relaxed mb-6">
          {trimmedLine.slice(2, -2)}
        </p>
      );
      continue;
    }

    // List items
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      inList = true;
      listItems.push(trimmedLine.substring(2));
      continue;
    }

    // Blockquote
    if (trimmedLine.startsWith('>')) {
      processListItems();
      elements.push(
        <blockquote key={key++} className="border-l-4 border-[#C5A572] pl-6 py-2 my-8 italic text-[#B8B2A8] text-lg">
          {trimmedLine.substring(1).trim()}
        </blockquote>
      );
      continue;
    }

    // Regular paragraph - process inline formatting
    processListItems();
    let text = trimmedLine;
    
    // Process inline bold and italic
    const processInlineFormatting = (str: string) => {
      const parts: React.ReactNode[] = [];
      let remaining = str;
      let partKey = 0;

      // Process **bold** and *italic*
      const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(remaining)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          parts.push(remaining.slice(lastIndex, match.index));
        }

        const matchedText = match[0];
        if (matchedText.startsWith('**')) {
          parts.push(
            <strong key={partKey++} className="text-[#F0EDE8] font-semibold">
              {matchedText.slice(2, -2)}
            </strong>
          );
        } else {
          parts.push(
            <em key={partKey++} className="italic text-[#C5A572]">
              {matchedText.slice(1, -1)}
            </em>
          );
        }

        lastIndex = regex.lastIndex;
      }

      // Add remaining text
      if (lastIndex < remaining.length) {
        parts.push(remaining.slice(lastIndex));
      }

      return parts.length > 0 ? parts : str;
    };

    // Check for links [text](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    if (linkRegex.test(text)) {
      const parts: React.ReactNode[] = [];
      let lastIdx = 0;
      linkRegex.lastIndex = 0;
      let linkMatch;

      while ((linkMatch = linkRegex.exec(text)) !== null) {
        if (linkMatch.index > lastIdx) {
          parts.push(
            <span key={`text-${lastIdx}`}>{processInlineFormatting(text.slice(lastIdx, linkMatch.index))}</span>
          );
        }
        parts.push(
          <Link 
            key={`link-${linkMatch.index}`}
            href={linkMatch[2]} 
            className="text-[#C5A572] hover:text-[#D4B896] underline underline-offset-4 transition-colors"
          >
            {linkMatch[1]}
          </Link>
        );
        lastIdx = linkRegex.lastIndex;
      }

      if (lastIdx < text.length) {
        parts.push(<span key={`text-end`}>{processInlineFormatting(text.slice(lastIdx))}</span>);
      }

      elements.push(
        <p key={key++} className="text-[#B8B2A8] text-lg leading-relaxed mb-6">
          {parts}
        </p>
      );
    } else {
      elements.push(
        <p key={key++} className="text-[#B8B2A8] text-lg leading-relaxed mb-6">
          {processInlineFormatting(text)}
        </p>
      );
    }
  }

  // Process any remaining list items
  processListItems();

  return elements;
}

export default async function BlogPostPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  // Get related posts (excluding current)
  const relatedPosts = blogPosts
    .filter(p => p.slug !== post.slug)
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-renaissance">
      {/* Header */}
      <header className="sticky top-0 z-50 py-4 px-4 bg-[rgba(10,10,10,0.9)] backdrop-blur-md border-b border-[rgba(197,165,114,0.1)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/blog" className="flex items-center gap-2 text-[#B8B2A8] hover:text-[#C5A572] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to Blog</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl">👑</span>
            <span className="font-['Cormorant_Garamond',Georgia,serif] text-lg font-semibold text-[#C5A572]">
              LumePet
            </span>
          </Link>
        </div>
      </header>

      {/* Article */}
      <article className="py-12 md:py-16 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Article Header */}
          <header className="mb-12 text-center">
            {/* Category */}
            <div className="mb-4">
              <span className="px-4 py-1.5 text-xs font-medium tracking-wider uppercase bg-[rgba(197,165,114,0.15)] text-[#C5A572] rounded-full border border-[rgba(197,165,114,0.3)]">
                {post.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-['Cormorant_Garamond',Georgia,serif] text-3xl md:text-4xl lg:text-5xl font-semibold text-[#F0EDE8] mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Meta */}
            <div className="flex items-center justify-center gap-4 text-sm text-[#7A756D]">
              <span>{post.author}</span>
              <span className="w-1 h-1 rounded-full bg-[#7A756D]" />
              <time dateTime={post.date}>{formatDate(post.date)}</time>
              <span className="w-1 h-1 rounded-full bg-[#7A756D]" />
              <span>{post.readTime} min read</span>
            </div>
          </header>

          {/* Featured Image */}
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-12 bg-gradient-to-br from-[#242424] to-[#1A1A1A] border border-[rgba(197,165,114,0.1)]">
            <img 
              src={post.coverImage} 
              alt={post.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Content */}
          <div className="prose-custom">
            {renderContent(post.content)}
          </div>

          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-[rgba(197,165,114,0.1)]">
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span 
                  key={tag}
                  className="px-3 py-1 text-xs text-[#B8B2A8] bg-[rgba(255,255,255,0.05)] rounded-full border border-[rgba(197,165,114,0.1)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-to-b from-transparent to-[rgba(197,165,114,0.05)]">
        <div className="max-w-2xl mx-auto text-center">
          <span className="text-4xl mb-4 block">🎨</span>
          <h2 className="font-['Cormorant_Garamond',Georgia,serif] text-2xl md:text-3xl font-semibold text-[#F0EDE8] mb-4">
            Ready to Create Your Pet&apos;s Portrait?
          </h2>
          <p className="text-[#B8B2A8] mb-8 text-lg">
            Transform your beloved companion into a timeless work of art.
          </p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 text-[#0A0A0A] font-semibold bg-gradient-to-r from-[#C5A572] to-[#D4B896] rounded-full hover:shadow-[0_8px_30px_rgba(197,165,114,0.4)] transition-all duration-300"
          >
            Create Your Portrait
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 px-4 border-t border-[rgba(197,165,114,0.1)]">
          <div className="max-w-4xl mx-auto">
            <h2 className="font-['Cormorant_Garamond',Georgia,serif] text-2xl font-semibold text-[#F0EDE8] mb-8 text-center">
              Continue Reading
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Link 
                  key={relatedPost.slug}
                  href={`/blog/${relatedPost.slug}`}
                  className="group block"
                >
                  <article className="p-6 rounded-xl border border-[rgba(197,165,114,0.15)] bg-[#1A1A1A] hover:border-[rgba(197,165,114,0.3)] transition-all duration-300">
                    <span className="text-xs text-[#C5A572] uppercase tracking-wider mb-2 block">
                      {relatedPost.category}
                    </span>
                    <h3 className="font-['Cormorant_Garamond',Georgia,serif] text-xl font-semibold text-[#F0EDE8] mb-2 group-hover:text-[#C5A572] transition-colors">
                      {relatedPost.title}
                    </h3>
                    <p className="text-sm text-[#7A756D]">
                      {relatedPost.readTime} min read
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[rgba(197,165,114,0.1)]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#7A756D]">
          <p>© 2025 LumePet. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-[#C5A572] transition-colors">Home</Link>
            <Link href="/blog" className="hover:text-[#C5A572] transition-colors">Blog</Link>
            <Link href="/about" className="hover:text-[#C5A572] transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

