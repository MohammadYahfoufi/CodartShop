"use client";

/* Animated SVG assets require native img elements so their embedded motion runs reliably. */
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowIcon } from "@/components/icons";
import type { HeroSlide, StorefrontSettings } from "@/lib/types";

export function HeroCarousel({ slides, settings }: { slides: HeroSlide[]; settings: StorefrontSettings }) {
  const fallbackSlide: HeroSlide = {
    id: "fallback", title: settings.fallback_hero_title, subtitle: settings.fallback_hero_subtitle,
    image_url: "", image_path: "", cta_label: settings.fallback_hero_cta_label,
    cta_href: settings.fallback_hero_cta_href, sort_order: 0, active: true, created_at: "", updated_at: "",
  };
  const visibleSlides = slides.filter((slide) => slide.active).slice(0, 5);
  const items = visibleSlides.length ? visibleSlides : [fallbackSlide];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % items.length), 6500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const slide = items[Math.min(active, items.length - 1)];

  return (
    <section className={`home-carousel ${slide.image_url ? "has-image" : "is-fallback"}`} aria-roledescription="carousel" aria-label="Featured collection">
      {slide.image_url && <Image key={slide.image_url} className="home-carousel-image" src={slide.image_url} alt="" fill priority sizes="100vw" />}
      <div className="home-carousel-shade" />
      <div className="home-carousel-art" role="group" aria-label="Codart Tech Core and product categories"><img className="home-carousel-core" src="/icons/codart-tech-core.svg" alt="Glowing Codart Tech Core" /><div className="hero-category-orbit orbit-clockwise"><div className="hero-orbit-item item-charger"><img src="/icons/chargers.svg" alt="Charger" /></div><div className="hero-orbit-item item-earbuds"><img src="/icons/earbuds.svg" alt="Earbuds" /></div></div><div className="hero-category-orbit orbit-counterclockwise"><div className="hero-orbit-item item-cable"><img src="/icons/cables.svg" alt="Cable" /></div><div className="hero-orbit-item item-power-bank"><img src="/icons/power-banks.svg" alt="Power bank" /></div></div></div>
      <div className="home-carousel-content" key={slide.id}>
        <p className="eyebrow">{settings.hero_eyebrow}</p>
        <h1>{slide.title}</h1>
        <p>{slide.subtitle}</p>
        <Link className="carousel-cta" href={slide.cta_href} data-analytics="hero_cta">{slide.cta_label}<ArrowIcon /></Link>
      </div>
      <div className="carousel-footer">
        <div className="carousel-progress"><span style={{ width: `${((active + 1) / items.length) * 100}%` }} /></div>
        <span>{String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}</span>
        {items.length > 1 && <div className="carousel-dots">{items.map((item, index) => <button type="button" key={item.id} className={index === active ? "is-active" : ""} onClick={() => setActive(index)} aria-label={`Show slide ${index + 1}`} />)}</div>}
      </div>
    </section>
  );
}
