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
    console.log("[useHighlighter] Highlighting", lines.length, "lines as", lang);
    highlightCode(code, lang).then((result) => {
      console.log("[useHighlighter] Got tokens:", result ? result.length : "null");
      if (!cancelled) setTokens(result);
    });

    return () => { cancelled = true; };
  }, [code, lang, lines.length]);

  return tokens;
}
