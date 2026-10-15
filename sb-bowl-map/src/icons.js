import { h } from './dom.js';

/**
 * Stroke icons on a 24×24 grid. Category `icon` values in venue.json
 * reference these keys. Add your own by appending path data here.
 */
export const ICONS = {
  // UI
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4',
  close: 'M6 6l12 12M18 6 6 18',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  layers: 'M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  link: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  // Categories
  cup: 'M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8Zm11 1h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2m3-2v2',
  book: 'M4 5h5a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4V5Zm16 0h-5a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h6V5Z',
  swap: 'M4 8h14l-3.5-3.5M20 16H6l3.5 3.5',
  leaf: 'M5 19C5 11 11 5 19 5c0 8-6 14-14 14Zm0 0 8-8',
  bag: 'M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
  star: 'm12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6-5-2.9-5 2.9 1.2-5.6L4 9.6 9.6 9 12 4Z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8Zm8 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0m-6 6v4m-3 0h6',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6m2 9a6 6 0 0 0-3-5.2',
  briefcase: 'M4 8h16v11H4V8Zm5 0V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 13h16',
  car: 'M5 16h14v-4l-2-5H7l-2 5v4Zm0-4h14M7 16v2m10-2v2',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Zm10 0v10',
  beer: 'M6 6h10v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6Zm10 3h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2M9 10v6m4-6v6',
  food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9',
  bus: 'M6 4h12a1 1 0 0 1 1 1v11H5V5a1 1 0 0 1 1-1Zm-1 7h14M8 16v3m8-3v3',
  bike: 'M6 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 14l4-6h5l3 6M10 8 8 5H6',
  parking: 'M5 4h14v16H5V4Zm5 12V8h3a2 2 0 0 1 0 4h-3',
  medical: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z',
  accessible: 'M12 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-1 3h3v6h4l2 5M11 10a6 6 0 1 0 5 8',
  stairs: 'M4 20h5v-5h5v-5h5V5h1',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  shirt: 'M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3a4 4 0 0 1-8 0Z',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
};

export function icon(name, extraClass = '') {
  return h(
    'svg',
    { class: `icon ${extraClass}`.trim(), viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
    h('path', { d: ICONS[name] ?? ICONS.info }),
  );
}

/** Teardrop marker. Tip sits at (20, 58) of a 40×60 box. */
export function pinShape() {
  return h(
    'svg',
    { class: 'pin__shape', viewBox: '0 0 40 60', 'aria-hidden': 'true', focusable: 'false' },
    h('path', { d: 'M20 58S2 35.5 2 20a18 18 0 0 1 36 0c0 15.5-18 38-18 38Z' }),
  );
}
