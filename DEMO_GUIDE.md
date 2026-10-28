# SCHOLARAi — Complete Demonstration & Evaluation Guide

**Platform Title:** SCHOLARAi — Student Funding & Application Intelligence Platform
**Evaluation Stage:** Complete, Hardened, Production-Ready
**Trust Principle:** *"AI assists. Official sources decide. Student approves."*

---

## 1. Quick Start & Environment Setup

### Prerequisites
- **Python 3.11+** (tested and verified with Python 3.14.3)
- **Node.js 18+** / npm (tested with Next.js 16.3.8)
- Windows / Linux / macOS compatible

### Step 1: Backend Setup
1. Open a terminal in the project root:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
2. Check environment configuration:
   A default template is provided in `backend/.env.example`. For local testing, default SQLite (`sqlite:///./scholarai.db`) and `AI_PROVIDER="demo"` work immediately without external API keys.
3. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The backend will automatically initialize the database, execute safe schema migrations, and idempotently synchronize all 11 verified Tamil Nadu scholarship dossiers.*
   - API Docs: `http://localhost:8000/docs`
   - Health Check: `http://localhost:8000/api/health`

### Step 2: Frontend Setup
1. Open a second terminal:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Next.js development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser.

---

## 2. Seeded Demonstration Credentials

| Role | Email | Password | Student Persona / Purpose |
|---|---|---|---|
| **Student** | `demo@scholarai.local` | `DemoStudent@2026` | **Arjun Kumar** (2nd Year B.Sc Computer Science, Loyola College Autonomous Chennai, BC Category, Day Scholar, Government Quota). |
| **Administrator** | *(CLI / REST API)* | Executed via CLI with `--admin-email` or Bearer token | Authorized state scholarship administrator for catalogue imports. |

---

## 3. Step-by-Step Evaluator Walkthrough

### Step 1: Authentication & Adaptive Dashboard (`/login` & `/`)
1. Visit `http://localhost:3000/login`.
2. Click the quick button **"Fill Demo Credentials (Arjun Kumar)"**, then click **"Sign In"**.
3. Observe:
   - Signed HttpOnly session cookie is established.
   - Redirects to `/` (Adaptive Dashboard).
   - Real-time display of **Confirmed Funding** (₹0), **Target Funding** (₹65,000), and remaining **Funding Gap** (₹65,000).
   - Active Next-Best-Action recommendations ranked deterministically by urgency and funding impact.

---

### Step 2: Student Profile & Deterministic Attributes (`/profile`)
1. Click **Profile** in the global navigation bar.
2. Observe the Tamil Nadu higher education attributes:
   - **Admission Quota**: `GOVERNMENT_QUOTA` (Single-Window / DCE allocation).
   - **Residential Status**: `DAY_SCHOLAR`.
   - **First Graduate in Family**: Declared state.
3. Edit an attribute (e.g. switch to `HOSTELLER`) and click **"Save Profile"**.
4. Observe the instantaneous recalculation of hostel-dependent scholarship criteria.

---

### Step 3: Discover Scholarships & Official Source Dossier (`/discover` & `/discover/[id]`)
1. Click **Discover** in the navigation bar.
2. Filter by stream (**Arts & Science** vs **Engineering**) or category (**Government Scholarships**).
3. Click on **Post-Matric Scholarship for SC/ST/SCA Students** or **Post-Matric Scholarship for BC, MBC & DNC Students**.
4. Scroll to the **"Official Verification & Source Dossier"** section:
   - Notice the **Source Authority** badge (`OFFICIAL GOVERNMENT PORTAL`).
   - Notice the **Official Source URL** link (`https://tndce.tn.gov.in/...` or `https://bcmbcmw.tn.gov.in/...`).
   - Notice the **Last Verified Timestamp** and **Official Excerpts** with section citations.
   - Observe that non-verified or demo opportunities clearly display *"No authoritative excerpts have been verified for this scheme yet"* rather than fabricating evidence.

---

### Step 4: Application Checklist & In-Checklist Upload Modal (`/applications`)
1. Click **Applications** in the navigation bar.
2. View active applications (e.g., *Post-Matric Scholarship for BC, MBC & DNC Students*).
3. Under the **Missing Documents Checklist**:
   - Locate a missing requirement (e.g., **Income Certificate**).
   - Click the blue **"Upload File"** button beside the missing requirement.
4. An interactive **Quick Upload Modal** appears:
   - Category is **automatically selected** to match the requirement (`INCOME_CERTIFICATE`).
   - Select a sample PDF, PNG, or JPEG file (< 5MB) and click **"Upload & Verify"**.
5. Upon successful upload:
   - The checklist instantly marks the item **AVAILABLE / VERIFIED**.
   - The application progress bar recalculates in real-time.
   - The shared-blocker engine updates across all applications requiring this certificate.

---

### Step 5: Shared Blockers & Dependency Cascade (`/documents`)
1. Click **Documents** in the navigation bar.
2. Observe the **Cross-Scholarship Dependency Graph**:
   - Top banner highlights the **Primary Shared Blocker**.
   - Calculates total potential funding at risk across multiple schemes.
   - Displays all uploaded files with cryptographic SHA-256 hashes and storage keys.

---

### Step 6: Verified Evidence Bank & AI Grounded Drafting (`/evidence` & `/applications`)
1. Click **Evidence** in the navigation bar to inspect the student's reusable verified credentials.
2. Navigate back to **Applications** and click **"AI Assistant"** on an application card:
   - Click **"Draft Answer from Evidence"**: The AI synthesizes a draft strictly referencing approved student assets.
   - Click **"Check Claims"**: Paste an unverified claim (e.g., *"I was the CEO of an autonomous research institute"*). The engine highlights the assertion as `UNSUPPORTED CLAIM` because it cannot be corroborated by Evidence Bank records.
   - Observe the **Student Approves** safeguard: the draft is never submitted until the student clicks `[Approve Draft]`.

---

### Step 7: Conversational AI Assistant & Action Confirmation Safeguard (`/assistant`)
1. Click **AI Assistant** in the navigation bar.
2. Type: *"Update my weekly available study time to 8 hours"*.
3. Observe the **Action Confirmation Safeguard**:
   - The assistant does **not** silently mutate the database.
   - It renders an interactive **Action Confirmation Card**:
     - *"Update your weekly available application time to 8 hours?"*
     - Buttons: `[Confirm Update]` | `[Cancel]`
   - Clicking Confirm safely updates the database and reflects in the Goal Planner.

---

### Step 8: Administrative Scholarship Import & Refresh CLI
1. Open a terminal and run a dry-run import simulation:
   ```bash
   python scripts/import_verified_scholarships.py --file scripts/sample_import.json --dry-run
   ```
2. Observe the detailed itemized table:
   - Displays action (`WOULD_CREATE` / `WOULD_UPDATE`).
   - Shows official government domain detection (`[Official Gov Domain]`).
   - Validates that non-government sources are automatically demoted to `PARTIALLY_VERIFIED`.
   - Confirms that zero database changes are written during dry run.

---

## 4. Troubleshooting & FAQ

- **Port already in use:**
  - Backend: Run on another port if needed: `uvicorn app.main:app --port 8001`. Update `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8001`.
  - Frontend: Run `npm run dev -- -p 3001` if port 3000 is occupied.
- **Node.js / npm execution policy on Windows:**
  - If PowerShell gives script execution warnings on `npm`, prefix commands with `cmd /c` (e.g., `cmd /c npm run dev`).
- **AI Provider Selection:**
  - To test live Gemini integration, add `AI_PROVIDER="gemini"` and `AI_API_KEY="your-gemini-key"` to `backend/.env`.
  - If no key is provided, the platform automatically runs on `AI_PROVIDER="demo"`, which provides 100% deterministic test coverage offline.
