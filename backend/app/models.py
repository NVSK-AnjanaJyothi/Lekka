from datetime import date
from sqlalchemy import String, Integer, Float, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

DEFAULT_CATEGORIES = ["Food", "Transport", "Rent", "Shopping", "Bills", "Health", "Entertainment", "Education", "Other"]

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))

class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[str] = mapped_column(String(10))  # income | expense
    amount: Mapped[float] = mapped_column(Float)
    date: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    merchant: Mapped[str] = mapped_column(String(100), default="")
    note: Mapped[str] = mapped_column(String(255), default="")
    payment_method: Mapped[str] = mapped_column(String(20), default="UPI")

class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "category", "month"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(50))
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    limit: Mapped[float] = mapped_column(Float)

class FestivalMonth(Base):
    __tablename__ = "festival_months"
    __table_args__ = (UniqueConstraint("user_id", "month"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    month: Mapped[str] = mapped_column(String(7))  # YYYY-MM
    label: Mapped[str] = mapped_column(String(50))  # e.g. Diwali, Wedding season

class SavingsGoal(Base):
    __tablename__ = "savings_goals"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    target_amount: Mapped[float] = mapped_column(Float)
    saved_amount: Mapped[float] = mapped_column(Float, default=0.0)
    target_date: Mapped[date] = mapped_column(Date)
