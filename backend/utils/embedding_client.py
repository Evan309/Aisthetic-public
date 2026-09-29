import numpy as np
from sentence_transformers import SentenceTransformer, util
import logging

class EmbeddingClient:
    def __init__(self, model: str = "all-MiniLM-L6-v2"):
        logging.info(f"Initializing EmbeddingClient with model: {model}")
        self.model = SentenceTransformer(model)
        logging.info(f"EmbeddingClient initialized with model: {model}")

    def embed_one(self, text: str):
        return self.model.encode(text, convert_to_tensor=True)

    def embed_texts(self, texts: list[str]):
        return self.model.encode(texts, convert_to_tensor=True)

    def similarity(self, emb1: np.ndarray, emb2: np.ndarray):
        return util.cos_sim(emb1, emb2)

    