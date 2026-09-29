from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from api.schemas import HealthCheck
from api.dependencies import get_db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])

# -------------------------------------------
# 🟢 Liveness check — NO DB = NO COST
# -------------------------------------------
@router.get("/live")
def live_check():
    return {"status": "alive"}


# -------------------------------------------
# 🟡 Readiness check — DB test optional
# -------------------------------------------
@router.get("/ready", response_model=HealthCheck)
def readiness_check(
    check_db: bool = False,
    db: Session = Depends(get_db)
):
    db_status = "skipped"

    if check_db:
        try:
            db.execute(text("SELECT 1"))
            db_status = "connected"
        except Exception as e:
            db_status = f"error: {str(e)}"

    return HealthCheck(
        status="healthy",
        database=db_status,
        timestamp=datetime.now()
    )
