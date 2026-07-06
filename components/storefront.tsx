"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowIcon, BagIcon, CloseIcon, MinusIcon, PlusIcon, SearchIcon, TrashIcon, WhatsAppIcon } from "@/components/icons";
import { ProductVisual } from "@/components/product-visual";
import { ProductGridSkeleton } from "@/components/skeletons";
import type { CartItem, PaginatedProducts, Product } from "@/lib/types";

const CART_KEY = "codart-cart";
const LEGACY_CART_KEY = "nexora-cart";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Storefront({ initialPage }: { initialPage: PaginatedProducts }) {
  const [productPage, setProductPage] = useState(initialPage);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved =
          localStorage.getItem(CART_KEY) ??
          localStorage.getItem(LEGACY_CART_KEY);
        if (saved) setCart(JSON.parse(saved) as CartItem[]);
      } catch {
        localStorage.removeItem(CART_KEY);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [cartOpen]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return productPage.products;
    return productPage.products.filter((product) =>
      `${product.title} ${product.description}`.toLowerCase().includes(term),
    );
  }, [productPage.products, query]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const searchResults = query.trim() ? filtered.slice(0, 5) : [];
  const whatsappNumber =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";

  function selectSearchResult(product: Product) {
    setQuery(product.title);
    setSearchFocused(false);
    requestAnimationFrame(() => {
      document
        .getElementById(`product-${product.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function loadPage(page: number) {
    if (
      page === productPage.page ||
      page < 1 ||
      page > productPage.totalPages ||
      productsLoading
    ) {
      return;
    }

    setProductsLoading(true);
    setQuery("");
    try {
      const response = await fetch(
        `/api/products?page=${page}&pageSize=${productPage.pageSize}`,
      );
      if (!response.ok) throw new Error("Unable to load this page.");
      setProductPage((await response.json()) as PaginatedProducts);
      document
        .getElementById("products")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to load products.");
    } finally {
      setProductsLoading(false);
    }
  }

  function addToCart(product: Product) {
    setCart((items) => {
      const existing = items.find((item) => item.id === product.id);
      return existing
        ? items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  }

  function changeQuantity(id: string, amount: number) {
    setCart((items) =>
      items
        .map((item) => item.id === id ? { ...item, quantity: item.quantity + amount } : item)
        .filter((item) => item.quantity > 0),
    );
  }

  function sendToWhatsApp() {
    if (!whatsappNumber) {
      alert("Add NEXT_PUBLIC_WHATSAPP_NUMBER to .env.local before sending orders.");
      return;
    }
    const lines = [
      "Hello Codart! I'd like to order:",
      "",
      ...cart.map((item, index) => `${index + 1}. ${item.title} × ${item.quantity} — ${money.format(item.price * item.quantity)}`),
      "",
      `Total: ${money.format(total)}`,
      "",
      "Please confirm availability. Thank you!",
    ];
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link href="/" className="brand" aria-label="Codart home">
          <Image className="brand-logo" src="/codart-logo.png" alt="Codart" width={512} height={512} priority />
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#products">Shop</a>
          <a href="#story">Our story</a>
          <a href="#contact">Contact</a>
        </nav>
        <button className="cart-trigger" onClick={() => setCartOpen(true)} aria-label={`Open cart with ${itemCount} items`}>
          <BagIcon />
          <span>Cart</span>
          {itemCount > 0 && <strong>{itemCount}</strong>}
        </button>
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow hero-glow-one" />
          <div className="hero-glow hero-glow-two" />
          <div className="hero-content">
            <p className="eyebrow">Technology, thoughtfully selected</p>
            <h1>Better tech.<br /><em>Less noise.</em></h1>
            <p className="hero-copy">Future-ready essentials for your desk, your pocket, and everything in between.</p>
            <a className="primary-button" href="#products">Explore the collection <ArrowIcon /></a>
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
            <div><p className="eyebrow">The collection</p><h2>Tools worth using.</h2></div>
            <div
              className="product-search"
              onFocus={() => setSearchFocused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setSearchFocused(false);
                }
              }}
            >
              <label className="search-box">
                <SearchIcon />
                <span className="sr-only">Search products</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search the collection"
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={searchFocused && Boolean(query.trim())}
                  aria-controls="product-search-results"
                />
                {query && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <CloseIcon />
                  </button>
                )}
              </label>

              {searchFocused && query.trim() && (
                <div className="search-results" id="product-search-results" role="listbox">
                  <div className="search-results-heading">
                    <span>Products</span>
                    <small>{filtered.length} {filtered.length === 1 ? "match" : "matches"}</small>
                  </div>
                  {searchResults.length ? (
                    searchResults.map((product) => (
                      <button
                        type="button"
                        className="search-result"
                        key={product.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSearchResult(product)}
                        role="option"
                        aria-selected={false}
                      >
                        <span className="search-result-image">
                          <ProductVisual src={product.image_url} alt="" />
                        </span>
                        <span className="search-result-copy">
                          <strong>{product.title}</strong>
                          <small>{product.description}</small>
                        </span>
                        <b>{money.format(product.price)}</b>
                        <ArrowIcon className="search-result-arrow" />
                      </button>
                    ))
                  ) : (
                    <div className="search-no-results">
                      <SearchIcon />
                      <span><strong>No products found</strong><small>Try a broader search term</small></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {productsLoading ? (
            <ProductGridSkeleton count={productPage.pageSize} />
          ) : filtered.length > 0 ? (
            <div className="product-grid">
              {filtered.map((product, index) => (
                <article className="product-card" id={`product-${product.id}`} key={product.id}>
                  <div className="product-media"><ProductVisual src={product.image_url} alt={product.title} priority={index < 2} /><span className="product-index">0{index + 1}</span></div>
                  <div className="product-card-body">
                    <h3>{product.title}</h3>
                    <p>{product.description}</p>
                    <div className="product-action"><strong>{money.format(product.price)}</strong><button onClick={() => addToCart(product)}>Add to cart <PlusIcon /></button></div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state"><SearchIcon /><h3>No products found</h3><p>Try a different search term.</p></div>
          )}

          {!productsLoading && productPage.totalPages > 1 && (
            <nav className="pagination" aria-label="Product pages">
              <button
                className="pagination-arrow"
                onClick={() => void loadPage(productPage.page - 1)}
                disabled={productPage.page === 1}
                aria-label="Previous page"
              >
                <ArrowIcon />
              </button>
              {Array.from(
                { length: productPage.totalPages },
                (_, index) => index + 1,
              ).map((page) => (
                <button
                  key={page}
                  className={page === productPage.page ? "is-active" : ""}
                  onClick={() => void loadPage(page)}
                  aria-current={page === productPage.page ? "page" : undefined}
                >
                  {String(page).padStart(2, "0")}
                </button>
              ))}
              <button
                className="pagination-arrow pagination-next"
                onClick={() => void loadPage(productPage.page + 1)}
                disabled={productPage.page === productPage.totalPages}
                aria-label="Next page"
              >
                <ArrowIcon />
              </button>
              <span className="pagination-summary">
                {productPage.total} products
              </span>
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
        <Link href="/" className="brand" aria-label="Codart home">
          <Image className="brand-logo" src="/codart-logo.png" alt="Codart" width={512} height={512} />
        </Link>
        <p>Questions? Build a cart and send us a message.</p>
        <div className="footer-actions">
          <a
            className="footer-whatsapp"
            href={whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Codart! I have a question.")}` : "#"}
            target={whatsappNumber ? "_blank" : undefined}
            rel={whatsappNumber ? "noopener noreferrer" : undefined}
            onClick={(event) => {
              if (!whatsappNumber) {
                event.preventDefault();
                alert("Add NEXT_PUBLIC_WHATSAPP_NUMBER to .env.local first.");
              }
            }}
          >
            <WhatsAppIcon />
            <span>Message us</span>
          </a>
        </div>
      </footer>

      <div className={`drawer-backdrop ${cartOpen ? "is-open" : ""}`} onClick={() => setCartOpen(false)} />
      <aside className={`cart-drawer ${cartOpen ? "is-open" : ""}`} aria-hidden={!cartOpen} aria-label="Shopping cart">
        <div className="drawer-header"><div><p className="eyebrow">Your selection</p><h2>Cart <span>{itemCount}</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close cart"><CloseIcon /></button></div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="cart-empty"><BagIcon /><h3>Your cart is quiet.</h3><p>Add something exceptional from the collection.</p><button className="text-button" onClick={() => setCartOpen(false)}>Continue shopping <ArrowIcon /></button></div>
          ) : cart.map((item) => (
            <div className="cart-item" key={item.id}>
              <div className="cart-thumb"><ProductVisual src={item.image_url} alt={item.title} /></div>
              <div className="cart-item-info">
                <div><h3>{item.title}</h3><strong>{money.format(item.price)}</strong></div>
                <div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)} aria-label={`Remove one ${item.title}`}><MinusIcon /></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)} aria-label={`Add one ${item.title}`}><PlusIcon /></button></div>
              </div>
              <button className="remove-button" onClick={() => setCart((items) => items.filter((product) => product.id !== item.id))} aria-label={`Remove ${item.title}`}><TrashIcon /></button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total"><span>Total</span><strong>{money.format(total)}</strong></div>
            <p>No online payment. We’ll confirm availability and details with you on WhatsApp.</p>
            <button className="whatsapp-button" onClick={sendToWhatsApp}><WhatsAppIcon />Send order via WhatsApp</button>
          </div>
        )}
      </aside>
    </div>
  );
}
