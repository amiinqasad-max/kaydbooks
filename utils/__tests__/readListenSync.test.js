const { suggestListenPosition, suggestReadingPosition } = require('../readListenSync');

const chapters = [
  { id: 'ch1', chapter_index: 0, start_page: 1, end_page: 20, start_time_seconds: 0, end_time_seconds: 600 },
  { id: 'ch2', chapter_index: 1, start_page: 21, end_page: 50, start_time_seconds: 600, end_time_seconds: 1500 },
  { id: 'ch3', chapter_index: 2, start_page: 51, end_page: 80, start_time_seconds: null, end_time_seconds: null }, // audio not timed yet
];

describe('suggestListenPosition (Priority 1: explicit chapter mapping)', () => {
  test('at the very start of a chapter, suggests that chapter\'s start time', () => {
    const result = suggestListenPosition({ chapters, currentPage: 21, totalPages: 80 });
    expect(result.strategy).toBe('chapter');
    expect(result.chapterId).toBe('ch2');
    expect(result.suggestedSeconds).toBe(600);
  });

  test('partway through a chapter, interpolates proportionally within the chapter (not word-level, just chapter-relative)', () => {
    // Halfway through ch1's pages (1-20) -> roughly halfway through its 0-600s range
    const result = suggestListenPosition({ chapters, currentPage: 10, totalPages: 80 });
    expect(result.strategy).toBe('chapter');
    expect(result.chapterId).toBe('ch1');
    expect(result.suggestedSeconds).toBeGreaterThan(200);
    expect(result.suggestedSeconds).toBeLessThan(400);
  });

  test('Priority 3: falls back to whole-book percentage when the chapter has no audio timing', () => {
    const result = suggestListenPosition({ chapters, currentPage: 60, totalPages: 80, totalAudioSeconds: 1600 });
    expect(result.strategy).toBe('book-percentage');
    expect(result.suggestedSeconds).toBeCloseTo((60 / 80) * 1600, 0);
  });

  test('Priority 4: no chapters and no total audio duration -> graceful "none", never a guess', () => {
    const result = suggestListenPosition({ chapters: [], currentPage: 5, totalPages: 80 });
    expect(result.strategy).toBe('none');
    expect(result.suggestedSeconds).toBeNull();
  });
});

describe('suggestReadingPosition (symmetric mapping back to pages)', () => {
  test('maps a mid-chapter audio position back to an interpolated page', () => {
    const result = suggestReadingPosition({ chapters, currentSeconds: 900, totalAudioSeconds: 1500, totalPages: 80 });
    expect(result.strategy).toBe('chapter');
    expect(result.chapterId).toBe('ch2');
    expect(result.suggestedPage).toBeGreaterThanOrEqual(21);
    expect(result.suggestedPage).toBeLessThanOrEqual(50);
  });

  test('falls back to book percentage with no matching chapter', () => {
    const result = suggestReadingPosition({ chapters: [], currentSeconds: 800, totalAudioSeconds: 1600, totalPages: 80 });
    expect(result.strategy).toBe('book-percentage');
    expect(result.suggestedPage).toBe(40);
  });

  test('returns none rather than guessing when there is nothing to go on', () => {
    const result = suggestReadingPosition({ chapters: [], currentSeconds: 800, totalAudioSeconds: 0, totalPages: 0 });
    expect(result.strategy).toBe('none');
    expect(result.suggestedPage).toBeNull();
  });
});
