from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import TrustedContact, User
from schemas.schemas import TrustedContactCreate, TrustedContactResponse, TrustedContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])

@router.get("/{user_id}", response_model=list[TrustedContactResponse])
def get_contacts(user_id: int, db: Session = Depends(get_db)):
    return db.query(TrustedContact).filter(TrustedContact.user_id == user_id).all()

@router.post("/{user_id}", response_model=TrustedContactResponse)
def create_contact(user_id: int, contact: TrustedContactCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_contact = TrustedContact(
        user_id=user_id,
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
def update_contact(contact_id: int, contact: TrustedContactUpdate, db: Session = Depends(get_db)):
    existing = db.query(TrustedContact).filter(TrustedContact.id == contact_id).first()
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
def delete_contact(contact_id: int, db: Session = Depends(get_db)):
    existing = db.query(TrustedContact).filter(TrustedContact.id == contact_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Contact not found")

    db.delete(existing)
    db.commit()
    return {"message": "Contact deleted"}
