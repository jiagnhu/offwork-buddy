// Measure using the actual font and available width; never truncate the reply.
export function splitReplyPages(
  text: string,
  maxHeight: number,
  measure: (value: string) => number,
): string[] {
  if (!text) return [""];
  const chars = Array.from(text),
    pages: string[] = [];
  let start = 0;
  while (start < chars.length) {
    let low = 1,
      high = chars.length - start,
      fit = 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (measure(chars.slice(start, start + mid).join("")) <= maxHeight) {
        fit = mid;
        low = mid + 1;
      } else high = mid - 1;
    }
    pages.push(chars.slice(start, start + fit).join(""));
    start += fit;
  }
  return pages;
}
