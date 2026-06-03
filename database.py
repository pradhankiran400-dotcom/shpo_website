from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

import os
from data.settings_manager import load_env_file

load_env_file()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./shop.db")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
     connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False,
                             autoflush=False, 
                             bind=engine)

Base = declarative_base()

