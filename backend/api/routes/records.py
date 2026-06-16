from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import Record, User
from schemas.schemas import RecordCreate, RecordResponse, RecordUpdate
from .users import get_current_user
from core.encryption import encrypt_detail, decrypt_detail

router = APIRouter(prefix="/records", tags=["records"])

@router.get("", response_model=list[RecordResponse])
def get_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = db.query(Record).filter(Record.user_id == current_user.id).order_by(Record.id.desc()).all()
    
    # Decrypt sensitive fields before sending to client
    for r in records:
        r.title = decrypt_detail(r.title)
        r.amount = decrypt_detail(r.amount)
        r.owner = decrypt_detail(r.owner)
        r.details = decrypt_detail(r.details)
        
    return records

@router.post("", response_model=RecordResponse)
def create_record(record: RecordCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_record = Record(
        user_id=current_user.id,
        title=encrypt_detail(record.title),
        category=record.category,
        amount=encrypt_detail(record.amount),
        owner=encrypt_detail(record.owner),
        details=encrypt_detail(record.details),
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    # Decrypt the sensitive fields so the response model has the plaintext
    new_record.title = decrypt_detail(new_record.title)
    new_record.amount = decrypt_detail(new_record.amount)
    new_record.owner = decrypt_detail(new_record.owner)
    new_record.details = decrypt_detail(new_record.details)
    return new_record

@router.put("/{record_id}", response_model=RecordResponse)
def update_record(record_id: int, record: RecordUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Record).filter(
        Record.id == record_id,
        Record.user_id == current_user.id
    ).first()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Record not found")

    existing.title = encrypt_detail(record.title)
    existing.category = record.category
    existing.amount = encrypt_detail(record.amount)
    existing.owner = encrypt_detail(record.owner)
    existing.details = encrypt_detail(record.details)
    db.commit()
    db.refresh(existing)
    
    # Decrypt the sensitive fields so the response model has the plaintext
    existing.title = decrypt_detail(existing.title)
    existing.amount = decrypt_detail(existing.amount)
    existing.owner = decrypt_detail(existing.owner)
    existing.details = decrypt_detail(existing.details)
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
