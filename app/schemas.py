from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from enum import Enum

class DeviceType(str, Enum):
    switch = "switch"
    access_point = "access_point"
    ups = "ups"

class Status(str, Enum):
    open = "open"
    on_hold = "on_hold"
    closed = "closed"

class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

class TicketBase(BaseModel):
    external_ticket_number: Optional[str] = Field(None, min_length=1, max_length=8)
    device_type: str
    school_name: str = Field(..., min_length=1, max_length=255)
    tea_code: int = Field(..., ge=0, le=999)
    date: str = Field(..., min_length=1)
    note: Optional[str] = Field(None, max_length=1000)
    priority: Optional[str] = None

class TicketCreate(TicketBase):
    external_ticket_number: str = Field(..., min_length=1, max_length=8)

class TicketUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    note: Optional[str] = Field(None, max_length=1000)
    status: Optional[Status] = None

class Ticket(TicketBase):
    ticket_number: int
    status: Status

    class Config:
        from_attributes = True
