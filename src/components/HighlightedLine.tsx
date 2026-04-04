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

const IDENTIFIER_RE = /[a-zA-Z_$]\w*/g;

function isClickableIdentifier(text: string): boolean {
  return text.length > 1 && !KEYWORDS.has(text);
}

/** Split a token's content into parts, making identifiers clickable */
function renderTokenParts(
  content: string,
  color: string | undefined,
  onTokenClick: (symbol: string, position: { x: number; y: number }) => void,
) {
  const parts: { text: string; clickable: boolean }[] = [];
  let lastIndex = 0;

  // Reset regex state
  IDENTIFIER_RE.lastIndex = 0;
  let match;
  while ((match = IDENTIFIER_RE.exec(content)) !== null) {
    const ident = match[0];
    const start = match.index;

    // Add non-identifier prefix
    if (start > lastIndex) {
      parts.push({ text: content.slice(lastIndex, start), clickable: false });
    }

    parts.push({ text: ident, clickable: isClickableIdentifier(ident) });
    lastIndex = start + ident.length;
  }

  // Add remaining non-identifier suffix
  if (lastIndex < content.length) {
    parts.push({ text: content.slice(lastIndex), clickable: false });
  }

  if (parts.length === 0) {
    return <span style={{ color }}>{content}</span>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.clickable ? (
          <span
            key={i}
            style={{ color }}
            className="cursor-pointer hover:underline hover:decoration-dotted"
            onClick={(e) => { e.stopPropagation(); onTokenClick(part.text, { x: e.clientX, y: e.clientY }); }}
          >
            {part.text}
          </span>
        ) : (
          <span key={i} style={{ color }}>{part.text}</span>
        )
      )}
    </>
  );
}

export function HighlightedLine({ tokens, plainText, onTokenClick }: Props) {
  if (!tokens) {
    return <span>{plainText || "\n"}</span>;
  }

  return (
    <>
      {tokens.map((token, i) => {
        if (onTokenClick) {
          return <span key={i}>{renderTokenParts(token.content, token.color, onTokenClick)}</span>;
        }
        return (
          <span key={i} style={{ color: token.color }}>
            {token.content}
          </span>
        );
      })}
    </>
  );
}
