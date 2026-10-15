import { h, settle, normalize } from './dom.js';
import { icon, pinShape } from './icons.js';

const compact = matchMedia('(max-width: 56rem)');
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/**
 * Interactive multi-level venue map.
 *
 * State lives in one object; every user action is queued so animations
 * never overlap (replaces the old `isNavigating` / `isExpanded` flags).
 */
export class VenueMap {
  #root;
  #venue;
  #els = {};
  #levels = []; // [{ data, el, svg, pinsEl, pins: Map<id, button> }]
  #spaces = new Map();
  #cats = new Map();
  #queue = Promise.resolve();
  #state = {
    level: null, // index into venue.levels (0 = bottom), null = overview
    open: false, // a level has finished expanding
    moving: false, // switching between levels
    space: null, // selected space id
    query: '',
    category: 'all',
    sort: 'category', // 'category' | 'name'
    directory: false, // drawer open (compact layouts)
  };

  constructor(root, venue) {
    this.#root = root;
    this.#venue = venue;
    for (const c of venue.categories) this.#cats.set(c.id, c);
    for (const s of venue.spaces) this.#spaces.set(s.id, s);
  }

  mount() {
    this.#build();
    this.#placePins();
    this.#bindGlobalEvents();
    this.#renderList();
    this.#updateChrome();
    this.#restoreFromUrl();
    return this;
  }

  // ── Public API ──────────────────────────────────────────────────────────
  showLevel(index) { return this.#run(() => this.#showLevel(index)); }
  step(delta) { return this.#run(() => this.#state.open && this.#showLevel(this.#state.level + delta)); }
  showAll() { return this.#run(() => this.#showAll()); }
  openSpace(id) { return this.#run(() => this.#openSpace(id)); }
  closeSpace() { return this.#run(() => this.#closeSpace()); }

  // ── Build ───────────────────────────────────────────────────────────────
  #build() {
    const v = this.#venue;
    for (const [prop, value] of Object.entries(v.theme ?? {})) {
      if (prop.startsWith('--')) this.#root.style.setProperty(prop, value);
    }

    this.#levels = v.levels.map((level, i) => this.#buildLevel(level, i));
    const e = this.#els;

    e.levels = h('div', { class: 'levels', style: { '--count': v.levels.length } }, this.#levels.map((l) => l.el));
    e.mall = h(
      'div',
      { class: 'mall' },
      v.surroundings && h('div', { class: 'surroundings' }, h('img', { src: v.surroundings, alt: '', decoding: 'async' })),
      e.levels,
    );

    e.up = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Up one floor', onclick: () => this.step(1) }, icon('up'));
    e.all = h('button', { type: 'button', class: 'iconbtn iconbtn--solid', 'aria-label': 'Show all floors', onclick: () => this.showAll() }, icon('layers'));
    e.down = h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Down one floor', onclick: () => this.step(-1) }, icon('down'));
    e.levelName = h('p', { class: 'levelnav__name' });
    e.nav = h('nav', { class: 'levelnav', 'aria-label': 'Floors' }, e.levelName, h('div', { class: 'levelnav__buttons' }, e.up, e.all, e.down));

    e.detailBody = h('div', { class: 'detail__body' });
    e.detail = h(
      'section',
      { class: 'detail', 'aria-labelledby': 'detail-title' },
      h('button', { type: 'button', class: 'iconbtn detail__close', 'aria-label': 'Close details', onclick: () => this.closeSpace() }, icon('close')),
      e.detailBody,
    );

    e.announcer = h('p', { class: 'sr-only', 'aria-live': 'polite' });

    const header = h(
      'header',
      { class: 'stage__header' },
      h('h1', { class: 'stage__title' }, v.name),
      v.tagline && h('p', { class: 'stage__tagline' }, v.tagline),
    );

    e.openDir = h(
      'button',
      { type: 'button', class: 'iconbtn iconbtn--solid stage__search', 'aria-label': 'Search places', 'aria-controls': 'directory', onclick: () => this.#setDirectory(true) },
      icon('search'),
    );

    this.#root.replaceChildren(
      h('main', { class: 'stage' }, header, e.mall, e.nav, e.detail, e.openDir, e.announcer),
      this.#buildDirectory(),
    );
    this.#root.removeAttribute('aria-busy');
  }

  #buildLevel(level, i) {
    const svg = level.svg;
    svg.classList.add('level__map');
    svg.setAttribute('aria-hidden', 'true');
    for (const shape of svg.querySelectorAll('[data-space]')) {
      const space = this.#spaces.get(shape.dataset.space);
      if (!space) continue;
      shape.classList.add('is-linked');
      const color = this.#cats.get(space.category)?.color;
      if (color) shape.style.setProperty('--cat', color);
    }

    const pinsEl = h('div', { class: 'level__pins' });
    const el = h(
      'div',
      { class: 'level', style: { '--i': i }, dataset: { index: i } },
      svg,
      h('span', { class: 'level__label', 'aria-hidden': 'true' }, level.short ?? level.name),
      pinsEl,
    );

    el.addEventListener('click', (ev) => {
      if (ev.target.closest('.pin')) return;
      const shape = ev.target.closest('[data-space].is-linked');
      if (this.#state.open && shape) this.openSpace(shape.dataset.space);
      else if (this.#state.level == null) this.showLevel(i);
    });
    el.addEventListener('keydown', (ev) => {
      if (this.#state.level == null && (ev.key === 'Enter' || ev.key === ' ')) {
        ev.preventDefault();
        this.showLevel(i);
      }
    });

    return { data: level, el, svg, pinsEl, pins: new Map() };
  }

  #placePins() {
    for (const lvl of this.#levels) {
      const vb = lvl.svg.viewBox.baseVal;
      const [vx, vy, vw, vh] = vb?.width ? [vb.x, vb.y, vb.width, vb.height] : [0, 0, 1200, 800];
      const spaces = this.#venue.spaces.filter((s) => String(s.level) === String(lvl.data.id));

      spaces.forEach((space, n) => {
        if (space.pin === false) return; // shape-only space (e.g. seating sections)
        const point = space.pin ?? this.#shapeCenter(lvl.svg, space.id);
        if (!point) return;
        const [x, y] = point;
        const cat = this.#cats.get(space.category);
        const pin = h(
          'button',
          {
            type: 'button',
            class: 'pin',
            dataset: { space: space.id },
            'aria-label': cat ? `${space.name}, ${cat.name}` : space.name,
            style: {
              '--x': `${((x - vx) / vw) * 100}%`,
              '--y': `${((y - vy) / vh) * 100}%`,
              '--n': n,
              '--cat': cat?.color ?? 'var(--accent)',
            },
            onclick: () => this.openSpace(space.id),
          },
          h(
            'span',
            { class: 'pin__body' },
            pinShape(),
            space.logo ? h('img', { class: 'pin__logo', src: space.logo, alt: '' }) : icon(space.icon ?? cat?.icon, 'pin__icon'),
          ),
          h('span', { class: 'pin__label', 'aria-hidden': 'true' }, space.name),
        );
        lvl.pinsEl.append(pin);
        lvl.pins.set(space.id, pin);
      });
    }
  }

  /** Falls back to the centre of the space's shape when no `pin` is given. */
  #shapeCenter(svg, id) {
    const shape = svg.querySelector(`[data-space="${CSS.escape(id)}"]`);
    try {
      const b = shape?.getBBox();
      return b ? [b.x + b.width / 2, b.y + b.height / 2] : null;
    } catch {
      return null;
    }
  }

  #buildDirectory() {
    const e = this.#els;
    e.search = h('input', {
      type: 'search',
      class: 'search__input',
      placeholder: 'Search places',
      'aria-label': 'Search places',
      autocomplete: 'off',
      enterkeyhint: 'search',
      oninput: (ev) => {
        this.#state.query = ev.target.value;
        this.#renderList();
      },
    });

    const chipData = [{ id: 'all', name: 'All' }, ...this.#cats.values()];
    e.chips = chipData.map((c) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(c.id === 'all'),
          dataset: { category: c.id },
          style: c.color ? { '--cat': c.color } : null,
          onclick: () => {
            this.#state.category = c.id;
            for (const chip of e.chips) chip.setAttribute('aria-pressed', String(chip.dataset.category === c.id));
            this.#renderList();
          },
        },
        c.color && h('span', { class: 'dot' }),
        c.name,
      ),
    );

    e.status = h('p', { class: 'directory__status', 'aria-live': 'polite' });
    e.scope = h('button', { type: 'button', class: 'linkbtn', onclick: () => this.showAll() }, 'All floors');
    e.list = h('div', { class: 'directory__list' });

    e.directory = h(
      'aside',
      { class: 'directory', id: 'directory', 'aria-label': 'Directory' },
      h(
        'div',
        { class: 'directory__head' },
        h('label', { class: 'search' }, icon('search', 'search__icon'), e.search, h('kbd', { class: 'search__kbd', 'aria-hidden': 'true' }, '/')),
        h('button', { type: 'button', class: 'iconbtn directory__close', 'aria-label': 'Close search', onclick: () => this.#setDirectory(false) }, icon('close')),
      ),
      this.#cats.size > 0 && h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by category' }, e.chips),
      h(
        'div',
        { class: 'directory__bar' },
        h('div', { class: 'directory__scope' }, e.status, e.scope),
        h(
          'label',
          { class: 'toggle' },
          h('input', {
            type: 'checkbox',
            class: 'toggle__input',
            onchange: (ev) => {
              this.#state.sort = ev.target.checked ? 'name' : 'category';
              this.#renderList();
            },
          }),
          h('span', { class: 'toggle__track', 'aria-hidden': 'true' }),
          'A–Z',
        ),
      ),
      e.list,
    );
    return e.directory;
  }

  // ── Render ──────────────────────────────────────────────────────────────
  #renderList() {
    const { query, category, sort, level, space: activeId } = this.#state;
    const scoped = level != null;
    const q = normalize(query);

    const items = this.#venue.spaces.filter(
      (s) =>
        (!scoped || this.#levelIndexOf(s) === level) &&
        (category === 'all' || s.category === category) &&
        (!q || normalize(`${s.name} ${s.description ?? ''} ${this.#cats.get(s.category)?.name ?? ''}`).includes(q)),
    );

    let groups;
    if (sort === 'name' || this.#cats.size === 0) {
      groups = [{ items: items.toSorted(byName) }];
    } else {
      groups = [...this.#cats.values(), null]
        .map((cat) => ({ cat, items: items.filter((s) => (cat ? s.category === cat.id : !this.#cats.has(s.category))).toSorted(byName) }))
        .filter((g) => g.items.length);
    }

    const focused = document.activeElement?.closest?.('.place')?.dataset.space;

    this.#els.list.replaceChildren(
      ...(items.length
        ? groups.map((g) =>
            h(
              'section',
              { class: 'group', style: g.cat ? { '--cat': g.cat.color } : null },
              g.cat && h('h2', { class: 'group__title' }, h('span', { class: 'dot' }), g.cat.name),
              h(
                'ul',
                { class: 'places', role: 'list' },
                g.items.map((s) =>
                  h(
                    'li',
                    {},
                    h(
                      'button',
                      {
                        type: 'button',
                        class: 'place',
                        dataset: { space: s.id },
                        'aria-current': s.id === activeId ? 'true' : null,
                        onclick: () => this.openSpace(s.id),
                      },
                      h('span', { class: 'place__name' }, s.name),
                      h('span', { class: 'place__meta' }, this.#levels[this.#levelIndexOf(s)]?.data.short ?? ''),
                    ),
                  ),
                ),
              ),
            ),
          )
        : [h('p', { class: 'empty' }, 'No places match your search.')]),
    );

    if (focused) this.#els.list.querySelector(`.place[data-space="${CSS.escape(focused)}"]`)?.focus();

    const count = `${items.length} ${items.length === 1 ? 'place' : 'places'}`;
    this.#els.status.textContent = scoped ? `${count} · ${this.#levels[level].data.short ?? this.#levels[level].data.name}` : count;
    this.#els.scope.hidden = !scoped;
  }

  #renderDetail(space) {
    const cat = this.#cats.get(space.category);
    const lvl = this.#levels[this.#levelIndexOf(space)]?.data;
    const children = [
      h(
        'p',
        { class: 'detail__eyebrow', style: cat ? { '--cat': cat.color } : null },
        cat && h('span', { class: 'dot' }),
        [cat?.name, lvl?.name].filter(Boolean).join(' · '),
      ),
      h('h2', { class: 'detail__title', id: 'detail-title', tabindex: '-1' }, space.name),
      space.meta &&
        h(
          'dl',
          { class: 'detail__meta' },
          Object.entries(space.meta).map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))),
        ),
      space.description && h('p', { class: 'detail__desc' }, space.description),
      space.url && h('a', { class: 'detail__link', href: space.url, target: '_blank', rel: 'noopener' }, space.urlLabel ?? 'Visit website', icon('link')),
    ];
    this.#els.detailBody.replaceChildren(...children.filter(Boolean));
  }

  /** Syncs every attribute that depends on state (single source of truth). */
  #updateChrome() {
    const s = this.#state;
    const e = this.#els;
    const n = this.#levels.length;

    this.#levels.forEach((l, j) => {
      const current = s.level === j;
      const pinsOn = s.open && current && !s.moving;
      l.pinsEl.toggleAttribute('data-active', pinsOn);
      l.pinsEl.inert = !pinsOn;

      if (s.level == null) {
        l.el.inert = false;
        l.el.setAttribute('role', 'button');
        l.el.tabIndex = 0;
        l.el.setAttribute('aria-label', `${l.data.name}: open floor plan`);
      } else {
        l.el.inert = !current;
        l.el.setAttribute('role', 'group');
        l.el.removeAttribute('tabindex');
        l.el.setAttribute('aria-label', `${l.data.name} floor plan`);
      }
    });

    e.nav.toggleAttribute('data-visible', s.level != null);
    e.nav.inert = s.level == null;
    e.levelName.textContent = s.level != null ? this.#levels[s.level].data.name : '';
    e.up.disabled = s.level == null || s.level >= n - 1;
    e.down.disabled = s.level == null || s.level <= 0;

    const detailOpen = s.space != null;
    this.#root.toggleAttribute('data-detail', detailOpen);
    e.detail.inert = !detailOpen;

    this.#root.toggleAttribute('data-directory', s.directory);
    e.directory.inert = compact.matches && !s.directory;
    e.openDir.setAttribute('aria-expanded', String(s.directory));
  }

  // ── Transitions ─────────────────────────────────────────────────────────
  async #showLevel(i) {
    const s = this.#state;
    if (i == null || i < 0 || i >= this.#levels.length) return;
    if (s.level === i && s.open) return;
    if (s.open) return this.#switchLevel(i);

    s.level = i;
    // Far levels leave first, the chosen one lifts out last.
    const maxDist = Math.max(i, this.#levels.length - 1 - i);
    this.#levels.forEach((l, j) => {
      l.el.dataset.pos = j === i ? 'current' : j > i ? 'above' : 'below';
      const delay = j === i ? maxDist * 0.12 + 0.1 : (maxDist - Math.abs(j - i)) * 0.12;
      l.el.style.setProperty('--delay', `${delay}s`);
    });
    this.#els.levels.dataset.selected = '';
    this.#updateChrome();
    this.#renderList();
    this.#announce(`${this.#levels[i].data.name}`);

    await settle(this.#levels[i].el);

    this.#levels.forEach((l) => l.el.style.removeProperty('--delay'));
    this.#els.levels.dataset.open = '';
    s.open = true;
    this.#updateChrome();
    this.#syncUrl();
  }

  async #switchLevel(i) {
    const s = this.#state;
    if (s.space) this.#closeSpace({ restoreFocus: false });
    s.level = i;
    s.moving = true;
    this.#levels.forEach((l, j) => (l.el.dataset.pos = j === i ? 'current' : j > i ? 'above' : 'below'));
    this.#updateChrome();
    this.#renderList();
    this.#announce(this.#levels[i].data.name);

    await settle(this.#levels[i].el);

    s.moving = false;
    this.#updateChrome();
    this.#syncUrl();
  }

  async #showAll() {
    const s = this.#state;
    if (s.level == null) return;
    const prev = this.#levels[s.level];
    if (s.space) this.#closeSpace({ restoreFocus: false });

    s.level = null;
    s.open = false;
    delete this.#els.levels.dataset.open;
    delete this.#els.levels.dataset.selected;
    for (const l of this.#levels) delete l.el.dataset.pos;
    this.#updateChrome();
    this.#renderList();
    this.#syncUrl();
    this.#announce('All floors');

    if (!this.#els.directory.contains(document.activeElement)) prev.el.focus({ preventScroll: true });
    await settle(prev.el);
  }

  async #openSpace(id) {
    const s = this.#state;
    const space = this.#spaces.get(id);
    if (!space) return;

    const li = this.#levelIndexOf(space);
    if (s.level !== li || !s.open) await this.#showLevel(li);

    if (s.space) this.#markSpace(s.space, false);
    s.space = id;
    this.#markSpace(id, true);
    this.#renderDetail(space);
    if (compact.matches) s.directory = false;
    this.#updateChrome();
    this.#syncUrl();
    this.#announce(`${space.name} selected`);
  }

  #closeSpace({ restoreFocus = true } = {}) {
    const s = this.#state;
    if (!s.space) return;
    const id = s.space;
    const hadFocus = this.#els.detail.contains(document.activeElement);
    this.#markSpace(id, false);
    s.space = null;
    this.#updateChrome();
    this.#syncUrl();
    if (restoreFocus && hadFocus) this.#findPin(id)?.focus({ preventScroll: true });
  }

  #markSpace(id, on) {
    this.#findPin(id)?.classList.toggle('is-active', on);
    for (const l of this.#levels) {
      l.svg.querySelector(`[data-space="${CSS.escape(id)}"]`)?.classList.toggle('is-selected', on);
    }
    const item = this.#els.list.querySelector(`.place[data-space="${CSS.escape(id)}"]`);
    if (on) item?.setAttribute('aria-current', 'true');
    else item?.removeAttribute('aria-current');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  #run(fn) {
    this.#queue = this.#queue.then(fn).catch((err) => console.error(err));
    return this.#queue;
  }

  #levelIndexOf(space) {
    return this.#levels.findIndex((l) => String(l.data.id) === String(space.level));
  }

  #findPin(id) {
    for (const l of this.#levels) if (l.pins.has(id)) return l.pins.get(id);
    return null;
  }

  #announce(text) {
    this.#els.announcer.textContent = text;
  }

  #setDirectory(open) {
    this.#state.directory = open;
    this.#updateChrome();
    if (open) this.#els.search.focus();
    else if (compact.matches) this.#els.openDir.focus();
  }

  #syncUrl() {
    const s = this.#state;
    const url = new URL(location.href);
    url.searchParams.delete('space');
    url.searchParams.delete('level');
    if (s.space) url.searchParams.set('space', s.space);
    else if (s.level != null) url.searchParams.set('level', this.#levels[s.level].data.id);
    if (url.href !== location.href) history.replaceState(history.state, '', url);
  }

  #restoreFromUrl() {
    const params = new URLSearchParams(location.search);
    const space = params.get('space');
    const level = params.get('level');
    if (space && this.#spaces.has(space)) this.openSpace(space);
    else if (level != null) {
      const i = this.#levels.findIndex((l) => String(l.data.id) === level);
      if (i >= 0) this.showLevel(i);
    }
  }

  #bindGlobalEvents() {
    compact.addEventListener('change', () => this.#updateChrome());

    document.addEventListener('keydown', (ev) => {
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const s = this.#state;
      const typing = ev.target.closest?.('input, textarea, select, [contenteditable]');

      if (ev.key === 'Escape') {
        if (typing && ev.target.value) return; // let the search field clear itself first
        if (s.directory && compact.matches) this.#setDirectory(false);
        else if (s.space) this.closeSpace();
        else if (s.level != null) this.showAll();
        return;
      }
      if (typing) return;

      if (ev.key === '/') {
        ev.preventDefault();
        this.#setDirectory(true);
      } else if (s.open && (ev.key === 'ArrowUp' || ev.key === 'PageUp')) {
        ev.preventDefault();
        this.step(1);
      } else if (s.open && (ev.key === 'ArrowDown' || ev.key === 'PageDown')) {
        ev.preventDefault();
        this.step(-1);
      }
    });
  }
}
