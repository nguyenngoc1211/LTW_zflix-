"""
Chạy 1 lần và lưu dữ liệu vector vào Chroma cũng như lưu BM25 vào ổ cứng
Có thể run lại mỗi khi cập nhật csdl mysql
"""


import sys
import os

from src.ingestion.indexer import DataIndexer
from src.logger import get_logger, setup_logging

setup_logging()
logger = get_logger("Ingest_Process")

def main():
    try:
        # 1. Khởi tạo Indexer thông qua Factory Method 'build_default'
        # Nó sẽ tự động nạp MySQL, Chunker, ChromaDB và BM25 cho bạn
        indexer = DataIndexer.build_default()
        
        # 2. Chạy Pipeline. 
        # Lần đầu tiên nên để force_reload=True để đảm bảo kho lưu trữ sạch sẽ
        results = indexer.run(force_reload="--force" in sys.argv)
        
        # 3. Kiểm tra kết quả
        if results["status"] == "success":
            logger.info("=" * 50)
            logger.info(f"THÀNH CÔNG: {results['message']}")
            logger.info(f"⏱Thời gian thực hiện: {results['elapsed_time']} giây")
            logger.info(f"Tổng số phim: {results['total_documents']}")
            logger.info(f"Tổng số chunks: {results['total_chunks']}")
            logger.info("=" * 50)
        else:
            logger.error(f"THẤT BẠI: {results['message']}")
            raise SystemExit(1)


    except Exception as e:
        logger.critical(f"Lỗi không xác định khi chạy Ingest: {e}", exc_info=True)
        raise SystemExit(1) from e

if __name__ == "__main__":
    main()
