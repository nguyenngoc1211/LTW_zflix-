"""
API v1 — History endpoints cho quản lý lịch sử hội thoại.

Sử dụng RAGPipeline.get_instance() để truy cập ChatHistoryRepository.
"""

from fastapi import APIRouter, HTTPException
from src.logger import get_logger
from src.pipeline.rag_pipeline import RAGPipeline
from src.schemas import ConversationHistory

logger = get_logger(__name__)

router = APIRouter(prefix="/history", tags=["v1 - History"])


@router.get("/{user_id}", response_model=list[ConversationHistory], response_model_exclude={"messages"})
async def get_user_history(user_id: str, limit: int = 10):
    """
    Lấy danh sách cuộc hội thoại của người dùng.

    Log: user_id, limit, số conversations trả về.

    Args:
        user_id (str): ID người dùng (path parameter).
        limit (int): Tối đa conversations (query param). Mặc định 10.

    Returns:
        list[dict]: conversation_id, created_at, updated_at,
            message_count, last_message.

    Raises:
        HTTPException 500: Khi truy vấn thất bại. Log error.
    """
    logger.info(f"[History API] Lấy danh sách chat cho User: {user_id} (limit={limit})")
    try:
        pipeline = RAGPipeline.get_instance()
        repo = pipeline.chat_service._history_repo 
        
        # Gọi hàm lấy danh sách từ DB
        conversations = await repo.get_user_conversations(user_id=user_id, limit=limit)
        
        logger.info(f"[History API] Trả về {len(conversations)} cuộc hội thoại cho {user_id}.")
        return conversations
        
    except Exception as e:
        logger.error(f"[History API] Lỗi khi lấy lịch sử của {user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tải lịch sử chat.")


@router.get("/{user_id}/{conversation_id}", response_model=ConversationHistory)
async def get_conversation_detail(user_id: str, conversation_id: str):
    """
    Lấy chi tiết cuộc hội thoại.

    Log: user_id, conversation_id, số messages.

    Args:
        user_id (str): ID người dùng (xác thực quyền).
        conversation_id (str): ID cuộc hội thoại.

    Returns:
        ConversationHistory: Toàn bộ thông tin cuộc hội thoại.

    Raises:
        HTTPException 404: Conversation không tồn tại.
        HTTPException 403: Không có quyền. Log warning.
    """
    logger.info(f"[History API] Tải chi tiết đoạn chat {conversation_id} của {user_id}")
    try:
        pipeline = RAGPipeline.get_instance()
        repo = pipeline.chat_service._history_repo
        
        conversation = await repo.get_conversation(conversation_id)
        
        # Không tìm thấy
        if not conversation:
            logger.warning(f"[History API] Không tìm thấy đoạn chat {conversation_id}")
            raise HTTPException(status_code=404, detail="Không tìm thấy cuộc hội thoại này.")
            
        # Kiểm tra chính chủ (Bảo mật cực quan trọng)
        # Giả định object conversation có thuộc tính user_id hoặc metadata chứa user_id
        owner_id = getattr(conversation, 'user_id', None)
        if owner_id and owner_id != user_id:
            logger.warning(f"[History API] Xâm phạm quyền riêng tư! User {user_id} cố đọc chat của {owner_id}")
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem cuộc hội thoại này.")
            
        return conversation
        
    except HTTPException:
        raise # Quăng thẳng lỗi HTTP lên cho Frontend
    except Exception as e:
        logger.error(f"[History API] Lỗi tải chi tiết đoạn chat {conversation_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Lỗi hệ thống khi tải chi tiết chat.")


@router.delete("/{user_id}/{conversation_id}")
async def delete_conversation(user_id: str, conversation_id: str):
    """
    Xóa cuộc hội thoại.

    Log: user_id, conversation_id, kết quả.

    Args:
        user_id (str): ID người dùng.
        conversation_id (str): ID cuộc hội thoại.

    Returns:
        dict: {"status": "success", "message": "..."}

    Raises:
        HTTPException 404: Không tìm thấy hoặc không có quyền.
    """
    logger.info(f"[History API] User {user_id} yêu cầu xóa đoạn chat {conversation_id}")
    try:
        pipeline = RAGPipeline.get_instance()
        repo = pipeline.chat_service._history_repo
        
        # 1. Kiểm tra xem đoạn chat có tồn tại và đúng chính chủ không trước khi xóa
        conversation = await repo.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Đoạn chat không tồn tại hoặc đã bị xóa.")
            
        owner_id = getattr(conversation, 'user_id', None)
        if owner_id and owner_id != user_id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xóa cuộc hội thoại này.")
            
        # 2. Tiến hành xóa
        success = await repo.delete_conversation(
            conversation_id=conversation_id, 
            user_id=user_id
        )
        
        if success:
            logger.info(f"[History API] Đã xóa thành công đoạn chat {conversation_id}")
            return {"status": "success", "message": "Đã xóa cuộc hội thoại thành công."}
        else:
            raise Exception("Hàm delete_conversation trả về False")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[History API] Lỗi khi xóa đoạn chat {conversation_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Không thể xóa cuộc hội thoại lúc này.")
