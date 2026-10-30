"""SQLAlchemy engine and session factory."""

from collections.abc import Iterator
from datetime import datetime

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_engine(get_settings().database_url, pool_pre_ping=True, pool_recycle=3600)


@event.listens_for(engine, "connect")
def _same_time_zone_as_python(dbapi_connection, _record) -> None:
    """MySQL NOW() and Python datetime.now() must use the same zone, even with a MySQL in UTC
    (e.g. docker-compose): dates are stored in the server's local time and sent in UTC by the API."""
    if engine.dialect.name != "mysql":
        return
    offset = datetime.now().astimezone().strftime("%z")  # e.g. +0200
    with dbapi_connection.cursor() as cursor:
        cursor.execute(f"SET time_zone = '{offset[:3]}:{offset[3:]}'")


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
