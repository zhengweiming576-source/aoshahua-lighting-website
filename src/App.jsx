import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  DraftingCompass,
  ExternalLink,
  Factory,
  Gem,
  Globe2,
  Layers,
  Lightbulb,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Pause,
  Phone,
  Play,
  Search,
  X,
} from 'lucide-react';
import {
  ANNOUNCEMENT,
  CATALOG,
  COMPANY_LEAD,
  CONTACT,
  FACTORY,
  MOQ_NOTE,
  NAV,
  PROCESS,
  PRODUCTS,
  PROJECT_CASES,
  SERIES,
  WHY,
  HERO_SLIDES,
} from './data';
import {
  APP_NAME,
  BRAND_NAME,
  CONTACT_EMAIL,
  LEGAL_ENTITY,
  LEGAL_LINKS,
  LEGAL_PAGES,
  SITE_URL,
} from './legalContent';
import {
  AddToCartButton,
  BuyerWelcomeBar,
  CartButton,
  CartDrawer,
  DetailCartControls,
  MoqNotice,
} from './Cart';
import { clearFocusedProduct, onFocusProduct, productIdFromUrl } from './productFocus';
import AdminPage from './AdminPage';
import MetaCallback from './MetaCallback';

// "Get a quote" opens WhatsApp with a short prefilled message, so a buyer lands
// straight in a chat with our export team instead of an empty mail client.
const QUOTE_HREF = `${CONTACT.whatsappHref}?text=${encodeURIComponent(
  'Hello Aoshahua, I would like a quotation for your lighting.'
)}`;

const ICONS = {
  factory: Factory,
  gem: Gem,
  layers: Layers,
  badge: BadgeCheck,
  compass: DraftingCompass,
  globe: Globe2,
};

const seriesLabel = {
  crystal: 'Crystal Chandeliers',
  wall: 'Wall Sconces',
  table: 'Table Lamps',
  floor: 'Floor Lamps',
  pendant: 'Pendant Lights',
  office: 'Office Lighting',
  custom: 'Large Custom Projects',
  info: '',
  chandelier: 'Chandelier',
  marble: 'Marble',
};

// Shown when a catalog entry has no photo of its own (e.g. the "Information" card).
const PLACEHOLDER_IMG = '/assets/images/placeholder.svg';

// Catalog search — matches the product's type (series), name, model and material.
// The material is stored in the product's `facts` lines (e.g. "Solid brass · Crystal glass"),
// so those are indexed too. The aliases let the owner type common Chinese terms.
const SEARCH_ALIASES = {
  吊灯: 'chandelier',
  水晶: 'crystal',
  云石: 'marble',
  大理石: 'marble',
  石材: 'stone',
  壁灯: 'wall',
  台灯: 'table lamp',
  落地灯: 'floor lamp',
  吸顶灯: 'ceiling',
  铜: 'copper',
  黄铜: 'brass',
  铁: 'iron',
  玻璃: 'glass',
  金属: 'metal',
  工程: 'project',
};

function searchableText(p) {
  return [
    p.name,
    p.model,
    p.id,
    p.summary,
    seriesLabel[p.series] || p.series,
    p.marble ? 'marble stone' : '',
    ...(Array.isArray(p.keywords) ? p.keywords : []),
    ...(Array.isArray(p.facts) ? p.facts : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matchesQuery(p, q) {
  const hay = searchableText(p);
  if (hay.includes(q)) return true;
  return Object.keys(SEARCH_ALIASES).some((cn) => q.includes(cn) && hay.includes(SEARCH_ALIASES[cn]));
}

function Wordmark({ href = '#top' }) {
  return (
    <a className="wordmark" href={href} aria-label="Aoshahua Lighting — home">
      <span className="wordmark__logo">
        <img src="/assets/images/logo/logo-badge.png" alt="Aoshahua Lighting logo" />
      </span>
      <span className="wordmark__text">
        <span className="wordmark__main">Aoshahua</span>
        <span className="wordmark__sub">LIGHTING · ZHONGSHAN · CHINA</span>
      </span>
    </a>
  );
}

function Header({ homeLinks = false, overHero = false }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Stay dark-glass as long as the hero photo is still behind the bar, instead
  // of flipping back to the light bar after a few pixels of scrolling.
  const [overHeroNow, setOverHeroNow] = useState(overHero);
  const prefix = homeLinks ? '/' : '';
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      if (!overHero) return;
      const hero = document.querySelector('.hero');
      setOverHeroNow(hero ? hero.getBoundingClientRect().bottom > 90 : false);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);
  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}${overHeroNow ? ' is-over-hero' : ''}`} data-component="site-header">
      <div className="container header-inner">
        <Wordmark href={homeLinks ? '/' : '#top'} />
        <nav className={`nav${open ? ' nav--open' : ''}`} aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.href} className="nav__link" href={`${prefix}${item.href}`} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          <a
            className="btn btn--ghost btn--sm nav__cta"
            href={QUOTE_HREF}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            Get a Quote <ArrowUpRight size={15} />
          </a>
        </nav>
        {/* Cart, then our contact details, then the mobile menu button. */}
        <div className="header-right">
          <CartButton />
          <div className="header-contact" data-component="header-contact">
            <a className="header-contact__row" href={CONTACT.phoneHref}>
              <span className="header-contact__label">Contact Number:</span>{' '}
              <span className="header-contact__value">{CONTACT.phoneDisplay}</span>
            </a>
            <a className="header-contact__row" href={`mailto:${CONTACT.email}`}>
              <span className="header-contact__label">Contact Email:</span>{' '}
              <span className="header-contact__value">{CONTACT.email}</span>
            </a>
            <a className="header-contact__row" href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
              <span className="header-contact__label">WhatsApp:</span>{' '}
              <span className="header-contact__value">{CONTACT.whatsapp}</span>
            </a>
          </div>
          <button
            className="nav-toggle"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}

// Full-bleed hero carousel. Each slide carries its own photo + copy; the two
// CTAs stay constant. Auto-plays, and exposes arrows / dots / a counter / pause.
// If HERO_SLIDES is ever empty we fall back to the single CATALOG image so the
// page can't render a blank hero.
const HERO_INTERVAL_MS = 8000;

function Hero() {
  const slides =
    HERO_SLIDES && HERO_SLIDES.length
      ? HERO_SLIDES
      : [
          {
            image: CATALOG.image,
            imageAlt: CATALOG.imageAlt,
            eyebrow: CATALOG.eyebrow,
            title: CATALOG.title,
            lede: CATALOG.lede,
          },
        ];
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Warm the remaining slides so the cross-fade never shows a blank frame.
  useEffect(() => {
    slides.forEach((s) => {
      if (!s.image) return;
      const img = new Image();
      img.src = s.image;
    });
  }, [count]);

  useEffect(() => {
    if (paused || count <= 1) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), HERO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, count]);

  const go = (n) => setIndex(((n % count) + count) % count);
  const pad = (n) => String(n).padStart(2, '0');

  return (
    <section className="hero hero--carousel" data-component="hero" aria-roledescription="carousel" aria-label="Featured lighting">
      {slides.map((s, i) => (
        <img
          key={i}
          className={'hero__media' + (i === index ? ' is-active' : '')}
          src={s.image}
          alt={s.imageAlt || ''}
          decoding={i === 0 ? 'async' : 'lazy'}
        />
      ))}
      <div className="hero__scrim" aria-hidden="true" />
      <div className="container hero__inner">
        <div className="hero__slides">
          {slides.map((s, i) => (
            <div
              key={i}
              className={'hero__slide' + (i === index ? ' is-active' : '')}
              aria-hidden={i !== index}
            >
              <p className="hero__eyebrow">{s.eyebrow}</p>
              <h1 className="hero__title">{s.title}</h1>
              <p className="hero__lede">{s.lede}</p>
            </div>
          ))}
        </div>
        <div className="hero__actions">
          <a className="btn btn--accent" href="#products">{CATALOG.ctaPrimaryLabel || 'Browse products'}</a>
          <a
            className="btn btn--ghost"
            href={QUOTE_HREF}
            target="_blank"
            rel="noopener noreferrer"
          >
            {CATALOG.ctaSecondaryLabel || 'Get a quote'}
          </a>
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className="hero__arrow hero__arrow--prev"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="hero__arrow hero__arrow--next"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
          >
            <ChevronRight size={22} />
          </button>
          <div className="hero__controls">
            <button
              type="button"
              className="hero__playpause"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            <span className="hero__counter">
              {pad(index + 1)} / {pad(count)}
            </span>
            <div className="hero__dots" role="tablist" aria-label="Choose slide">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={'hero__dot' + (i === index ? ' is-active' : '')}
                  onClick={() => go(i)}
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Announcement() {
  return (
    <div className="announcement" data-component="announcement">
      <span>{ANNOUNCEMENT}</span>
    </div>
  );
}

function ProductCard({ product, onOpen }) {
  return (
    <article
      className="pcard"
      data-component="product-card"
      data-product-id={product.id}
      onClick={() => onOpen(product)}
    >
      <div className="pcard__media">
        <img className="pcard__img pcard__img--base" src={product.image || PLACEHOLDER_IMG} alt={product.name} loading="eager" />
        {product.hover && product.hover !== product.image ? (
          <img className="pcard__img pcard__img--alt" src={product.hover} alt="" aria-hidden="true" loading="lazy" />
        ) : null}
        <button
          type="button"
          className="pcard__quick"
          aria-label={`Quick enquiry for ${product.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(product);
          }}
        >
          + Quick enquiry
        </button>
      </div>
      <div className="pcard__info">
        <div className="pcard__title-row">
          <h3 className="pcard__name">{product.name}</h3>
          {product.model ? <span className="pcard__model">{product.model}</span> : null}
        </div>
        <p className="pcard__specs">
          {product.facts.slice(0, 2).join(' · ')}
          <span className="pcard__series">{seriesLabel[product.series]}</span>
        </p>
        <p className="pcard__badge">Made to order · Custom available</p>
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}

function productImages(p) {
  const out = [];
  const push = (u) => {
    if (u && typeof u === 'string' && u.trim() && !out.includes(u)) out.push(u.trim());
  };
  push(p && p.image);
  push(p && p.hover);
  (p && Array.isArray(p.gallery) ? p.gallery : []).forEach(push);
  return out;
}

function QuickEnquiry({ product, onClose }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const imgs = useMemo(() => productImages(product), [product]);
  const imgIdx = imgs.length ? Math.min(idx, imgs.length - 1) : 0;
  const current = imgs[imgIdx] || (product && product.image) || PLACEHOLDER_IMG;

  useEffect(() => {
    setIdx(0);
    setZoom(false);
  }, [product && product.id]);

  useEffect(() => {
    if (!product) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (zoom) setZoom(false);
        else onCloseRef.current();
      }
      if (zoom && e.key === 'ArrowRight' && imgs.length > 1) setIdx((i) => (i + 1) % imgs.length);
      if (zoom && e.key === 'ArrowLeft' && imgs.length > 1)
        setIdx((i) => (i - 1 + imgs.length) % imgs.length);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [product, zoom, imgs.length]);

  if (!product) return null;

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label={`${product.name} — details`}>
      <button type="button" className="drawer-overlay" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <aside className="drawer drawer--product">
        <button type="button" className="drawer__close drawer__close--abs" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
        <div className="dcols">
          <div className="dcols__media">
            <div className="gmain">
              <img key={`${current}-bg`} src={current} alt="" aria-hidden="true" className="gmain__bg" />
              <img
                key={`${current}-fg`}
                src={current}
                alt={product.name}
                className="gmain__fg"
                onClick={() => (imgs.length ? setZoom(true) : undefined)}
              />
              {imgs.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="gmain__nav gmain__nav--prev"
                    aria-label="Previous image"
                    onClick={() => setIdx((imgIdx - 1 + imgs.length) % imgs.length)}
                  >
                    ‹
                  </button>
                  <span className="gmain__count">
                    {imgIdx + 1} / {imgs.length}
                  </span>
                  <button
                    type="button"
                    className="gmain__nav gmain__nav--next"
                    aria-label="Next image"
                    onClick={() => setIdx((imgIdx + 1) % imgs.length)}
                  >
                    ›
                  </button>
                </>
              ) : null}
            </div>
            {imgs.length > 1 ? (
              <div className="gthumbs">
                {imgs.map((u, i) => (
                  <button
                    key={u}
                    type="button"
                    className={`gthumbs__t${i === imgIdx ? ' gthumbs__t--on' : ''}`}
                    onClick={() => setIdx(i)}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={u} alt="" />
                  </button>
                ))}
              </div>
            ) : null}
            {zoom ? (
              <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image zoom" onClick={() => setZoom(false)}>
                <img src={current} alt={product.name} onClick={(e) => e.stopPropagation()} />
                {imgs.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="lightbox__nav lightbox__nav--prev"
                      aria-label="Previous image"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIdx((imgIdx - 1 + imgs.length) % imgs.length);
                      }}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="lightbox__nav lightbox__nav--next"
                      aria-label="Next image"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIdx((imgIdx + 1) % imgs.length);
                      }}
                    >
                      ›
                    </button>
                    <span className="lightbox__count">
                      {imgIdx + 1} / {imgs.length}
                    </span>
                  </>
                ) : null}
                <button type="button" className="lightbox__close" aria-label="Close zoom" onClick={() => setZoom(false)}>
                  <X size={22} />
                </button>
              </div>
            ) : null}
          </div>
          <div className="dcols__info">
             <p className="drawer__eyebrow">
               {seriesLabel[product.series]}
               {product.model ? ` · ${product.model}` : ''}
             </p>
             <h3 className="drawer__pname">{product.name}</h3>
             <p className="drawer__price">Made to order · Priced on request</p>
            <div className="drawer__body">
          <p className="drawer__summary">{product.summary}</p>

          <h4>Specifications</h4>
          <ul className="drawer__facts">
            {product.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          <p className="drawer__tiers-note">
            Finished, size, colour and finish can be tailored to your project. Send an enquiry and our export
            team will quote for your specifications, quantity and destination.
          </p>

          <DetailCartControls product={product} />

          <div className="drawer__actions">
            <a
              className="btn btn--accent btn--block drawer__whatsapp"
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={18} /> Chat on WhatsApp · {CONTACT.whatsapp}
            </a>
          </div>
          <p className="drawer__help">
            Prefer to talk? Call <a href={CONTACT.phoneHref}>{CONTACT.phoneDisplay}</a> · WhatsApp: {CONTACT.whatsapp}
          </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// 12 is the least common multiple of the column counts the grid uses — 4 columns
// above 1200px, 3 down to 900px, 2 below that — so a page of 12 always fills every
// row exactly and never leaves half-empty white cells at the end. Multiples of 12
// keep that true as the buyer picks a bigger page.
const PAGE_SIZE_OPTIONS = [12, 24, 36, 48];

// React keys must be unique. A product added in the editor starts life with an
// empty `id` (it gets its 1688 product ID later), so several can end up sharing
// key="" — which makes React reconcile the grid against duplicate keys and can
// leave stale cards in the DOM. Fall back to the product's slot in PRODUCTS.
function productKey(p) {
  if (p.id) return String(p.id);
  const i = PRODUCTS.indexOf(p);
  return i >= 0 ? `slot-${i}` : `name-${p.name || 'unnamed'}`;
}

// Page numbers for the pager: show them all while there are few, and collapse
// the middle into an ellipsis once the list gets long.
function buildPageButtons(pageCount, current) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const wanted = new Set([1, pageCount, current - 1, current, current + 1]);
  const list = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) out.push(`gap-${n}`);
    out.push(n);
  });
  return out;
}

function Catalog() {
  const [series, setSeries] = useState('all');
  const [sort, setSort] = useState('featured');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  // Buyers read the catalogue a screenful at a time: 12 per page by default (a
  // full grid at every breakpoint), switchable to 24/36/48. Paging only slices
  // what we render — the search, the series chips and the count still work on
  // the whole filtered list.
  const [pageSize, setPageSize] = useState(12);
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    let list = PRODUCTS.filter((p) => (series === 'all' ? true : p.series === series));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => matchesQuery(p, q));
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [series, sort, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pagedProducts = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstOnPage = (safePage - 1) * pageSize + 1;
  const lastOnPage = firstOnPage + pagedProducts.length - 1;

  // If the filter narrows the list below the page we're on, fall back to the
  // last page that still has products instead of showing an empty grid.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function goToPage(n) {
    setPage(Math.min(Math.max(1, n), pageCount));
    // 用 scrollIntoView 而不是 window.scrollTo：这个站点的抽屉会给 body 上滚动锁，
    // 实测 window.scrollTo 在某些状态下不生效，而 scrollIntoView 一直可靠。
    // 顶部留白交给 CSS 的 scroll-margin-top，避免被粘性页头挡住。
    const grid = document.querySelector('.pgrid');
    if (grid && typeof grid.scrollIntoView === 'function') {
      grid.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  // The inquiry list can ask us to show one specific product: drop whatever
  // filter is hiding it, jump to the page it sits on, scroll its card into view,
  // then open the detail view on top so the buyer lands exactly where they wanted.
  const visibleRef = useRef(visible);
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const pendingFocus = useRef(null);
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const { id, product } = pending;
    const idx = visible.findIndex((p) => String(p.id) === id);
    if (idx < 0) return; // still filtered out — nothing to scroll to
    pendingFocus.current = null;
    const targetPage = Math.floor(idx / pageSize) + 1;
    const switching = targetPage !== safePage;
    if (switching) setPage(targetPage);
    // Scroll FIRST, then open the detail drawer — the drawer locks page scroll,
    // so opening it first would leave the card stranded off-screen.
    window.setTimeout(
      () => {
        const card = document.querySelector(`.pcard[data-product-id="${id}"]`);
        if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'center' });
        setSelected(product);
      },
      switching ? 160 : 30
    );
  }, [focusTick, visible, pageSize, safePage]);

  useEffect(() => {
    const reveal = (rawId) => {
      const id = String(rawId || '');
      if (!id) return false;
      const product = PRODUCTS.find((p) => String(p.id) === id);
      if (!product) return false;
      const listed = visibleRef.current.some((p) => String(p.id) === id);
      if (!listed) {
        setSeries('all');
        setQuery('');
      }
      // The effect below owns paging + scrolling + opening the drawer, because
      // it has to wait for the (possibly new) page to be in the DOM first.
      pendingFocus.current = { id, product };
      setFocusTick((t) => t + 1);
      return true;
    };
    const off = onFocusProduct(reveal);
    // Deep link: a ?product=<id> URL copied out of the inquiry list.
    const fromUrl = productIdFromUrl();
    if (fromUrl) window.setTimeout(() => reveal(fromUrl), 0);
    return off;
  }, []);

  return (
    <section className="section section--catalog" id="products" data-component="catalog">
      <div className="container">
        <h2 className="sr-only">Products</h2>

        <div className="catalog-bar">
          <div className="chips" role="group" aria-label="Filter by series">
            {SERIES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip-btn${series === s.id ? ' is-active' : ''}`}
                onClick={() => {
                  setSeries(s.id);
                  setPage(1);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="catalog-search" data-component="catalog-search" role="search">
          <label className="catalog-search__field">
            <Search size={16} className="catalog-search__icon" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by type, name or material — e.g. pendant, marble, brass"
              aria-label="Search products by type, name or material"
            />
          </label>
          {query ? (
            <button
              type="button"
              className="catalog-search__clear"
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="catalog-bar__right">
            <span className="catalog-count">
              {visible.length === 0
                ? 'No products'
                : `Showing ${firstOnPage}–${lastOnPage} of ${visible.length} ${
                    visible.length === 1 ? 'product' : 'products'
                  }`}
            </span>
            <label className="sort">
              <span className="sort__label">Per page</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Products per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="sort">
              <span className="sort__label">Sort by</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="name">Alphabetically, A–Z</option>
              </select>
            </label>
          </div>
        </div>

        <p className="catalog-note">{MOQ_NOTE}</p>

        <div className="pgrid">
          {visible.length === 0 && (
            <p className="catalog-empty">
              {query.trim() ? (
                <>
                  No products match “{query.trim()}”. Try another keyword — you can search by lamp type, product name
                  or material (for example pendant, wall sconce, marble, brass) — or clear the search to see all{' '}
                  {PRODUCTS.length} models.
                </>
              ) : (
                <>
                  No models listed in this category yet. Message us on WhatsApp and our team will recommend the
                  best fit from our 500+ model range.
                </>
              )}
            </p>
          )}
          {pagedProducts.map((p) => (
            <ProductCard key={productKey(p)} product={p} onOpen={setSelected} />
          ))}
        </div>

        {pageCount > 1 ? (
          <nav className="pager" aria-label="Product pagination">
            <button
              type="button"
              className="pager__btn"
              onClick={() => goToPage(safePage - 1)}
              disabled={safePage <= 1}
            >
              <ChevronLeft size={15} /> Previous
            </button>

            <div className="pager__nums">
              {buildPageButtons(pageCount, safePage).map((n) =>
                typeof n === 'string' ? (
                  <span key={n} className="pager__gap">
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    className={`pager__num${n === safePage ? ' is-active' : ''}`}
                    onClick={() => goToPage(n)}
                    aria-current={n === safePage ? 'page' : undefined}
                    aria-label={`Page ${n}`}
                  >
                    {n}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="pager__btn"
              onClick={() => goToPage(safePage + 1)}
              disabled={safePage >= pageCount}
            >
              Next <ChevronRight size={15} />
            </button>
          </nav>
        ) : null}
      </div>

      <QuickEnquiry
        product={selected}
        onClose={() => {
          setSelected(null);
          clearFocusedProduct();
        }}
      />
    </section>
  );
}

// A dedicated gallery of installed / built lighting — the "工程案例" page.
// Data (headings, note and every card) lives in content.json -> PROJECT_CASES,
// so the editor can add real project photos without a code change.
function ProjectCases() {
  if (!PROJECT_CASES || !PROJECT_CASES.cases || !PROJECT_CASES.cases.length) return null;

  return (
    <section className="section section--cases" id="cases" data-component="project-cases">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Project Cases</p>
          <h2>{PROJECT_CASES.heading}</h2>
          <p className="section-head__note">{PROJECT_CASES.note}</p>
        </div>

        {/* Home grid always shows only the first 4 cases; every case (including
            any added later in the editor) is still reachable via the
            /projects directory below. Order in content.json = display order. */}
        <div className="casegrid">
          {PROJECT_CASES.cases.slice(0, 4).map((c, i) => (
            <a
              key={i}
              href={c.slug ? `/project/${c.slug}` : '#cases'}
              className="case-card case-card--link"
            >
              <span className="case-card__media">
                <img src={c.image} alt={c.caption || c.title} loading="lazy" decoding="async" />
              </span>
              <span className="case-card__body">
                <span className="case-card__cat">{c.category}</span>
                <span className="case-card__title">{c.title}</span>
                <span className="case-card__place">{c.place}</span>
              </span>
            </a>
          ))}
        </div>

        <div className="cases-more">
          <a className="btn btn--ghost btn--sm" href="/projects">
            View all projects
            <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}

// Project detail page — a full page for one installed project, opened from the
// cards above. Layout follows the client's reference: big image + thumbnail
// gallery on top, then "Project Overview" text with a "Project Specifications"
// box to the right, and a WhatsApp CTA. Data lives in content.json — each case
// carries `slug` + `detail.{client, year, location, images, overview, specs}`.
function ProjectDetail({ project }) {
  const d = project.detail;
  const [img, setImg] = useState(0);
  const images = d && d.images && d.images.length ? d.images : [project.image];
  const active = images[Math.min(img, images.length - 1)];

  useEffect(() => {
    document.title = `${project.title} · ${APP_NAME}`;
    window.scrollTo(0, 0);
  }, [project]);

  // Reset the gallery if the same component is reused for another project.
  useEffect(() => {
    setImg(0);
  }, [project.slug]);

  const specs = (d && d.specs) || [];
  const overview = (d && d.overview) || [];
  // Back: the detail page is normally reached from the /projects directory,
  // so return there. If opened directly (e.g. a bookmarked /project/<slug>),
  // fall back to the home page's cases grid.
  // (The separate "All projects" link on the right is the one that carries
  // ?from=, so the directory knows to return to THIS detail page.)
  const cameFromProjects = typeof window !== 'undefined'
    ? document.referrer.includes('/projects')
    : false;
  const backHref = cameFromProjects ? '/projects' : '/#cases';

  return (
    <>
      <Header homeLinks />
      <main className="project-page" id="top">
        <div className="container project-page__inner">
          <nav className="project-detail-nav">
            <a className="project-back" href={backHref}>
              <ChevronLeft size={16} /> Back to {cameFromProjects ? 'Project Cases' : 'home'}
            </a>
            <a className="project-back project-back--right" href={'/projects?from=/project/' + project.slug}>
              All projects
              <ArrowUpRight size={15} />
            </a>
          </nav>

          <p className="eyebrow project-page__eyebrow">{project.category}</p>
          <h1 className="project-page__title">{project.title}</h1>
          <div className="project-meta">
            <span className="project-meta__item">
              <MapPin size={15} />
              {(d && d.location) || project.place}
            </span>
            {d && d.year ? (
              <span className="project-meta__item">
                <Calendar size={15} />
                {d.year}
              </span>
            ) : null}
            {d && d.client ? (
              <span className="project-meta__item">
                <Building2 size={15} />
                {d.client}
              </span>
            ) : null}
          </div>

          <figure className="project-gallery">
            <div className="project-gallery__stage">
              <img src={active} alt={`${project.title} — view ${img + 1}`} />
            </div>
            {images.length > 1 ? (
              <div className="project-gallery__thumbs" aria-label="Project photos">
                {images.map((src, i) => (
                  <button
                    key={src + '-' + i}
                    type="button"
                    className={'project-thumb' + (i === img ? ' is-active' : '')}
                    aria-label={'Photo ' + (i + 1)}
                    onClick={() => setImg(i)}
                  >
                    {/* eager: thumbs are tiny and there are at most a few —
                        lazy loading made the strip flash blank on first paint */}
                    <img src={src} alt="" loading="eager" decoding="async" />
                  </button>
                ))}
              </div>
            ) : null}
          </figure>

          <div className="project-body">
            <div className="project-overview">
              <h2 className="project-overview__head">
                <Lightbulb size={18} /> Project Overview
              </h2>
              <p className="project-overview__lede">{project.caption}</p>
              {overview.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              <a
                className="btn btn--accent project-cta"
                href={QUOTE_HREF}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={17} /> Discuss a project like this
              </a>
            </div>
            <aside className="project-specs">
              <h3 className="project-specs__head">
                <Layers size={15} /> Project Specifications
              </h3>
              <dl>
                {specs.map((row, i) => (
                  <div className="project-specs__row" key={i}>
                    <dt>{row[0]}</dt>
                    <dd>{row[1]}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </div>
      </main>
      <Footer homeLinks />
    </>
  );
}



// Projects index — /projects. A directory of every project case: a list of
// names on the left, a live preview on the right. Clicking a name opens that
// project's detail page (/project/<slug>).
function ProjectsIndex() {
  const cases = (PROJECT_CASES && PROJECT_CASES.cases) || [];
  const slug = typeof window !== 'undefined' ? decodeURIComponent(window.location.pathname.split('/').pop() || '') : '';
  // Smart back: if we were entered from a project detail page (All projects link
  // passes ?from=/project/<slug>), go back to THAT page; otherwise the home cases grid.
  const from = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('from') || '')
    : '';
  const backHref = from && from.startsWith('/project/') ? from : '/#cases';
  const [active, setActive] = useState(() => {
    const i = cases.findIndex((c) => c.slug === slug);
    return i >= 0 ? i : 0;
  });
  const c = cases[active] || {};
  const d = c.detail || {};

  useEffect(() => {
    document.title = `All projects · ${APP_NAME}`;
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Header homeLinks />
      <main className="projindex-page" id="top">
        <div className="container projindex-inner">
          <a className="project-back" href={backHref}>
            <ChevronLeft size={16} /> Back to {from && from.startsWith('/project/') ? 'Project' : 'Project Cases'}
          </a>
          <p className="eyebrow projindex-eyebrow">Project Cases</p>
          <h1 className="projindex-title">{PROJECT_CASES.heading}</h1>
          {PROJECT_CASES.note ? (
            <p className="projindex-note">{PROJECT_CASES.note}</p>
          ) : null}

          <div className="projindex">
            <ol className="projindex-list">
              {cases.map((x, i) => (
                <li key={x.slug || i} className={'projindex-item' + (i === active ? ' is-active' : '')}>
                  <a
                    href={'/project/' + x.slug}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                  >
                    <span className="projindex-item__body">
                      <span className="projindex-item__cat">{x.category}</span>
                      <span className="projindex-item__name">{x.title}</span>
                      <span className="projindex-item__place">{x.place}</span>
                    </span>
                    <ArrowUpRight size={16} className="projindex-item__arrow" />
                  </a>
                </li>
              ))}
            </ol>

            <aside className="projindex-preview">
              {c.image ? (
                <a href={'/project/' + c.slug} className="projindex-preview__media">
                  <img src={c.image} alt={c.caption || c.title} />
                </a>
              ) : null}
              <div className="projindex-preview__body">
                <span className="projindex-item__cat">{c.category}</span>
                <h2 className="projindex-preview__title">{c.title}</h2>
                <p className="projindex-preview__meta">
                  {(d.location || c.place) + (d.year ? ' · ' + d.year : '')}
                </p>
                {c.caption ? <p className="projindex-preview__cap">{c.caption}</p> : null}
                <a className="btn btn--accent btn--sm projindex-preview__cta" href={'/project/' + c.slug}>
                  View project
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer homeLinks />
    </>
  );
}

function Company() {
  return (
    <section className="section section--paper" id="company" data-component="company">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">Company</p>
          <h2>A source factory behind an own brand</h2>
          <p className="section-lede">{COMPANY_LEAD}</p>
        </div>

        <div className="factory" data-component="factory-showcase">
          {FACTORY.images.map((img) => (
            <figure className="fcard" key={img.src}>
              <img src={img.src} alt={img.alt} loading="lazy" />
              <figcaption>{img.caption}</figcaption>
            </figure>
          ))}
          <figure className="fcard factory__info">
            <span className="factory__info-mark">{FACTORY.info ? FACTORY.info.mark : '1500 m²'}</span>
            <p>
              {FACTORY.info ? FACTORY.info.desc : 'In-house workshop — component finishing, assembly, quality control and export packing under one roof.'}
            </p>
          </figure>
        </div>

        <div className="expo" data-component="factory-expo">
          <div className="expo__intro">
            <p className="eyebrow">Exhibitions</p>
            <h3>{FACTORY.expo.heading}</h3>
            <p>{FACTORY.expo.lede}</p>
          </div>
          <div className="expo__grid">
            {FACTORY.expo.images.map((img) => (
              <figure className="fcard" key={img.src}>
                <img src={img.src} alt={img.alt} loading="lazy" />
                <figcaption>{img.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="why-grid">
          {WHY.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <article className="why-card" data-component="why-card" key={item.title}>
                <span className="why-card__icon">{Icon ? <Icon size={22} strokeWidth={1.6} /> : null}</span>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section className="section" id="process" data-component="process">
      <div className="container">
        <div className="section-head">
          <p className="eyebrow">How We Work</p>
          <h2>From enquiry to shipment</h2>
        </div>
        <ol className="process">
          {PROCESS.map((step, i) => (
            <li className="process__step" key={step.title}>
              <span className="process__num">{String(i + 1).padStart(2, '0')}</span>
              {step.image ? (
                <img className="process__media" src={step.image} alt={step.title} loading="lazy" />
              ) : null}
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ContactBand() {
  const [copied, setCopied] = useState(false);
  const copyWechat = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.whatsapp);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="section contact" id="contact" data-component="contact-band">
      <div className="container">
        <p className="eyebrow eyebrow--center">Contact Our Export Team</p>
        <h2 className="contact__title">Let&rsquo;s light your next project.</h2>
        <div className="contact__channels">
          <a className="contact-card contact-card--primary" href={CONTACT.phoneHref}>
            <Phone size={20} strokeWidth={1.7} />
            <span className="contact-card__label">Call us</span>
            <span className="contact-card__value">{CONTACT.phoneDisplay}</span>
          </a>
          <a className="contact-card" href={CONTACT.emailHref}>
            <Mail size={20} strokeWidth={1.7} />
            <span className="contact-card__label">Email</span>
            <span className="contact-card__value">{CONTACT.email}</span>
          </a>
          <button className="contact-card contact-card--btn" onClick={copyWechat} type="button">
            <MessageCircle size={20} strokeWidth={1.7} />
            <span className="contact-card__label">WhatsApp ID</span>
            <span className="contact-card__value">
              {CONTACT.whatsapp}{' '}
              {copied ? (
                <Check size={14} className="contact-card__copied" />
              ) : (
                <Copy size={14} className="contact-card__copy" />
              )}
            </span>
          </button>
          <a className="contact-card" href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={20} strokeWidth={1.7} />
            <span className="contact-card__label">Chat on WhatsApp</span>
            <span className="contact-card__value">{CONTACT.whatsapp}</span>
          </a>
        </div>
        <p className="contact__note">
          <MapPin size={14} /> {CONTACT.addressLine1} · {CONTACT.addressLine2}
        </p>
      </div>
    </section>
  );
}

function Footer({ homeLinks = false }) {
  const prefix = homeLinks ? '/' : '';
  return (
    <footer className="site-footer" data-component="site-footer">
      <div className="container footer-grid">
        <div className="footer__brand">
          <Wordmark href={homeLinks ? '/' : '#top'} />
          <p>
            A Zhongshan source factory and own brand crafting crystal chandeliers, marble wall sconces and pendant
            lighting for buyers worldwide.
          </p>
        </div>
        <nav className="footer__nav" aria-label="Footer">
          <h4>Explore</h4>
          {NAV.map((item) => (
            <a key={item.href} href={`${prefix}${item.href}`}>
              {item.label}
            </a>
          ))}
        </nav>
        <nav className="footer__nav" aria-label="Legal">
          <h4>Legal</h4>
          {LEGAL_LINKS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="footer__contact">
          <h4>Contact</h4>
          <a href={CONTACT.phoneHref}>{CONTACT.phoneDisplay}</a>
          <a href={CONTACT.emailHref}>{CONTACT.email}</a>
          <a href={CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer">
            WhatsApp: {CONTACT.whatsapp}
          </a>
          <span>
            {CONTACT.addressLine1}, {CONTACT.addressLine2}
          </span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>CCC · ISO 9000 · Export License</span>
        <span className="footer-bottom__legal">
          {LEGAL_ENTITY} · <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> ·{' '}
          <a href={SITE_URL}>{SITE_URL}</a>
        </span>
        <span>
          &copy; {new Date().getFullYear()} {CONTACT.legalName}
        </span>
      </div>
      <div className="container footer-legalbar" data-component="footer-legal-bar">
        <span className="footer-legalbar__label">Legal documents</span>
        <nav className="footer-legalbar__links" aria-label="Legal documents">
          {LEGAL_LINKS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

function LegalBlock({ block }) {
  if (block.type === 'p') return <p className="legal__p">{block.text}</p>;
  if (block.type === 'code') return <p className="legal__code">{block.text}</p>;
  if (block.type === 'ul') {
    return (
      <ul className="legal__list">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === 'contact-line') {
    return (
      <p className="legal__contact-line">
        <span className="legal__contact-label">{block.label}:</span> <a href={block.href}>{block.value}</a>
      </p>
    );
  }
  return null;
}

function LegalPage({ doc }) {
  useEffect(() => {
    document.title = `${doc.title} · Aoshahua Lighting`;
    window.scrollTo(0, 0);
  }, [doc]);

  return (
    <>
      <Header homeLinks />
      <main className="legal" id="top">
        <div className="container legal__inner">
          <p className="eyebrow">Legal</p>
          <h1 className="legal__title">{doc.title}</h1>
          <p className="legal__meta">
            {doc.effectiveDate ? `Effective Date: ${doc.effectiveDate} · ` : ''}
            {APP_NAME}
          </p>
          {doc.intro.map((text) => (
            <p className="legal__p legal__p--lede" key={text}>
              {text}
            </p>
          ))}
          {doc.sections.map((section) => (
            <section className="legal__section" key={section.heading}>
              <h2>{section.heading}</h2>
              {section.blocks.map((block, i) => (
                <LegalBlock block={block} key={`${section.heading}-${i}`} />
              ))}
            </section>
          ))}
        </div>
      </main>
      <Footer homeLinks />
    </>
  );
}

function normalizePath(raw) {
  let p = String(raw || '/').split('?')[0].split('#')[0];
  p = p.replace(/index\.html$/i, '');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  if (!p.startsWith('/')) p = `/${p}`;
  return (p || '/').toLowerCase();
}

export default function App() {
  const route = normalizePath(typeof window !== 'undefined' ? window.location.pathname : '/');
  const legalDoc = LEGAL_PAGES[route] || null;

  if (legalDoc) return <LegalPage doc={legalDoc} />;
  if (route === '/admin') return <AdminPage />;
  if (route === '/meta-callback') return <MetaCallback />;

  // Projects index: /projects (all-case directory)
  if (route === '/projects') return <ProjectsIndex />;

  // Project detail pages: /project/<slug> (data in content.json -> PROJECT_CASES)
  const projectMatch = route.startsWith('/project/')
    ? PROJECT_CASES.cases.find((c) => c.slug === route.slice('/project/'.length))
    : undefined;
  if (projectMatch) return <ProjectDetail project={projectMatch} />;

  return (
    <>
      {/* No strip in the page flow, ever: anything rendered between the
          announcement/header and the hero breaks the hero's -79px slide-up and
          shows a band of page background under the transparent header.
          (BuyerWelcomeBar is intentionally NOT rendered — its "we kept your
          details" value already lives in the cart drawer via InquiryHistory
          and the pre-filled form, so the page stays exactly as approved:
          announcement → header → full-bleed hero.) */}
      {/* Announcement first, so the hero below it can slide up under the sticky
          header without swallowing the announcement bar. */}
      <Announcement />
      <Header overHero />
      <main id="top">
        <Hero />
        <Catalog />
        <ProjectCases />
        <Company />
        <Process />
        <ContactBand />
      </main>
      <Footer />
      <CartDrawer />
      <MoqNotice />
    </>
  );
}
