from typing import Optional
"""
Module reranker — sắp xếp lại kết quả search bằng cross-encoder.

Cung cấp class Reranker sử dụng cross-encoder model để đánh giá
trực tiếp cặp (query, document) cho kết quả chính xác hơn.
"""

import time
import os
from src.schemas import RetrievedChunk
from src.config import RERANKER_MODEL_NAME, HF_CACHE_DIR

# Config must be loaded before sentence-transformers reads cache paths.
from sentence_transformers import CrossEncoder
from src.logger import get_logger

logger = get_logger(__name__)


class Reranker:
    """
    Rerank kết quả search bằng cross-encoder model.

    Cross-encoder đánh giá trực tiếp cặp (query, document) nên
    chính xác hơn bi-encoder, nhưng chậm hơn → chỉ áp dụng
    cho top-K kết quả từ giai đoạn retrieval.

    Attributes:
        _model: Cross-encoder model instance.
        _model_name (str): Tên model đang sử dụng.
        _top_k (int): Số kết quả giữ lại sau rerank.

    Usage:
        reranker = Reranker()
        reranked = reranker.rerank(query, chunks, top_k=5)
    """

    def __init__(self, top_k: int = 5):
        """
        Khởi tạo Reranker và load cross-encoder model.

        Sử dụng RERANKER_MODEL_NAME từ config (mặc định BAAI/bge-reranker-v2-m3).
        Log tên model đang load và thời gian load.

        Args:
            top_k (int): Số kết quả giữ lại mặc định. Mặc định 5.

        Raises:
            Exception: Khi không thể tải model.
                Log error kèm tên model.
        """
        self._top_k = top_k
        self._model_name = RERANKER_MODEL_NAME
        
        logger.info(f"Đang tải mô hình Cross-encoder: '{self._model_name}'...")
        start_time = time.time()
        
        try:
            self._model = CrossEncoder(self._model_name)
            
            elapsed_time = round(time.time() - start_time, 2)
            logger.info(f"Tải mô hình Reranker hoàn tất trong {elapsed_time}s.")
            
        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng khi tải mô hình '{self._model_name}': {e}", exc_info=True)
            raise RuntimeError(f"Không thể khởi tạo Reranker: {e}")
        
        

    def rerank(
        self,
        query: str,
        chunks: list[RetrievedChunk],
        top_k: Optional[int] = None
    ) -> list[RetrievedChunk]:
        """
        Rerank danh sách chunks dựa trên cross-encoder score.

        Quy trình:
        1. Tạo các cặp (query, chunk.content)
        2. Cross-encoder đánh giá relevance score
        3. Sắp xếp theo score giảm dần
        4. Trả về top_k kết quả

        Log: số chunks đầu vào, top_k, score range sau rerank.

        Args:
            query (str): Câu truy vấn gốc.
            chunks (list[RetrievedChunk]): Chunks từ hybrid search.
            top_k (Optional[int]): Số chunks giữ lại. None = dùng self._top_k.

        Returns:
            list[RetrievedChunk]: Chunks đã rerank, sắp xếp theo score.

        Raises:
            Exception: Khi inference thất bại.
                Log error kèm số chunks và query.
        """
        if not chunks:
            logger.warning("Danh sách chunks rỗng, không có gì để rerank.")
            return []

        target_top_k = top_k if top_k is not None else self._top_k
        logger.info(f"Đang rerank {len(chunks)} chunks cho query: '{query}' (lấy top {target_top_k})")

        try:
            start_time = time.time()

            # Chuẩn bị dữ liệu đầu vào cho Cross-encoder
            # Tạo các cặp: [(query, doc1), (query, doc2), ...]
            sentence_pairs = [[query, chunk.content] for chunk in chunks]

            scores = self._model.predict(sentence_pairs) # chấm điểm và trả về bảng điểm

            for i, score in enumerate(scores):
                chunks[i].score = float(score)

            reranked_chunks = sorted(chunks, key=lambda x: x.score, reverse=True)

            final_results = reranked_chunks[:target_top_k]

            elapsed = round(time.time() - start_time, 2)
            
            if final_results:
                max_s = final_results[0].score
                min_s = final_results[-1].score
                logger.info(f"Rerank hoàn tất trong {elapsed}s. Score range: [{min_s:.4f} - {max_s:.4f}]")

            return final_results

        except Exception as e:
            logger.error(f"Lỗi trong quá trình rerank: {e}", exc_info=True)
            return chunks[:target_top_k]
