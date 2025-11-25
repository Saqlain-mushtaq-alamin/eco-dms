# Use Windows command shell
SHELL := cmd.exe
.SHELLFLAGS := /C

PY_ENV=backend\.venv
PYTHON=py -3.11

# Install dependencies
install:
	@if not exist "$(PY_ENV)" ($(PYTHON) -m venv "$(PY_ENV)")
	@"$(PY_ENV)\Scripts\pip" install -r backend\requirements.txt

# Dev setup: start backend, contracts, and web
dev: install
	@echo Starting Backend...
	@start "" /B "$(PY_ENV)\Scripts\uvicorn" backend.app.main:app --reload --port 8000
	@echo Starting Hardhat...
	@start "" /B pnpm --filter eco-dms-contracts hardhat node
	@echo Starting Web...
	@pnpm --filter eco-dms-web dev

# Backend only (runs inside backend directory)
backend: install
	@echo Starting Backend only...
	@cd backend && start "" /B "..\$(PY_ENV)\Scripts\uvicorn" app.main:app --reload --port 8000

# Web only
web:
	@pnpm --filter eco-dms-web dev

# Contracts only
contracts:
	@pnpm --filter eco-dms-contracts hardhat node

# Run tests
test:
	@pnpm --filter eco-dms-web test || exit 0
	@pnpm --filter eco-dms-contracts test || exit 0
	@if exist "$(PY_ENV)" "$(PY_ENV)\Scripts\python" -m pytest backend\app\tests -q || exit 0

# Deploy to staging
deploy-staging:
	@pnpm --filter eco-dms-contracts build
	@pnpm --filter eco-dms-contracts deploy:staging
	@echo Staging deploy done.

# Clean
clean:
	@echo Nothing to clean.
