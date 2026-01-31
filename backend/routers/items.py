from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from ..database import SessionLocal
from ..models.item import Item
from pydantic import BaseModel

router = APIRouter(prefix="/items", tags=["items"])

class AnnotationUpdate(BaseModel):
    annotation: dict

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/")
def list_items(db: Session = Depends(get_db)):
    items = db.query(Item).all()
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "task_type": item.task_type,
            "content": item.content,
            "label_config": json.loads(item.label_config),
            "annotation": json.loads(item.annotation) if item.annotation else None
        })
    return result

@router.get("/{item_id}")
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return {
        "id": item.id,
        "task_type": item.task_type,
        "content": item.content,
        "label_config": json.loads(item.label_config),
        "annotation": json.loads(item.annotation) if item.annotation else None
    }

@router.put("/{item_id}/annotation")
def update_annotation(item_id: int, update: AnnotationUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.annotation = json.dumps(update.annotation)
    db.commit()
    return {"status": "success"}