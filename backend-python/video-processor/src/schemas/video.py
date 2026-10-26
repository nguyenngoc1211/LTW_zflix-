from pydantic import BaseModel

class VideoJob(BaseModel):
    file_name: str
    production_id: int
    episode_id: int