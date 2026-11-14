"""No-op chat history implementation for deployments without MongoDB."""

import uuid

from src.schemas import ChatMessage


class NoOpChatHistoryRepository:
    """Preserves the history repository interface without retaining any data."""

    async def create_conversation(self, user_id: str) -> str:
        return str(uuid.uuid4())

    async def add_message(self, conversation_id: str, message: ChatMessage) -> None:
        return None

    async def get_recent_messages(
        self, conversation_id: str, limit: int = 10
    ) -> list[ChatMessage]:
        return []

    async def get_user_conversations(self, user_id: str, limit: int = 10) -> list[dict]:
        return []

    async def get_conversation(self, conversation_id: str):
        return None

    async def delete_conversation(self, conversation_id: str, user_id: str) -> bool:
        return False
