/**
 * Splits a long Japanese dialogue / monologue into bite-sized pages (20-38 characters)
 * suitable for smartphone novel/RPG style speech bubbles.
 */
export function splitDialogueIntoPages(
  rawText: string,
  maxCharsPerPage: number = 36
): string[] {
  if (!rawText) return [''];

  // Trim outer quotes if they wrap the whole text: 「...」 or 『...』
  let cleaned = rawText.trim();
  if (
    (cleaned.startsWith('「') && cleaned.endsWith('」')) ||
    (cleaned.startsWith('『') && cleaned.endsWith('』'))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (cleaned.length <= maxCharsPerPage && !cleaned.includes('\n')) {
    return [cleaned];
  }

  // Split by explicit newlines first
  const rawLines = cleaned.split(/\r?\n+/);
  const pages: string[] = [];

  for (const line of rawLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    if (trimmedLine.length <= maxCharsPerPage) {
      // If adding this line to the previous page still keeps it <= maxCharsPerPage, combine
      if (
        pages.length > 0 &&
        pages[pages.length - 1].length + trimmedLine.length <= maxCharsPerPage
      ) {
        pages[pages.length - 1] += ' ' + trimmedLine;
      } else {
        pages.push(trimmedLine);
      }
      continue;
    }

    // Line is longer than maxCharsPerPage: split at punctuation points
    const sentenceRegex = /([^。！？!?…]+[。！？!?…]+|[^。！？!?…]+$)/g;
    const segments = trimmedLine.match(sentenceRegex) || [trimmedLine];

    let currentChunk = '';

    for (const seg of segments) {
      if (!seg) continue;

      if (currentChunk.length === 0) {
        if (seg.length <= maxCharsPerPage) {
          currentChunk = seg;
        } else {
          // If a single segment without punctuation is longer than maxCharsPerPage,
          // chunk it by character count (preferring commas '、')
          let remaining = seg;
          while (remaining.length > maxCharsPerPage) {
            const commaIdx = remaining.slice(0, maxCharsPerPage).lastIndexOf('、');
            const cutIdx = commaIdx >= maxCharsPerPage - 12 ? commaIdx + 1 : maxCharsPerPage;
            pages.push(remaining.slice(0, cutIdx).trim());
            remaining = remaining.slice(cutIdx).trim();
          }
          if (remaining) {
            currentChunk = remaining;
          }
        }
      } else if (currentChunk.length + seg.length <= maxCharsPerPage) {
        currentChunk += seg;
      } else {
        pages.push(currentChunk.trim());
        if (seg.length <= maxCharsPerPage) {
          currentChunk = seg;
        } else {
          let remaining = seg;
          while (remaining.length > maxCharsPerPage) {
            const commaIdx = remaining.slice(0, maxCharsPerPage).lastIndexOf('、');
            const cutIdx = commaIdx >= maxCharsPerPage - 12 ? commaIdx + 1 : maxCharsPerPage;
            pages.push(remaining.slice(0, cutIdx).trim());
            remaining = remaining.slice(cutIdx).trim();
          }
          currentChunk = remaining;
        }
      }
    }

    if (currentChunk.trim()) {
      pages.push(currentChunk.trim());
    }
  }

  return pages.length > 0 ? pages : [cleaned];
}

/**
 * Determines optimal font size class based on character count for mobile-first speech bubble.
 */
export function getDialogueFontSizeClass(textLength: number): string {
  if (textLength <= 20) {
    return 'text-[13.5px] sm:text-[15px]';
  }
  if (textLength <= 32) {
    return 'text-[12.5px] sm:text-[14px]';
  }
  return 'text-[11.5px] sm:text-[12.5px]';
}
