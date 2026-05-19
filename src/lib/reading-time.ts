const WORDS_PER_MINUTE = 200;

export function computeReadingMinutes(markdown: string): number {
  const plain = markdown.replace(/[#*`_>!\[\]()]/g, " ");
  const words = plain.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
