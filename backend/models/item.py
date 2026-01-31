from sqlalchemy import Column, Integer, String, Text
from ..database import Base

class Item(Base):
    __tablename__ = "items"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    task_type = Column(String)
    content = Column(Text)
    label_config = Column(Text)
    annotation = Column(Text, nullable=True)