from typing import Optional
"""
Module kết nối và quản lý MongoDB cho lịch sử chat.

Cung cấp class MongoDBClient (singleton) để tạo kết nối,
lấy database và collection, và quản lý vòng đời kết nối.
"""

import os
from motor.motor_asyncio import AsyncIOMotorClient
from src.config import MONGODB_COLLECTION_HISTORY, MONGODB_DB_NAME, MONGODB_URI
from src.logger import get_logger

logger = get_logger(__name__)


class MongoDBClient:
    """
    Singleton client quản lý kết nối MongoDB.

    Đảm bảo chỉ có một kết nối MongoDB duy nhất trong toàn bộ
    application. Cung cấp access đến database và collection
    cho chat history.

    Attributes:
        _instance (Optional[MongoDBClient]): Singleton instance.
        _client: pymongo.MongoClient instance.
        _database: pymongo.database.Database instance.
        _history_collection: pymongo.collection.Collection cho chat history.

    Usage:
        client = MongoDBClient.get_instance()
        collection = client.get_history_collection()
    """

    _instance = None

    def __new__(cls):
        """
        Singleton pattern — đảm bảo chỉ tạo một instance duy nhất.

        Returns:
            MongoDBClient: Instance duy nhất.
        """
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
            cls._instance._client = None
            cls._instance._database = None
        return cls._instance

    @classmethod
    def get_instance(cls) -> "MongoDBClient":
        """
        Lấy singleton instance của MongoDBClient.

        Returns:
            MongoDBClient: Instance duy nhất đã kết nối.
        """
        if cls._instance is None:
            cls()
            
        assert cls._instance is not None
        return cls._instance



    async def connect(self) -> None:
        """
        Thiết lập kết nối đến MongoDB server.

        Sử dụng MONGODB_URI từ config. Tạo index trên các trường:
        user_id, conversation_id, updated_at (nếu chưa tồn tại).
        Log thông tin kết nối thành công hoặc lỗi.

        Raises:
            pymongo.errors.ConnectionFailure: Khi không thể kết nối.
                Log error kèm URI (đã mask password) ra console.
        """
        if self._client is not None:
            return

        uri = MONGODB_URI
        db_name = MONGODB_DB_NAME
        
        # Mask password khi log (chỉ lấy phần đầu của URI)
        safe_uri = uri.split('@')[-1] if '@' in uri else uri
        logger.info(f"Đang kết nối MongoDB (Async) tại: {safe_uri}")

        try:
            self._client = AsyncIOMotorClient(uri)
            # Lệnh ping để test kết nối thực sự
            await self._client.admin.command('ping')
            
            self._database = self._client[db_name]
            
            logger.info("Kết nối MongoDB thành công!")

            await self._create_indexes()

        except Exception as e:
            logger.critical(f"Lỗi kết nối MongoDB: {e}", exc_info=True)
            self._client = None
            raise RuntimeError(f"Connection Failure: {e}")



    async def _create_indexes(self) -> None:
        """
        Hàm bổ sung: Tạo index trên các trường user_id, conversation_id, updated_at
        giúp tăng tốc độ truy vấn theo thời gian thực.
        """
        try:
            collection = self.get_history_collection()
            logger.info("Đang kiểm tra và tạo MongoDB Indexes...")
            
            # Tạo index (1 là tăng dần, -1 là giảm dần)
            import pymongo
            
            # Index cho việc tìm tất cả lịch sử của 1 user, xếp theo thời gian mới nhất
            await collection.create_index(
                [("user_id", pymongo.ASCENDING), ("updated_at", pymongo.DESCENDING)],
                background=True
            )
            
            # Index cho việc tìm đích danh 1 cuộc hội thoại
            await collection.create_index(
                [("conversation_id", pymongo.ASCENDING)],
                unique=True, 
                background=True
            )
            logger.info("Hoàn tất tạo MongoDB Indexes.")
        except Exception as e:
            logger.warning(f"Không thể tạo index tự động (có thể đã tồn tại): {e}")
            
            
            
    def get_database(self):
        """
        Lấy MongoDB database instance.

        Sử dụng MONGODB_DB_NAME từ config.

        Returns:
            pymongo.database.Database: MongoDB database object.

        Raises:
            RuntimeError: Khi chưa gọi connect().
        """
        if self._database is None:
            raise RuntimeError("Chưa gọi connect() trước khi lấy database.")
        return self._database
    
    

    def get_history_collection(self):
        """
        Lấy MongoDB collection cho chat history.

        Sử dụng MONGODB_COLLECTION_HISTORY từ config.

        Returns:
            pymongo.collection.Collection: Collection cho chat history.

        Raises:
            RuntimeError: Khi chưa gọi connect().
        """
        collection_name = MONGODB_COLLECTION_HISTORY
        return self.get_database()[collection_name]



    async def close(self) -> None:
        """
        Đóng kết nối MongoDB và giải phóng tài nguyên.

        Log thông tin đóng kết nối. An toàn khi gọi nhiều lần.
        """
        if self._client is not None:
            self._client.close()
            self._client = None
            self._database = None
            logger.info("Đã đóng kết nối MongoDB.")
            
            
if __name__ == "__main__":
    import asyncio
    async def test_connection():
        db_client = MongoDBClient.get_instance()
        
        try:
            print("Bắt đầu khởi tạo kết nối...")
            await db_client.connect()
            print("Đã vượt qua được Ping và tạo Index")
            
            db = db_client.get_database()
            collections = await db.list_collection_names()
            print(f"Các collection đang có trong Database: {collections}")
            
            print("SUCCESS")
        
        except Exception as e:
            print(f"FAIL: {e}")
            
        finally:
            await db_client.close()
            print("Disconnect Database")
        
    asyncio.run(test_connection())