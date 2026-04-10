from sqlalchemy.orm import Session

from db.models import Record, TrustedContact, User
from core.utils import to_ist_string, utc_now

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
        amount = safe_amount(record.amount)
        category = (record.category or "Other").lower()

        if category in ["debt", "bill"]:
            if highest_debt is None or amount > highest_debt["amount"]:
                highest_debt = {"title": record.title, "amount": amount, "owner": record.owner}
        elif category in ["money owed to me", "lent", "owed", "receivable"]:
            if highest_owed is None or amount > highest_owed["amount"]:
                highest_owed = {"title": record.title, "amount": amount, "owner": record.owner}
        else:
            if highest_asset is None or amount > highest_asset["amount"]:
                highest_asset = {"title": record.title, "amount": amount, "owner": record.owner}

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
        amount = safe_amount(r.amount)
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
            category_total = sum(safe_amount(item.amount) for item in items)
            sections.append(f"Category               : {category}")
            sections.append(f"Category Total         : {money(category_total)}")
            sections.append("-" * 88)
            for index, item in enumerate(items, start=1):
                sections.append(f"Entry {index}")
                sections.append(f"  Title / Item Name    : {item.title or 'Not provided'}")
                sections.append(f"  Amount               : {money(safe_amount(item.amount))}")
                sections.append(f"  Person / Institution : {item.owner or 'Not provided'}")
                sections.append(f"  Details / Notes      : {item.details or 'No details provided'}")
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
