/**
 * Read <-> Listen position mapping.
 *
 * Honesty rule (per the product spec): we do NOT claim word-level or
 * sentence-level synchronization -- this app has no forced-alignment data
 * between the ebook text and the audio narration. What we DO have is
 * `chapters` (supabase/migrations/003_authorization_and_schema_fixes.sql),
 * which gives each chapter a page range AND a time range when an admin has
 * filled them in.
 *
 * Mapping priority, matching the product spec exactly:
 *   1. Explicit chapter mapping (the current page/second falls inside a
 *      chapter that has BOTH a page range and a time range recorded)
 *   2. Percentage-within-chapter mapping (the chapter is known on the
 *      source side, but the equivalent chapter has no time/page range --
 *      falls back to overall percentage-through-chapter)
 *   3. Percentage mapping across the whole book (no chapter data at all)
 *   4. Explicit "no mapping" result -- the caller (UI) must show a graceful
 *      choice, never silently jump to a made-up position.
 */

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {Object} params
 * @param {Array<{id:string, chapter_index:number, start_page?:number, end_page?:number, start_time_seconds?:number, end_time_seconds?:number}>} params.chapters
 * @param {number} params.currentPage
 * @param {number} params.totalPages
 * @param {number} [params.totalAudioSeconds] used for the whole-book percentage fallback
 * @returns {{ strategy: 'chapter'|'chapter-percentage'|'book-percentage'|'none', chapterId: string|null, suggestedSeconds: number|null }}
 */
function suggestListenPosition({ chapters, currentPage, totalPages, totalAudioSeconds }) {
  const list = Array.isArray(chapters) ? chapters : [];

  const currentChapter = list.find(
    (c) => c.start_page != null && currentPage >= c.start_page && (c.end_page == null || currentPage <= c.end_page)
  );

  if (currentChapter && currentChapter.start_time_seconds != null) {
    // Strategy 1: we know the chapter AND its audio start time. If the
    // chapter also has a page range and an end time, place the listener
    // proportionally through the chapter's audio using how far through the
    // chapter's *pages* the reader is -- closer than just jumping to the
    // chapter start, still honest (never claims word-level accuracy).
    const hasFullRange =
      currentChapter.end_page != null &&
      currentChapter.end_time_seconds != null &&
      currentChapter.end_page > currentChapter.start_page;

    let suggestedSeconds = currentChapter.start_time_seconds;
    if (hasFullRange) {
      const pageFraction = clamp(
        (currentPage - currentChapter.start_page) / (currentChapter.end_page - currentChapter.start_page),
        0,
        1
      );
      suggestedSeconds =
        currentChapter.start_time_seconds +
        pageFraction * (currentChapter.end_time_seconds - currentChapter.start_time_seconds);
    }

    return { strategy: 'chapter', chapterId: currentChapter.id, suggestedSeconds };
  }

  if (currentChapter) {
    // Strategy 2: chapter is known on the page side, but this chapter has
    // no recorded audio timing. Nothing honest to suggest for this chapter
    // specifically -- fall through to whole-book percentage instead of
    // guessing a chapter's start time from unrelated data.
  }

  if (totalPages > 0 && totalAudioSeconds > 0) {
    // Strategy 3: no usable chapter data -- fall back to overall percentage.
    const percent = clamp(currentPage / totalPages, 0, 1);
    return {
      strategy: 'book-percentage',
      chapterId: currentChapter ? currentChapter.id : null,
      suggestedSeconds: percent * totalAudioSeconds,
    };
  }

  // Strategy 4: nothing reliable to suggest at all.
  return { strategy: 'none', chapterId: null, suggestedSeconds: null };
}

/**
 * Symmetric: from an audio position, suggest where to resume reading.
 * @returns {{ strategy: 'chapter'|'book-percentage'|'none', chapterId: string|null, suggestedPage: number|null }}
 */
function suggestReadingPosition({ chapters, currentSeconds, totalAudioSeconds, totalPages }) {
  const list = Array.isArray(chapters) ? chapters : [];

  const currentChapter = list.find(
    (c) =>
      c.start_time_seconds != null &&
      currentSeconds >= c.start_time_seconds &&
      (c.end_time_seconds == null || currentSeconds <= c.end_time_seconds)
  );

  if (currentChapter && currentChapter.start_page != null) {
    const hasFullRange =
      currentChapter.end_time_seconds != null &&
      currentChapter.end_page != null &&
      currentChapter.end_time_seconds > currentChapter.start_time_seconds;

    let suggestedPage = currentChapter.start_page;
    if (hasFullRange) {
      const timeFraction = clamp(
        (currentSeconds - currentChapter.start_time_seconds) /
          (currentChapter.end_time_seconds - currentChapter.start_time_seconds),
        0,
        1
      );
      suggestedPage = Math.round(
        currentChapter.start_page + timeFraction * (currentChapter.end_page - currentChapter.start_page)
      );
    }

    return { strategy: 'chapter', chapterId: currentChapter.id, suggestedPage };
  }

  if (totalAudioSeconds > 0 && totalPages > 0) {
    const percent = clamp(currentSeconds / totalAudioSeconds, 0, 1);
    return {
      strategy: 'book-percentage',
      chapterId: currentChapter ? currentChapter.id : null,
      suggestedPage: Math.max(1, Math.round(percent * totalPages)),
    };
  }

  return { strategy: 'none', chapterId: null, suggestedPage: null };
}

module.exports = { suggestListenPosition, suggestReadingPosition };
