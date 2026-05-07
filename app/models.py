from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, Enum
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

class UpsInstallStatus(PyEnum):
    intake = "intake"
    servicing = "servicing"
    scheduled = "scheduled"
    fulfilled = "fulfilled"

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
    mdf_idf = Column(String(100), nullable=True)
    date = Column(String, nullable=False)
    note = Column(String)
    device_type = Column(Enum(DeviceType), nullable=False)
    status = Column(Enum(Status), default=Status.open, nullable=False)
    priority = Column(Enum(Priority), nullable=True)


class Rma(Base):
    __tablename__ = "rmas"

    rma_id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(Integer, ForeignKey("tickets.ticket_number"), nullable=True, index=True)
    customer = Column(String(255), nullable=False)
    campus = Column(String(255), nullable=False)
    dynamics_case_number = Column(String(32), nullable=False, index=True)
    part_number_model = Column(String(100), nullable=False)
    defective_serial_number = Column(String(100), nullable=False)
    issue = Column(String, nullable=False)


class UpsInstallation(Base):
    __tablename__ = "ups_installations"
    __table_args__ = (
        CheckConstraint("tea_code >= 0 AND tea_code <= 999", name="ck_ups_installations_tea_code_3_digits"),
    )

    ups_installation_id = Column(Integer, primary_key=True, index=True)
    ticket_number = Column(Integer, ForeignKey("tickets.ticket_number", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    external_ticket_number = Column(String(8), nullable=True)
    school_name = Column(String(255), nullable=False)
    tea_code = Column(Integer, nullable=False)
    created_date = Column(String, nullable=False)
    status = Column(Enum(UpsInstallStatus), default=UpsInstallStatus.intake, nullable=False)
    serial_number = Column(String(100), nullable=True)
    defective_battery_pack_serial = Column(String(100), nullable=True)
    idf = Column(String(100), nullable=True)
    asset_tag = Column(String(100), nullable=True)
    new_serial_number = Column(String(100), nullable=True)
    new_webcard_serial = Column(String(100), nullable=True)
    mac_address = Column(String(32), nullable=True)
    hostname = Column(String(100), nullable=True)
    new_battery_pack_asset_tag = Column(String(100), nullable=True)
    new_battery_pack_serial = Column(String(100), nullable=True)
    model = Column(String(100), nullable=True)
    room_number = Column(String(50), nullable=True)
    installed_date = Column(String, nullable=True)
    installed_by = Column(String(100), nullable=True)
    notes = Column(String, nullable=True)
    snmp_ip = Column(String(100), nullable=True)
    battery_pack_1_asset_tag = Column(String(100), nullable=True)
    ups_po = Column(String(100), nullable=True)
    bp_po = Column(String(100), nullable=True)
    proposed_install_date = Column(String, nullable=True)
    approved_install_date = Column(String, nullable=True)
    install_contact = Column(String(255), nullable=True)
    install_contact_number = Column(String(20), nullable=True)
