/** Keeps whole words until maxLength; never cuts mid-word. */
export function truncateByWords(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;

  const words = trimmed.split(/\s+/);
  let result = '';

  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length > maxLength) break;
    result = candidate;
  }

  if (result) return result;
  return words[0]!.slice(0, maxLength);
}
