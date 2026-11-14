"""
API v1 — Chat endpoint cho chatbot tư vấn phim.

Sử dụng RAGPipeline.get_instance() để truy cập ChatService.
"""

import asyncio

from fastapi import APIRouter, HTTPException
from src.schemas import ChatRequest, ChatResponse
from src.pipeline.rag_pipeline import RAGPipeline
from src.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/chat", tags=["v1 - Chat"])


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Endpoint chính để chat với chatbot tư vấn phim.

    Nhận tin nhắn, xử lý qua RAG pipeline, trả về câu trả lời.
    Log: user_id, conversation_id, query (truncated), thời gian.

    Args:
        request (ChatRequest): user_id, message, conversation_id (optional).

    Returns:
        ChatResponse: answer + sources.

    Raises:
        HTTPException 500: Khi pipeline thất bại. Log error + traceback.
    """
    short_query = request.message[:50] + "..." if len(request.message) > 50 else request.message
    
    logger.info(f"📥 [API Chat] Nhận Request - User: {request.user_id} | Conv_ID: {request.conversation_id} | Query: '{short_query}'")
    
    try:
        pipeline = RAGPipeline.get_instance()
        
        response = await pipeline.chat_service.process(request)
        
        logger.info(f"[API Chat] Trả Response - User: {request.user_id} | Xử lý thành công!")
        return response
        
    except (asyncio.TimeoutError, TimeoutError) as e:
        logger.warning(
            f"[API Chat] Timeout cho User {request.user_id}: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=504,
            detail="Hệ thống đang bận hoặc LLM phản hồi quá chậm. Vui lòng thử lại sau!",
        )
    except RuntimeError as e:
        # Common case: pipeline not initialized yet
        logger.error(f"[API Chat] Pipeline chưa sẵn sàng: {e}", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Hệ thống AI đang khởi động. Vui lòng thử lại sau vài giây.",
        )
    except Exception as e:
        # Ghi log đỏ chót ra terminal kèm Traceback để anh em Dev đi dò bug
        logger.error(f"[API Chat] Lỗi xử lý cho User {request.user_id}: {e}", exc_info=True)
        
        # Ném lỗi 500 về cho Frontend để nó báo "Hệ thống bận" cho khách
        raise HTTPException(
            status_code=500, 
            detail="Hệ thống đang gặp sự cố khi xử lý câu hỏi của bạn. Vui lòng thử lại sau!"
        )
