// Aoshahua Lighting — site content.
// All editable text, products and image paths live in src/content.json.
// The visual content editor (site-editor/) reads and writes that file —
// no code edits needed for everyday changes.
import C from './content.json';

// These remain live bindings so the public site can start with the bundled
// content and then replace it with the owner's saved version from Supabase.
export let CONTACT = C.CONTACT;
export let NAV = C.NAV;
export let ANNOUNCEMENT = C.ANNOUNCEMENT;
export let CATALOG = C.CATALOG;
export let HERO_SLIDES = C.HERO_SLIDES;
export let SERIES = C.SERIES;
export let PRODUCTS = C.PRODUCTS;
export let FACTORY = C.FACTORY;
export let COMPANY_LEAD = C.COMPANY_LEAD;
export let WHY = C.WHY;
export let PROCESS = C.PROCESS;
export let MOQ_NOTE = C.MOQ_NOTE;
export let PROJECT_CASES = C.PROJECT_CASES;

export const STATIC_CONTENT = C;

export function applyContent(next) {
  if (!next || typeof next !== 'object') return;
  CONTACT = next.CONTACT || C.CONTACT;
  NAV = next.NAV || C.NAV;
  ANNOUNCEMENT = next.ANNOUNCEMENT || C.ANNOUNCEMENT;
  CATALOG = next.CATALOG || C.CATALOG;
  HERO_SLIDES = next.HERO_SLIDES || C.HERO_SLIDES;
  SERIES = next.SERIES || C.SERIES;
  PRODUCTS = next.PRODUCTS || C.PRODUCTS;
  FACTORY = next.FACTORY || C.FACTORY;
  COMPANY_LEAD = next.COMPANY_LEAD || C.COMPANY_LEAD;
  WHY = next.WHY || C.WHY;
  PROCESS = next.PROCESS || C.PROCESS;
  MOQ_NOTE = next.MOQ_NOTE || C.MOQ_NOTE;
  PROJECT_CASES = next.PROJECT_CASES || C.PROJECT_CASES;
}

export function contentSnapshot() {
  return {
    CONTACT,
    NAV,
    ANNOUNCEMENT,
    CATALOG,
    HERO_SLIDES,
    SERIES,
    PRODUCTS,
    FACTORY,
    COMPANY_LEAD,
    WHY,
    PROCESS,
    MOQ_NOTE,
    PROJECT_CASES,
  };
}
