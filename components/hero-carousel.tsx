"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowIcon } from "@/components/icons";
import type { HeroSlide } from "@/lib/types";

const fallbackSlide: HeroSlide = {
  id: "fallback",
  title: "Better tech. Less noise.",
  subtitle: "Future-ready essentials for your desk, your pocket, and everything in between.",
  image_url: "",
  image_path: "",
  cta_label: "Explore the collection",
  cta_href: "/#products",
  sort_order: 0,
  active: true,
  created_at: "",
  updated_at: "",
};

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
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
      <div className="home-carousel-art" aria-hidden="true"><span /><span /><b>C</b></div>
      <div className="home-carousel-content" key={slide.id}>
        <p className="eyebrow">Codart featured</p>
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
