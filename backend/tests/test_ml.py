import numpy as np
from app.ml import AuditFeature, NumericContextModel, semantic_similarity


class FakeEncoder:
    def encode(self, _texts, normalize_embeddings=True):
        return np.asarray([[1.0, 0.0], [0.98, 0.02]])


def test_numeric_model_returns_explainable_context_score():
    features = [AuditFeature(index, 1_000_000 + index * 1000, 800_000 + index * 800, 50 + (index % 40), 90 + index, 10 + index) for index in range(1, 24)]
    model = NumericContextModel()
    metadata = model.fit(features)
    score = model.score(features[0])
    assert metadata["training_rows"] == 23
    assert 0 <= score["context_score"] <= 100
    assert "not a fraud probability" in score["limitation"]


def test_semantic_similarity_returns_explanation_not_an_accusation():
    result = semantic_similarity("Build a covered drainage channel", "Construct a covered stormwater drain", FakeEncoder())
    assert result["semantic_similarity"] > 0.95
    assert "Semantic similarity" in result["interpretation"]
