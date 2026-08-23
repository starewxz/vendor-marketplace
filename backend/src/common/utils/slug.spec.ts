import { generateUniqueSlug, isUniqueViolation, slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Wireless Headphones')).toBe('wireless-headphones');
  });

  it('strips non-alphanumeric characters', () => {
    expect(slugify('50% Off!! Café Mug')).toBe('50-off-caf-mug');
  });
});

describe('generateUniqueSlug', () => {
  it('returns the plain slug when nothing collides', async () => {
    const slug = await generateUniqueSlug('Wireless Headphones', () =>
      Promise.resolve(false),
    );
    expect(slug).toBe('wireless-headphones');
  });

  it('appends a deterministic numeric suffix on collision', async () => {
    const taken = new Set(['wireless-headphones', 'wireless-headphones-2']);
    const slug = await generateUniqueSlug('Wireless Headphones', (candidate) =>
      Promise.resolve(taken.has(candidate)),
    );
    expect(slug).toBe('wireless-headphones-3');
  });
});

describe('isUniqueViolation', () => {
  it('recognizes a Postgres 23505 error', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('rejects unrelated errors', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });
});
