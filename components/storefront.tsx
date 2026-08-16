"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  OrderReceipt,
  PaginatedProducts,
  Product,
} from "@/lib/types";

type StorefrontProps = {
  initialPage: PaginatedProducts;
  initialFilter?: "all" | "favorites";
  initialCheckoutStep?: "cart" | "details";
  initialPanelOpen?: boolean;
  focusProductId?: string;
};

const emptyDetails: CheckoutDetails = { name: "", phone: "", note: "" };

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

export function Storefront({
  initialPage,
  initialFilter = "all",
  initialCheckoutStep = "cart",
  initialPanelOpen = false,
  focusProductId,
}: StorefrontProps) {
  const [productPage, setProductPage] = useState(initialPage);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "favorites">(initialFilter);
  const [cartOpen, setCartOpen] = useState(initialPanelOpen);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "details">(
    initialCheckoutStep,
  );
  const [details, setDetails] = useState<CheckoutDetails>(emptyDetails);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const visitorIdRef = useRef("");
  const searchRequestRef = useRef(0);
  const searchMountedRef = useRef(false);

  useEffect(() => {
    queueMicrotask(() => {
      const storedCart = readStoredJson<CartItem[]>(
        CART_KEY,
        readStoredJson<CartItem[]>(LEGACY_CART_KEY, []),
      );
      const normalizedCart = storedCart
        .filter((item) => item?.id && Number.isFinite(item.price))
        .map((item) => ({
          ...item,
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        }));

      // Preserve an item added immediately after hydration instead of letting
      // the delayed storage read replace it with an older cart.
      setCart((currentCart) =>
        currentCart.length ? currentCart : normalizedCart,
      );
      const storedFavorites = readStoredJson<string[]>(FAVORITES_KEY, []).filter(
        (id): id is string => typeof id === "string",
      );
      setFavoriteIds(storedFavorites);

      let visitorId = localStorage.getItem(VISITOR_KEY) ?? "";
      if (!visitorId) {
        visitorId = createVisitorId();
        localStorage.setItem(VISITOR_KEY, visitorId);
      }
      visitorIdRef.current = visitorId;
      setHydrated(true);

      void fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, productIds: storedFavorites }),
      })
        .then(async (response) => {
          if (!response.ok) return;
          const result = (await response.json()) as { productIds?: string[] };
          if (Array.isArray(result.productIds)) setFavoriteIds(result.productIds);
        })
        .catch(() => {
          // Local favorites remain available while the database is offline.
        });
    });
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favoriteIds));
    }
  }, [favoriteIds, hydrated]);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [cartOpen]);

  useEffect(() => {
    if (!focusProductId) return;
    requestAnimationFrame(() => {
      document.getElementById(`product-${focusProductId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [focusProductId]);

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
  }, [query, productPage.pageSize]);

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
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const visibleStart = productPage.total
    ? (productPage.page - 1) * productPage.pageSize + 1
    : 0;
  const visibleEnd = Math.min(
    productPage.page * productPage.pageSize,
    productPage.total,
  );
  const searchResults = query.trim() ? filtered.slice(0, 5) : [];
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";

  function openCart(step: "cart" | "details" = "cart") {
    setCheckoutStep(step);
    setCartOpen(true);
  }

  function showFavorites() {
    setFilter((current) => current === "favorites" ? "all" : "favorites");
    setSearchFocused(false);
    requestAnimationFrame(() => {
      document.getElementById("products")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
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
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      return existing
        ? items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
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
          item.id === id ? { ...item, quantity: item.quantity + amount } : item,
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
            `${index + 1}. ${item.title} × ${item.quantity} — ${money.format(item.price * item.quantity)}`,
        ),
        "",
        `Total: ${money.format(receipt.total)}`,
        ...(details.name ? ["", `Name: ${details.name}`] : []),
        ...(details.phone ? [`Phone: ${details.phone}`] : []),
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
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Unable to save your order.");
    } finally {
      setOrderSubmitting(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Codart home">
          <Image className="brand-logo" src="/codart-logo.png" alt="Codart" width={512} height={512} priority />
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/#products">Shop</Link>
          <Link href="/#story">Our story</Link>
          <Link href="/#contact">Contact</Link>
        </nav>
        <div className="header-actions">
          <button
            type="button"
            className={`favorite-trigger ${filter === "favorites" ? "is-active" : ""}`}
            aria-label={filter === "favorites" ? "Show all products" : "Show favorite products"}
            onClick={showFavorites}
          >
            <HeartIcon filled={favoriteIds.length > 0} />
            <span>Saved</span>
            {favoriteIds.length > 0 && <strong>{favoriteIds.length}</strong>}
          </button>
          <button
            type="button"
            className="cart-trigger"
            aria-label={`Open cart with ${itemCount} items`}
            onClick={() => openCart()}
          >
            <BagIcon />
            <span>Cart</span>
            {itemCount > 0 && <strong>{itemCount}</strong>}
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="hero-content">
            <p className="eyebrow">Technology, thoughtfully selected</p>
            <h1>Better tech.<br /><em>Less noise.</em></h1>
            <p className="hero-copy">Future-ready essentials for your desk, your pocket, and everything in between.</p>
            <Link className="primary-button" href="/#products">Explore the collection <ArrowIcon /></Link>
          </div>
          <div className="hero-object" aria-hidden="true">
            <span className="hero-ring ring-one" />
            <span className="hero-ring ring-two" />
            <span className="hero-core">C</span>
          </div>
          <div className="hero-stats">
            <span><strong>Curated</strong>Every product, considered</span>
            <span><strong>Direct</strong>Order in one message</span>
            <span><strong>Human</strong>Real support, always</span>
          </div>
        </section>

        <section className="products-section" id="products">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{filter === "favorites" ? "Your saved products" : "The collection"}</p>
              <h2>{filter === "favorites" ? "Favorites." : "Tools worth using."}</h2>
            </div>
            <div className="product-search" onFocus={() => setSearchFocused(true)} onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setSearchFocused(false);
            }}>
              <label className="search-box">
                <SearchIcon />
                <span className="sr-only">Search products</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the collection" autoComplete="off" role="combobox" aria-expanded={searchFocused && Boolean(query.trim())} aria-controls="product-search-results" />
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

          <div className="catalog-status" aria-live="polite">
            <span>
              {productsLoading
                ? query.trim() ? "Searching the catalog…" : "Loading products…"
                : filter === "favorites"
                  ? `${filtered.length} saved ${filtered.length === 1 ? "product" : "products"}`
                  : `Showing ${visibleStart}–${visibleEnd} of ${productPage.total} ${query.trim() ? "results" : "products"}`}
            </span>
            {query.trim() && !productsLoading && <strong>Search: “{query.trim()}”</strong>}
          </div>

          {productsLoading ? <ProductGridSkeleton count={productPage.pageSize} /> : filtered.length ? (
            <div className="product-grid">
              {filtered.map((product, index) => {
                const isFavorite = favoriteIds.includes(product.id);
                const quantityInCart =
                  cart.find((item) => item.id === product.id)?.quantity ?? 0;
                return (
                  <article className="product-card" id={`product-${product.id}`} key={product.id}>
                    <div className="product-media">
                      <ProductVisual src={product.image_url} alt={product.title} priority={index < 2} />
                      <span className="product-index">{String(index + 1).padStart(2, "0")}</span>
                      <button type="button" className={`favorite-button ${isFavorite ? "is-active" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label={`${isFavorite ? "Remove" : "Add"} ${product.title} ${isFavorite ? "from" : "to"} favorites`}><HeartIcon filled={isFavorite} /></button>
                    </div>
                    <div className="product-card-body">
                      <Link href={`/products/${product.id}`}><h3>{product.title}</h3></Link>
                      <p>{product.description}</p>
                      <div className="product-action">
                        <strong>{money.format(product.price)}</strong>
                        <button
                          type="button"
                          className={quantityInCart ? "is-in-cart" : ""}
                          onClick={() => addToCart(product)}
                          aria-label={`Add ${product.title} to cart${quantityInCart ? `, ${quantityInCart} currently in cart` : ""}`}
                        >
                          {quantityInCart ? `In cart · ${quantityInCart}` : "Add to cart"}
                          <PlusIcon />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state"><HeartIcon /><h3>{filter === "favorites" ? "Nothing saved yet" : "No products found"}</h3><p>{filter === "favorites" ? "Tap the heart on a product to keep it here." : "Try a different search term."}</p>{filter === "favorites" && <Link className="text-button centered" href="/#products">Browse all products <ArrowIcon /></Link>}</div>
          )}

          {!productsLoading && filter === "all" && productPage.totalPages > 1 && (
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

        <section className="story-section" id="story">
          <p className="eyebrow">Why Codart</p>
          <h2>We believe good technology should feel simple.</h2>
          <p>So we skip the endless catalog and choose a focused collection of products that earn their place in your day.</p>
          <div className="story-line" />
        </section>
      </main>

      <footer id="contact">
        <Link href="/" className="brand" aria-label="Codart home"><Image className="brand-logo" src="/codart-logo.png" alt="Codart" width={512} height={512} /></Link>
        <p>Questions? Build a cart and send us a message.</p>
        <a className="footer-whatsapp" href={whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Codart! I have a question.")}` : "https://wa.me/"} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /><span>Message us</span></a>
      </footer>

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
            <div className="checkout-summary"><span>{itemCount} {itemCount === 1 ? "item" : "items"}</span><strong>{money.format(total)}</strong></div>
            <label><span>Name</span><input required value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} placeholder="Your name" autoComplete="name" /></label>
            <label><span>Phone</span><input required value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })} placeholder="Your phone number" type="tel" autoComplete="tel" /></label>
            <label><span>Order note <small>Optional</small></span><textarea value={details.note} onChange={(event) => setDetails({ ...details, note: event.target.value })} placeholder="Color, delivery area, or anything else" rows={4} /></label>
            <div className="checkout-note"><WhatsAppIcon /><p><strong>Checkout happens on WhatsApp</strong><span>We’ll confirm stock, delivery, and payment with you directly.</span></p></div>
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
                    <div><h3>{item.title}</h3><strong>{money.format(item.price * item.quantity)}</strong></div>
                    <div className="quantity-control"><button type="button" onClick={() => changeQuantity(item.id, -1)} aria-label={`Remove one ${item.title}`}><MinusIcon /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} aria-label={`Add one ${item.title}`}><PlusIcon /></button></div>
                  </div>
                  <button type="button" className="remove-button" onClick={() => setCart((items) => items.filter((product) => product.id !== item.id))} aria-label={`Remove ${item.title}`}><TrashIcon /></button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="cart-footer">
                <div className="cart-total"><span>Total</span><strong>{money.format(total)}</strong></div>
                <p>Taxes and delivery, if applicable, are confirmed before payment.</p>
                <button type="button" className="whatsapp-button" onClick={() => setCheckoutStep("details")}>Continue to order <ArrowIcon /></button>
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
