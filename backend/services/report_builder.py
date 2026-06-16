from sqlalchemy.orm import Session

from db.models import Record, TrustedContact, User
from core.utils import to_ist_string, utc_now
from core.encryption import decrypt_detail

def get_dashboard_intelligence(records: list[Record]) -> dict:
    def safe_amount(value) -> float:
        try:
            return float(value or 0)
        except Exception:
            return 0.0

    highest_debt = None
    highest_owed = None
    highest_asset = None

    for record in records:
        decrypted_amount = decrypt_detail(record.amount)
        amount = safe_amount(decrypted_amount)
        category = (record.category or "Other").lower()
        decrypted_title = decrypt_detail(record.title)
        decrypted_owner = decrypt_detail(record.owner)

        if category in ["debt", "bill"]:
            if highest_debt is None or amount > highest_debt["amount"]:
                highest_debt = {"title": decrypted_title, "amount": amount, "owner": decrypted_owner}
        elif category in ["money owed to me", "lent", "owed", "receivable"]:
            if highest_owed is None or amount > highest_owed["amount"]:
                highest_owed = {"title": decrypted_title, "amount": amount, "owner": decrypted_owner}
        else:
            if highest_asset is None or amount > highest_asset["amount"]:
                highest_asset = {"title": decrypted_title, "amount": amount, "owner": decrypted_owner}

    return {
        "highest_debt": highest_debt,
        "highest_owed": highest_owed,
        "strongest_asset": highest_asset,
    }


def build_emergency_report(user: User, contacts: list[TrustedContact], db: Session) -> str:
    records = db.query(Record).filter(Record.user_id == user.id).all()

    def safe_amount(value) -> float:
        try:
            return float(value or 0)
        except Exception:
            return 0.0

    def money(value: float) -> str:
        return f"₹ {value:,.2f}"

    total_debt = 0.0
    total_owed_to_me = 0.0
    total_assets = 0.0
    grouped: dict[str, list[Record]] = {}

    for r in records:
        category = (r.category or "Other").strip()
        grouped.setdefault(category, []).append(r)
        decrypted_amount = decrypt_detail(r.amount)
        amount = safe_amount(decrypted_amount)
        category_lower = category.lower()
        if category_lower in ["debt", "bill"]:
            total_debt += amount
        elif category_lower in ["money owed to me", "lent", "owed", "receivable"]:
            total_owed_to_me += amount
        else:
            total_assets += amount

    intel = get_dashboard_intelligence(records)

    sections: list[str] = []
    sections.append("DEATH NOTE - EMERGENCY INFORMATION REPORT")
    sections.append("")
    sections.append(f"Prepared for trusted contacts of {user.name}.")
    sections.append(f"This report summarizes the key liabilities, receivables, assets, and personal note left by {user.name}.")
    sections.append("")
    sections.append("I believe in YOU, Go ahead read this document🙂")
    sections.append("")
    sections.append("=" * 88)
    sections.append("ACCOUNT HOLDER DETAILS")
    sections.append("=" * 88)
    sections.append(f"Name                     : {user.name}")
    sections.append(f"Email                    : {user.email}")
    sections.append(f"Report Generated At      : {to_ist_string(utc_now())}")
    sections.append(f"Last Check-in Time       : {to_ist_string(user.last_check_in)}")
    sections.append("")
    sections.append(f"We're not sure whether something happened to {user.name} after the last check in time")
    sections.append("We convey our deep condolences if he's/she's no more")
    sections.append("")

    sections.append("=" * 88)
    sections.append("FINANCIAL SUMMARY")
    sections.append("=" * 88)
    sections.append(f"Total Amount in Debt     : {money(total_debt)}")
    sections.append(f"Total Money Owed To Me   : {money(total_owed_to_me)}")
    sections.append(f"Total Assets / Value     : {money(total_assets)}")
    sections.append(f"Total Records Entered    : {len(records)}")
    sections.append("")

    sections.append("=" * 88)
    sections.append("DASHBOARD INTELLIGENCE")
    sections.append("=" * 88)
    if intel["highest_debt"]:
        sections.append(f"Highest Liability        : {intel['highest_debt']['title']} ({money(intel['highest_debt']['amount'])})")
    else:
        sections.append("Highest Liability        : None recorded")
    if intel["highest_owed"]:
        sections.append(f"Largest Receivable       : {intel['highest_owed']['title']} ({money(intel['highest_owed']['amount'])})")
    else:
        sections.append("Largest Receivable       : None recorded")
    if intel["strongest_asset"]:
        sections.append(f"Strongest Asset          : {intel['strongest_asset']['title']} ({money(intel['strongest_asset']['amount'])})")
    else:
        sections.append("Strongest Asset          : None recorded")
    sections.append("")

    sections.append("=" * 88)
    sections.append("PERSONAL LAST MESSAGE")
    sections.append("=" * 88)
    if user.last_message and user.last_message.strip():
        sections.append(user.last_message.strip())
    else:
        sections.append("No personal last message was saved by the account holder.")
    sections.append("")

    sections.append("=" * 88)
    sections.append("TRUSTED CONTACTS")
    sections.append("=" * 88)
    if contacts:
        for index, contact in enumerate(contacts, start=1):
            sections.append(f"Contact {index}")
            sections.append(f"  Name                 : {contact.name}")
            sections.append(f"  Relationship         : {contact.relationship_name or 'Not provided'}")
            sections.append(f"  Email                : {contact.email or 'Not provided'}")
            sections.append(f"  Phone                : {contact.phone or 'Not provided'}")
            sections.append("-" * 88)
    else:
        sections.append("No trusted contacts available.")
        sections.append("")

    sections.append("=" * 88)
    sections.append("DETAILED RECORDS")
    sections.append("=" * 88)
    if records:
        for category, items in grouped.items():
            category_total = sum(safe_amount(decrypt_detail(item.amount)) for item in items)
            sections.append(f"Category               : {category}")
            sections.append(f"Category Total         : {money(category_total)}")
            sections.append("-" * 88)
            for index, item in enumerate(items, start=1):
                decrypted_title = decrypt_detail(item.title)
                decrypted_amount = decrypt_detail(item.amount)
                decrypted_owner = decrypt_detail(item.owner)
                
                sections.append(f"Entry {index}")
                sections.append(f"  Title / Item Name    : {decrypted_title or 'Not provided'}")
                sections.append(f"  Amount               : {money(safe_amount(decrypted_amount))}")
                sections.append(f"  Person / Institution : {decrypted_owner or 'Not provided'}")
                
                decrypted_details = decrypt_detail(item.details)
                sections.append(f"  Details / Notes      : {decrypted_details or 'No details provided'}")
                sections.append("")
            sections.append("=" * 88)
    else:
        sections.append("No records were found in the database.")
        sections.append("")

    sections.append("IMPORTANT NOTE")
    sections.append("-" * 88)
    sections.append("This report was automatically generated by the Death Note system.")
    sections.append("Please verify all details carefully before making any decisions or contacting institutions.")
    sections.append("")
    sections.append("Take care of all these things mentioned above after my death buddy.")
    sections.append("I loved you guys always❣️, sorry for leaving y'all 🥺")

    return "\n".join(sections)


def build_sms_summary(user: User, db: Session, recipient_name: str) -> str:
    records = db.query(Record).filter(Record.user_id == user.id).all()

    def safe_amount(value) -> float:
        try:
            return float(value or 0)
        except Exception:
            return 0.0

    total_debt = sum(safe_amount(decrypt_detail(r.amount)) for r in records if (r.category or "").lower() in ["debt", "bill"])
    total_assets = sum(safe_amount(decrypt_detail(r.amount)) for r in records if (r.category or "").lower() not in ["debt", "bill", "money owed to me", "lent", "owed", "receivable"])

    # Personalize and truncate last message to keep SMS short
    raw_message = user.last_message.strip() if user.last_message else "No message."
    short_message = (raw_message[:80] + "...") if len(raw_message) > 80 else raw_message

    summary = [
        f"Dear {recipient_name},",
        f"🚨 EMERGENCY for {user.name}:",
        f"Debt: ₹{total_debt:,.0f}",
        f"Assets: ₹{total_assets:,.0f}",
        f"Message: {short_message}",
        "Full report in your email. - Quiet Record"
    ]
    return "\n".join(summary)
