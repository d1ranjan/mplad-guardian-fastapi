from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import RobustScaler


@dataclass(frozen=True)
class AuditFeature:
    project_id: int
    sanctioned_amount: float
    actual_expenditure: float
    progress_percent: int
    days_to_completion: int
    days_since_update: int

    def vector(self) -> list[float]:
        return [np.log1p(self.sanctioned_amount), np.log1p(self.actual_expenditure), self.actual_expenditure / max(self.sanctioned_amount, 1), self.progress_percent / 100, self.days_to_completion, self.days_since_update]


class NumericContextModel:
    feature_names = ["log_sanctioned_amount", "log_actual_expenditure", "expenditure_ratio", "progress_ratio", "days_to_completion", "days_since_update"]

    def __init__(self, contamination: float = 0.08):
        self.contamination = contamination
        self.pipeline = Pipeline([("scaler", RobustScaler()), ("isolation_forest", IsolationForest(n_estimators=200, contamination=contamination, random_state=42))])

    def fit(self, features: Iterable[AuditFeature]) -> dict:
        rows = list(features)
        if len(rows) < 20:
            raise ValueError("At least 20 project records are required to train the numeric context model.")
        self.pipeline.fit(np.asarray([feature.vector() for feature in rows]))
        return {"algorithm": "IsolationForest with RobustScaler", "training_rows": len(rows), "contamination": self.contamination, "feature_names": self.feature_names, "interpretation": "Unsupervised context score; not a fraud probability."}

    def score(self, feature: AuditFeature) -> dict:
        raw = float(-self.pipeline.decision_function(np.asarray([feature.vector()]))[0])
        return {"project_id": feature.project_id, "context_score": round(min(100, max(0, 50 + raw * 120)), 2), "raw_anomaly_distance": round(raw, 6), "features": dict(zip(self.feature_names, feature.vector(), strict=True)), "limitation": "This anomaly-context score is not a fraud probability or finding of fraud."}

    def save(self, path: Path, metadata: dict) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"pipeline": self.pipeline, "metadata": metadata}, path)


@lru_cache(maxsize=1)
def get_sentence_encoder(model_name: str = "all-MiniLM-L6-v2"):
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(model_name)


def semantic_similarity(reference_text: str, candidate_text: str, encoder=None) -> dict:
    active_encoder = encoder or get_sentence_encoder()
    embeddings = active_encoder.encode([reference_text, candidate_text], normalize_embeddings=True)
    reference, candidate = np.asarray(embeddings[0]), np.asarray(embeddings[1])
    denominator = float(np.linalg.norm(reference) * np.linalg.norm(candidate))
    score = float(np.dot(reference, candidate) / denominator) if denominator else 0.0
    return {"semantic_similarity": round(score, 4), "embedding_model": "all-MiniLM-L6-v2", "interpretation": "Semantic similarity identifies comparable language only. Location, date, category, and source-record review are required before treating a pair as a potential duplicate."}
