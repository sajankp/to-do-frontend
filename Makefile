# FastTodo Frontend Developer Makefile
# Common tasks for development workflow
# Usage: make <target>

.PHONY: help setup dev build lint format clean

# Default target - show help
help:
	@echo "FastTodo Frontend Development Commands:"
	@echo ""
	@echo "  make setup   - Install dependencies and pre-commit hooks"
	@echo "  make dev     - Start development server"
	@echo "  make build   - Build for production"
	@echo "  make lint    - Check code formatting with Prettier"
	@echo "  make format  - Auto-format code with Prettier"
	@echo "  make clean   - Remove build artifacts"
	@echo ""

# First-time setup
setup:
	@echo "🚀 Setting up development environment..."
	npm install
	npx pre-commit install || pip install pre-commit && pre-commit install
	@echo "✅ Setup complete!"

# Development server
dev:
	npm run dev

# Production build
build:
	npm run build

# Check formatting
lint:
	npx prettier --check "**/*.{ts,tsx,js,jsx,json,md,yaml,yml}"

# Auto-format code
format:
	npx prettier --write "**/*.{ts,tsx,js,jsx,json,md,yaml,yml}"

# Type checking
typecheck:
	npx tsc --noEmit

# Clean build artifacts
clean:
	@echo "🧹 Cleaning up..."
	rm -rf dist/
	rm -rf node_modules/.cache/
	@echo "✅ Clean complete"
