
import logging
import threading
from typing import Optional
import torch

from db.utils.backfill_openclip_image_embeddings import OpenCLIPImageEmbedder

logger = logging.getLogger(__name__)

_embedder_singleton: Optional[OpenCLIPImageEmbedder] = None
_embedder_lock = threading.Lock()

def get_embedder() -> OpenCLIPImageEmbedder:
    """
    Returns a global thread-safe singleton of the OpenCLIP embedder.
    Loads the model lazily on the first call.
    """
    global _embedder_singleton
    
    if _embedder_singleton is None:
        with _embedder_lock:
            # Double check locking
            if _embedder_singleton is None:
                logger.info("Loading OpenCLIP model (singleton)...")
                try:
                    device = "cuda" if torch.cuda.is_available() else "cpu"
                    _embedder_singleton = OpenCLIPImageEmbedder(device=device)
                    logger.info(f"OpenCLIP model loaded on {device}")
                except Exception as e:
                    logger.error(f"Failed to load OpenCLIP model: {e}", exc_info=True)
                    raise

    return _embedder_singleton

# Alias for backward compatibility or clarity if needed
get_img_embedder = get_embedder
get_txt_embedder = get_embedder
