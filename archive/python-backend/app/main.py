from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import date, datetime, timedelta, timezone
from database import get_db
from models import DeviceResponse, DeviceResponseStatus as DeviceResponseModelStatus, Rma, Ticket, UpsInstallation
from schemas import DeviceResponse as DeviceResponseSchema, DeviceResponseCreate, DeviceResponseUpdate, Rma as RmaSchema, RmaCreate, RmaUpdate, Ticket as TicketSchema, TicketCreate, TicketUpdate, Status, UpsInstallStatus, UpsInstallation as UpsInstallationSchema, UpsInstallationUpdate, UpsScheduleCustomRequest, UpsScheduleRequest, UpsScheduleResponse, UpsScheduleRow

app = FastAPI(
    title="Ticket Tracking API",
    description="A minimal ticket tracking application",
    version="1.0.0"
)


def resolve_next_weekday(day: str) -> str:
    weekday_map = {"mon": 0, "tue": 1, "wed": 2, "thu": 3}
    today = date.today()
    next_monday = today + timedelta(days=7 - today.weekday())
    return (next_monday + timedelta(days=weekday_map[day])).isoformat()


def derive_ups_equipment(ups: UpsInstallation) -> str:
    battery_pack_count = sum([
        bool(ups.defective_battery_pack_serial or ups.battery_pack_1_asset_tag),
        bool(ups.new_battery_pack_serial or ups.new_battery_pack_asset_tag),
    ])
    if battery_pack_count == 0:
        return "UPS"
    return f"UPS, {battery_pack_count} BP"


def build_schedule_row(ups: UpsInstallation) -> UpsScheduleRow:
    return UpsScheduleRow(
        ups_installation_id=ups.ups_installation_id,
        ticket_number=str(ups.external_ticket_number or ups.ticket_number),
        idf=ups.idf,
        school_name=ups.school_name,
        proposed_install_date=ups.proposed_install_date or "",
        equipment=derive_ups_equipment(ups),
    )


def is_locking_response_status(status) -> bool:
    return getattr(status, "value", status) in {
        DeviceResponseModelStatus.temp_placed.value,
        DeviceResponseModelStatus.closed.value,
    }


@app.post("/tickets/", response_model=TicketSchema, status_code=201)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    try:
        ticket_data = ticket.model_dump()
        db_ticket = Ticket(**ticket_data)
        db.add(db_ticket)
        db.flush()

        if ticket_data["device_type"] == "ups":
            db_ups_installation = UpsInstallation(
                ticket_number=db_ticket.ticket_number,
                external_ticket_number=db_ticket.external_ticket_number,
                school_name=db_ticket.school_name,
                tea_code=db_ticket.tea_code,
                idf=db_ticket.mdf_idf,
                created_date=db_ticket.date,
            )
            db.add(db_ups_installation)

        db.commit()
        db.refresh(db_ticket)
        return db_ticket
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid ticket data")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating ticket: {str(e)}")

@app.get("/tickets/", response_model=list[TicketSchema])
def list_tickets(
    status: Optional[Status] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Ticket)
        if status:
            query = query.filter(Ticket.status == status)
        tickets = query.order_by(Ticket.ticket_number.desc()).offset(offset).limit(limit).all()
        return tickets
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error retrieving tickets")

@app.put("/tickets/{ticket_number}", response_model=TicketSchema)
def update_ticket(ticket_number: int, ticket_update: TicketUpdate, db: Session = Depends(get_db)):
    try:
        db_ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not db_ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        for key, value in ticket_update.model_dump(exclude_unset=True).items():
            setattr(db_ticket, key, value)
        db.commit()
        db.refresh(db_ticket)
        return db_ticket
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating ticket")

@app.delete("/tickets/{ticket_number}")
def delete_ticket(ticket_number: int, db: Session = Depends(get_db)):
    try:
        db_ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not db_ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        db.query(UpsInstallation).filter(UpsInstallation.ticket_number == ticket_number).delete()
        db.delete(db_ticket)
        db.commit()
        return {"message": "Ticket deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error deleting ticket")


@app.get("/tickets/{ticket_number}/response", response_model=DeviceResponseSchema)
def get_ticket_response(ticket_number: int, db: Session = Depends(get_db)):
    try:
        db_response = db.query(DeviceResponse).filter(DeviceResponse.ticket_id == ticket_number).first()
        if not db_response:
            raise HTTPException(status_code=404, detail="Ticket response not found")
        return db_response
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error retrieving ticket response")


@app.post("/tickets/{ticket_number}/response", response_model=DeviceResponseSchema, status_code=201)
def create_ticket_response(
    ticket_number: int,
    response: DeviceResponseCreate,
    db: Session = Depends(get_db)
):
    try:
        db_ticket = db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()
        if not db_ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        existing_response = db.query(DeviceResponse).filter(DeviceResponse.ticket_id == ticket_number).first()
        if existing_response:
            raise HTTPException(status_code=400, detail="Ticket response already exists")

        db_response = DeviceResponse(ticket_id=ticket_number, **response.model_dump())
        if is_locking_response_status(db_response.status):
            db_response.resolution_locked_at = datetime.now(timezone.utc)

        db.add(db_response)
        db.commit()
        db.refresh(db_response)
        return db_response
    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid ticket response data")
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error creating ticket response")


@app.patch("/tickets/{ticket_number}/response", response_model=DeviceResponseSchema)
def update_ticket_response(
    ticket_number: int,
    response_update: DeviceResponseUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_response = db.query(DeviceResponse).filter(DeviceResponse.ticket_id == ticket_number).first()
        if not db_response:
            raise HTTPException(status_code=404, detail="Ticket response not found")

        update_data = response_update.model_dump(exclude_unset=True)
        if db_response.resolution_locked_at and "resolution_type" in update_data:
            update_data.pop("resolution_type")

        for key, value in update_data.items():
            setattr(db_response, key, value)

        if (
            "status" in update_data
            and is_locking_response_status(db_response.status)
            and not db_response.resolution_locked_at
        ):
            db_response.resolution_locked_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(db_response)
        return db_response
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating ticket response")


@app.post("/rmas/", response_model=RmaSchema, status_code=201)
def create_rma(rma: RmaCreate, db: Session = Depends(get_db)):
    try:
        db_rma = Rma(**rma.model_dump())
        db.add(db_rma)
        db.commit()
        db.refresh(db_rma)
        return db_rma
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid RMA data")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating RMA: {str(e)}")


@app.get("/rmas/", response_model=list[RmaSchema])
def list_rmas(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    try:
        return db.query(Rma).order_by(Rma.rma_id.desc()).offset(offset).limit(limit).all()
    except Exception:
        raise HTTPException(status_code=500, detail="Error retrieving RMAs")


@app.put("/rmas/{rma_id}", response_model=RmaSchema)
def update_rma(rma_id: int, rma_update: RmaUpdate, db: Session = Depends(get_db)):
    try:
        db_rma = db.query(Rma).filter(Rma.rma_id == rma_id).first()
        if not db_rma:
            raise HTTPException(status_code=404, detail="RMA not found")
        for key, value in rma_update.model_dump(exclude_unset=True).items():
            setattr(db_rma, key, value)
        db.commit()
        db.refresh(db_rma)
        return db_rma
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating RMA")


@app.delete("/rmas/{rma_id}")
def delete_rma(rma_id: int, db: Session = Depends(get_db)):
    try:
        db_rma = db.query(Rma).filter(Rma.rma_id == rma_id).first()
        if not db_rma:
            raise HTTPException(status_code=404, detail="RMA not found")
        db.delete(db_rma)
        db.commit()
        return {"message": "RMA deleted"}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error deleting RMA")


@app.get("/ups-installations/", response_model=list[UpsInstallationSchema])
def list_ups_installations(
    status: Optional[UpsInstallStatus] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(UpsInstallation)
        if status:
            query = query.filter(UpsInstallation.status == status)
        return query.order_by(UpsInstallation.ups_installation_id.desc()).offset(offset).limit(limit).all()
    except Exception:
        raise HTTPException(status_code=500, detail="Error retrieving UPS installations")


@app.put("/ups-installations/{ups_installation_id}", response_model=UpsInstallationSchema)
def update_ups_installation(
    ups_installation_id: int,
    ups_update: UpsInstallationUpdate,
    db: Session = Depends(get_db)
):
    try:
        db_ups = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id == ups_installation_id
        ).first()
        if not db_ups:
            raise HTTPException(status_code=404, detail="UPS installation not found")
        for key, value in ups_update.model_dump(exclude_unset=True).items():
            setattr(db_ups, key, value)
        db.commit()
        db.refresh(db_ups)
        return db_ups
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating UPS installation")


@app.delete("/ups-installations/{ups_installation_id}")
def delete_ups_installation(ups_installation_id: int, db: Session = Depends(get_db)):
    try:
        db_ups = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id == ups_installation_id
        ).first()
        if not db_ups:
            raise HTTPException(status_code=404, detail="UPS installation not found")
        db.delete(db_ups)
        db.commit()
        return {"message": "UPS installation deleted"}
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error deleting UPS installation")


@app.post("/ups/schedule", response_model=UpsScheduleResponse)
def schedule_ups_installations(
    schedule_request: UpsScheduleRequest,
    db: Session = Depends(get_db)
):
    try:
        requested_ids = schedule_request.ups_installation_ids
        installs = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id.in_(requested_ids)
        ).all()

        if len(installs) != len(set(requested_ids)):
            raise HTTPException(status_code=404, detail="One or more UPS installations were not found")

        proposed_install_date = resolve_next_weekday(schedule_request.day.value)
        rows = []
        installs_by_id = {install.ups_installation_id: install for install in installs}
        for ups_id in requested_ids:
            install = installs_by_id[ups_id]
            install.proposed_install_date = proposed_install_date
            install.status = UpsInstallStatus.scheduled
            rows.append(build_schedule_row(install))

        db.commit()
        return UpsScheduleResponse(
            proposed_install_date=proposed_install_date,
            rows=rows
        )
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error generating UPS schedule")


@app.post("/ups/schedule/custom", response_model=UpsScheduleResponse)
def schedule_ups_installations_with_dates(
    schedule_request: UpsScheduleCustomRequest,
    db: Session = Depends(get_db)
):
    try:
        requested_ids = [row.ups_installation_id for row in schedule_request.rows]
        installs = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id.in_(requested_ids)
        ).all()

        if len(installs) != len(set(requested_ids)):
            raise HTTPException(status_code=404, detail="One or more UPS installations were not found")

        rows_by_id = {row.ups_installation_id: row for row in schedule_request.rows}
        installs_by_id = {install.ups_installation_id: install for install in installs}
        response_rows = []
        for ups_id in requested_ids:
            install = installs_by_id[ups_id]
            install.proposed_install_date = rows_by_id[ups_id].proposed_install_date
            install.status = UpsInstallStatus.scheduled
            response_rows.append(build_schedule_row(install))

        db.commit()
        return UpsScheduleResponse(
            proposed_install_date="",
            rows=response_rows
        )
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error generating UPS schedule")


@app.patch("/ups/{ups_installation_id}/rollback", response_model=UpsInstallationSchema)
def rollback_ups_installation(ups_installation_id: int, db: Session = Depends(get_db)):
    try:
        db_ups = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id == ups_installation_id
        ).first()
        if not db_ups:
            raise HTTPException(status_code=404, detail="UPS installation not found")

        db_ups.status = UpsInstallStatus.intake
        db_ups.proposed_install_date = None
        db.commit()
        db.refresh(db_ups)
        return db_ups
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error rolling back UPS installation")


@app.patch("/ups-installations/{ups_installation_id}/phase2", response_model=UpsInstallationSchema)
def update_ups_phase2(
    ups_installation_id: int,
    ups_update: UpsInstallationUpdate,
    db: Session = Depends(get_db)
):
    """Phase 2: Service Info (IDF, defective serial, defective battery)"""
    try:
        db_ups = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id == ups_installation_id
        ).first()
        if not db_ups:
            raise HTTPException(status_code=404, detail="UPS installation not found")
        
        allowed_fields = {
            'model', 'serial_number', 'snmp_ip', 'hostname', 'asset_tag',
            'mac_address', 'room_number', 'defective_battery_pack_serial',
            'battery_pack_1_asset_tag', 'idf'
        }
        for key, value in ups_update.model_dump(exclude_unset=True).items():
            if key in allowed_fields:
                setattr(db_ups, key, value)

        db.commit()
        db.refresh(db_ups)
        return db_ups
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating UPS phase 2")


@app.patch("/ups-installations/{ups_installation_id}/phase3-schedule", response_model=UpsInstallationSchema)
def update_ups_phase3_schedule(
    ups_installation_id: int,
    ups_update: UpsInstallationUpdate,
    db: Session = Depends(get_db)
):
    """Phase 3 Schedule: proposed install date"""
    try:
        db_ups = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id == ups_installation_id
        ).first()
        if not db_ups:
            raise HTTPException(status_code=404, detail="UPS installation not found")
        
        allowed_fields = {'proposed_install_date', 'install_contact', 'install_contact_number'}
        for key, value in ups_update.model_dump(exclude_unset=True).items():
            if key in allowed_fields:
                setattr(db_ups, key, value)

        if db_ups.proposed_install_date:
            db_ups.status = UpsInstallStatus.scheduled
        
        db.commit()
        db.refresh(db_ups)
        return db_ups
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating UPS phase 3 schedule")


@app.patch("/ups-installations/{ups_installation_id}/phase3-warehouse", response_model=UpsInstallationSchema)
def update_ups_phase3_warehouse(
    ups_installation_id: int,
    ups_update: UpsInstallationUpdate,
    db: Session = Depends(get_db)
):
    """Phase 3 Warehouse: PO numbers, approved install date"""
    try:
        db_ups = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id == ups_installation_id
        ).first()
        if not db_ups:
            raise HTTPException(status_code=404, detail="UPS installation not found")
        
        allowed_fields = {'ups_po', 'bp_po', 'approved_install_date'}
        for key, value in ups_update.model_dump(exclude_unset=True).items():
            if key in allowed_fields:
                setattr(db_ups, key, value)

        db.commit()
        db.refresh(db_ups)
        return db_ups
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating UPS phase 3 warehouse")


@app.patch("/ups-installations/{ups_installation_id}/phase3-devices", response_model=UpsInstallationSchema)
def update_ups_phase3_devices(
    ups_installation_id: int,
    ups_update: UpsInstallationUpdate,
    db: Session = Depends(get_db)
):
    """Phase 3 Devices: new asset tag, replacement serial, webcard serial, MAC, battery fields"""
    try:
        db_ups = db.query(UpsInstallation).filter(
            UpsInstallation.ups_installation_id == ups_installation_id
        ).first()
        if not db_ups:
            raise HTTPException(status_code=404, detail="UPS installation not found")
        
        allowed_fields = {
            'asset_tag', 'new_serial_number', 'new_webcard_serial', 'snmp_ip',
            'new_battery_pack_serial', 'new_battery_pack_asset_tag', 'battery_pack_1_asset_tag'
        }
        for key, value in ups_update.model_dump(exclude_unset=True).items():
            if key in allowed_fields:
                setattr(db_ups, key, value)
        
        db.commit()
        db.refresh(db_ups)
        return db_ups
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error updating UPS phase 3 devices")
