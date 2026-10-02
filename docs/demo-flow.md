# Demo Flow & Walkthrough — SCHOLARAi

**Current Phase: Phase 1 — Foundation**

This document walks through verifying and demonstrating the features implemented in Phase 1.

---

## 1. Demo Student Baseline

On initial database setup, SCHOLARAi seeds the primary demo student:

| Attribute | Baseline Value |
|---|---|
| **Name** | Arjun Kumar |
| **Email** | `arjun.kumar@demo.edu` |
| **Phone** | `+91 98765 43210` |
| **Institution** | Demo Engineering College |
| **Course** | B.Tech Computer Science |
| **Year** | 2nd Year |
| **CGPA** | 8.4 / 10.0 |
| **12th Percentage** | 89.2% |
| **Category** | OBC |
| **State** | Karnataka |
| **Annual Education Cost** | ₹1,20,000 |
| **Existing Support** | ₹60,000 |
| **Calculated Funding Gap** | **₹60,000** |
| **Funding Progress** | **50.0%** |
| **Annual Family Income** | ₹2,40,000 |

---

## 2. Step-by-Step Demo Flow

### Step 1: Verify API Health
Open a browser or terminal and request the health endpoint:
```bash
curl http://127.0.0.1:8000/api/health
```
**Expected Response:**
```json
{
  "status": "healthy",
  "service": "SCHOLARAi API",
  "version": "0.1.0",
  "phase": "Phase 1 — Foundation",
  "environment": "development",
  "database": "connected",
  "trust_principle": "AI assists. Official sources decide. Student approves."
}
```

### Step 2: Open Student Dashboard
1. Navigate to `http://localhost:3000` in your web browser.
2. Observe:
   - Platform branding: **SCHOLARAi — Student Funding & Application Intelligence**.
   - Prominent Trust Principle: *"AI assists. Official sources decide. Student approves."*
   - Clear disclosure: *"SCHOLARAi does not claim guaranteed eligibility or scholarship awards."*
   - Student Summary card displaying Arjun Kumar's academic details.
   - Funding Need Overview displaying 4 metric cards:
     - **Annual Education Cost:** ₹1,20,000
     - **Existing Support:** ₹60,000
     - **Remaining Funding Gap:** ₹60,000
     - **Annual Family Income:** ₹2,40,000
   - Funding progress visual bar showing 50.0% covered.

### Step 3: Test Dynamic Calculation on Profile Page
1. Click **"Edit Profile"** in the top header or click **"Profile"** in the navigation menu (`http://localhost:3000/profile`).
2. Notice all fields are pre-populated with Arjun Kumar's data.
3. Scroll to **Section 3: Financial Details**.
4. In the **Annual Education Cost** field, change the value from `120000` to `150000`.
   - **Immediately observe the Live Funding Gap Preview box:**
   - The preview updates without page reload or lag:
     - Annual Cost: ₹1,50,000
     - Existing Support: ₹60,000
     - **Calculated Funding Gap: ₹90,000**
     - Coverage Ratio: 40.0%
5. Now change **Existing Support** to `75000`.
   - The preview updates immediately:
     - **Calculated Funding Gap: ₹75,000**
     - Coverage Ratio: 50.0%

### Step 4: Verify Persistence to SQLite Database
1. Click **"Save & Update Profile"**.
2. Notice the green success banner:
   > *"Profile and funding details successfully saved to database!"*
3. Click **"&larr; Back to Dashboard"** (`http://localhost:3000`).
4. Notice that the Dashboard metrics now reflect the updated values persisted in the database.
5. In your terminal, verify that querying the backend returns the updated values:
   ```bash
   curl http://127.0.0.1:8000/api/v1/student/me
   ```

### Step 5: Test Boundary Validations
1. Return to `http://localhost:3000/profile`.
2. Try setting **Current CGPA** to `11.5` and submit.
   - Client error banner: *"CGPA must be a valid number between 0.0 and 10.0."*
3. Try setting **12th Percentage** to `110%` and submit.
   - Client error banner: *"12th percentage must be a valid number between 0.0% and 100.0%."*
4. The backend API also rejects any out-of-range payload with HTTP 422 Unprocessable Entity.

---

## 3. Automated Verification Script

To run the complete automated end-to-end verification suite:
```bash
python test_live_system.py
```
This tests:
1. `/api/health`
2. `GET /api/v1/student/me`
3. `GET /api/v1/student/funding`
4. `PUT /api/v1/student/me`
5. Database round-trip persistence
6. Resetting demo student state
7. Frontend HTTP 200 responses on `/` and `/profile`.
