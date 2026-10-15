const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_TAGS = new Set(['svg', 'path', 'g', 'circle', 'rect', 'polyline', 'line']);

/**
 * Tiny hyperscript helper: h('button', { class: 'x', onclick }, 'Label')
 * - `style` accepts an object (custom properties allowed)
 * - `dataset` accepts an object
 * - `on*` function props become event listeners
 * - `true` sets a boolean attribute, null/false/undefined skip it
 */
export function h(tag, props = {}, ...children) {
  const el = SVG_TAGS.has(tag)
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'style' && typeof value === 'object') {
      for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, v);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else {
      el.setAttribute(key, value === true ? '' : value);
    }
  }

  el.append(...children.flat(Infinity).filter((c) => c != null && c !== false));
  return el;
}

/** Wait two frames so freshly-set styles have started their transitions. */
export const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

/**
 * Resolve once every CSS transition/animation currently running on `el`
 * has finished. Replaces the old transitionend + vendor-prefix dance, and
 * resolves immediately when motion is reduced/disabled.
 */
export async function settle(el) {
  await nextFrame();
  await Promise.allSettled(el.getAnimations().map((a) => a.finished));
}

/** Case- and accent-insensitive normalisation for search. */
export const normalize = (str) =>
  str.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
