SHELL := /usr/bin/env bash

PY_ENV := backend/.venv
BACKEND_PORT := 8000

.PHONY: install dev backend web contracts ipfs test deploy-staging clean

install:
    pnpm install
    if [ ! -d "$(PY_ENV)" ]; then python -m venv $(PY_ENV); fi
    $(PY_ENV)/Scripts/pip install -r backend/requirements.txt

dev: install ipfs contracts backend web
    @echo "Dev started:"
    @echo " Web    -> http://localhost:5173"
    @echo " API    -> http://localhost:8000"
    @echo " Hardhat-> http://localhost:8545 (after node starts)"

backend:
    cd backend && ../$(PY_ENV)/Scripts/uvicorn app.main:app --reload --port $(BACKEND_PORT) &

web:
    pnpm --filter eco-dms-web dev &

contracts:
    pnpm --filter eco-dms-contracts hardhat node &

ipfs:
    if [ -f infrastructure/docker-compose.dev.yml ]; then \
        docker compose -f infrastructure/docker-compose.dev.yml up -d ipfs postgres graph-node; \
    else \
        echo "Skip IPFS/Graph: docker-compose.dev.yml missing or Docker not installed."; \
    fi

test:
    pnpm --filter eco-dms-web test || true
    pnpm --filter eco-dms-contracts test || true
    if [ -d "$(PY_ENV)" ]; then $(PY_ENV)/Scripts/python -m pytest backend/app/tests -q || true; fi

deploy-staging:
    pnpm --filter eco-dms-contracts build
    pnpm --filter eco-dms-contracts deploy:staging
    @echo "Staging deploy done (Polygon Mumbai). Update subgraph.yaml address."

clean:
    if [ -f infrastructure/docker-compose.dev.yml ]; then docker compose -f infrastructure/docker-compose.dev.yml down; fi