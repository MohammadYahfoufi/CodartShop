"use client";

import Image from "next/image";

export function ProductVisual({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  if (!src) {
    const theme = Array.from(alt).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 4;
    const initials = alt
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "C";

    return (
      <div className={`product-placeholder placeholder-theme-${theme}`} aria-label={`${alt} product preview`}>
        <span className="placeholder-orbit" />
        <span className="product-monogram" aria-hidden="true">{initials}</span>
      </div>
    );
  }

  return <Image src={src} alt={alt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" className="product-image" priority={priority} />;
}
