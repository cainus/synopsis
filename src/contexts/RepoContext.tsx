import { createContext, useContext } from "react";

const RepoContext = createContext<string | null>(null);

export function RepoProvider({ value, children }: { value: string | null; children: React.ReactNode }) {
  return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
}

export function useRepoPath(): string {
  const value = useContext(RepoContext);
  if (!value) {
    throw new Error("useRepoPath must be used within a RepoProvider with a non-null value");
  }
  return value;
}
