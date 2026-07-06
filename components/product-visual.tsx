"use client";

import Image from "next/image";
import { ImageIcon } from "@/components/icons";

export function ProductVisual({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  if (!src) {
    return (
      <div className="product-placeholder" aria-label={`${alt} placeholder`}>
        <span className="placeholder-orbit" />
        <ImageIcon className="placeholder-icon" />
      </div>
    );
  }

  return <Image src={src} alt={alt} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" className="product-image" priority={priority} />;
}
