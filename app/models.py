from sqlalchemy import CheckConstraint, Column, Integer, String, Enum
from enum import Enum as PyEnum
from database import Base

class Status(PyEnum):
    open = "open"
    on_hold = "on_hold"
    closed = "closed"

class Priority(PyEnum):
    low = "low"
    medium = "medium"
    high = "high"

class DeviceType(PyEnum):
    switch = "switch"
    access_point = "access_point"
    ups = "ups"

class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = (
        CheckConstraint("tea_code >= 0 AND tea_code <= 999", name="ck_tickets_tea_code_3_digits"),
        CheckConstraint("char_length(external_ticket_number) <= 8", name="ck_tickets_external_ticket_number_len"),
    )

    ticket_number = Column(Integer, primary_key=True, index=True)
    external_ticket_number = Column(String(8), nullable=True)
    school_name = Column(String, nullable=False)
    tea_code = Column(Integer, nullable=False)
    date = Column(String, nullable=False)
    note = Column(String)
    device_type = Column(Enum(DeviceType), nullable=False)
    status = Column(Enum(Status), default=Status.open, nullable=False)
    priority = Column(Enum(Priority), nullable=True)
