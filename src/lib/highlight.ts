import { createHighlighter, type Highlighter, type ThemedToken, type BundledLanguage } from "shiki";

export type { ThemedToken };

let highlighterPromise: Promise<Highlighter> | null = null;

const PRELOADED_LANGS = [
  "typescript", "tsx", "javascript", "jsx",
] as const;

export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-dark"],
      langs: [...PRELOADED_LANGS],
    });
  }
  return highlighterPromise;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  mjs: "javascript", cjs: "javascript", mts: "typescript",
  rs: "rust", py: "python", go: "go",
  css: "css", scss: "css", html: "html", htm: "html",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  sh: "bash", bash: "bash", zsh: "bash",
  swift: "swift", kt: "kotlin", kts: "kotlin",
  java: "java", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp",
  cs: "csharp", rb: "ruby", php: "php",
  sql: "sql", xml: "xml", md: "markdown", mdx: "markdown",
  graphql: "graphql", gql: "graphql",
  dockerfile: "dockerfile",
};

const PROSE_EXTENSIONS = new Set([
  "md", "mdx", "txt", "text", "rst", "adoc", "asciidoc", "org",
  "csv", "tsv", "log", "env", "gitignore", "dockerignore",
]);

export function isProseFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return PROSE_EXTENSIONS.has(ext);
}

export function langFromPath(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const basename = filePath.split("/").pop()?.toLowerCase() ?? "";
  if (basename === "dockerfile") return "dockerfile";
  return EXT_TO_LANG[ext] ?? null;
}

/** Highlight a single line of code (no prefix). Returns tokens or null on failure. */
export async function highlightLine(
  code: string,
  lang: string
): Promise<ThemedToken[] | null> {
  try {
    const h = await getHighlighter();
    const result = h.codeToTokens(code, { lang: lang as BundledLanguage, theme: "github-dark" });
    return result.tokens[0] ?? null;
  } catch {
    return null;
  }
}

/** Highlight multiple lines at once. More efficient than per-line calls. */
export async function highlightCode(
  code: string,
  lang: string
): Promise<ThemedToken[][] | null> {
  try {
    const h = await getHighlighter();
    // Load language on demand if not already loaded
    const loaded = h.getLoadedLanguages();
    if (!loaded.includes(lang as BundledLanguage)) {
      await h.loadLanguage(lang as BundledLanguage);
    }
    const result = h.codeToTokens(code, { lang: lang as BundledLanguage, theme: "github-dark" });
    return result.tokens;
  } catch (e) {
    console.error("[highlight] Failed to highlight code:", e);
    return null;
  }
}
