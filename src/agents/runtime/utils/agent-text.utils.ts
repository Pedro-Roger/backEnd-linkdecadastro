export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

export function makeUniqueSlug(base: string) {
  const root = slugify(base) || `item-${Date.now()}`;
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}
