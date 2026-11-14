"""
Module history repository — CRUD operations cho lịch sử chat trên MongoDB.

Cung cấp class ChatHistoryRepository tách riêng data access logic
khỏi API router.
"""

import uuid
from datetime import datetime
from typing import Optional
from src.schemas import ChatMessage, ConversationHistory
from src.database.mongodb import MongoDBClient
from src.logger import get_logger

logger = get_logger(__name__)


class ChatHistoryRepository:
    """
    Repository pattern cho CRUD lịch sử hội thoại trên MongoDB.

    Tách biệt data access logic khỏi business logic và API layer.
    Sử dụng MongoDBClient để lấy collection.

    Attributes:
        _mongo_client (MongoDBClient): MongoDB client instance.
        _collection: MongoDB collection cho chat history.

    Usage:
        repo = ChatHistoryRepository(mongo_client)
        conv_id = repo.create_conversation("user1")
        repo.add_message(conv_id, message)
        history = repo.get_conversation(conv_id)
    """

    def __init__(self, mongo_client: MongoDBClient):
        """
        Khởi tạo ChatHistoryRepository.

        Args:
            mongo_client (MongoDBClient): Instance MongoDBClient đã connect().
        """
        self._mongo_client = mongo_client
        
        try:
            self._collection = self._mongo_client.get_history_collection()
            logger.info("Thủ kho đã nhận chìa khóa và sẵn sàng làm việc với 'chat_history'!")
            
        except RuntimeError as e:
            logger.error(f"LỖI NGHIÊM TRỌNG: {e}")
            raise e



    async def create_conversation(self, user_id: str) -> str:
        """
        Tạo cuộc hội thoại mới.

        Sinh conversation_id (UUID v4), tạo document trong MongoDB.
        Log: user_id, conversation_id mới.

        Args:
            user_id (str): ID người dùng.

        Returns:
            str: conversation_id (UUID v4).

        Raises:
            Exception: Khi insert thất bại. Log error kèm user_id.
        """
        conversation_id = str(uuid.uuid4())
        now = datetime.utcnow()

        # Tạo object theo chuẩn Schema đã định nghĩa
        new_conversation = ConversationHistory(
            conversation_id=conversation_id,
            user_id=user_id,
            messages=[],
            created_at=now,
            updated_at=now
        )

        try:
            await self._collection.insert_one(new_conversation.model_dump()) #Dùng model_dump() để biến Object thành dạng Mongo hiểu được
            logger.info(f"Đã tạo cuộc hội thoại mới: {conversation_id} cho User: {user_id}")
            return conversation_id
        
        except Exception as e:
            logger.error(f"Lỗi khi tạo conversation cho {user_id}: {e}")
            raise e
        
        

    async def add_message(self, conversation_id: str, message: ChatMessage) -> None:
        """
        Thêm tin nhắn vào cuộc hội thoại.

        Sử dụng $push + cập nhật updated_at.
        Log debug: conversation_id, role, content length.

        Args:
            conversation_id (str): ID cuộc hội thoại.
            message (ChatMessage): Tin nhắn cần thêm.

        Raises:
            ValueError: Khi conversation_id không tồn tại.
                Log error kèm conversation_id.
        """
        now = datetime.utcnow()
        
        message_dict = message.model_dump() # chuyển thành định dạng của mongodb
        # Đảm bảo timestamp được cập nhật đúng lúc lưu
        message_dict["timestamp"] = now

        try:
            # Dùng $push để thêm vào mảng messages, $set để cập nhật thời gian updated_at
            result = await self._collection.update_one(
                {"conversation_id": conversation_id},
                {
                    "$push": {"messages": message_dict},
                    "$set": {"updated_at": now}
                }
            )

            if result.matched_count == 0:
                logger.error(f"Không tìm thấy conversation_id: {conversation_id} để thêm tin nhắn!")
                raise ValueError(f"Conversation {conversation_id} không tồn tại.")
            
            logger.debug(f"Đã thêm tin nhắn {message.role} vào {conversation_id}")

        except Exception as e:
            logger.error(f"Lỗi khi thêm tin nhắn vào {conversation_id}: {e}")
            raise e
        
        

    async def get_conversation(self, conversation_id: str) -> Optional[ConversationHistory]:
        """
        Lấy chi tiết cuộc hội thoại.

        Log debug: conversation_id, found/not found, số messages.

        Args:
            conversation_id (str): ID cuộc hội thoại.

        Returns:
            Optional[ConversationHistory]: ConversationHistory hoặc None.
        """
        try:
            doc = await self._collection.find_one({"conversation_id": conversation_id})
            
            if doc:
                # Chuyển đổi từ Dictionary của Mongo ngược lại thành Pydantic Model để các tầng khác dễ xài
                return ConversationHistory(**doc)
            
            logger.warning(f"Không tìm thấy lịch sử cho ID: {conversation_id}")
            return None
            
        except Exception as e:
            logger.error(f"Lỗi khi lấy conversation {conversation_id}: {e}")
            return None
        
        

    async def get_recent_messages(
        self,
        conversation_id: str,
        limit: int = 10
    ) -> list[ChatMessage]:
        """
        Lấy N tin nhắn gần nhất.

        Sử dụng MongoDB $slice để tối ưu.
        Log debug: conversation_id, limit, số messages thực tế.

        Args:
            conversation_id (str): ID cuộc hội thoại.
            limit (int): Số tin nhắn gần nhất. Mặc định 10.

        Returns:
            list[ChatMessage]: Tin nhắn (cũ → mới). Rỗng nếu không tìm thấy.
        """
        try:
            pipeline = [
                {"$match": {"conversation_id": conversation_id}},
                {"$project": {"messages": {"$slice": ["$messages", -limit]}, "_id": 0}}
            ]
            
            # Aggregate là lệnh mạnh nhất của Mongo để xử lý dữ liệu phức tạp
            cursor = self._collection.aggregate(pipeline)
            docs = await cursor.to_list(length=1)
            
            if not docs or not docs[0].get("messages"):
                return []
                
            # Trả về list các Pydantic Object
            return [ChatMessage(**msg) for msg in docs[0]["messages"]]
            
        except Exception as e:
            logger.error(f"Lỗi khi lấy tin nhắn gần đây của {conversation_id}: {e}")
            return []
        
        

    async def get_user_conversations(self, user_id: str, limit: int = 10) -> list[dict]:
        """
        Lấy danh sách cuộc hội thoại của user.

        Sắp xếp theo updated_at giảm dần.
        Log: user_id, số conversations.

        Args:
            user_id (str): ID người dùng.
            limit (int): Tối đa conversations. Mặc định 10.

        Returns:
            list[dict]: conversation_id, created_at, updated_at,
                message_count, last_message (truncated 100 chars).
        """
        try:
            # Lọc theo user_id
            cursor = self._collection.find(
                {"user_id": user_id},
                # Projection: Lấy những trường cần thiết, bỏ trường 'messages' cho nhẹ
                {"conversation_id": 1, "created_at": 1, "updated_at": 1, "_id": 0}
            ).sort("updated_at", -1).limit(limit) # Xếp thời gian giảm dần (mới nhất lên đầu)
            
            # Trải phẳng cursor thành list
            conversations = await cursor.to_list(length=limit)
            return conversations
            
        except Exception as e:
            logger.error(f"Lỗi khi lấy danh sách conversation của {user_id}: {e}")
            return []
        
        

    async def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        """
        Xóa cuộc hội thoại (kiểm tra quyền sở hữu).

        Log: conversation_id, user_id, kết quả.
        Log warning nếu user_id không khớp.

        Args:
            conversation_id (str): ID cuộc hội thoại.
            user_id (str): ID người dùng (xác thực quyền).

        Returns:
            bool: True nếu xóa thành công.
        """
        try:
            # 1. Lệnh xóa kết hợp 2 điều kiện: Đúng ID hội thoại VÀ Đúng ID chủ sở hữu
            result = await self._collection.delete_one({
                "conversation_id": conversation_id,
                "user_id": user_id
            })

            # 2. Kiểm tra kết quả
            if result.deleted_count > 0:
                logger.info(f"Đã xóa thành công conversation: {conversation_id} của User: {user_id}")
                return True
            else:
                # Nếu không xóa được, có thể do ID sai hoặc User này không phải chủ sở hữu
                logger.warning(
                    f"Yêu cầu xóa thất bại: Conversation {conversation_id} không tồn tại "
                    f"hoặc không thuộc về User {user_id}."
                )
                return False

        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng khi xóa conversation {conversation_id}: {e}")
            return False



if __name__ == "__main__":
    import asyncio
    from src.database.mongodb import MongoDBClient
    from src.schemas import ChatMessage, MessageRole

    async def test_repository_flow():
        print("BẮT ĐẦU TES REPOSITORY...")
        
        # 1. Khởi tạo kết nối DB (Lấy chìa khóa)
        db_client = MongoDBClient.get_instance()
        await db_client.connect()
        
        try:
            repo = ChatHistoryRepository(db_client)
            user_test = "user_vip_001"
            
            print("\n[1] Đang tạo hội thoại mới...")
            conv_id = await repo.create_conversation(user_test)
            print(f"Đã tạo thành công! Conversation ID: {conv_id}")
            
            print("\n[2] Đang thêm 2 tin nhắn vào hội thoại...")
            msg_user = ChatMessage(role=MessageRole.USER, content="Review cho tôi phim Inception đi!")
            msg_ai = ChatMessage(role=MessageRole.ASSISTANT, content="Inception là siêu phẩm hack não của Christopher Nolan. Điểm 9.5/10!")
            
            await repo.add_message(conv_id, msg_user)
            await repo.add_message(conv_id, msg_ai)
            print("Đã đút 2 tin nhắn vào Database thành công (Dùng $push)!")
            
            print("\n[3] Đang lấy chi tiết hồ sơ ra kiểm tra...")
            history = await repo.get_conversation(conv_id)
            if history:
                print(f"Lấy thành công! Hội thoại này đang có {len(history.messages)} tin nhắn:")
                for m in history.messages:
                    print(f"{m.role.upper()}: {m.content}")
            
            print("\n[4] Đang lấy danh sách các hội thoại của User...")
            user_convs = await repo.get_user_conversations(user_test)
            print(f"User '{user_test}' đang có tổng cộng {len(user_convs)} cuộc hội thoại.")
            
            print("\nBÀI TEST HOÀN HẢO! Hãy mở web MongoDB Atlas lên để xem chiến tích nhé!")
            
            
        except Exception as e:
            print(f"\nTOANG RỒI: {e}")
            
        finally:
            await db_client.close()
            print("\nĐã ngắt kết nối an toàn.")

    # Chạy kịch bản
    asyncio.run(test_repository_flow())