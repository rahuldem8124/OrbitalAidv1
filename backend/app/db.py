"""
Database engine and session setup.
Defaults to a local SQLite file for zero-setup development.
Swap DATABASE_URL to a Postgres connection string when ready for production —
nothing else in the codebase needs to change.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./orbitalaid.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_session():
    """Yield a DB session, auto-closing when done."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db():
    """Create all tables if they don't exist yet."""
    from app.models.models import Base
    Base.metadata.create_all(bind=engine)