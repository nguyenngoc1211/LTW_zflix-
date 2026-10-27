from fastapi import BackgroundTasks, FastAPI
from schemas.video import VideoJob
from services.video_processor import process_hls_task

app = FastAPI(title="Video Processing Service")

@app.post("/process-video")
async def process_video(job: VideoJob, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        process_hls_task, 
        job.file_name, 
        job.production_id, 
        job.episode_id
    )
    return {"message": "Job accepted, processing in background.", "file": job.file_name}