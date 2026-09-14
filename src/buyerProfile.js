// Remembers a buyer's own submission details and inquiry history.
//
// Everything here lives in THAT buyer's browser (localStorage). It is never
// sent anywhere new: the details are only used to pre-fill the inquiry form on
// the buyer's next visit, so they do not have to retype them, and the history
// list only ever contains the inquiries that browser itself submitted.
// The buyer can wipe all of it at any time from the cart drawer.

import { useEffect, useState } from 'react';

const PROFILE_KEY = 'aoshahua.buyer-profile.v1';
const HISTORY_KEY = 'aoshahua.buyer-history.v1';
const DISMISS_KEY = 'aoshahua.buyer-strip-dismissed.v1';
const MAX_HISTORY = 10;

const EMPTY_PROFILE = { company: '', name: '', email: '', country: '', message: '' };

const listeners = new Set();

function emit() {
  listeners.forEach((fn) => fn());
}

function read(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const value = JSON.parse(raw);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: remembering details is a convenience, never a requirement.
  }
}

function drop(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ profile */

export function loadProfile() {
  const stored = read(PROFILE_KEY, null);
  return stored && typeof stored === 'object' ? { ...EMPTY_PROFILE, ...stored } : { ...EMPTY_PROFILE };
}

export function hasProfile() {
  const profile = loadProfile();
  return Boolean(profile.name || profile.email);
}

export function saveProfile(profile) {
  write(PROFILE_KEY, { ...EMPTY_PROFILE, ...profile });
  emit();
}

export function clearProfile() {
  drop(PROFILE_KEY);
  emit();
}

/* ------------------------------------------------------------------ history */

export function loadHistory() {
  const stored = read(HISTORY_KEY, []);
  return Array.isArray(stored) ? stored.filter((entry) => entry && entry.ref) : [];
}

export function addToHistory(entry) {
  const next = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  write(HISTORY_KEY, next);
  emit();
  return next;
}

export function clearHistory() {
  drop(HISTORY_KEY);
  emit();
}

/* ----------------------------------------------------- welcome-back strip */

export function isStripDismissed() {
  return read(DISMISS_KEY, false) === true;
}

export function dismissStrip() {
  write(DISMISS_KEY, true);
  emit();
}

export function resetStripDismissal() {
  drop(DISMISS_KEY);
  emit();
}

/* ------------------------------------------------------------ react binding */

export function useBuyerMemory() {
  const [snapshot, setSnapshot] = useState(() => ({
    profile: loadProfile(),
    history: loadHistory(),
    dismissed: isStripDismissed(),
  }));

  useEffect(() => {
    const refresh = () =>
      setSnapshot({ profile: loadProfile(), history: loadHistory(), dismissed: isStripDismissed() });
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, []);

  return snapshot;
}
