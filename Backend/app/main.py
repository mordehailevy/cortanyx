"""FastAPI application entry point.

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.routers import conversations
from app.schemas import Health
from app.services.openai_service import AIServiceError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()

app = FastAPI(
    title="ChatGPT Clone API",
    version="1.0.0",
    description="REST API of the ChatGPT Clone final project (FastAPI + MySQL + OpenAI) - by Mordehai Levy.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(AIServiceError)
async def ai_error_handler(_: Request, exc: AIServiceError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.get("/api/health", response_model=Health, tags=["System"], summary="Check the API, database and configuration")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:  # noqa: BLE001
        db_status = "unreachable"
    return Health(
        status="ok" if db_status == "ok" else "degraded",
        database=db_status,
        model=settings.openai_model,
        openai_key_configured=bool(settings.openai_api_key),
    )


app.include_router(conversations.router)
