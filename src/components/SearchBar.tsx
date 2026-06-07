import { forwardRef, useEffect, useImperativeHandle, useRef, KeyboardEvent } from "react";
import { ChevronUp, ChevronDown, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  currentMatch: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const SearchBar = forwardRef<HTMLInputElement, Props>(function SearchBar(
  {
    query,
    onQueryChange,
    matchCount,
    currentMatch,
    onNext,
    onPrev,
    onClose,
  },
  ref,
) {
  const internalRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => internalRef.current as HTMLInputElement);

  useEffect(() => {
    internalRef.current?.focus();
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      onPrev();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onNext();
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background shrink-0">
      <input
        ref={internalRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
        className="bg-muted border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring w-48"
      />
      {query.length > 0 && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {currentMatch} of {matchCount}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={onPrev}
        aria-label="Previous match"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={onNext}
        aria-label="Next match"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={onClose}
        aria-label="Close search"
      >
        <XIcon className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
});
