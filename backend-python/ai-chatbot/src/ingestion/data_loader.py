"""
Module trích xuất dữ liệu phim từ MySQL database.

Cung cấp class DataLoader để kết nối MySQL, truy vấn và tổng hợp
thông tin từ nhiều bảng, tạo ra các MovieDocument hoàn chỉnh.
"""

from typing import Optional, Union
from mysql.connector.abstracts import MySQLConnectionAbstract
from mysql.connector.pooling import PooledMySQLConnection
from src.schemas import MovieDocument
import mysql.connector
from mysql.connector.errors import Error as MySQLError 
from src.config import (
    MYSQL_HOST, 
    MYSQL_PORT, 
    MYSQL_USER, 
    MYSQL_PASSWORD, 
    MYSQL_DATABASE
)

from src.logger import get_logger
logger = get_logger(__name__)


class DataLoader:
    """
    Trích xuất và tổng hợp dữ liệu phim từ MySQL database.

    Class này chịu trách nhiệm kết nối đến MySQL (movie_streaming_db),
    thực hiện JOIN nhiều bảng (productions, genres, actors, ratings, episodes),
    và chuyển đổi kết quả thành MovieDocument phục vụ pipeline RAG.

    Attributes:
        _connection: MySQL connection instance.

    Usage:
        loader = DataLoader()
        documents = loader.load_all()
        loader.close()
    """

    def __init__(self):
        """
        Khởi tạo DataLoader.

        Chưa kết nối MySQL, cần gọi connect() hoặc sử dụng load_all()
        (tự động kết nối).
        """
        self._connection: Optional[mysql.connector.connection.MySQLConnection] = None
        # self._connection: Optional[Union[MySQLConnectionAbstract, PooledMySQLConnection]] = None

    def connect(self):
        """
        Tạo kết nối đến MySQL database.

        Sử dụng MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD,
        MYSQL_DATABASE từ config.
        Log thông tin kết nối (host:port/database) khi thành công.

        Returns:
            mysql.connector.connection.MySQLConnection: Kết nối MySQL.

        Raises:
            mysql.connector.Error: Khi không thể kết nối.
                Log error kèm thông tin host và database.
        """
        try:
            self._connection = mysql.connector.connect( # type: ignore
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=MYSQL_DATABASE
            )
            if self._connection is not None and self._connection.is_connected():
                logger.info(f"Kết nối thành công tới MySQL: {MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}")
                
        except MySQLError as e:
            logger.error(
                f"Lỗi kết nối MySQL tại {MYSQL_HOST}/{MYSQL_DATABASE}: {e}"
            )
            raise

    def fetch_all_productions(self) -> list[dict]:
        """
        Truy vấn tất cả productions từ MySQL.

        Thực hiện JOIN với các bảng liên quan để lấy đầy đủ thông tin:
        - productions: thông tin cơ bản (title, description, type, year, ...)
        - production_genres + genres: danh sách thể loại
        - production_actors + actors: danh sách diễn viên và vai diễn
        - ratings: điểm đánh giá trung bình và số lượng
        - movies/series/seasons: thông tin riêng theo loại
        - episodes: danh sách các tập

        Log số lượng productions đã fetch.

        Returns:
            list[dict]: Mỗi dict chứa toàn bộ thông tin đã tổng hợp:
                id, title, type, description, release_year, country,
                language, rating_avg, rating_count, is_premium, status,
                genres, actors, reviews, episodes.

        Raises:
            Exception: Khi truy vấn thất bại.
                Log error kèm câu query đang thực thi.
        """
        if not self._connection or not self._connection.is_connected():
            raise RuntimeError("Chưa kết nối database. Hãy gọi connect() trước.")

        try:
            cursor = self._connection.cursor(dictionary=True)
            
            # 1. Fetch dữ liệu cơ bản của bảng productions
            logger.info("Đang truy vấn bảng productions...")
            cursor.execute("SELECT * FROM productions")
            productions_dict = {row['id']: row for row in cursor.fetchall()}

            # Khởi tạo các list rỗng chứa quan hệ
            for p_id in productions_dict:
                productions_dict[p_id]['genres'] = []
                productions_dict[p_id]['actors'] = []
                productions_dict[p_id]['episodes'] = []
                productions_dict[p_id]['primary_duration_seconds'] = None
                productions_dict[p_id]['primary_thumbnail_url'] = None
                
            '''
            {
                1: {
                    "id": 1, "title": "The Dark Knight", "type": "movie",
                    "genres": [], "actors": [], "episodes": []
                },
                2: {
                    "id": 2, "title": "Loki", "type": "series",
                    "genres": [], "actors": [], "episodes": []
                }
            }
            '''
            
            # 2. Fetch và map Thể loại (Genres)
            cursor.execute("""
                SELECT pg.production_id, g.name 
                FROM production_genres pg 
                JOIN genres g ON pg.genre_id = g.id
            """)
            for row in cursor.fetchall():
                if row['production_id'] in productions_dict:
                    productions_dict[row['production_id']]['genres'].append(row['name'])

            # 3. Fetch và map Diễn viên (Actors)
            cursor.execute("""
                SELECT pa.production_id, a.name, pa.character_name
                FROM production_actors pa 
                JOIN actors a ON pa.actor_id = a.id
                ORDER BY pa.display_order ASC
            """)
            for row in cursor.fetchall():
                if row['production_id'] in productions_dict:
                    # Nối tên diễn viên và tên nhân vật (nếu có)
                    actor_info = row['name']
                    if row['character_name']:
                        actor_info += f" (vai {row['character_name']})"
                    productions_dict[row['production_id']]['actors'].append(actor_info)

            # 4. Fetch và map Tập phim (Episodes)
            cursor.execute("""
                SELECT production_id, episode_number, title, duration, thumbnail_url
                FROM episodes 
                ORDER BY production_id, episode_number ASC
            """)
            for row in cursor.fetchall():
                if row['production_id'] in productions_dict:
                    duration_seconds = row.get('duration')
                    duration_minutes = None
                    if isinstance(duration_seconds, (int, float)) and duration_seconds > 0:
                        duration_minutes = round(duration_seconds / 60)

                    ep_info = f"Tập {row['episode_number']}: {row['title']}"
                    if duration_minutes:
                        ep_info += f" ({duration_minutes} phút)"
                    productions_dict[row['production_id']]['episodes'].append(ep_info)

                    if (
                        productions_dict[row['production_id']].get('primary_duration_seconds') is None
                        and isinstance(duration_seconds, (int, float))
                        and duration_seconds > 0
                    ):
                        productions_dict[row['production_id']]['primary_duration_seconds'] = int(duration_seconds)

                    if (
                        not productions_dict[row['production_id']].get('primary_thumbnail_url')
                        and isinstance(row.get('thumbnail_url'), str)
                        and row.get('thumbnail_url').strip() != ''
                    ):
                        productions_dict[row['production_id']]['primary_thumbnail_url'] = row['thumbnail_url']

            cursor.close()
            
            result_list = list(productions_dict.values())
            logger.info(f"Đã fetch và tổng hợp thành công {len(result_list)} productions.")
            return result_list

        except Exception as e:
            logger.error(f"Lỗi khi truy vấn và tổng hợp dữ liệu MySQL: {e}", exc_info=True)
            raise

    def build_movie_document(self, production_data: dict) -> MovieDocument:
        """
        Chuyển đổi dữ liệu thô thành MovieDocument.

        Tổng hợp thông tin thành chuỗi text có cấu trúc (content)
        phục vụ embedding, đồng thời trích xuất metadata cho filtering.

        Content bao gồm: tên phim, mô tả, thể loại, diễn viên,
        năm phát hành, quốc gia, đánh giá, thông tin tập phim.

        Args:
            production_data (dict): Thông tin production từ fetch_all_productions().

        Returns:
            MovieDocument: Document với content đã format và metadata đầy đủ.
        """
        p_id = production_data['id']
        p_type = production_data.get('type', 'movie')
        title = production_data.get('title', 'Không rõ')
        desc = production_data.get('description', '') or 'Không có mô tả'
        status = production_data.get('status', "Không có")
        year = production_data.get('release_year', 'Không rõ')
        pre = True if production_data.get("is_premium", 0) == 1 else False
        country = production_data.get('country', 'Không rõ')
        rating_avg = float(production_data.get('rating_avg') or 0.0)
        rating_cnt = production_data.get('rating_count', 0)
        lang = production_data.get("language", "Vietnamese")
        slug = production_data.get("slug", "")
        poster_url = production_data.get("poster_url", "")
        thumbnail_url = production_data.get("primary_thumbnail_url", "")
        duration_seconds = production_data.get("primary_duration_seconds")
        duration_minutes = None
        if isinstance(duration_seconds, (int, float)) and duration_seconds > 0:
            duration_minutes = round(duration_seconds / 60)
        
        genres_list = production_data.get('genres', [])
        actors_list = production_data.get('actors', [])
        episodes_list = production_data.get('episodes', [])

        # Xây dựng chuỗi văn bản thuần (Content) tối ưu cho việc đọc của LLM
        content_lines = [
            f"Tên phim/series: {title}",
            f"Loại: {p_type}",
            f"Năm phát hành: {year}",
            f"Quốc gia: {country}",
            f"Đánh giá trung bình: {rating_avg}/5",
            f"Số lượng đánh giá: {rating_cnt}",
            f"Thể loại: {', '.join(genres_list) if genres_list else 'Không có'}",
            f"Dàn diễn viên: {', '.join(actors_list) if actors_list else 'Không có thông tin'}",
            f"Mô tả nội dung: {desc}",
            f"Trạng thái: {status}",
            f"Ngôn ngữ: {lang}",
            f"Premium: {pre}",
            f"slug: {slug}",
            f"Thời lượng: {duration_minutes} phút" if duration_minutes else "Thời lượng: Chưa rõ"
        ]

        # Chỉ thêm thông tin tập phim nếu là series/season và có dữ liệu
        if episodes_list:
            content_lines.append(f"Danh sách tập phim: {', '.join(episodes_list)}")

        full_content = "\n".join(content_lines)

        # Đóng gói Metadata phục vụ Filtering
        metadata = {
            "production_id": p_id,
            "type": p_type,
            "title": title,
            "year": year,
            "country": country,
            # "genres": genres_list,  # List các string để ChromaDB filter
            "rating": rating_avg,
            "language": lang,
            "slug": slug or "",
            "poster_url": poster_url or "",
            "thumbnail_url": thumbnail_url or "",
            "duration_minutes": int(duration_minutes) if duration_minutes else 0
        }
        if actors_list:
            metadata["actors"] = actors_list
        else:
            metadata["actors"] = ["Không có thông tin diễn viên"] # ChromaDB ko nhận list rỗng
            
        if genres_list:
            metadata["genres"] = genres_list
        else:
            metadata["genres"] = ["Chưa phân loại"] # ChromaDB ko nhận list rỗng
            
        return MovieDocument(
            production_id=p_id,
            title=title,
            content=full_content,
            metadata=metadata
        )

    def load_all(self) -> list[MovieDocument]:
        """
        Load toàn bộ dữ liệu phim và chuyển đổi thành MovieDocument.

        Orchestrate: connect() → fetch_all_productions() → build_movie_document().
        Log tổng số documents đã load thành công.

        Returns:
            list[MovieDocument]: Tất cả MovieDocument sẵn sàng cho chunking.

        Raises:
            Exception: Khi trích xuất hoặc chuyển đổi thất bại.
                Log error kèm production_id gây lỗi (nếu có).
        """
        try:
            self.connect()
            raw_data = self.fetch_all_productions()
            
            documents = []
            for item in raw_data:
                try:
                    doc = self.build_movie_document(item)
                    documents.append(doc)
                except Exception as doc_e:
                    logger.error(f"Lỗi khi build document cho production_id={item.get('id')}: {doc_e}")
            
            logger.info(f"Hoàn tất load_all: Tạo thành công {len(documents)} MovieDocuments.")
            return documents
        
        except Exception as e:
            logger.error("Quá trình load_all thất bại.")
            raise
        finally:
            self.close()
            
            
            
    def fetch_recent_productions(self, days_ago: int = 1) -> list[dict]:
        """
        Chỉ truy vấn những phim mới được thêm/cập nhật trong vòng X ngày qua.
        Tối ưu hóa bằng cách dùng mệnh đề IN (...) để chỉ kéo dữ liệu liên quan.
        """
        if not self._connection or not self._connection.is_connected():
            raise RuntimeError("Chưa kết nối database. Hãy gọi connect() trước.")

        try:
            cursor = self._connection.cursor(dictionary=True)
            
            # 1. Fetch các phim mới cập nhật (Giả định có cột 'updated_at')
            logger.info(f"Đang tìm các phim được cập nhật trong {days_ago} ngày qua...")
            
            # Nếu fen dùng cột created_at thay vì updated_at thì sửa ở câu SQL dưới nhé
            query = "SELECT * FROM productions WHERE updated_at >= DATE_SUB(NOW(), INTERVAL %s DAY)"
            cursor.execute(query, (days_ago,))
            
            productions_dict = {row['id']: row for row in cursor.fetchall()}
            
            if not productions_dict:
                logger.info("Không có phim nào mới trong khoảng thời gian này.")
                return []

            # Lấy danh sách ID để làm bộ lọc cho các bảng con
            valid_ids = list(productions_dict.keys())
            format_strings = ','.join(['%s'] * len(valid_ids))
            
            for p_id in productions_dict:
                productions_dict[p_id]['genres'] = []
                productions_dict[p_id]['actors'] = []
                productions_dict[p_id]['episodes'] = []

            # 2. Fetch Thể loại (Chỉ lấy của những phim mới)
            cursor.execute(f"""
                SELECT pg.production_id, g.name 
                FROM production_genres pg 
                JOIN genres g ON pg.genre_id = g.id
                WHERE pg.production_id IN ({format_strings})
            """, tuple(valid_ids))
            for row in cursor.fetchall():
                productions_dict[row['production_id']]['genres'].append(row['name'])

            # 3. Fetch Diễn viên (Chỉ lấy của những phim mới)
            cursor.execute(f"""
                SELECT pa.production_id, a.name, pa.character_name
                FROM production_actors pa 
                JOIN actors a ON pa.actor_id = a.id
                WHERE pa.production_id IN ({format_strings})
                ORDER BY pa.display_order ASC
            """, tuple(valid_ids))
            for row in cursor.fetchall():
                actor_info = row['name']
                if row['character_name']:
                    actor_info += f" (vai {row['character_name']})"
                productions_dict[row['production_id']]['actors'].append(actor_info)

            # 4. Fetch Tập phim (Chỉ lấy của những phim mới)
            cursor.execute(f"""
                SELECT production_id, episode_number, title 
                FROM episodes 
                WHERE production_id IN ({format_strings})
                ORDER BY production_id, episode_number ASC
            """, tuple(valid_ids))
            for row in cursor.fetchall():
                ep_info = f"Tập {row['episode_number']}: {row['title']}"
                productions_dict[row['production_id']]['episodes'].append(ep_info)

            cursor.close()
            
            result_list = list(productions_dict.values())
            logger.info(f"Đã fetch thành công {len(result_list)} productions mới.")
            return result_list

        except Exception as e:
            logger.error(f"Lỗi khi truy vấn dữ liệu mới từ MySQL: {e}", exc_info=True)
            raise



    def load_recent(self, days_ago: int = 1) -> list[MovieDocument]:
        """
        Orchestrator để nạp dữ liệu phim mới. Chỉ update những phim mới được thêm vào
        """
        try:
            self.connect()
            raw_data = self.fetch_recent_productions(days_ago)
            
            if not raw_data:
                return []
                
            documents = []
            for item in raw_data:
                try:
                    doc = self.build_movie_document(item)
                    documents.append(doc)
                except Exception as doc_e:
                    logger.error(f"Lỗi khi build document cho ID={item.get('id')}: {doc_e}")
            
            logger.info(f"Hoàn tất load_recent: Tạo thành công {len(documents)} MovieDocuments mới.")
            return documents
        
        except Exception as e:
            logger.error("Quá trình load_recent thất bại.")
            raise
        finally:
            self.close()
            
            

    def close(self) -> None:
        """Đóng kết nối MySQL. An toàn khi gọi nhiều lần."""
        if self._connection and self._connection.is_connected():
            self._connection.close()
            logger.info("Đã đóng kết nối MySQL một cách an toàn.")


if __name__ == "__main__":
    import pprint
    from src.logger import setup_logging
    setup_logging()
    
    logger.info("Bắt đầu test DataLoader độc lập...")
    
    dataloader = DataLoader()
    
    try:
        # dataloader.connect()
        # data = dataloader.fetch_all_productions()
        # pprint.pprint(data[0])
        
        documents = dataloader.load_all()
        if documents:
            logger.info("--- THÔNG TIN DOCUMENT MẪU ---")
            sample = documents[0]
            pprint.pprint(sample)
            # logger.info(f"ID: {sample.production_id} | Title: {sample.title}")
            # logger.info(f"Content:\n{sample.content[:1000]}...") # In 300 ký tự đầu
            
    except Exception as e:
        logger.error(f"Test thất bại: {e}")