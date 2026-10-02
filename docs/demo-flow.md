# Demo Flow & Walkthrough — SCHOLARAi

**Current Status: Block 3 — Advanced AI, Evidence, RAG & Adaptive Intelligence**

This document details the complete end-to-end demonstration flow illustrating the core value proposition of SCHOLARAi Block 3:

$$\text{DISCOVER} \longrightarrow \text{EVIDENCE BANK} \longrightarrow \text{AI ASSIST} \longrightarrow \text{ADAPTIVE PLAN} \longrightarrow \text{APPROVE}$$

Trust Principle: **"AI assists. Official sources decide. Student approves."**

---

## 1. Demo Student Baseline & Credentials

The system provides a pre-configured local demo account linked to Arjun Kumar:

| Field | Value |
|---|---|
| **Demo Email** | `demo@scholarai.local` |
| **Demo Password** | `DemoStudent@2026` |
| **Name** | Arjun Kumar |
| **Course** | B.Tech Computer Science (2nd Year) |
| **Institution** | Demo Engineering College |
| **CGPA** | 8.4 / 10.0 (Verified) |
| **12th Percentage** | 89.2% (Verified) |
| **Annual Education Cost** | ₹1,20,000 |
| **Existing Confirmed Aid** | ₹60,000 |
| **Remaining Funding Gap** | **₹60,000** |
| **Annual Family Income** | ₹2,40,000 |

*Notice:* All scholarship catalog entries and knowledge sources are **DEMO DATA** and clearly labeled. AI responses are generated in **DEMO AI MODE** if no external LLM API key is configured.

---

## 2. Block 3 Coherent Walkthrough

### Step 1: Secure Authentication (`http://localhost:3000/login`)
1. Navigate to `/login`.
2. Click the quick button: **"Fill Demo Credentials (Arjun Kumar)"**.
3. Click **"Sign In"**.
4. The backend securely hashes passwords with PBKDF2-HMAC-SHA256 (600,000 rounds) and sets a signed `scholarai_session` HttpOnly cookie.
5. You are redirected to the **Adaptive Dashboard** (`/`). Notice the user menu in the header displaying *"Arjun Kumar (demo@scholarai.local)"*.

---

### Step 2: Explore the Verified Evidence Bank (`http://localhost:3000/evidence`)
1. Click **Evidence** in the navigation bar.
2. View the student's reusable asset library:
   - **Academic**: `CGPA 8.4 in B.Tech CS` (Source: Student Profile, Status: `VERIFIED`).
   - **Project**: `Full-Stack Scholarship Management Platform` (Source: User Provided, Status: `USER_PROVIDED`).
   - **Academic**: `Higher Secondary Certificate (89.2%)` (Source: Academic Marksheet, Status: `VERIFIED`).
3. Click **"Add Evidence"** to create a new reusable asset (e.g. *Leadership: Open Source Club Organizer*).
4. Verify that the AI never silently edits or invents evidence — changes require explicit student submission.

---

### Step 3: Conversational AI Assistant & Portfolio Grounding (`http://localhost:3000/assistant`)
1. Click **AI Assistant** in the navigation bar.
2. Observe the clear trust disclaimer banner:
   - *"Trust Principle: AI assists. Official sources decide. Student approves. AI-generated suggestions are grounded in your stored profile."*
3. Click the suggested prompt: **"What should I do next?"** or **"What is blocking my applications?"**.
4. Observe the Assistant's response:
   - Cites your actual funding gap (**₹60,000**).
   - Identifies the urgent deadline risk (**CSR STEM Bursary, 4 days remaining**).
   - Flags the shared blocker (**Income Certificate** affecting 3 applications).
   - Displays clear labels: `FACTS FROM USER DATA` vs `AI-ASSISTED RECOMMENDATION`.
5. Test the **Action Confirmation Safeguard**:
   - Ask: *"Update my weekly study hours to 8 hours."*
   - Notice the assistant does **not** silently mutate the database. It renders an **Interactive Action Card**:
     - *"Would you like me to update your weekly preparation hours to 8.0 hrs?"*
     - Buttons: `[Confirm Update]` | `[Cancel]`
   - Clicking Confirm safely persists the change.

---

### Step 4: AI Application Assistance & Evidence Grounding (`http://localhost:3000/applications`)
1. Navigate to **Applications**.
2. Click **"AI Assistant"** on the **National Merit-cum-Means Scholarship** card.
3. The drawer opens with three capabilities:
   - **Draft Grounded Answer**: Click **"Draft Answer from Evidence"**.
     - The AI retrieves approved evidence from the Evidence Bank (e.g. *Full-Stack Project*).
     - Synthesizes a structured draft with explicit badge: `AI GENERATED DRAFT`.
     - Cites evidence used: `Full-Stack Scholarship Management Platform`.
     - Prompts student: *"Approve draft to save as your working answer."*
   - **Unsupported Claim Detection**:
     - Paste a text containing an unverified claim: *"I led a 50-person engineering department at Google."*
     - Click **"Check Claims"**.
     - The engine highlights: `UNSUPPORTED CLAIM` — *"Please verify or remove this statement as it cannot be corroborated with your stored evidence."*
   - **Student Approval Required**:
     - Drafts are never submitted to scholarship providers. Student must click `[Approve Draft]` or edit manually.

---

### Step 5: Scholarship Change Monitoring & Notifications
1. Observe the **Notification Bell** icon in the global header.
2. Click the bell to open the **Notification Center**:
   - Displays unread notifications with urgency badges:
     - `URGENT` / `DEADLINE`: *"Urgent: CSR STEM Bursary deadline is approaching in 4 days."*
     - `HIGH` / `DOCUMENT`: *"Shared Blocker: Income Certificate is required by 3 applications."*
     - `INFO` / `SYSTEM`: *"Block 3 Intelligence Layer active in Demo AI Mode."*
3. Test Change Monitoring:
   - Call `/api/v1/monitoring/check` to simulate a source change (e.g. CSR STEM Bursary deadline moved earlier).
   - The system detects the content hash change, classifies severity as `HIGH`, and triggers a targeted notification.

---

### Step 6: Adaptive Planning on Rejection or Approval
1. Open **My Goal** (`/goal`).
2. Current state:
   - Active Applications: 3
   - Potential Funding Under Pursuit: ₹1,35,000
   - Funding Gap: ₹60,000
3. If an application status transitions to `REJECTED`:
   - Potential funding from that application immediately drops to **₹0**.
   - The remaining gap is recalculated to ensure no shortfall is masked.
   - The weekly allocation dynamically reassigns preparation hours to viable alternatives.
4. If an application is `APPROVED`:
   - Award amount is logged.
   - Concurrent award rule check warns: *"Concurrent holding eligibility requires official verification."*

---

### Step 7: Voice Decoder with Mandatory Confirmation
1. In `/assistant`, click the **Microphone (Voice)** button.
2. The Voice Decoder modal opens supporting speech/text in:
   - **English**: *"I need around sixty thousand rupees for my fees."*
   - **Tamil**: *"எனக்கு அறுபதாயிரம் ரூபாய் உதவித்தொகை தேவை"*
   - **Tanglish**: *"Enakku fees ku 60000 theva paduthu."*
3. Submit the voice phrase.
4. The decoder extracts the structured intent:
   - Extracted Intent: `funding_goal`
   - Parameters: `{"amount": 60000}`
5. The safeguard displays:
   - *"You said: 'Enakku fees ku 60000 theva paduthu.' Interpreted intent: Set funding goal to ₹60,000. Is this correct?"*
   - Buttons: `[Confirm & Apply]` | `[Edit Phrase]` | `[Cancel]`
   - Nothing is applied until the student clicks Confirm!

---

## 3. Automated End-to-End Test Suite

Run all test suites locally:

```powershell
# 1. Unit & Regression Tests (Pytest)
python -m pytest tests -v

# 2. Block 2 Live Regression Suite (14 tests)
python test_live_block2.py

# 3. Block 3 Live Integration Suite (16 tests)
python test_live_block3.py

# 4. Frontend Typecheck & Build
cd frontend
npx.cmd tsc --noEmit
npm.cmd run build
```
