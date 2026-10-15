#!/usr/bin/env node
/**
 * Checks a venue config before you ship it:
 *   npm run check                 (validates data/venue.json)
 *   node scripts/validate.mjs path/to/venue.json
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const file = resolve(process.argv[2] ?? 'data/venue.json');
const dir = dirname(file);
const venue = JSON.parse(await readFile(file, 'utf8'));
const errors = [];
const warnings = [];

if (!venue.name) warnings.push('No "name" set.');
if (!Array.isArray(venue.levels) || !venue.levels.length) errors.push('"levels" must be a non-empty array.');

const catIds = new Set((venue.categories ?? []).map((c) => c.id));
for (const c of venue.categories ?? []) {
  if (!/^#[0-9a-f]{3,8}$/i.test(c.color ?? '')) warnings.push(`Category "${c.id}" has no hex "color".`);
}

const svgSpaces = new Map();
for (const level of venue.levels ?? []) {
  try {
    const svg = await readFile(resolve(dir, level.map), 'utf8');
    if (!/viewBox=/.test(svg)) warnings.push(`${level.map}: no viewBox — pins may be misplaced.`);
    svgSpaces.set(String(level.id), new Set([...svg.matchAll(/data-space="([^"]+)"/g)].map((m) => m[1])));
  } catch {
    errors.push(`Level "${level.id}": can't read map file "${level.map}".`);
  }
}

const ids = new Set();
for (const s of venue.spaces ?? []) {
  const tag = `Space "${s.id}" (${s.name ?? 'unnamed'})`;
  if (!s.id || !s.name) errors.push(`${tag}: "id" and "name" are required.`);
  if (ids.has(String(s.id))) errors.push(`${tag}: duplicate id.`);
  ids.add(String(s.id));
  const shapes = svgSpaces.get(String(s.level));
  if (!shapes) errors.push(`${tag}: unknown level "${s.level}".`);
  else if (!s.pin && !shapes.has(String(s.id))) errors.push(`${tag}: no "pin" and no data-space="${s.id}" shape on that level.`);
  else if (!shapes.has(String(s.id))) warnings.push(`${tag}: no matching shape — it will have a pin but no highlighted area.`);
  if (s.category && !catIds.has(s.category)) warnings.push(`${tag}: unknown category "${s.category}".`);
  if (s.url && !/^https?:\/\//.test(s.url)) warnings.push(`${tag}: "url" must start with http(s):// — it will be ignored.`);
}

for (const w of warnings) console.warn(`⚠ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
console.log(
  `${errors.length ? '✖' : '✔'} ${venue.levels?.length ?? 0} levels, ${venue.spaces?.length ?? 0} spaces — ${errors.length} errors, ${warnings.length} warnings`,
);
process.exit(errors.length ? 1 : 0);
