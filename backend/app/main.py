"""ORCA API entrypoint.

    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .api import alerts, chat, emergency_route, fishing, forecast, historical, map as map_api, routes, sos
from .config import get_data_mode

app = FastAPI(
    title="ORCA — Marine EcOsystem Reasoning with Collaborative Agents",
    description=(
        "SIH26176 · A crew of cooperating AI agents that turns Indian marine data "
        "into one safe, explainable decision for fishers.\n\n"
        "**Safety note:** ORCA is decision support. It does not replace official "
        "IMD / INCOIS advisories or Coast Guard instructions."
    ),
    version=__version__,
)

cors_origins_str = os.getenv("ORCA_CORS_ORIGINS", "*")
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")] if cors_origins_str else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(fishing.router)
app.include_router(forecast.router)
app.include_router(map_api.router)
app.include_router(alerts.router)
app.include_router(routes.router)
app.include_router(sos.router)
app.include_router(emergency_route.router)
app.include_router(historical.router)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "version": __version__, "data_mode": get_data_mode(),
            "agents": ["intent", "planner", "weather", "ocean", "pfz", "cyclone",
                       "gis", "risk", "route", "explanation"]}


# --- serve the built frontend if it exists --------------------------------
_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    # index.html must NEVER be cached: a browser tab holding yesterday's HTML
    # keeps loading yesterday's JS bundle, and the demo quietly runs old code
    # (this actually happened — a feature "missing" on stage was a stale tab).
    # The hashed /assets files stay cacheable; only the entry document is not.
    _NO_STORE = {"Cache-Control": "no-store, must-revalidate"}

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(_DIST / "index.html", headers=_NO_STORE)

    @app.get("/{full_path:path}")
    def spa(full_path: str) -> FileResponse:
        candidate = _DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html", headers=_NO_STORE)
else:
    @app.get("/")
    def root() -> dict:
        return {
            "name": "ORCA",
            "problem_statement": "SIH26176",
            "docs": "/docs",
            "health": "/api/health",
            "note": "Frontend not built yet — run `npm install && npm run build` in frontend/.",
        }
