# Quiet Record

A ledger for your whole financial life — with guidance on managing it while you
are here, and a trusted release if you ever become unreachable.

## What it does

- **The ledger.** Debts, receivables, insurance, property, stocks, bonds and
  private notes, recorded once against your account.
- **The advisor.** A deterministic rules engine works your own records into a net
  worth figure, a five-pillar health score, a target asset mix, a debt payoff
  order, a monthly plan and a retirement projection — with a ranked list of what
  to do next. It runs entirely in the browser; no model and no third-party call
  sits between your figures and the guidance.
- **The watch.** An inactivity timer you reset by checking in. If it runs out, a
  warning goes to you first, then your records and final message are released to
  your trusted contacts by email and SMS.

## Design

A classic ivory-and-navy treatment: parchment ground, navy ink, gold rules,
Playfair Display for prose and Inter for every figure. Charts use a
five-slot categorical palette validated for the lightness band, chroma floor,
colour-vision separation and contrast against the card surface; each figure
carries a legend, direct labels and a table view so nothing is encoded by colour
alone.

## Running it

Backend (FastAPI, PostgreSQL):

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env      # set DATABASE_URL and SECRET_KEY at minimum
alembic upgrade head
uvicorn main:app --reload
```

Frontend (React + Vite):

```bash
cd frontend
npm install
cp .env.example .env      # VITE_API_BASE, defaults to http://127.0.0.1:8000
npm run dev
```

## Notes

- The financial profile behind the advisor (age, income, expenses, dependents,
  risk appetite) is kept in `localStorage` per account. It never reaches the
  server and is not part of the legacy report.
- Trigger thresholds come from `TRIGGER_THRESHOLD_SECONDS` and
  `WARNING_THRESHOLD_SECONDS`; set them low to demo the release quickly.
- The advisor gives general guidance from arithmetic on the figures you enter.
  It is not personal financial advice.
