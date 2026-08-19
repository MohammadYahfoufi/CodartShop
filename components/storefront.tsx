"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowIcon,
  BagIcon,
  CloseIcon,
  HeartIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { ProductVisual } from "@/components/product-visual";
import { ProductGridSkeleton } from "@/components/skeletons";
import { HeroCarousel } from "@/components/hero-carousel";
import { AuthButton } from "@/components/auth-button";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { deliveryAreas, getDeliveryArea, getPaymentMethod, paymentMethods } from "@/lib/checkout";
import { realtimeTopics } from "@/lib/realtime-topics";
import {
  CART_KEY,
  FAVORITES_KEY,
  LEGACY_CART_KEY,
  money,
  readStoredJson,
  VISITOR_KEY,
} from "@/lib/commerce";
import type {
  CartItem,
  CheckoutDetails,
  HeroSlide,
  OrderReceipt,
  PaginatedProducts,
  Product,
  StorefrontSettings,
} from "@/lib/types";

type StorefrontProps = {
  initialPage: PaginatedProducts;
  initialFilter?: "all" | "favorites";
  initialCheckoutStep?: "cart" | "details";
  initialPanelOpen?: boolean;
  focusProductId?: string;
  heroSlides?: HeroSlide[];
  settings: StorefrontSettings;
};

const emptyDetails: CheckoutDetails = { name: "", email: "", phone: "", address: "", area: "beirut", paymentMethod: "cash-on-delivery", note: "" };

function productPrice(product: Product) {
  return product.sale_price != null && product.sale_price < product.price ? product.sale_price : product.price;
}

function createVisitorId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function mergeCarts(...carts: CartItem[][]) {
  const merged = new Map<string, CartItem>();
  for (const cart of carts) {
    for (const item of cart) {
      const current = merged.get(item.id);
      merged.set(item.id, {
        ...item,
        quantity: Math.max(item.quantity, current?.quantity ?? 0),
      });
    }
  }
  return [...merged.values()];
}

function ProductDetailsModal({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (product: Product) => void }) {
  const gallery = product.images?.length ? product.images : [{ url: product.image_url, path: product.image_path, alt: product.title }];
  const [activeImage, setActiveImage] = useState(gallery[0]?.url ?? product.image_url);
  const specifications = Object.entries(product.specifications ?? {});
  const soldOut = (product.stock_quantity ?? 10) <= 0;
  return <><div className="drawer-backdrop is-open" onClick={onClose} /><section className="product-modal" role="dialog" aria-modal="true" aria-label={product.title}><button type="button" className="icon-button product-modal-close" onClick={onClose} aria-label="Close product details"><CloseIcon /></button><div className="product-gallery"><div className="product-gallery-main"><ProductVisual src={activeImage} alt={product.title} /></div>{gallery.length > 1 && <div className="product-gallery-thumbs">{gallery.map((image) => <button type="button" className={activeImage === image.url ? "is-active" : ""} key={image.path} onClick={() => setActiveImage(image.url)}><ProductVisual src={image.url} alt={image.alt ?? product.title} /></button>)}</div>}</div><div className="product-modal-copy">{product.category && <p className="eyebrow">{product.category}</p>}<h2>{product.title}</h2><p>{product.description}</p><div className="product-modal-price">{product.sale_price != null && product.sale_price < product.price && <del>{money.format(product.price)}</del>}<strong>{money.format(productPrice(product))}</strong></div><span className={`inventory-label ${soldOut ? "is-out" : ""}`}>{soldOut ? "Out of stock" : `${product.stock_quantity ?? 10} in stock`}</span>{specifications.length > 0 && <dl className="product-specifications">{specifications.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>}<button type="button" className="primary-button" disabled={soldOut} onClick={() => { onAdd(product); onClose(); }}>{soldOut ? "Unavailable" : "Add to cart"}<PlusIcon /></button></div></section></>;
}

export function Storefront({
  initialPage,
  initialFilter = "all",
  initialCheckoutStep = "cart",
  initialPanelOpen = false,
  focusProductId,
  heroSlides = [],
  settings,
}: StorefrontProps) {
  const [productPage, setProductPage] = useState(initialPage);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const filter = initialFilter;
  const [cartOpen, setCartOpen] = useState(initialPanelOpen);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "details">(
    initialCheckoutStep,
  );
  const [details, setDetails] = useState<CheckoutDetails>(emptyDetails);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState(focusProductId ?? "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const visitorIdRef = useRef("");
  const userIdRef = useRef("");
  const cartStorageKeyRef = useRef(CART_KEY);
  const favoritesStorageKeyRef = useRef(FAVORITES_KEY);
  const searchRequestRef = useRef(0);
  const searchMountedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(async () => {
      const authClient = createSupabaseBrowserClient();
      const { data: authData } = authClient
        ? await authClient.auth.getUser()
        : { data: { user: null } };
      const userId = authData.user?.id ?? "";
      userIdRef.current = userId;

      const cartStorageKey = userId ? `${CART_KEY}:${userId}` : CART_KEY;
      const favoritesStorageKey = userId ? `${FAVORITES_KEY}:${userId}` : FAVORITES_KEY;
      cartStorageKeyRef.current = cartStorageKey;
      favoritesStorageKeyRef.current = favoritesStorageKey;

      const storedCart = readStoredJson<CartItem[]>(
        cartStorageKey,
        userId
          ? readStoredJson<CartItem[]>(CART_KEY, readStoredJson<CartItem[]>(LEGACY_CART_KEY, []))
          : readStoredJson<CartItem[]>(LEGACY_CART_KEY, []),
      );
      const normalizedCart = storedCart
        .filter((item) => item?.id && Number.isFinite(item.price))
        .map((item) => ({
          ...item,
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        }));

      const storedFavorites = readStoredJson<string[]>(
        favoritesStorageKey,
        userId ? readStoredJson<string[]>(FAVORITES_KEY, []) : [],
      ).filter(
        (id): id is string => typeof id === "string",
      );

      let visitorId = localStorage.getItem(VISITOR_KEY) ?? "";
      if (!visitorId) {
        visitorId = createVisitorId();
        localStorage.setItem(VISITOR_KEY, visitorId);
      }
      visitorIdRef.current = userId || visitorId;

      const favoritesRequest = fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: visitorIdRef.current, productIds: storedFavorites }),
      }).catch(() => null);
      const cartRequest = userId
        ? fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: normalizedCart.map((item) => ({ productId: item.id, quantity: item.quantity })),
            }),
          }).catch(() => null)
        : Promise.resolve(null);

      const [favoritesResponse, cartResponse] = await Promise.all([favoritesRequest, cartRequest]);
      let syncedFavorites = storedFavorites;
      if (favoritesResponse?.ok) {
        const result = (await favoritesResponse.json()) as { productIds?: string[] };
        if (Array.isArray(result.productIds)) syncedFavorites = result.productIds;
        if (userId) localStorage.removeItem(FAVORITES_KEY);
      }
      let syncedCart = normalizedCart;
      if (cartResponse?.ok) {
        const result = (await cartResponse.json()) as { items?: CartItem[] };
        if (Array.isArray(result.items)) syncedCart = result.items;
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(LEGACY_CART_KEY);
      }

      // Preserve interactions made while account data was loading and merge
      // them with the account's server-side state.
      setCart((currentCart) => mergeCarts(syncedCart, currentCart));
      setFavoriteIds((currentIds) => [...new Set([...syncedFavorites, ...currentIds])]);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(cartStorageKeyRef.current, JSON.stringify(cart));
    if (!userIdRef.current) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        }),
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(favoritesStorageKeyRef.current, JSON.stringify(favoriteIds));
    }
  }, [favoriteIds, hydrated]);

  useEffect(() => {
    document.body.style.overflow = cartOpen || selectedProduct ? "hidden" : "";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setCartOpen(false); setSelectedProduct(null); }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cartOpen, selectedProduct]);

  useEffect(() => {
    if (!focusProductId) return;
    const frame = requestAnimationFrame(() => {
      setHighlightedProductId(focusProductId);
      const productCard = document.getElementById(`product-${focusProductId}`);
      productCard?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    const timer = window.setTimeout(() => setHighlightedProductId(""), 4500);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusProductId, productPage.products]);

  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true;
      return;
    }

    const requestId = ++searchRequestRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setProductsLoading(true);
      try {
        const parameters = new URLSearchParams({
          page: "1",
          pageSize: String(productPage.pageSize),
        });
        if (query.trim()) parameters.set("q", query.trim());
        if (category) parameters.set("category", category);
        if (sort) parameters.set("sort", sort);
        if (featuredOnly) parameters.set("featured", "true");
        const response = await fetch(`/api/products?${parameters}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to search products.");
        const result = (await response.json()) as PaginatedProducts;
        if (searchRequestRef.current === requestId) setProductPage(result);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (searchRequestRef.current === requestId) {
          console.warn(error instanceof Error ? error.message : "Unable to search products.");
        }
      } finally {
        if (searchRequestRef.current === requestId) setProductsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, sort, featuredOnly, productPage.pageSize]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(realtimeTopics.catalog).on("broadcast", { event: "catalog-changed" }, () => {
      const parameters = new URLSearchParams({ page: String(productPage.page), pageSize: String(productPage.pageSize) });
      if (query.trim()) parameters.set("q", query.trim());
      if (category) parameters.set("category", category);
      if (sort) parameters.set("sort", sort);
      if (featuredOnly) parameters.set("featured", "true");
      void fetch(`/api/products?${parameters}`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result: PaginatedProducts | null) => { if (result) setProductPage(result); });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [category, featuredOnly, productPage.page, productPage.pageSize, query, sort]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return productPage.products.filter((product) => {
      const matchesFilter =
        filter === "all" || favoriteIds.includes(product.id);
      const matchesSearch =
        !term ||
        `${product.title} ${product.description}`.toLowerCase().includes(term);
      return matchesFilter && matchesSearch;
    });
  }, [favoriteIds, filter, productPage.products, query]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + productPrice(item) * item.quantity, 0);
  const selectedDelivery = getDeliveryArea(details.area) ?? deliveryAreas[0];
  const checkoutTotal = subtotal + selectedDelivery.fee;
  const visibleStart = productPage.total
    ? (productPage.page - 1) * productPage.pageSize + 1
    : 0;
  const visibleEnd = Math.min(
    productPage.page * productPage.pageSize,
    productPage.total,
  );
  const catalogLoading = productsLoading || (filter === "favorites" && !hydrated);
  const searchResults = query.trim() ? filtered.slice(0, 5) : [];
  const whatsappNumber = settings.whatsapp_number.replace(/\D/g, "") ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "";

  function openCart(step: "cart" | "details" = "cart") {
    setCheckoutStep(step);
    setCartOpen(true);
  }

  function selectSearchResult(product: Product) {
    setQuery(product.title);
    setSearchFocused(false);
    requestAnimationFrame(() => {
      document.getElementById(`product-${product.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  async function loadPage(page: number) {
    if (
      page === productPage.page ||
      page < 1 ||
      page > productPage.totalPages ||
      productsLoading
    ) return;

    setProductsLoading(true);
    const requestId = ++searchRequestRef.current;
    try {
      const parameters = new URLSearchParams({
        page: String(page),
        pageSize: String(productPage.pageSize),
      });
      if (query.trim()) parameters.set("q", query.trim());
      if (category) parameters.set("category", category);
      if (sort) parameters.set("sort", sort);
      if (featuredOnly) parameters.set("featured", "true");
      const response = await fetch(`/api/products?${parameters}`);
      if (!response.ok) throw new Error("Unable to load this page.");
      if (searchRequestRef.current !== requestId) return;
      setProductPage((await response.json()) as PaginatedProducts);
      document.getElementById("products")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load products.");
    } finally {
      if (searchRequestRef.current === requestId) setProductsLoading(false);
    }
  }

  function addToCart(product: Product) {
    if ((product.stock_quantity ?? 10) <= 0) return;
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      const maximum = product.stock_quantity ?? 10;
      return existing
        ? items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: Math.min(maximum, item.quantity + 1) }
              : item,
          )
        : [...items, { ...product, quantity: 1 }];
    });
    openCart();
  }

  function changeQuantity(id: string, amount: number) {
    setCart((items) =>
      items
        .map((item) =>
          item.id === id ? { ...item, quantity: Math.min(item.stock_quantity ?? 10, item.quantity + amount) } : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function toggleFavorite(id: string) {
    const removing = favoriteIds.includes(id);
    setFavoriteIds((ids) =>
      removing ? ids.filter((item) => item !== id) : [...ids, id],
    );

    const visitorId = visitorIdRef.current;
    if (!visitorId) return;
    void fetch("/api/favorites", {
      method: removing ? "DELETE" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, productId: id }),
    }).catch(() => {
      // The next page load retries synchronization from local storage.
    });
  }

  async function sendToWhatsApp(event?: FormEvent) {
    event?.preventDefault();
    if (!cart.length || orderSubmitting) return;

    setOrderSubmitting(true);
    setOrderError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: details,
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });
      const receipt = (await response.json()) as OrderReceipt & { error?: string };
      if (!response.ok) throw new Error(receipt.error ?? "Unable to save your order.");

      const lines = [
        `Hello Codart! I'd like to confirm order #${receipt.id.slice(0, 8).toUpperCase()}:`,
        "",
        ...cart.map(
          (item, index) =>
            `${index + 1}. ${item.title} × ${item.quantity} — ${money.format(productPrice(item) * item.quantity)}`,
        ),
        "",
        `Subtotal: ${money.format(receipt.subtotal)}`,
        `Delivery: ${money.format(receipt.deliveryFee)}`,
        `Total: ${money.format(receipt.total)}`,
        ...(details.name ? ["", `Name: ${details.name}`] : []),
        ...(details.phone ? [`Phone: ${details.phone}`] : []),
        ...(details.email ? [`Email: ${details.email}`] : []),
        ...(details.address ? [`Address: ${details.address}`] : []),
        `Area: ${selectedDelivery.label}`,
        `Payment: ${getPaymentMethod(details.paymentMethod)?.label ?? details.paymentMethod}`,
        ...(details.note ? [`Note: ${details.note}`] : []),
        "",
        "Please confirm availability. Thank you!",
      ];
      const message = encodeURIComponent(lines.join("\n"));
      const url = whatsappNumber
        ? `https://wa.me/${whatsappNumber}?text=${message}`
        : `https://wa.me/?text=${message}`;
      window.open(url, "_blank", "noopener,noreferrer");
      setCart([]);
      setDetails(emptyDetails);
      setCartOpen(false);
      window.location.assign(`/order-confirmation?order=${encodeURIComponent(receipt.id)}&total=${encodeURIComponent(String(receipt.total))}`);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Unable to save your order.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  return (
    <div className="site-shell" style={{ "--product-image-background": settings.product_background_color } as CSSProperties}>
      <header className="site-header">
        <Link href="/" className="brand header-brand" aria-label={`${settings.site_name} home`}>
          <Image className="header-brand-logo" src={settings.site_logo_url} alt={settings.site_name} width={512} height={512} priority />
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/#products">{settings.header_shop_label}</Link>
          <Link href="/#story">{settings.header_story_label}</Link>
          <Link href="/#contact">{settings.header_contact_label}</Link>
        </nav>
        <div className="header-actions">
          <Link className="track-trigger" href="/track-order" aria-label="Track an order"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 7h14v12H5z" /><path d="M8 7V5h8v2M9 12h6M12 9v6" /></svg><span>{settings.header_track_label}</span></Link>
          <AuthButton />
          <Link
            href="/favorites"
            className={`favorite-trigger ${filter === "favorites" ? "is-active" : ""}`}
            aria-label="Open saved products"
          >
            <HeartIcon filled={favoriteIds.length > 0} />
            <span>{settings.header_saved_label}</span>
            {favoriteIds.length > 0 && <strong>{favoriteIds.length}</strong>}
          </Link>
          <button
            type="button"
            className="cart-trigger"
            aria-label={`Open cart with ${itemCount} items`}
            onClick={() => openCart()}
          >
            <BagIcon />
            <span>{settings.header_cart_label}</span>
            {itemCount > 0 && <strong>{itemCount}</strong>}
          </button>
        </div>
      </header>

      <main>
        {filter === "favorites" ? (
          <section className="saved-hero">
            <div className="saved-hero-glow" />
            <div className="saved-hero-copy">
              <p className="eyebrow">Your personal shortlist</p>
              <h1>Saved for <em>later.</em></h1>
              <p>Everything you liked, collected in one quiet place. Compare your picks or move them straight into your cart.</p>
              <Link className="saved-back-link" href="/#products"><ArrowIcon /> Back to all products</Link>
            </div>
            <div className="saved-count" aria-live="polite">
              <HeartIcon filled />
              <strong>{hydrated ? favoriteIds.length : "—"}</strong>
              <span>{favoriteIds.length === 1 ? "saved item" : "saved items"}</span>
            </div>
          </section>
        ) : <HeroCarousel slides={heroSlides} settings={settings} />}

        <section className={`products-section ${filter === "favorites" ? "saved-products-section" : ""}`} id="products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{filter === "favorites" ? "Your saved products" : settings.catalog_eyebrow}</p>
              <h2>{filter === "favorites" ? "Favorites." : settings.catalog_title}</h2>
            </div>
            <div className="product-search" onFocus={() => setSearchFocused(true)} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false);
            }}>
              <label className="search-box">
                <SearchIcon />
                <span className="sr-only">Search products</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={settings.catalog_search_placeholder} autoComplete="off" role="combobox" aria-expanded={searchFocused && Boolean(query.trim())} aria-controls="product-search-results" />
                {query && <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search"><CloseIcon /></button>}
              </label>
              {searchFocused && query.trim() && (
                <div className="search-results" id="product-search-results" role="listbox">
                  <div className="search-results-heading"><span>Products</span><small>{productPage.total} {productPage.total === 1 ? "match" : "matches"}</small></div>
                  {searchResults.length ? searchResults.map((product) => (
                    <button type="button" className="search-result" key={product.id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectSearchResult(product)} role="option" aria-selected={false}>
                      <span className="search-result-image"><ProductVisual src={product.image_url} alt="" /></span>
                      <span className="search-result-copy"><strong>{product.title}</strong><small>{product.description}</small></span>
                      <b>{money.format(product.price)}</b><ArrowIcon className="search-result-arrow" />
                    </button>
                  )) : <div className="search-no-results"><SearchIcon /><span><strong>No products found</strong><small>Try a broader search term</small></span></div>}
                </div>
              )}
            </div>
          </div>

          {filter === "all" && <div className="filter-area">
            <div className="filter-toolbar"><button type="button" className={`filter-trigger ${filtersOpen ? "is-active" : ""}`} aria-expanded={filtersOpen} aria-controls="catalog-filter-menu" onClick={() => setFiltersOpen((open) => !open)}><span className="filter-trigger-icon" aria-hidden="true"><i /><i /><i /></span><span>Filter & sort</span>{(category || featuredOnly || sort !== "newest") && <b>Active</b>}</button></div>
            {filtersOpen && <div className="catalog-controls" id="catalog-filter-menu" aria-label="Catalog filters">
            <div className="category-filters">
              <button type="button" className={!category ? "is-active" : ""} onClick={() => setCategory("")}>All</button>
              {(productPage.categories ?? []).map((item) => <button type="button" className={category === item ? "is-active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}
            </div>
            <div className="catalog-selects">
              <label><span className="sr-only">Featured filter</span><select value={featuredOnly ? "featured" : "all"} onChange={(event) => setFeaturedOnly(event.target.value === "featured")}><option value="all">All products</option><option value="featured">Featured only</option></select></label>
              <label><span className="sr-only">Sort products</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label>
              <button type="button" className="filter-reset" onClick={() => { setCategory(""); setFeaturedOnly(false); setSort("newest"); }}>Reset</button>
            </div>
          </div>}
          </div>}

          <div className="catalog-status" aria-live="polite">
            <span>
              {catalogLoading
                ? query.trim() ? "Searching the catalog…" : "Loading products…"
                : filter === "favorites"
                  ? `${filtered.length} saved ${filtered.length === 1 ? "product" : "products"}`
                  : `Showing ${visibleStart}–${visibleEnd} of ${productPage.total} ${query.trim() ? "results" : "products"}`}
            </span>
            {query.trim() && !catalogLoading && <strong>Search: “{query.trim()}”</strong>}
          </div>

          {catalogLoading ? <ProductGridSkeleton count={Math.min(productPage.pageSize, 6)} /> : filtered.length ? (
            <div className="product-grid">
              {filtered.map((product, index) => {
                const isFavorite = favoriteIds.includes(product.id);
                const quantityInCart =
                  cart.find((item) => item.id === product.id)?.quantity ?? 0;
                return (
                  <article className={`product-card ${highlightedProductId === product.id ? "is-ai-highlighted" : ""}`} id={`product-${product.id}`} key={product.id}>
                    <div className="product-media">
                      <ProductVisual src={product.image_url} alt={product.title} priority={index < 2} />
                      <span className="product-index">{String(index + 1).padStart(2, "0")}</span>
                      <div className="product-badges">{product.featured && <span>Featured</span>}{product.sale_price != null && product.sale_price < product.price && <span className="sale-badge">Sale {Math.round((1 - product.sale_price / product.price) * 100)}%</span>}{(product.stock_quantity ?? 10) <= 0 && <span className="stock-badge">Out of stock</span>}</div>
                      <button type="button" data-analytics="favorite_product" className={`favorite-button ${isFavorite ? "is-active" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label={`${isFavorite ? "Remove" : "Add"} ${product.title} ${isFavorite ? "from" : "to"} favorites`}><HeartIcon filled={isFavorite} /></button>
                    </div>
                    <div className="product-card-body">
                      <button type="button" className="product-title-button" data-analytics="open_product" onClick={() => setSelectedProduct(product)}><h3>{product.title}</h3></button>
                      {product.category && <span className="product-category">{product.category}</span>}
                      <p>{product.description}</p>
                      <div className="product-action">
                        <strong className={product.sale_price != null && product.sale_price < product.price ? "sale-price" : ""}>{product.sale_price != null && product.sale_price < product.price && <del>{money.format(product.price)}</del>}{money.format(productPrice(product))}</strong>
                        <button
                          type="button"
                          data-analytics="add_to_cart"
                          className={quantityInCart ? "is-in-cart" : ""}
                          onClick={() => addToCart(product)}
                          disabled={(product.stock_quantity ?? 10) <= 0}
                          aria-label={`Add ${product.title} to cart${quantityInCart ? `, ${quantityInCart} currently in cart` : ""}`}
                        >
                          {(product.stock_quantity ?? 10) <= 0 ? "Out of stock" : quantityInCart ? `In cart · ${quantityInCart}` : "Add to cart"}
                          <PlusIcon />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><h3>{filter === "favorites" ? "Nothing saved yet" : "No products found"}</h3><p>{filter === "favorites" ? "Save products from the collection and they’ll appear here." : "Try another search or reset your filters."}</p>{filter === "favorites" ? <Link className="text-button centered" href="/#products">Browse all products <ArrowIcon /></Link> : <button type="button" className="text-button centered" onClick={() => { setQuery(""); setCategory(""); setFeaturedOnly(false); setSort("newest"); }}>Reset filters <ArrowIcon /></button>}</div>
          )}

          {!catalogLoading && filter === "all" && productPage.totalPages > 1 && (
            <nav className="pagination" aria-label="Product pages">
              <button type="button" className="pagination-arrow" onClick={() => void loadPage(productPage.page - 1)} disabled={productPage.page === 1}><ArrowIcon /><span>Previous</span></button>
              {Array.from({ length: productPage.totalPages }, (_, index) => index + 1).map((page) => (
                <button type="button" key={page} className={page === productPage.page ? "is-active" : ""} onClick={() => void loadPage(page)} aria-current={page === productPage.page ? "page" : undefined}>{String(page).padStart(2, "0")}</button>
              ))}
              <button type="button" className="pagination-arrow pagination-next" onClick={() => void loadPage(productPage.page + 1)} disabled={productPage.page === productPage.totalPages}><span>Next</span><ArrowIcon /></button>
              <span className="pagination-summary">Page {productPage.page} of {productPage.totalPages}</span>
            </nav>
          )}
        </section>

        {filter === "all" && <section className={`story-section ${settings.story_image_url ? "has-story-image" : ""}`} id="story">
          {settings.story_image_url && <Image className="story-background" src={settings.story_image_url} alt="" fill sizes="100vw" />}
          <div className="story-overlay" />
          <div className="story-heading">
            <p className="eyebrow">{settings.story_eyebrow}</p>
            <h2>{settings.story_title}</h2>
          </div>
          <p>{settings.story_body}</p>
          <div className="story-line" />
        </section>}
      </main>

      <footer className="site-footer" id="contact">
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label={`${settings.site_name} home`}><Image className="brand-logo" src={settings.site_logo_url} alt={settings.site_name} width={512} height={512} /></Link>
            <p>{settings.footer_description}</p>
          </div>
          <nav className="footer-navigation" aria-label="Footer navigation">
            <p className="eyebrow">{settings.footer_nav_heading}</p>
            <Link href="/#products">{settings.footer_shop_label}</Link>
            <Link href="/favorites">{settings.footer_saved_label}</Link>
            <Link href="/track-order">{settings.footer_track_label}</Link>
            <Link href="/#story">{settings.footer_story_label}</Link>
          </nav>
          <div className="footer-contact">
            <p className="eyebrow">{settings.footer_contact_eyebrow}</p>
            <h2>{settings.footer_contact_title}</h2>
            <p>{settings.footer_contact_body}</p>
            <a className="footer-whatsapp" data-analytics="whatsapp_contact" href={whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello ${settings.site_name}! I have a question.`)}` : "https://wa.me/"} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /><span>{settings.footer_whatsapp_label}</span><ArrowIcon /></a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {settings.footer_copyright}</span>
          <span>{settings.footer_tagline}</span>
        </div>
      </footer>

      {selectedProduct && <ProductDetailsModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />}

      {cartOpen && (
        <>
          <div className="drawer-backdrop is-open" onClick={() => setCartOpen(false)} />
          <aside className="cart-drawer is-open" aria-label="Shopping cart" role="dialog" aria-modal="true" aria-live="polite">
        <div className="drawer-header">
          <div><p className="eyebrow">{checkoutStep === "details" ? "One last step" : "Your selection"}</p><h2>{checkoutStep === "details" ? "Order details" : "Cart"} <span>{itemCount}</span></h2></div>
          <button type="button" className="icon-button" aria-label="Close cart" onClick={() => setCartOpen(false)}><CloseIcon /></button>
        </div>

        {checkoutStep === "details" && cart.length ? (
          <form className="checkout-form" onSubmit={sendToWhatsApp}>
            <button type="button" className="checkout-back" onClick={() => setCheckoutStep("cart")}><ArrowIcon /> Back to cart</button>
            <div className="checkout-summary"><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span><strong>{money.format(checkoutTotal)}</strong></div>
            <label><span>Name</span><input required value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} placeholder="Your name" autoComplete="name" /></label>
            <label><span>Email</span><input required value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })} placeholder="you@example.com" type="email" autoComplete="email" /></label>
            <label><span>Phone</span><input required value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} placeholder="Your phone number" type="tel" autoComplete="tel" /></label>
            <label><span>Delivery address</span><textarea required value={details.address} onChange={(event) => setDetails({ ...details, address: event.target.value })} placeholder="Street, building, floor, and landmark" rows={3} autoComplete="street-address" /></label>
            <label><span>Delivery area</span><select value={details.area} onChange={(event) => setDetails({ ...details, area: event.target.value as CheckoutDetails["area"] })}>{deliveryAreas.map((area) => <option value={area.value} key={area.value}>{area.label} · {money.format(area.fee)}</option>)}</select></label>
            <label><span>Payment method</span><select value={details.paymentMethod} onChange={(event) => setDetails({ ...details, paymentMethod: event.target.value as CheckoutDetails["paymentMethod"] })}>{paymentMethods.map((method) => <option value={method.value} key={method.value}>{method.label}</option>)}</select></label>
            <label><span>Order note <small>Optional</small></span><textarea value={details.note} onChange={(event) => setDetails({ ...details, note: event.target.value })} placeholder="Color, delivery area, or anything else" rows={4} /></label>
            <div className="checkout-costs"><span>Subtotal <b>{money.format(subtotal)}</b></span><span>Delivery <b>{money.format(selectedDelivery.fee)}</b></span><strong>Total <b>{money.format(checkoutTotal)}</b></strong></div>
            <div className="checkout-note"><WhatsAppIcon /><p><strong>Checkout continues on WhatsApp</strong><span>You’ll also receive an email receipt when email delivery is configured.</span></p></div>
            {orderError && <p className="checkout-error" role="alert">{orderError}</p>}
            <button className="whatsapp-button" type="submit" disabled={orderSubmitting}><WhatsAppIcon />{orderSubmitting ? "Saving order…" : "Save & send via WhatsApp"}</button>
          </form>
        ) : (
          <>
            <div className="cart-items">
              {!cart.length ? (
                <div className="cart-empty"><BagIcon /><h3>Your cart is quiet.</h3><p>Add something exceptional from the collection.</p><Link className="text-button" href="/#products" onClick={() => setCartOpen(false)}>Continue shopping <ArrowIcon /></Link></div>
              ) : cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-thumb"><ProductVisual src={item.image_url} alt={item.title} /></div>
                  <div className="cart-item-info">
                    <div><h3>{item.title}</h3><strong>{money.format(productPrice(item) * item.quantity)}</strong></div>
                    <div className="quantity-control"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Remove one ${item.title}`}><MinusIcon /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Add one ${item.title}`}><PlusIcon /></button></div>
                  </div>
                  <button type="button" className="remove-button" onClick={() => setCart((items) => items.filter((product) => product.id !== item.id))} aria-label={`Remove ${item.title}`}><TrashIcon /></button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-total"><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>
                <p>Taxes and delivery, if applicable, are confirmed before payment.</p>
                <button type="button" className="cart-checkout-button" onClick={() => setCheckoutStep("details")}><span>Continue to order</span><ArrowIcon /></button>
              </div>
            )}
          </>
        )}
          </aside>
        </>
      )}
    </div>
  );
}
