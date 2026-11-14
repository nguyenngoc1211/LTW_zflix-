"""Read the Zflix MongoDB catalog for the existing RAG indexer."""

from pymongo import MongoClient

from src.config import MONGODB_URI, MONGODB_DB_NAME
from src.ingestion.data_loader import DataLoader


class MongoDataLoader:
    def load_all(self):
        if not MONGODB_URI:
            raise RuntimeError("MONGODB_URI is required to index the Zflix catalog")

        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10000)
        try:
            db = client[MONGODB_DB_NAME]
            productions = list(db.productions.find({"type": {"$in": ["movie", "series"]}}))
            if not productions:
                return []

            ids = [item["id"] for item in productions]
            links = list(db.production_genres.find({"production_id": {"$in": ids}}))
            genre_ids = list({link["genre_id"] for link in links})
            genres = {item["id"]: item["name"] for item in db.genres.find({"id": {"$in": genre_ids}})}
            genres_by_production = {}
            for link in links:
                name = genres.get(link["genre_id"])
                if name:
                    genres_by_production.setdefault(link["production_id"], []).append(name)

            actor_links = list(db.production_actors.find({"production_id": {"$in": ids}}))
            actor_ids = list({link["actor_id"] for link in actor_links})
            actors = {item["id"]: item["name"] for item in db.actors.find({"id": {"$in": actor_ids}})}
            actors_by_production = {}
            for link in actor_links:
                name = actors.get(link["actor_id"])
                if name:
                    actors_by_production.setdefault(link["production_id"], []).append(name)

            seasons = list(db.seasons.find({"series_id": {"$in": ids}}))
            season_to_series = {season["id"]: season["series_id"] for season in seasons}
            episode_ids = ids + list(season_to_series)
            episodes_by_production = {}
            for episode in db.episodes.find({"production_id": {"$in": episode_ids}}):
                owner = season_to_series.get(episode["production_id"], episode["production_id"])
                label = f"Tập {episode.get('episode_number', '?')}: {episode.get('title') or 'Chưa đặt tên'}"
                episodes_by_production.setdefault(owner, []).append(label)

            formatter = DataLoader()
            documents = []
            for item in productions:
                for field in ("rating_avg", "rating_count"):
                    value = item.get(field)
                    if hasattr(value, "to_decimal"):
                        item[field] = float(value.to_decimal())
                item["genres"] = genres_by_production.get(item["id"], [])
                item["actors"] = actors_by_production.get(item["id"], [])
                item["episodes"] = episodes_by_production.get(item["id"], [])
                item["primary_thumbnail_url"] = None
                item["primary_duration_seconds"] = None
                document = formatter.build_movie_document(item)
                document.content = f"Mã phim: {item['id']}\n{document.content}"
                # Chroma metadata accepts scalar values, not lists.
                document.metadata.pop("genres", None)
                document.metadata.pop("actors", None)
                document.metadata = {
                    key: ("" if value is None else value)
                    for key, value in document.metadata.items()
                }
                documents.append(document)
            return documents
        finally:
            client.close()
