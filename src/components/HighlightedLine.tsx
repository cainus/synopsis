import type { ThemedToken } from "@/lib/highlight";

interface Props {
  tokens: ThemedToken[] | null;
  plainText: string;
  onTokenClick?: (symbol: string, position: { x: number; y: number }) => void;
}

const KEYWORDS = new Set([
  // JS/TS
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "new", "delete", "typeof",
  "instanceof", "void", "this", "super", "class", "extends", "implements",
  "interface", "type", "enum", "import", "export", "from", "default", "as",
  "async", "await", "yield", "try", "catch", "finally", "throw", "of", "in",
  "true", "false", "null", "undefined", "NaN", "Infinity",
  // Rust
  "fn", "pub", "mod", "use", "struct", "impl", "trait", "where", "mut",
  "ref", "self", "Self", "crate", "match", "loop", "move", "unsafe", "extern",
  // Python
  "def", "class", "import", "from", "as", "if", "elif", "else", "for",
  "while", "return", "yield", "with", "try", "except", "finally", "raise",
  "pass", "lambda", "None", "True", "False", "and", "or", "not", "is", "in",
  // Go
  "func", "package", "import", "type", "struct", "interface", "map", "chan",
  "go", "defer", "select", "range", "nil",
]);

const IDENTIFIER_RE = /^[a-zA-Z_$]\w*$/;

function isClickableIdentifier(text: string): boolean {
  return IDENTIFIER_RE.test(text) && !KEYWORDS.has(text);
}

export function HighlightedLine({ tokens, plainText, onTokenClick }: Props) {
  if (!tokens) {
    return <span>{plainText || "\n"}</span>;
  }

  return (
    <>
      {tokens.map((token, i) => {
        const clickable = onTokenClick && isClickableIdentifier(token.content);
        return (
          <span
            key={i}
            style={{ color: token.color }}
            className={clickable ? "cursor-pointer hover:underline hover:decoration-dotted" : undefined}
            onClick={clickable ? (e) => { e.stopPropagation(); onTokenClick(token.content, { x: e.clientX, y: e.clientY }); } : undefined}
          >
            {token.content}
          </span>
        );
      })}
    </>
  );
}
