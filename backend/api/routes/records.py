from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Record, User
from schemas.schemas import RecordCreate, RecordResponse, RecordUpdate
from .users import get_current_user

router = APIRouter(prefix="/records", tags=["records"])

@router.get("", response_model=list[RecordResponse])
def get_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Record).filter(Record.user_id == current_user.id).order_by(Record.id.desc()).all()

@router.post("", response_model=RecordResponse)
def create_record(record: RecordCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_record = Record(
        user_id=current_user.id,
        title=record.title,
        category=record.category,
        amount=record.amount,
        owner=record.owner,
        details=record.details,
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    return new_record

@router.put("/{record_id}", response_model=RecordResponse)
def update_record(record_id: int, record: RecordUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Record).filter(
        Record.id == record_id,
        Record.user_id == current_user.id
    ).first()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")

    existing.title = record.title
    existing.category = record.category
    existing.amount = record.amount
    existing.owner = record.owner
    existing.details = record.details
    db.commit()
    db.refresh(existing)
    return existing

@router.delete("/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Record).filter(
        Record.id == record_id,
        Record.user_id == current_user.id
    ).first()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")

    db.delete(existing)
    db.commit()
    return {"message": "Record deleted"}
