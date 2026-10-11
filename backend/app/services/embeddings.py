"""Embedding service for semantic similarity (Addendum section 6, Step 2).

Wraps sentence-transformers. EMBEDDINGS_ENABLED determines whether the real
model is loaded; otherwise the duplicate engine uses the deterministic
keyword-similarity fallback — the pipeline always works offline.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


class EmbeddingService:
    def __init__(self, enabled: bool, model_name: str):
        self.enabled = enabled
        self.model_name = model_name
        self.model = None

    def _load(self):
        if self.model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer

            logger.info("Loading embedding model %s ...", self.model_name)
            self.model = SentenceTransformer(self.model_name)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Embedding model load failed: %s", exc)
            self.enabled = False

    def encode(self, texts: list[str]) -> Optional[np.ndarray]:
        if not self.enabled:
            return None
        self._load()
        if self.model is None:
            return None
        try:
            vecs = self.model.encode(texts, normalize_embeddings=True)
            return np.asarray(vecs)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Embedding encode failed: %s", exc)
            return None

    def cosine(self, vecs: np.ndarray, i: int, j: int) -> float:
        a, b = vecs[i], vecs[j]
        return float(np.dot(a, b))


embedding_service = EmbeddingService(enabled=False, model_name="BAAI/bge-small-en-v1.5")


def configure_embeddings(enabled: bool, model_name: str):
    global embedding_service
    embedding_service = EmbeddingService(enabled, model_name)