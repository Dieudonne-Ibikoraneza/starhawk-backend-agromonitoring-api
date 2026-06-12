export const normalizeLocationText = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const matchesLocationText = (value: string, query?: string): boolean => {
  if (!query) {
    return true;
  }

  const normalizedValue = normalizeLocationText(value);
  const normalizedQuery = normalizeLocationText(query);

  return normalizedValue.includes(normalizedQuery) || normalizedQuery.includes(normalizedValue);
};

