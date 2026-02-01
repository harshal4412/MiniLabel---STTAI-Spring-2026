from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session
import json
import os

from .database import engine, Base, SessionLocal
from .models.item import Item
from .routers import items

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MiniLabel v1",
    description="Vercel Deployment Version",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/seed", tags=["System"])
def seed_data(db: Session = Depends(get_db)):
    db.query(Item).delete()
    
    samples = [
        Item(
            task_type="text_classification",
            content="The user interface of this application is surprisingly intuitive and snappy.",
            label_config=json.dumps(["Delight", "Neutral", "Frustration"])
        ),
        Item(
            task_type="ner",
            content="Elon Musk visited the Tesla Giga Factory in Berlin last Thursday.",
            label_config=json.dumps(["PERSON", "ORG", "GPE", "DATE"])
        ),
        Item(
            task_type="bbox",
            content="https://images.unsplash.com/photo-1583511655857-d19b40a7a54e",
            label_config=json.dumps(["Frenchie", "Accessory", "Furniture"])
        ),
        Item(
            task_type="text_classification",
            content="I encountered a bug while trying to export my results to JSON format.",
            label_config=json.dumps(["Bug Report", "Feature Request", "Spam"])
        ),
        Item(
            task_type="ner",
            content="Microsoft Corp. announced a partnership with OpenAI in San Francisco.",
            label_config=json.dumps(["ORG", "GPE"])
        ),
        Item(
            task_type="bbox",
            content="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba",
            label_config=json.dumps(["Cat", "Eye", "Ear"])
        )
    ]
    
    db.add_all(samples)
    db.commit()
    return {
        "status": "success", 
        "message": f"Database seeded with {len(samples)} diverse tasks."
    }

@app.get("/health", tags=["System"])
def health_check():
    return {"status": "online", "database": "connected"}

@app.get("/")
async def serve_index():
    return FileResponse("frontend/index.html")

@app.get("/{path_name:path}")
async def catch_all(path_name: str):
    if path_name.startswith(("items", "seed", "health", "docs", "openapi.json")):
        return RedirectResponse(url=f"/{path_name}")
        
    file_path = os.path.join("frontend", path_name)
    if os.path.exists(file_path):
        return FileResponse(file_path)
        
    return FileResponse("frontend/index.html")