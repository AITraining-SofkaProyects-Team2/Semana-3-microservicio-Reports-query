# Makefile helpers for running without Docker Desktop (uses docker CLI)

.PHONY: up down logs start-colima stop-colima

start-colima:
	colima start --cpu 2 --memory 4 --disk 60

stop-colima:
	colima stop

up: start-colima
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f app
