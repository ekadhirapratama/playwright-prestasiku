export function generateTcId(
  epicRaw: string,
  storyRaw: string,
  index: number
): string {
  const epicMatch = epicRaw ? epicRaw.match(/\b(E\d+)\b/) : null;
  const epicCode = epicMatch ? epicMatch[1] : (epicRaw || '').replace(/\s+/g, '').slice(0, 4);

  const storyMatch = storyRaw ? storyRaw.match(/\b(S\d+)\b/) : null;
  const storyCode = storyMatch ? storyMatch[1] : (storyRaw || '').replace(/\s+/g, '').slice(0, 4);

  const paddedIndex = String(index).padStart(3, '0');
  return `${epicCode}-${storyCode}-${paddedIndex}`;
}
