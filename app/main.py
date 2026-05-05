from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from database import get_db
from models import Ticket
from schemas import Ticket as TicketSchema, TicketCreate, TicketUpdate, Status

app = FastAPI(
    title="Ticket Tracking API",
    description="A minimal ticket tracking application",
    version="1.0.0"
)

@app.post("/tickets/", response_model=TicketSchema, status_code=201)
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    try:
        db_ticket = Ticket(**ticket.model_dump())
        db.add(db_ticket)
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
        db.delete(db_ticket)
        db.commit()
        return {"message": "Ticket deleted"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error deleting ticket")
