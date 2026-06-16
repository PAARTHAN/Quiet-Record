from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import TrustedContact, User
from schemas.schemas import TrustedContactCreate, TrustedContactResponse, TrustedContactUpdate
from .users import get_current_user

router = APIRouter(prefix="/contacts", tags=["contacts"])

@router.get("", response_model=list[TrustedContactResponse])
def get_contacts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(TrustedContact).filter(TrustedContact.user_id == current_user.id).all()

@router.post("", response_model=TrustedContactResponse)
def create_contact(contact: TrustedContactCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_contact = TrustedContact(
        user_id=current_user.id,
        name=contact.name,
        email=contact.email,
        phone=contact.phone,
        relationship_name=contact.relationship,
    )
    db.add(new_contact)
    db.commit()
    db.refresh(new_contact)
    return new_contact

@router.put("/{contact_id}", response_model=TrustedContactResponse)
def update_contact(contact_id: int, contact: TrustedContactUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(TrustedContact).filter(
        TrustedContact.id == contact_id,
        TrustedContact.user_id == current_user.id
    ).first()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")

    existing.name = contact.name
    existing.email = contact.email
    existing.phone = contact.phone
    existing.relationship_name = contact.relationship
    db.commit()
    db.refresh(existing)
    return existing

@router.delete("/{contact_id}")
def delete_contact(contact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(TrustedContact).filter(
        TrustedContact.id == contact_id,
        TrustedContact.user_id == current_user.id
    ).first()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(existing)
    db.commit()
    return {"message": "Contact deleted"}
