import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()
URL = os.getenv("DATABASE_URL", "sqlite:///./spendwise.db")
if URL.startswith("postgres://"):  # Render/Heroku style URLs
    URL = URL.replace("postgres://", "postgresql://", 1)
# pool_pre_ping reconnects if a hosted DB (e.g. Neon) went to sleep and dropped the connection
engine = create_engine(URL, pool_pre_ping=True, connect_args={"check_same_thread": False} if URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()