"""Hydrate RAG production IDs from the existing Zflix MongoDB catalog."""

import re
import unicodedata

from pymongo import MongoClient

from src.config import MONGODB_DB_NAME, MONGODB_URI
from src.logger import get_logger
from src.schemas import RecommendedMovie


logger = get_logger(__name__)


def _searchable(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(re.findall(r"\w+", without_accents))


def _mentioned(production_id: int, title: str, answer: str) -> bool:
    # The ID must first come from RAG retrieval and resolve to a real production.
    # A movie detail link in the answer is also direct evidence for that ID.
    if re.search(rf"/movies/{production_id}(?!\d)", answer):
        return True
    searchable_answer = f" {_searchable(answer)} "
    searchable_title = _searchable(title)
    if not searchable_title:
        return False
    if f" {searchable_title} " in searchable_answer:
        return True
    # LLMs sometimes omit an English article from an otherwise complete title.
    words = searchable_title.split()
    return len(words) >= 3 and words[0] in {"a", "an", "the"} and f" {' '.join(words[1:])} " in searchable_answer


def _rating(value: object) -> float | None:
    if value is None:
        return None
    try:
        if hasattr(value, "to_decimal"):
            value = value.to_decimal()
        return float(value)
    except (TypeError, ValueError):
        return None


def load_recommended_movies(production_ids: list[int], answer: str) -> list[RecommendedMovie]:
    """Return up to four answer-backed RAG movies, ordered by retrieval relevance."""
    if not production_ids or not answer.strip():
        return []

    client = MongoClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=3000,
        connectTimeoutMS=3000,
        socketTimeoutMS=3000,
    )
    try:
        db = client[MONGODB_DB_NAME]
        productions = {
            item["id"]: item for item in db.productions.find(
                {"id": {"$in": production_ids}, "type": {"$in": ["movie", "series"]}},
                {"_id": 0, "id": 1, "title": 1, "poster_url": 1, "release_year": 1,
                 "rating_avg": 1, "description": 1},
            )
        }
        selected = [productions[production_id] for production_id in production_ids
                    if production_id in productions and productions[production_id].get("title")
                    and _mentioned(production_id, productions[production_id]["title"], answer)][:4]
        if not selected:
            return []

        ids = [item["id"] for item in selected]
        links = list(db.production_genres.find(
            {"production_id": {"$in": ids}}, {"_id": 0, "production_id": 1, "genre_id": 1}
        ))
        genre_ids = list({link["genre_id"] for link in links})
        genres = {item["id"]: item["name"] for item in db.genres.find(
            {"id": {"$in": genre_ids}}, {"_id": 0, "id": 1, "name": 1}
        )} if genre_ids else {}
        genres_by_production: dict[int, list[str]] = {}
        for link in links:
            name = genres.get(link["genre_id"])
            if name:
                genres_by_production.setdefault(link["production_id"], []).append(name)

        return [RecommendedMovie(
            id=item["id"],
            title=item["title"],
            poster=item.get("poster_url"),
            year=item.get("release_year"),
            genres=genres_by_production.get(item["id"], []),
            rating=_rating(item.get("rating_avg")),
            description=item.get("description"),
        ) for item in selected]
    finally:
        client.close()
