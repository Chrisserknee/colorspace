import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts, type BlogPost } from "./posts";

export const metadata: Metadata = {
  title: "LumePet Blog | Stories, Tips & Pet Portrait Inspiration",
  description: "Discover heartwarming stories about pets and their portraits, expert tips on capturing your pet's personality, and the art of transforming beloved companions into timeless masterpieces.",
  keywords: ["pet portraits", "pet art", "royal pet portraits", "pet painting tips", "pet photography", "custom pet art", "pet memorial", "dog portraits", "cat portraits"],
  openGraph: {
    title: "LumePet Blog | Stories, Tips & Pet Portrait Inspiration",
    description: "Discover heartwarming stories about pets and their portraits, expert tips on capturing your pet's personality, and the art of transforming beloved companions into timeless masterpieces.",
    type: "website",
    siteName: "LumePet",
  },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <Link 
      href={`/blog/${post.slug}`}
      className={`group block ${featured ? 'col-span-full' : ''}`}
    >
      <article 
        className={`
          relative overflow-hidden rounded-2xl border border-[rgba(197,165,114,0.15)] 
          bg-[#1A1A1A] transition-all duration-500 hover:border-[rgba(197,165,114,0.3)]
          hover:shadow-[0_20px_60px_rgba(0,0,0,0.4),0_0_40px_rgba(197,165,114,0.1)]
          ${featured ? 'md:flex md:items-stretch' : ''}
        `}
      >
        {/* Image */}
        <div className={`
          relative overflow-hidden bg-gradient-to-br from-[#242424] to-[#1A1A1A]
          ${featured ? 'md:w-1/2 aspect-[16/10] md:aspect-auto' : 'aspect-[16/10]'}
        `}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-transparent to-transparent z-10" />
          <div 
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ 
              backgroundImage: `url(${post.coverImage})`,
              backgroundColor: '#242424'
            }}
          />
          {/* Category Badge */}
          <div className="absolute top-4 left-4 z-20">
            <span className="px-3 py-1 text-xs font-medium tracking-wider uppercase bg-[rgba(197,165,114,0.9)] text-[#0A0A0A] rounded-full">
              {post.category}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className={`
          p-6 md:p-8 flex flex-col justify-center
          ${featured ? 'md:w-1/2' : ''}
        `}>
          {/* Date & Read Time */}
          <div className="flex items-center gap-3 text-sm text-[#7A756D] mb-3">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span className="w-1 h-1 rounded-full bg-[#7A756D]" />
            <span>{post.readTime} min read</span>
          </div>

          {/* Title */}
          <h2 className={`
            font-['Cormorant_Garamond',Georgia,serif] font-semibold text-[#F0EDE8] 
            leading-tight mb-3 transition-colors duration-300 group-hover:text-[#C5A572]
            ${featured ? 'text-2xl md:text-3xl lg:text-4xl' : 'text-xl md:text-2xl'}
          `}>
            {post.title}
          </h2>

          {/* Excerpt */}
          <p className={`
            text-[#B8B2A8] leading-relaxed mb-4
            ${featured ? 'text-base md:text-lg' : 'text-sm md:text-base line-clamp-3'}
          `}>
            {post.excerpt}
          </p>

          {/* Read More */}
          <div className="flex items-center gap-2 text-[#C5A572] font-medium text-sm group-hover:gap-3 transition-all duration-300">
            <span>Read Article</span>
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function BlogPage() {
  const [featuredPost, ...otherPosts] = blogPosts;

  return (
    <div className="min-h-screen bg-renaissance">
      {/* Header */}
      <header className="relative py-6 px-4 border-b border-[rgba(197,165,114,0.1)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="text-2xl">👑</span>
            <span className="font-['Cormorant_Garamond',Georgia,serif] text-xl font-semibold text-[#C5A572] tracking-wide">
              LumePet
            </span>
          </Link>
          <Link 
            href="/"
            className="px-5 py-2 text-sm font-medium text-[#0A0A0A] bg-gradient-to-r from-[#C5A572] to-[#D4B896] rounded-full hover:shadow-[0_4px_20px_rgba(197,165,114,0.4)] transition-all duration-300"
          >
            Create Your Portrait
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 md:py-24 px-4 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(197,165,114,0.03)] to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[rgba(197,165,114,0.05)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-[rgba(139,58,66,0.05)] rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto text-center">
          <p className="text-[#C5A572] text-sm font-medium tracking-[0.2em] uppercase mb-4">
            The LumePet Journal
          </p>
          <h1 className="font-['Cormorant_Garamond',Georgia,serif] text-4xl md:text-5xl lg:text-6xl font-semibold text-[#F0EDE8] mb-6 leading-tight">
            Stories of Love, Art &<br />
            <span className="text-[#C5A572]">Beloved Companions</span>
          </h1>
          <p className="text-lg md:text-xl text-[#B8B2A8] max-w-2xl mx-auto leading-relaxed">
            Explore the world of pet portraiture—heartwarming tales, artistic insights, 
            and the timeless bond between pets and their people.
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Featured Post */}
          {featuredPost && (
            <div className="mb-12">
              <BlogCard post={featuredPost} featured />
            </div>
          )}

          {/* Other Posts */}
          {otherPosts.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {otherPosts.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 px-4 border-t border-[rgba(197,165,114,0.1)]">
        <div className="max-w-xl mx-auto text-center">
          <span className="text-3xl mb-4 block">✉️</span>
          <h2 className="font-['Cormorant_Garamond',Georgia,serif] text-2xl md:text-3xl font-semibold text-[#F0EDE8] mb-4">
            Join the Royal Court
          </h2>
          <p className="text-[#B8B2A8] mb-6">
            Subscribe for exclusive stories, pet portrait tips, and special offers delivered to your inbox.
          </p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-8 py-3 text-[#0A0A0A] font-semibold bg-gradient-to-r from-[#C5A572] to-[#D4B896] rounded-full hover:shadow-[0_8px_30px_rgba(197,165,114,0.4)] transition-all duration-300"
          >
            Visit LumePet
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[rgba(197,165,114,0.1)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#7A756D]">
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

