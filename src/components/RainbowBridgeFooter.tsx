import Image from "next/image";
import Link from "next/link";

export default function RainbowBridgeFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer 
      className="py-12 px-6"
      style={{ borderTop: '1px solid rgba(212, 175, 55, 0.15)' }}
    >
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col items-center justify-center gap-6">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div
              style={{
                filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.6)) drop-shadow(0 0 20px rgba(230, 200, 255, 0.3))'
              }}
            >
              <Image
                src="/samples/LumePet2.png"
                alt="LumePet Logo"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <span 
              className="text-xl font-semibold"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
            >
              LumePet
            </span>
          </div>

          {/* Link back to main site */}
          <Link 
            href="/"
            className="text-sm transition-colors hover:opacity-80"
            style={{ color: '#9B8AA0' }}
          >
            ← Back to LumePet
          </Link>

          {/* Copyright */}
          <p className="text-sm" style={{ color: '#9B8AA0' }}>
            © {currentYear} LumePet
          </p>
        </div>

        {/* Fine print */}
        <div 
          className="mt-8 pt-6 text-center"
          style={{ borderTop: '1px solid rgba(212, 175, 55, 0.1)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(155, 138, 160, 0.7)' }}>
            In loving memory of all the pets who have crossed the Rainbow Bridge.
          </p>
        </div>
      </div>
    </footer>
  );
}




