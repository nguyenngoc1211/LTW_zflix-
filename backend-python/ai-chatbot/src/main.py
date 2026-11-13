"""
Entry point cho FastAPI application — AI Chatbot tư vấn phim MovieHub.

Khởi tạo FastAPI app, cấu hình logging, CORS, đăng ký API routers
(v1, v2), và khởi tạo RAGPipeline tại startup.

PYTHONPATH=. uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.logger import setup_logging, get_logger
from src.pipeline.rag_pipeline import RAGPipeline
from src.api.v1 import router as v1_router
from src.api.v2 import router as v2_router

setup_logging()
logger = get_logger(__name__)

# ── Khởi tạo FastAPI app ────────────────────────────────────
app = FastAPI(
    title="MovieHub AI Chatbot",
    description="Chatbot tư vấn phim sử dụng RAG (Retrieval-Augmented Generation)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS Middleware ──────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    # Dev-friendly defaults: allow any origin.
    # NOTE: Wildcard CORS cannot be combined with credentials.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API Versions ───────────────────────────────────
# NOTE: v1_router/v2_router already define their own prefixes (see src/api/v1/__init__.py).
app.include_router(v1_router)
app.include_router(v2_router)

# ── Health Check ─────────────────────────────────────────────
@app.get("/", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {"service": "MovieHub AI Chatbot", "status": "active", "version": "1.0.0"}


# ── Startup / Shutdown Events ───────────────────────────────
@app.on_event("startup")
async def startup_event():
    """
    Khởi tạo RAGPipeline (composition root) khi server bắt đầu.

    Wire tất cả dependencies: MongoDB, ChromaDB, Embedding, Reranker, LLM.
    Log trạng thái khởi tạo từng thành phần.
    """
    logger.info("[App.Startup] Initializing RAGPipeline dependencies...")
    try:
        pipeline = RAGPipeline()
        await pipeline.initialize()
        logger.info("[App.Startup] RAGPipeline initialized successfully. System is ready.")
    except Exception as e:
        logger.critical(f"[App.Startup] System initialization failed: {e}", exc_info=True)
        raise RuntimeError("Failed to start AI subsystem.")


@app.on_event("shutdown")
async def shutdown_event():
    """
    Gọi RAGPipeline.shutdown() để đóng connections và cleanup.
    """
    logger.info("[App.Shutdown] Initiating system shutdown sequence...")
    try:
        pipeline = RAGPipeline.get_instance()
        await pipeline.shutdown()
        logger.info("[App.Shutdown] System resources released successfully.")
    except Exception as e:
        logger.error(f"[App.Shutdown] Error during cleanup: {e}", exc_info=True)
