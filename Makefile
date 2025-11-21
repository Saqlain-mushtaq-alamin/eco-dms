SHELL := /usr/bin/env bash

PY_ENV := backend/.venv
BACKEND_PORT := 8000

.PHONY: dev test deploy:staging backend web contracts ipfs subgraph clean

dev: install python-env up-ipfs-graph start-hardhat start-backend start-web
    @echo "Dev environment started."

install:
    pnpm install
    @if [ ! -d "$(PY_ENV)" ]; then python -m venv $(PY_ENV); fi
    @$(PY_ENV)/Scripts/pip install -r backend/requirements.txt

python-env:
    @if [ ! -d "$(PY_ENV)" ]; then python -m venv $(PY_ENV); fi
    @$(PY_ENV)/Scripts/pip install -r backend/requirements.txt

start-backend:
    ( cd backend && ../$(PY_ENV)/Scripts/uvicorn app.main:app --reload --port $(BACKEND_PORT) ) &

start-web:
    pnpm --filter eco-dms-web dev &

start-hardhat:
    pnpm --filter eco-dms-contracts hardhat node &

up-ipfs-graph:
    docker compose -f infrastructure/docker-compose.dev.yml up -d ipfs postgres graph-node

subgraph-build:
    pnpm --filter eco-dms-subgraph graph:codegen
    pnpm --filter eco-dms-subgraph graph:build

test:
    pnpm --filter eco-dms-web test
    pnpm --filter eco-dms-web lint:web || true
    pnpm --filter eco-dms-contracts test
    pytest backend/app/tests -q || true
    pnpm --filter eco-dms-subgraph graph:test || true

deploy:staging:
    pnpm --filter eco-dms-contracts deploy:staging
    @echo "Contracts deployed to staging (Polygon testnet). Run subgraph deploy next (manual)."

clean:
    docker compose -f infrastructure/docker-compose.dev.yml down