import logging
import os
from datetime import datetime

def init_logger(name: str, log_dir: str = "backend/logs") -> logging.Logger:
    """
    Initialize a logger that writes both to console and a timestamped log file.
    Usage:
        logger = init_logger(__name__)
        logger.info("message")
    """
    os.makedirs(log_dir, exist_ok=True)

    # Create timestamped log filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = os.path.join(log_dir, f"{name}_{timestamp}.log")

    # Configure logging
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Formatter for both console & file
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s", "%Y-%m-%d %H:%M:%S")

    # File handler
    fh = logging.FileHandler(log_path)
    fh.setFormatter(fmt)
    fh.setLevel(logging.INFO)

    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    ch.setLevel(logging.INFO)

    # Avoid duplicate handlers if re-initialized
    if not logger.handlers:
        logger.addHandler(fh)
        logger.addHandler(ch)

    logger.info(f"📄 Logging initialized. Saving logs to: {log_path}")
    return logger