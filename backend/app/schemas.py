from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field

PAYMENT = Literal["UPI", "Card", "Cash", "NetBanking", "Other"]

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class TxIn(BaseModel):
    type: Literal["income", "expense"]
    amount: float = Field(gt=0, lt=1e9)
    date: date
    category: str = Field(min_length=1, max_length=50)
    merchant: str = Field(default="", max_length=100)
    note: str = Field(default="", max_length=255)
    payment_method: PAYMENT = "UPI"

class TxOut(TxIn):
    id: int
    model_config = {"from_attributes": True}

class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)

class BudgetIn(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    limit: float = Field(gt=0, lt=1e9)

class NLIn(BaseModel):
    text: str = Field(min_length=3, max_length=300)

class ChatIn(BaseModel):
    question: str = Field(min_length=2, max_length=500)

class ParsedEntry(BaseModel):
    """Schema every AI-produced entry must satisfy before it is shown or saved."""
    amount: float = Field(gt=0, lt=1e9)
    date: date
    category: str
    merchant: str = Field(default="", max_length=100)
    payment_method: PAYMENT = "Other"
    type: Literal["income", "expense"] = "expense"
