# SCHOLARAi — Student Funding & Application Intelligence

**Current Phase: Phase 1 — Foundation**

---

## 1. Product Overview

Scholarship discovery is a search problem. Scholarship pursuit is a coordination and decision problem.

**SCHOLARAi** is designed to connect:
- Student funding need
- Scholarship rules
- Application state
- Documents and evidence
- Deadlines
- Next actions

### Core Trust Principle
> **"AI assists. Official sources decide. Student approves."**
> 
> *Notice:* SCHOLARAi does not claim guaranteed eligibility or guaranteed scholarship awards. Final eligibility criteria and awards are determined exclusively by official awarding authorities.

---

## 2. Phase 1 Scope & Features

This repository implements the foundational layer of SCHOLARAi:

1. **Clean Modular Architecture**: Clean separation between FastAPI backend and Next.js frontend, prepared for PostgreSQL migration.
2. **Student & Funding Data Models**:
   - `Student`: Core personal student record.
   - `StudentProfile`: Academic details, institution, course, year, CGPA, 12th percentage, reservation category, domicile state.
   - `FundingProfile`: Annual educational costs, existing scholarships/support, annual family income, and dynamically calculated funding gap.
3. **Dynamic Funding Gap Engine**:
   - Funding gap formula: `max(0, annual_education_cost - existing_support)`.
   - Never hardcoded; always computed dynamically on the backend and previewed live on the frontend.
4. **Demo Student Seed**:
   - Seeded automatically on startup: **Arjun Kumar** (B.Tech Computer Science, 2nd Year, Demo Engineering College).
   - Baseline: Cost ₹1,20,000, Support ₹60,000, Remaining Funding Gap ₹60,000 (50.0% coverage).
5. **Backend API (FastAPI)**:
   - `GET /api/health`: Health status, DB connectivity, and trust principle.
   - `GET /api/v1/student/me`: Retrieves student personal, academic, and financial profile.
   - `PUT /api/v1/student/me`: Updates student details, validates numeric ranges, recalculates funding gap, and persists to SQLite.
   - `GET /api/v1/student/funding`: Provides real-time funding metrics and coverage percentage.
6. **Frontend Portal (Next.js 16 + Tailwind CSS + TypeScript)**:
   - Responsive layout with sidebar navigation: Dashboard, Discover, My Goal, Applications, Documents, AI Assistant, and Profile.
   - Dashboard displaying student summary, funding metric cards, funding progress bar, and the trust principle callout.
   - Profile page with real-time live funding-gap calculation as the student enters numbers, and persistent saving to the backend.

---

## 3. Technology Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4
- **Backend**: Python 3.14, FastAPI, SQLAlchemy 2.0, Pydantic v2, Uvicorn
- **Database**: SQLite (local development default; SQLAlchemy abstraction ready for PostgreSQL)
- **Validation**: Strict boundary checks (CGPA: 0.0–10.0, 12th: 0–100%, non-negative financial inputs)

---

## 4. Quick Start & Setup

### Prerequisites
- Node.js (v18+) & npm
- Python (v3.10+)

### Backend Setup
```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The API documentation is accessible at `http://127.0.0.1:8000/docs`.

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
The frontend application will be running at `http://localhost:3000`.

---

## 5. Running Tests

### Backend Unit & Integration Tests
```bash
python -m pytest backend/tests
```

### Frontend Typecheck & Build
```bash
cd frontend
npx tsc --noEmit
npm run build
```

### End-to-End Live Integration Test
```bash
python test_live_system.py
```

---

## 6. What Is Deferred to Later Phases

To preserve Phase 1 focus, the following capabilities are explicitly intentionally deferred:
- Advanced AI features & LLM APIs (Phase 3)
- Retrieval-Augmented Generation / RAG (Phase 3)
- Live web scraping of scholarship portals (Phase 2)
- Multi-user authentication & authorization (Phase 2)
- Push & email notifications (Phase 3)
- Document uploading & OCR file storage (Phase 3)
