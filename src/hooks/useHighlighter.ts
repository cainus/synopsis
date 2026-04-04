import { useState, useEffect, useMemo } from "react";
import { highlightCode, langFromPath, type ThemedToken } from "@/lib/highlight";

export function useHighlighter(
  lines: string[],
  filePath: string
): ThemedToken[][] | null {
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);
  const lang = useMemo(() => langFromPath(filePath), [filePath]);
  const code = useMemo(() => lines.join("\n"), [lines]);

  useEffect(() => {
    if (!lang || lines.length === 0) {
      setTokens(null);
      return;
    }

    let cancelled = false;
    highlightCode(code, lang).then((result) => {
      if (!cancelled) setTokens(result);
    });

    return () => { cancelled = true; };
  }, [code, lang, lines.length]);

  return tokens;
}
