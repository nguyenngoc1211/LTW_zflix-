"""
Module hybrid search — kết hợp Semantic Search + BM25 Keyword Search.

Cung cấp class HybridSearchEngine quản lý cả hai phương pháp search
và kết hợp kết quả bằng Reciprocal Rank Fusion (RRF).
"""

import os
import pickle
from typing import Optional
# from langchain.schema import Document
from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever
from src.config import BM25_INDEX_PATH
from src.database.vector_store import VectorStoreManager

from src.schemas import RetrievedChunk
from src.logger import get_logger

logger = get_logger(__name__)


class HybridSearchEngine:
    """
    Engine tìm kiếm kết hợp Semantic (dense) + BM25 (sparse).

    Quản lý cả ChromaDB vector search và BM25 keyword search,
    cung cấp phương thức hybrid_search() để kết hợp kết quả.

    Attributes:
        _vector_store (VectorStoreManager): Quản lý ChromaDB cho semantic search.
        _bm25_retriever: LangChain BM25Retriever instance (khởi tạo sau ingest).
        _is_bm25_ready (bool): BM25 retriever đã sẵn sàng chưa.

    Usage:
        engine = HybridSearchEngine(vector_store)
        engine.init_bm25(documents)
        results = engine.search("phim hành động hay", top_k=10, alpha=0.5)
    """

    def __init__(self, vector_store: VectorStoreManager):
        """
        Khởi tạo HybridSearchEngine.

        Args:
            vector_store (VectorStoreManager): Instance VectorStoreManager
                đã được initialize().
        """
        self._vector_store = vector_store
        self._bm25_retriever = None
        self._is_bm25_ready = False



    def init_bm25(self, documents: list[Document]) -> None:
        """
        Khởi tạo BM25 retriever và LƯU XUỐNG Ổ CỨNG.
        Hàm này CHỈ ĐƯỢC GỌI khi chạy file nạp dữ liệu (run_ingest.py).
        """
        if not documents:
            logger.warning("Danh sách documents rỗng. Không thể build BM25 Index.")
            return

        logger.info(f"Đang xây dựng BM25 Index cho {len(documents)} chunks...")
        
        try:
            self._bm25_retriever = BM25Retriever.from_documents(documents)
            self._is_bm25_ready = True
            
            # --- ĐOẠN THÊM MỚI: LƯU RA FILE ---
            os.makedirs(os.path.dirname(BM25_INDEX_PATH), exist_ok=True)
            with open(BM25_INDEX_PATH, "wb") as f:
                pickle.dump(self._bm25_retriever, f)
                
            logger.info(f"Đã lưu BM25 Index an toàn xuống ổ cứng tại: {BM25_INDEX_PATH}")
            
        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng khi khởi tạo và lưu BM25: {e}", exc_info=True)
            raise RuntimeError(f"Không thể khởi tạo Keyword Search: {e}")


    def load_bm25(self) -> None:
        """
        Đọc BM25 retriever từ ổ cứng lên RAM.
        Hàm này ĐƯỢC GỌI khi server khởi động (trong rag_pipeline.py).
        """
        if os.path.exists(BM25_INDEX_PATH):
            try:
                with open(BM25_INDEX_PATH, "rb") as f:
                    self._bm25_retriever = pickle.load(f)
                self._is_bm25_ready = True
                logger.info("Đã load BM25 Index từ ổ cứng lên RAM thành công. Bán cầu não phải đã sẵn sàng!")
            except Exception as e:
                logger.error(f"Lỗi khi load file BM25: {e}")
                self._is_bm25_ready = False
        else:
            logger.warning("Không tìm thấy file BM25. Tìm kiếm Keyword tạm thời bị vô hiệu hóa! Hãy chạy Ingestion Pipeline để tạo.")
            self._is_bm25_ready = False
        

    async def semantic_search(self, 
                        query: str, 
                        top_k: int = 10, 
                        filter: Optional[dict] = None
                        ) -> list[Document]:
        """
        Semantic search trong ChromaDB.

        Tạo embedding cho query, tìm chunks có cosine similarity cao nhất.
        Log query và số kết quả.

        Args:
            query (str): Câu truy vấn.
            top_k (int): Số kết quả tối đa. Mặc định 10.

        Returns:
            list[Document]: Documents sắp xếp theo relevance giảm dần.

        Raises:
            Exception: Khi search thất bại. Log error kèm query.
        """
        logger.info(f"Đang tìm kiếm Semantic cho query: '{query}' (top_k={top_k})")
        
        try:
            # Lấy LangChain Chroma wrapper từ VectorStoreManager
            # tự động dùng EmbeddingService để dịch query thành vector.
            vector_db = self._vector_store.get_langchain_chroma()
            results = await vector_db.asimilarity_search(query, k=top_k, filter = filter)
            
            logger.info(f"Semantic search trả về {len(results)} kết quả.")
            return results
            
        except Exception as e:
            logger.error(f"Lỗi khi thực hiện semantic search cho '{query}': {e}")
            raise

    async def keyword_search(self, query: str, top_k: int = 10) -> list[Document]:
        """
        BM25 keyword search.

        Log query và số kết quả.

        Args:
            query (str): Câu truy vấn.
            top_k (int): Số kết quả tối đa. Mặc định 10.

        Returns:
            list[Document]: Documents sắp xếp theo BM25 score giảm dần.

        Raises:
            RuntimeError: Khi BM25 chưa khởi tạo (chưa gọi init_bm25).
                Log error cảnh báo.
        """
        if not self._is_bm25_ready or self._bm25_retriever is None:
            logger.error("BM25 Retriever chưa được khởi tạo. Hãy gọi init_bm25() trước.")
            raise RuntimeError("BM25 chưa sẵn sàng.")

        logger.info(f"Đang tìm kiếm Keyword (BM25) cho query: '{query}' (top_k={top_k})")
        
        try:
            # BM25Retriever trong LangChain dùng phương thức invoke() để tìm kiếm
            results = await self._bm25_retriever.ainvoke(query, k=top_k)
            
            logger.info(f"Keyword search trả về {len(results)} kết quả.")
            return results
            
        except Exception as e:
            logger.error(f"Lỗi khi thực hiện keyword search cho '{query}': {e}")
            raise

    async def search(
        self,
        query: str,
        top_k: int = 10,
        filter: Optional[dict] = None,
        alpha: float = 0.5
    ) -> list[RetrievedChunk]:
        """
        Hybrid search kết hợp semantic + keyword.

        Quy trình:
        1. Chạy semantic_search() và keyword_search()
        2. Chuẩn hóa score về [0, 1]
        3. Kết hợp: final_score = alpha * semantic + (1 - alpha) * keyword
        4. Loại bỏ duplicate (production_id + chunk_index)
        5. Sắp xếp theo final_score giảm dần

        Log: query, alpha, kết quả từ mỗi phương pháp, kết quả cuối.

        Args:
            query (str): Câu truy vấn.
            top_k (int): Số kết quả tối đa. Mặc định 10.
            alpha (float): Trọng số semantic [0, 1]. Mặc định 0.5.

        Returns:
            list[RetrievedChunk]: Kết quả đã fuse.
        """
        logger.info(f"--- BẮT ĐẦU HYBRID SEARCH: '{query}' ---")
        
        try:
            fetch_k = max(20, top_k * 2) 
            
            semantic_docs = await self.semantic_search(query, top_k=fetch_k, filter = filter)
            if self._is_bm25_ready:
                keyword_docs = await self.keyword_search(query, top_k=fetch_k)
            else:
                logger.warning("BM25 chưa sẵn sàng; tiếp tục bằng semantic search.")
                keyword_docs = []

            if filter and semantic_docs:
                # Lấy danh sách ID của các chunk hợp lệ (lọt qua được ChromaDB filter)
                valid_ids = set()
                for doc in semantic_docs:
                    p_id = doc.metadata.get('production_id', 'unknown')
                    c_idx = doc.metadata.get('chunk_index', 0)
                    valid_ids.add(f"{p_id}_{c_idx}")
                
                # Loại bỏ những kết quả BM25 không nằm trong danh sách valid_ids
                filtered_keyword_docs = []
                for doc in keyword_docs:
                    p_id = doc.metadata.get('production_id', 'unknown')
                    c_idx = doc.metadata.get('chunk_index', 0)
                    if f"{p_id}_{c_idx}" in valid_ids:
                        filtered_keyword_docs.append(doc)
                        
                logger.debug(f"Đã loại bỏ {len(keyword_docs) - len(filtered_keyword_docs)} kết quả BM25 vi phạm filter.")
                keyword_docs = filtered_keyword_docs

            # 4. Trộn RRF
            final_docs = self.reciprocal_rank_fusion(
                results_list=[semantic_docs, keyword_docs],
                top_k=top_k
            )
            
            logger.info("--- KẾT THÚC HYBRID SEARCH ---")
            return final_docs
            
        except Exception as e:
            logger.error(f"Lỗi hệ thống trong quá trình Hybrid Search: {e}", exc_info=True)
            raise

    def reciprocal_rank_fusion(
        self,
        results_list: list[list[Document]],
        k: int = 60,
        top_k: int = 10
    ) -> list[RetrievedChunk]:
        """
        Kết hợp kết quả bằng Reciprocal Rank Fusion.

        RRF score = sum(1 / (k + rank_i)) cho mỗi document.
        Log số nguồn đầu vào và số kết quả đầu ra.

        Args:
            results_list (list[list[Document]]): Kết quả từ nhiều nguồn.
            k (int): Tham số smoothing. Mặc định 60.
            top_k (int): Số kết quả tối đa. Mặc định 10.

        Returns:
            list[RetrievedChunk]: Kết quả đã fuse, sắp xếp theo RRF score.
        """
        fused_scores = {}
        doc_map = {}

        logger.info(f"Đang trộn kết quả từ {len(results_list)} nguồn bằng RRF...")

        # results_list chứa 2 mảng: [ [Kết quả Semantic], [Kết quả BM25] ]
        for results in results_list:
            for rank, doc in enumerate(results):
                p_id = doc.metadata.get('production_id', 'unknown')
                c_idx = doc.metadata.get('chunk_index', 0)
                doc_id = f"{p_id}_{c_idx}"

                # Nếu chưa có trong danh sách trộn, khởi tạo điểm = 0
                if doc_id not in doc_map:
                    doc_map[doc_id] = doc
                    fused_scores[doc_id] = 0.0

                # Cộng dồn điểm RRF: 1 / (k + hạng)
                # rank bắt đầu từ 0, nên rank + 1 để hạng 1 nhận điểm cao nhất
                fused_scores[doc_id] += 1 / (k + rank + 1)

        # Sắp xếp danh sách gộp theo điểm RRF giảm dần
        reranked_results = sorted(fused_scores.items(), key=lambda x: x[1], reverse=True)

        final_results = []
        for doc_id, score in reranked_results[:top_k]:
            doc = doc_map[doc_id]
            
            chunk = RetrievedChunk(
                production_id=doc.metadata.get('production_id'),
                chunk_index=doc.metadata.get('chunk_index'),
                content=doc.page_content,
                score=round(score, 4), 
                metadata=doc.metadata  
            )
            final_results.append(chunk)

        logger.info(f"RRF hoàn tất. Trả về {len(final_results)} RetrievedChunk.")
        return final_results
