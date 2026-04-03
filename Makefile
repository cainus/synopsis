.PHONY: dev test test-rust test-frontend build check

dev:
	source "$$HOME/.cargo/env" && npm run tauri dev

test: test-rust test-frontend

test-rust:
	source "$$HOME/.cargo/env" && cd src-tauri && cargo test

test-frontend:
	npm test

check:
	source "$$HOME/.cargo/env" && cd src-tauri && cargo check
	npx tsc --noEmit

build:
	source "$$HOME/.cargo/env" && npm run tauri build
