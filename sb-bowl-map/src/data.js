/**
 * Loads venue.json plus every level's SVG floor plan.
 * Paths inside venue.json are resolved relative to venue.json itself.
 */
export async function loadVenue(url) {
  const venueUrl = new URL(url, document.baseURI);
  const venue = await fetchJson(venueUrl);

  venue.categories ??= [];
  venue.spaces ??= [];
  if (!Array.isArray(venue.levels) || venue.levels.length === 0) {
    throw new Error('venue.json needs at least one entry in "levels".');
  }

  await Promise.all(
    venue.levels.map(async (level) => {
      level.svg = await fetchSvg(new URL(level.map, venueUrl));
    }),
  );

  if (venue.surroundings) venue.surroundings = new URL(venue.surroundings, venueUrl).href;
  for (const space of venue.spaces) {
    space.id = String(space.id);
    if (space.logo) space.logo = new URL(space.logo, venueUrl).href;
    if (space.url && !/^https?:\/\//i.test(space.url)) delete space.url;
  }

  validate(venue);
  return venue;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} loading ${url.pathname}`);
  return res.json();
}

async function fetchSvg(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} loading ${url.pathname}`);
  const text = await res.text();
  const type = res.headers.get('content-type') ?? 'unknown type';
  if (!/<svg[\s>]/i.test(text)) {
    // Usually a host's "not found" / SPA fallback page served with a 200 status.
    const preview = text.trim().slice(0, 60).replace(/\s+/g, ' ');
    throw new Error(
      `${url.pathname} didn't return an SVG (got ${type}: "${preview}…"). ` +
        'Check the file was uploaded to that path and that the host serves .svg files as-is.',
    );
  }
  return sanitizeSvg(text, `${url.pathname} (${type})`);
}

/**
 * Parses an SVG string and strips anything executable, so floor plans
 * exported from Figma/Illustrator (or supplied by a client) are safe to inline.
 */
function sanitizeSvg(text, name) {
  // Strip a BOM / XML prolog / DOCTYPE some editors and hosts add.
  const clean = text.replace(/^﻿/, '').replace(/<!DOCTYPE[^>[]*(\[[^\]]*\])?>/i, '');
  const doc = new DOMParser().parseFromString(clean, 'image/svg+xml');
  const svg = doc.documentElement;
  const parseError = doc.querySelector('parsererror');
  if (svg.localName !== 'svg' || parseError) {
    const detail = parseError?.textContent.trim().split('\n')[0] ?? `root element is <${svg.localName}>`;
    throw new Error(`${name} is not valid SVG — ${detail}`);
  }
  svg.querySelectorAll('script, foreignObject, style').forEach((n) => n.remove());
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const { name: attr, value } of [...el.attributes]) {
      if (/^on/i.test(attr) || /^\s*javascript:/i.test(value)) el.removeAttribute(attr);
    }
  }
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return document.importNode(svg, true);
}

/** Non-fatal checks — logs problems so template users can fix their data. */
function validate(venue) {
  const levelIds = new Set(venue.levels.map((l) => String(l.id)));
  const catIds = new Set(venue.categories.map((c) => c.id));
  const seen = new Set();

  for (const space of venue.spaces) {
    const where = `space "${space.id}" (${space.name})`;
    if (seen.has(space.id)) console.warn(`[venue] duplicate ${where}`);
    seen.add(space.id);
    if (!levelIds.has(String(space.level))) console.warn(`[venue] ${where} has unknown level "${space.level}"`);
    if (space.category && !catIds.has(space.category)) console.warn(`[venue] ${where} has unknown category "${space.category}"`);
    const level = venue.levels.find((l) => String(l.id) === String(space.level));
    if (level && !space.pin && !level.svg.querySelector(`[data-space="${CSS.escape(space.id)}"]`)) {
      console.warn(`[venue] ${where} has no "pin" and no matching data-space shape in ${level.map}`);
    }
  }
}
