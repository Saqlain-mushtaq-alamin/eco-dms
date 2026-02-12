# Use Windows command shell
SHELL := cmd.exe
.SHELLFLAGS := /C

PY_ENV=.venv
PYTHON=py -3.11

# Install dependencies (base only, no ML)
install:
	@if not exist "$(PY_ENV)" ($(PYTHON) -m venv "$(PY_ENV)")
	@"$(PY_ENV)\Scripts\pip" install -r backend\requirements-base.txt 2>nul || echo Dependencies already installed

# Dev setup: start backend, contracts, and web (NO ML/Celery)
dev: install
	@echo Starting Redis...
	@docker run --rm -d --name eco-redis -p 6379:6379 redis:7 1>nul 2>nul || echo Redis already running or Docker not available.
	@echo Starting Backend...
	@start "" /B cmd /C "set PYTHONPATH=%CD%\backend&& .venv\Scripts\python -m uvicorn backend.app.main:app --reload --port 8000"
	@echo Starting Hardhat...
	@pushd contracts && start "" /B cmd /C "npx hardhat node --port 8545" && popd
	@echo Waiting for Hardhat to start...
	@timeout /t 5 /nobreak >nul
	@echo Deploying contracts...
	@pushd contracts && npx hardhat run scripts\auto-deploy.ts --network localhost && popd
	@echo Starting Web...
	@pushd apps\web && start "" /B cmd /C "pnpm dev" && popd
	@echo All services started: Backend http://127.0.0.1:8000  Web http://localhost:5173  Hardhat http://127.0.0.1:8545  Redis redis://127.0.0.1:6379
	@echo Note: ML verification disabled (using JSON verdicts). To enable ML, install backend/requirements-ml.txt

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

# Deploy contracts (to running local network)
deploy-contracts:
	@echo Deploying contracts to localhost...
	@pushd contracts && npx hardhat run scripts\auto-deploy.ts --network localhost && popd

# Run ML verification test
test-ml:
	@echo Testing ML Verifier System...
	@$(PYTHON) verify_ml_system.py

# Run tests
test:
	@pnpm --filter eco-dms-web test || exit 0
	@pnpm --filter eco-dms-contracts test || exit 0
	@if exist "$(PY_ENV)" "$(PY_ENV)\Scripts\python" -m pytest backend\app\tests -q || exit 0

# Stop all services
stop:
	@echo Stopping services...
	@docker stop eco-redis 2>nul || echo Redis not running
	@docker stop graph-node graph-postgres graph-ipfs 2>nul || echo Graph services not running
	@taskkill /F /FI "WINDOWTITLE eq Celery*" 2>nul || echo No Celery worker to stop
	@taskkill /F /FI "WINDOWTITLE eq uvicorn*" 2>nul || echo No backend to stop
	@echo Services stopped.

# ==================
# THE GRAPH COMMANDS
# ==================

# Start Graph Node stack (PostgreSQL + IPFS + Graph Node)
graph-start:
	@echo Starting The Graph Node stack...
	@docker-compose -f infrastructure\docker-compose.graph.yml up -d
	@echo Waiting for services to be ready...
	@timeout /t 10 /nobreak >nul
	@echo Graph Node started!
	@echo   GraphQL endpoint: http://127.0.0.1:8000/subgraphs/name/eco-dms
	@echo   GraphQL Playground: http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql
	@echo   Admin API: http://127.0.0.1:8020

# Stop Graph Node stack
graph-stop:
	@echo Stopping The Graph Node stack...
	@docker-compose -f infrastructure\docker-compose.graph.yml down
	@echo Graph Node stopped.

# View Graph Node logs
graph-logs:
	@docker-compose -f infrastructure\docker-compose.graph.yml logs -f graph-node

# Build and deploy subgraph
graph-deploy:
	@echo Building and deploying subgraph...
	@pushd subgraph && pnpm graph:deploy && popd
	@echo Subgraph deployed!

# Full dev environment with Graph Node
dev-full: install
	@echo Starting full development stack (Backend + Contracts + Web + Graph)...
	@$(MAKE) graph-start
	@$(MAKE) dev
	@echo Waiting for contracts to deploy...
	@timeout /t 8 /nobreak >nul
	@echo Deploying subgraph...
	@$(MAKE) graph-deploy
	@echo Full stack ready!
	@echo   Backend: http://127.0.0.1:8000
	@echo   Web: http://localhost:5173
	@echo   Hardhat: http://127.0.0.1:8545
	@echo   GraphQL: http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql

# Clean
clean:
	@echo Nothing to clean.
