/** Background-only class for highlighted diff lines */
export function diffBg(line: string): string {
  if (line.startsWith("+")) return "bg-green-500/8";
  if (line.startsWith("-")) return "bg-red-400/8";
  return "";
}

/** Full class (text color + background) for non-highlighted fallback */
export function diffClass(line: string): string {
  if (line.startsWith("+")) return "text-green-500 bg-green-500/8";
  if (line.startsWith("-")) return "text-red-400 bg-red-400/8";
  return "";
}
