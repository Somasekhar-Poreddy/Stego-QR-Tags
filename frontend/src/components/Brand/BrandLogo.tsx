interface BrandLogoProps {
  height?: number;
  className?: string;
  alt?: string;
}

/**
 * Horizontal wordmark + icon. Use for hero areas with horizontal room —
 * Navbar (desktop), Footer, login screens, OG image. Intrinsic ratio
 * is ~5.38:1 (master is 4375×813); width auto-scales from height.
 */
export function BrandLogo({ height = 32, className, alt = "StegoTags" }: BrandLogoProps) {
  return (
    <img
      src="/logo-stegotags.png"
      alt={alt}
      style={{ height, width: "auto", display: "block" }}
      className={className}
    />
  );
}
