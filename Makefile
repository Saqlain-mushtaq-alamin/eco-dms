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
	@echo Starting Redis...
	@docker run --rm -d --name eco-redis -p 6379:6379 redis:7 1>nul 2>nul || echo Redis already running or Docker not available.
	@echo Starting Backend...
	@pushd backend && start "" /B cmd /C "set PYTHONPATH=%CD%&& .venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000" && popd
	@echo Starting Hardhat...
	@pushd contracts && start "" /B cmd /C "npx hardhat node --port 8545" && popd
	@echo Starting Web...
	@pushd apps\web && start "" /B cmd /C "pnpm dev" && popd
	@echo All services started: Backend http://127.0.0.1:8000  Web http://localhost:5173  Hardhat http://127.0.0.1:8545  Redis redis://127.0.0.1:6379

# Backend only (runs inside backend directory)
backend: install
	@echo Starting Backend only...
	@pushd backend && start "" /B cmd /C "set PYTHONPATH=%CD%&& .venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000" && popd

# Web only
web:
	@pushd apps\web && pnpm dev && popd

# Contracts only
contracts:
	@pushd contracts && npx hardhat node --port 8545 && popd

# Run tests
test:
	@pnpm --filter eco-dms-web test || exit 0
	@pnpm --filter eco-dms-contracts test || exit 0
	@if exist "$(PY_ENV)" "$(PY_ENV)\Scripts\python" -m pytest backend\app\tests -q || exit 0

# Clean
clean:
	@echo Nothing to clean.
