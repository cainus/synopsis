// Shared mock factories for @tauri-apps/api modules.
// Import and call these in vi.mock() factories.

export function makeCoreModule(overrides: Record<string, unknown> = {}) {
  return {
    invoke: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

export function makeEventModule(overrides: Record<string, unknown> = {}) {
  return {
    listen: vi.fn().mockResolvedValue(() => {}),
    emit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
