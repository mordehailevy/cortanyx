"""FastAPI application entry point.

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

import logging

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.routers import conversations
from app.schemas import Health
from app.security import SecurityMiddleware
from app.services.openai_service import AIServiceError

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()

MAX_BODY_BYTES = 64 * 1024  # a chat message is at most 8000 characters

docs = {} if settings.enable_docs else {"docs_url": None, "redoc_url": None, "openapi_url": None}
app = FastAPI(
    title="Cortanyx API",
    version="1.1.0",
    description="REST API of Cortanyx, the ChatGPT-style final project (FastAPI + MySQL + OpenAI) - by Mordehai Levy.",
    **docs,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
# only answer to known host names (protects a local API against DNS rebinding)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(SecurityMiddleware, max_body_bytes=MAX_BODY_BYTES)


@app.exception_handler(AIServiceError)
async def ai_error_handler(_: Request, exc: AIServiceError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    # same shape as FastAPI's default, without echoing the submitted values back
    errors = [{k: v for k, v in e.items() if k not in ("input", "ctx", "url")} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": errors})


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
