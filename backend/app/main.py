"""CivicPulse API entrypoint.

Supervisor agent layout from the PRD:
    Intake -> Evidence -> Duplicate -> Priority -> Action -> Routing
Each is realized as a thin agent wrapper, orchestrated by the Supervisor.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.v1 import analytics, calls, dashboard, demo, incidents, metrics, reports, sms
from .core.config import settings
from .core.paths import UPLOADS_DIR
from .db.database import Base, engine


# Ensure schema exists before any request (idempotent).
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI civic issue intake & resolution assistant (DVPS30).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(reports.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(demo.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(sms.router, prefix="/api/v1")
app.include_router(calls.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tagline": "Many reports -> one probable incident -> one prioritized action.",
        "docs": "/docs",
        "endpoints": {
            "submit_report": "POST /api/v1/reports",
            "incidents": "GET /api/v1/incidents",
            "dashboard": "GET /api/v1/dashboard/stats",
            "metrics": "GET /api/v1/metrics",
            "demo_seed": "POST /api/v1/demo/seed",
            "hotspots": "GET /api/v1/analytics/hotspots",
            "watchdog_run": "POST /api/v1/analytics/watchdog/run",
            "sms_inbound": "POST /api/v1/sms/inbound",
            "call_helpline": "POST /api/v1/calls/simulate",
            "tracker": "GET /api/v1/reports/tracker/{report_id}",
        },
    }