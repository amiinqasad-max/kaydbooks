import { sanitizeBookRecord, sanitizeBookArray, sanitizeNestedBookRecord } from '../bookSanitizer';

describe('sanitizeBookRecord', () => {
  test('returns safe defaults for null/undefined input', () => {
    expect(sanitizeBookRecord(null).title).toBe('');
    expect(sanitizeBookRecord(undefined).is_premium).toBe(false);
  });

  test('preserves real values while coercing types', () => {
    const result = sanitizeBookRecord({
      id: 42,
      title: 'Dune',
      author: 'Frank Herbert',
      page_count: '412',
      is_premium: 'true', // Boolean('true') === true, Boolean('') === false
    });
    expect(result.title).toBe('Dune');
    expect(result.page_count).toBe(412);
    expect(typeof result.page_count).toBe('number');
    expect(result.is_premium).toBe(true);
  });

  test('never leaves title/author as undefined (the original "level3" crash class)', () => {
    const result = sanitizeBookRecord({ id: 1 });
    expect(result.title).toBe('');
    expect(result.author).toBe('');
  });
});

describe('sanitizeBookArray', () => {
  test('maps sanitizeBookRecord over a real array', () => {
    const result = sanitizeBookArray([{ title: 'A' }, { title: 'B' }]);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('A');
  });

  test('returns [] for non-array input instead of throwing', () => {
    expect(sanitizeBookArray(null)).toEqual([]);
    expect(sanitizeBookArray('not an array')).toEqual([]);
  });
});

describe('sanitizeNestedBookRecord', () => {
  test('sanitizes a nested `books` object (the shape returned by a Supabase join)', () => {
    const result = sanitizeNestedBookRecord({
      progress_percentage: 40,
      books: { title: 'Nested Book' },
    });
    expect(result.books.title).toBe('Nested Book');
    expect(result.books.author).toBe(''); // filled in, not undefined
  });

  test('passes through non-object input unchanged', () => {
    expect(sanitizeNestedBookRecord(null)).toBe(null);
  });
});
