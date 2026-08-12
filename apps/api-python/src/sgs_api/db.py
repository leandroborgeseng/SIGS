from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_DEFAULT_DIR = Path(__file__).resolve().parents[2] / ".data"
_DEFAULT_DIR.mkdir(parents=True, exist_ok=True)
_DEFAULT_URL = f"sqlite:///{_DEFAULT_DIR / 'sgs.db'}"

DATABASE_URL = os.getenv("SGS_DATABASE_URL", _DEFAULT_URL)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from sgs_api import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
