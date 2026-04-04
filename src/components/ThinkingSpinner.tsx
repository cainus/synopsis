export function ThinkingSpinner() {
  return (
    <div className="flex items-center justify-center gap-2.5 text-muted-foreground py-12 text-sm">
      <span className="inline-block w-3.5 h-3.5 border-2 border-muted border-t-primary rounded-full animate-spin shrink-0" />
      Thinking…
    </div>
  );
}
