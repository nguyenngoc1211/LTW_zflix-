"""
API v1 — Ingestion endpoints cho nạp dữ liệu phim.

Sử dụng RAGPipeline.get_instance() để truy cập DataIndexer.
"""

from fastapi import APIRouter, HTTPException
from src.schemas import IngestRequest
from src.logger import get_logger
from src.pipeline.rag_pipeline import RAGPipeline
from src.ingestion.indexer import DataIndexer

logger = get_logger(__name__)

router = APIRouter(prefix="/ingest", tags=["v1 - Ingestion"])


@router.post("")
async def ingest_data(request: IngestRequest):
    """
    Kích hoạt quá trình ingest dữ liệu phim từ MySQL vào ChromaDB.

    Gọi RAGPipeline.data_indexer.run() để thực thi pipeline.
    Log: bắt đầu ingest, force_reload flag, kết quả.

    Args:
        request (IngestRequest): Body chứa force_reload flag.

    Returns:
        dict: Thống kê (total_documents, total_chunks, elapsed_time, status).

    Raises:
        HTTPException 500: Khi ingest thất bại. Log error + traceback.
    """
    logger.info(f"Ingest API] Bắt đầu quá trình nạp dữ liệu (force_reload={request.force_reload})...")
    
    try:
        indexer = DataIndexer.build_default()
        
        results = indexer.run(force_reload=request.force_reload)
        
        if results.get("status") == "success":
            logger.info("[Ingest API] Nạp dữ liệu thành công!")
            return results
        else:
            raise Exception(results.get("message", "Lỗi không xác định từ Indexer"))
            
    except Exception as e:
        logger.error(f"[Ingest API] Quá trình Ingest thất bại: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Hệ thống gặp lỗi trong quá trình đồng bộ dữ liệu: {e}"
        )


@router.get("/stats")
async def get_stats():
    """
    Lấy thống kê ChromaDB collection.

    Returns:
        dict: chroma_stats, status.

    Raises:
        HTTPException 500: Khi không thể lấy thống kê.
    """
    logger.info("[Ingest API] Yêu cầu kiểm tra thống kê kho dữ liệu Vector.")
    
    try:
        pipeline = RAGPipeline.get_instance()
        vector_store = pipeline.chat_service._retriever._search_engine._vector_store
        
        if vector_store and vector_store._collection:
            total_chunks = vector_store._collection.count()
            collection_name = vector_store._collection.name
        else:
            total_chunks = 0
            collection_name = "Chưa kết nối hoặc Collection rỗng"
            
        logger.info(f"[Ingest API] Hiện tại đang có {total_chunks} chunks trong não AI.")
        
        return {
            "status": "success",
            "chroma_stats": {
                "total_chunks_indexed": total_chunks,
                "collection_name": collection_name
            }
        }
        
    except Exception as e:
        logger.error(f"[Ingest API] Lỗi khi lấy thống kê ChromaDB: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail="Không thể lấy thống kê dữ liệu lúc này. Vui lòng kiểm tra lại log."
        )
