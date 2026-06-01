from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from enum import Enum
from datetime import datetime

class DeviceType(str, Enum):
    switch = "switch"
    access_point = "access_point"
    ups = "ups"

class Status(str, Enum):
    open = "open"
    on_hold = "on_hold"
    closed = "closed"

class UpsInstallStatus(str, Enum):
    intake = "intake"
    servicing = "servicing"
    scheduled = "scheduled"
    fulfilled = "fulfilled"

class DeviceResponseResolutionType(str, Enum):
    permanent = "permanent"
    temp_rma = "temp_rma"
    no_replacement = "no_replacement"

class DeviceResponseStatus(str, Enum):
    open = "open"
    temp_placed = "temp_placed"
    closed = "closed"


class UpsScheduleDay(str, Enum):
    mon = "mon"
    tue = "tue"
    wed = "wed"
    thu = "thu"

class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"

class TicketBase(BaseModel):
    external_ticket_number: Optional[str] = Field(None, min_length=1, max_length=8)
    device_type: str
    school_name: str = Field(..., min_length=1, max_length=255)
    tea_code: int = Field(..., ge=0, le=999)
    mdf_idf: Optional[str] = Field(None, max_length=100)
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


class RmaBase(BaseModel):
    ticket_number: Optional[int] = None
    customer: str = Field(..., min_length=1, max_length=255)
    campus: str = Field(..., min_length=1, max_length=255)
    dynamics_case_number: str = Field(..., min_length=1, max_length=32)
    part_number_model: str = Field(..., min_length=1, max_length=100)
    defective_serial_number: str = Field(..., min_length=1, max_length=100)
    issue: str = Field(..., min_length=1, max_length=1000)


class RmaCreate(RmaBase):
    pass


class RmaUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticket_number: Optional[int] = None
    customer: Optional[str] = Field(None, min_length=1, max_length=255)
    campus: Optional[str] = Field(None, min_length=1, max_length=255)
    dynamics_case_number: Optional[str] = Field(None, min_length=1, max_length=32)
    part_number_model: Optional[str] = Field(None, min_length=1, max_length=100)
    defective_serial_number: Optional[str] = Field(None, min_length=1, max_length=100)
    issue: Optional[str] = Field(None, min_length=1, max_length=1000)


class Rma(RmaBase):
    rma_id: int

    class Config:
        from_attributes = True


class DeviceResponseBase(BaseModel):
    resolution_type: DeviceResponseResolutionType = DeviceResponseResolutionType.permanent
    status: DeviceResponseStatus = DeviceResponseStatus.open
    response_note: Optional[str] = Field(None, max_length=2000)
    temp_response_note: Optional[str] = Field(None, max_length=2000)
    rma_response_note: Optional[str] = Field(None, max_length=2000)
    defective_model: Optional[str] = Field(None, max_length=100)
    defective_sn: Optional[str] = Field(None, max_length=100)
    defective_mac: Optional[str] = Field(None, max_length=32)
    defective_asset_tag: Optional[str] = Field(None, max_length=100)
    defective_room: Optional[str] = Field(None, max_length=50)
    replacement_model: Optional[str] = Field(None, max_length=100)
    replacement_sn: Optional[str] = Field(None, max_length=100)
    replacement_mac: Optional[str] = Field(None, max_length=32)
    replacement_hostname: Optional[str] = Field(None, max_length=100)
    replacement_ip: Optional[str] = Field(None, max_length=100)
    replacement_asset_tag: Optional[str] = Field(None, max_length=100)
    replacement_room: Optional[str] = Field(None, max_length=50)
    temp_model: Optional[str] = Field(None, max_length=100)
    temp_sn: Optional[str] = Field(None, max_length=100)
    temp_mac: Optional[str] = Field(None, max_length=32)
    temp_hostname: Optional[str] = Field(None, max_length=100)
    temp_ip: Optional[str] = Field(None, max_length=100)
    temp_asset_tag: Optional[str] = Field(None, max_length=100)
    temp_room: Optional[str] = Field(None, max_length=50)


class DeviceResponseCreate(DeviceResponseBase):
    pass


class DeviceResponseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resolution_type: Optional[DeviceResponseResolutionType] = None
    status: Optional[DeviceResponseStatus] = None
    response_note: Optional[str] = Field(None, max_length=2000)
    temp_response_note: Optional[str] = Field(None, max_length=2000)
    rma_response_note: Optional[str] = Field(None, max_length=2000)
    defective_model: Optional[str] = Field(None, max_length=100)
    defective_sn: Optional[str] = Field(None, max_length=100)
    defective_mac: Optional[str] = Field(None, max_length=32)
    defective_asset_tag: Optional[str] = Field(None, max_length=100)
    defective_room: Optional[str] = Field(None, max_length=50)
    replacement_model: Optional[str] = Field(None, max_length=100)
    replacement_sn: Optional[str] = Field(None, max_length=100)
    replacement_mac: Optional[str] = Field(None, max_length=32)
    replacement_hostname: Optional[str] = Field(None, max_length=100)
    replacement_ip: Optional[str] = Field(None, max_length=100)
    replacement_asset_tag: Optional[str] = Field(None, max_length=100)
    replacement_room: Optional[str] = Field(None, max_length=50)
    temp_model: Optional[str] = Field(None, max_length=100)
    temp_sn: Optional[str] = Field(None, max_length=100)
    temp_mac: Optional[str] = Field(None, max_length=32)
    temp_hostname: Optional[str] = Field(None, max_length=100)
    temp_ip: Optional[str] = Field(None, max_length=100)
    temp_asset_tag: Optional[str] = Field(None, max_length=100)
    temp_room: Optional[str] = Field(None, max_length=50)


class DeviceResponse(DeviceResponseBase):
    id: int
    ticket_id: int
    resolution_locked_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UpsInstallationBase(BaseModel):
    status: UpsInstallStatus = UpsInstallStatus.intake
    serial_number: Optional[str] = Field(None, max_length=100)
    defective_battery_pack_serial: Optional[str] = Field(None, max_length=100)
    idf: Optional[str] = Field(None, max_length=100)
    asset_tag: Optional[str] = Field(None, max_length=100)
    new_serial_number: Optional[str] = Field(None, max_length=100)
    new_webcard_serial: Optional[str] = Field(None, max_length=100)
    mac_address: Optional[str] = Field(None, max_length=32)
    hostname: Optional[str] = Field(None, max_length=100)
    new_battery_pack_asset_tag: Optional[str] = Field(None, max_length=100)
    new_battery_pack_serial: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    room_number: Optional[str] = Field(None, max_length=50)
    installed_date: Optional[str] = None
    installed_by: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    snmp_ip: Optional[str] = Field(None, max_length=100)
    battery_pack_1_asset_tag: Optional[str] = Field(None, max_length=100)
    ups_po: Optional[str] = Field(None, max_length=100)
    bp_po: Optional[str] = Field(None, max_length=100)
    proposed_install_date: Optional[str] = None
    approved_install_date: Optional[str] = None
    install_contact: Optional[str] = Field(None, max_length=255)
    install_contact_number: Optional[str] = Field(None, max_length=20)


class UpsInstallationUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[UpsInstallStatus] = None
    serial_number: Optional[str] = Field(None, max_length=100)
    defective_battery_pack_serial: Optional[str] = Field(None, max_length=100)
    idf: Optional[str] = Field(None, max_length=100)
    asset_tag: Optional[str] = Field(None, max_length=100)
    new_serial_number: Optional[str] = Field(None, max_length=100)
    new_webcard_serial: Optional[str] = Field(None, max_length=100)
    mac_address: Optional[str] = Field(None, max_length=32)
    hostname: Optional[str] = Field(None, max_length=100)
    new_battery_pack_asset_tag: Optional[str] = Field(None, max_length=100)
    new_battery_pack_serial: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    room_number: Optional[str] = Field(None, max_length=50)
    installed_date: Optional[str] = None
    installed_by: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    snmp_ip: Optional[str] = Field(None, max_length=100)
    battery_pack_1_asset_tag: Optional[str] = Field(None, max_length=100)
    ups_po: Optional[str] = Field(None, max_length=100)
    bp_po: Optional[str] = Field(None, max_length=100)
    proposed_install_date: Optional[str] = None
    approved_install_date: Optional[str] = None
    install_contact: Optional[str] = Field(None, max_length=255)
    install_contact_number: Optional[str] = Field(None, max_length=20)


class UpsInstallation(UpsInstallationBase):
    ups_installation_id: int
    ticket_number: int
    external_ticket_number: Optional[str] = None
    school_name: str
    tea_code: int
    created_date: str

    class Config:
        from_attributes = True


class UpsScheduleRequest(BaseModel):
    ups_installation_ids: list[int] = Field(..., min_length=1)
    day: UpsScheduleDay


class UpsScheduleCustomRow(BaseModel):
    ups_installation_id: int
    proposed_install_date: str = Field(..., min_length=1)


class UpsScheduleCustomRequest(BaseModel):
    rows: list[UpsScheduleCustomRow] = Field(..., min_length=1)


class UpsScheduleRow(BaseModel):
    ups_installation_id: int
    ticket_number: str
    idf: Optional[str] = None
    school_name: str
    install_contact: str = ""
    install_contact_number: str = ""
    proposed_install_date: str
    type: str = "Replace"
    equipment: str


class UpsScheduleResponse(BaseModel):
    proposed_install_date: str
    rows: list[UpsScheduleRow]
