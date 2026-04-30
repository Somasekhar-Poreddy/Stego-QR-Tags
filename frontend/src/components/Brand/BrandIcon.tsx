interface BrandIconProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Square brand mark (shield-S in rounded blue tile). Use for tight spots —
 * favicon proxy in UI, sidebar collapsed state, sticker corner, splash.
 */
export function BrandIcon({ size = 32, className, alt = "StegoTags" }: BrandIconProps) {
  return (
    <img
      src="/icon-512.png"
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
