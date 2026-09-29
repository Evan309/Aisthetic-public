import logging
import os
import time
from typing import Callable, TypeVar

from sqlalchemy import create_engine
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session, sessionmaker
from dotenv import load_dotenv

load_dotenv()


# Keep session setup as close as possible to the last known-good version.
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"DEBUG: Using DATABASE_URL starting with: {DATABASE_URL.split('://')[0]}://..." if '://' in DATABASE_URL else "DEBUG: DATABASE_URL missing")
logger = logging.getLogger(__name__)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    connect_args={
        "options": "-c statement_timeout=60000 -c idle_in_transaction_session_timeout=60000",
    },
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

TRANSIENT_DB_MARKERS = (
    "ssl syscall error",
    "ssl connection has been closed unexpectedly",
    "eof detected",
    "could not receive data from server",
    "server closed the connection unexpectedly",
    "connection reset by peer",
    "connection not open",
    "connection failed",
    "could not connect",
    "timed out",
    "timeout expired",
    "connection timeout expired",
    "multiple connection attempts failed",
    "terminating connection",
    "closed unexpectedly",
)

T = TypeVar("T")


def is_transient_db_error(exc: BaseException) -> bool:
    current: BaseException | None = exc
    while current is not None:
        msg = str(current).lower()
        if any(marker in msg for marker in TRANSIENT_DB_MARKERS):
            return True
        current = getattr(current, "orig", None) or getattr(current, "__cause__", None)
    return False


def recover_db_session(db: Session) -> None:
    try:
        db.rollback()
    except Exception:
        pass
    try:
        db.invalidate()
    except Exception:
        pass


def run_with_db_retry(
    db: Session,
    fn: Callable[[], T],
    *,
    retries: int = 1,
    base_sleep_s: float = 0.25,
) -> T:
    attempt = 0
    while True:
        try:
            return fn()
        except (OperationalError, DBAPIError) as exc:
            if attempt >= retries or not is_transient_db_error(exc):
                raise
            attempt += 1
            recover_db_session(db)
            sleep_s = base_sleep_s * attempt
            logger.warning("Transient DB error; retrying request DB work", extra={"attempt": attempt, "sleep_s": sleep_s}, exc_info=True)
            time.sleep(sleep_s)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        try:
            db.rollback()
        except Exception:
            pass
        db.close()
