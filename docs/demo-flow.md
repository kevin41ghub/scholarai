# Demo Flow & Walkthrough — SCHOLARAi

**Current Status: Block 2 — Core Funding & Application Intelligence**

This document details the complete end-to-end demonstration flow illustrating the core value proposition of SCHOLARAi:

$$\text{DISCOVER} \longrightarrow \text{UNDERSTAND} \longrightarrow \text{PLAN} \longrightarrow \text{UNBLOCK} \longrightarrow \text{APPLY}$$

---

## 1. Demo Student Baseline Profile

The system initializes with the primary demo student:

| Field | Value |
|---|---|
| **Name** | Arjun Kumar |
| **Email** | `arjun.kumar@demo.edu` |
| **Course** | B.Tech Computer Science (2nd Year) |
| **Institution** | Demo Engineering College |
| **CGPA** | 8.4 / 10.0 |
| **12th Percentage** | 89.2% |
| **Category** | OBC |
| **Domicile State** | Karnataka |
| **Annual Education Cost** | ₹1,20,000 |
| **Existing Confirmed Aid** | ₹60,000 |
| **Remaining Funding Gap** | **₹60,000** |
| **Annual Family Income** | ₹2,40,000 |

*Notice:* All scholarships are **DEMO DATA** and clearly labeled as such.

---

## 2. Coherent Demo Walkthrough

### Step 1: Open Dashboard (`http://localhost:3000`)
1. **Funding Need Overview**:
   - Annual Cost: ₹1,20,000
   - Existing Support: ₹60,000
   - **Remaining Funding Gap: ₹60,000** (calculated dynamically: $\max(0, 120000 - 60000)$)
   - Progress Bar: 50.0% covered.
2. **Application Portfolio Summary**:
   - 3 Active Applications in pipeline.
   - 1 Application at Urgent Deadline Risk (CSR STEM Bursary, 4 days remaining).
   - 3 Applications Blocked by missing document.
   - Potential Funding Under Pursuit: **₹1,35,000**.
3. **Shared Blocker Alert**:
   - Prominently warns: *"Shared Blocker Detected — Income Certificate"*
   - Informs student: *"Currently missing and blocking 3 active applications (CSR STEM Bursary, National Merit-cum-Means, State Welfare Fellowship). Potential Funding Affected: ₹1,35,000."*
4. **Next Best Action Card**:
   - Recommends: *"Provide Income Certificate (Shared Blocker) — Required by 3 applications. Resolving this unblocks ₹1,35,000 of potential funding."*

---

### Step 2: Discover Scholarships (`http://localhost:3000/discover`)
1. View 8 diverse demo scholarships.
2. Observe deterministic match badges:
   - **National Merit-cum-Means (₹50,000)**: `Likely Eligible` (CGPA 8.4 $\ge$ 7.0, Income ₹2.4L $\le$ ₹2.5L, 12th 89.2% $\ge$ 75%).
   - **NextGen Technology Grant (₹40,000)**: `Likely Eligible` (B.Tech CS, CGPA 8.4 $\ge$ 8.0).
   - **CSR STEM Bursary (₹60,000)**: `Likely Eligible` + `Urgent: 4d left`.
   - **PG Excellence Fellowship (₹80,000)**: `Ineligible` (Restricted to Postgraduate scholars).
   - **Women in Technology Scholarship (₹75,000)**: `Ineligible` (Restricted to female applicants).
   - **Regional Student Stipend (₹35,000)**: `Needs Verification` (Municipal ward certificate needed).
3. Filter by `Likely Eligible Only` or sort by `Highest Amount`.
4. Read *"Why this may fit"* transparent bullets under each card.

---

### Step 3: Inspect Potential Funding Impact (`/discover/1`)
1. Click on **National Merit-cum-Means Scholarship**.
2. Examine the **Potential Funding Impact** box:
   - Current Funding Gap: ₹60,000
   - Scholarship Award: ₹50,000
   - **Potential Remaining Gap: ₹10,000**
   - Coverage: ~83% of current educational gap.
   - Explicit disclaimer: *"Potential funding impact only. Does not assume receipt of award. Awards are determined exclusively by official providers."*

---

### Step 4: Examine Applications Tracker (`http://localhost:3000/applications`)
1. View the 3 active applications in progress:
   - National Merit-cum-Means (₹50,000, 67% ready)
   - CSR STEM Bursary (₹60,000, 67% ready, Urgent: 4d left)
   - State Welfare Fellowship (₹25,000, 67% ready)
2. Expand the **CSR STEM Bursary** checklist:
   - Marksheet $\rightarrow$ `AVAILABLE` (green dot)
   - Bonafide Certificate $\rightarrow$ `AVAILABLE` (green dot)
   - Income Certificate $\rightarrow$ `MISSING` (orange blocker)
3. Notice that all 3 applications are held back by the exact same missing document.

---

### Step 5: Resolve Shared Blocker with Cascade Unblocking (`http://localhost:3000/documents`)
1. Navigate to **Documents**.
2. Notice the prominent **High-Impact Shared Blockers** card:
   - *"Income Certificate (Tehsildar Issued)"*
   - Blocks: 3 active applications.
   - Potential funding affected: ₹1,35,000.
3. Click **"Mark as Available"** on the Income Certificate card.
4. **Observe the Instant Cascade Propagation**:
   - A success banner appears: *"Updated Income Certificate to AVAILABLE. Cascade unblocking evaluated for dependent applications!"*
   - The shared blocker disappears from the blocker banner.
5. Return to **Applications** (`/applications`):
   - All 3 applications now show **100% Readiness**!
   - Status automatically transitioned from `IN_PROGRESS` to **`READY`**!
   - Blockers count drops to 0!
6. Return to **Dashboard** (`/`):
   - Blocked applications count is now **0**.
   - Next Best Action dynamically updates to: **"Review & Submit CSR STEM Bursary"** (because its deadline is in 4 days and it is now 100% ready)!

---

### Step 6: Plan Weekly Time Allocation & Strategy (`http://localhost:3000/goal`)
1. Navigate to **My Goal**.
2. Inspect the **Target vs. Pipeline Analysis**:
   - Funding Gap: ₹60,000
   - Potential Funding Identified: ₹1,35,000 (across 3 active applications)
   - Potential Remaining Gap: ₹0
3. Inspect the **Suggested Weekly Plan**:
   - Out of 5.0 available preparation hours this week:
     - 1.5 hrs $\rightarrow$ CSR STEM Bursary finalization
     - 1.5 hrs $\rightarrow$ National Merit application review
     - 1.5 hrs $\rightarrow$ State Welfare Fellowship review
     - 0.5 hrs $\rightarrow$ Strategy and discovery review
4. Adjust the hours slider to **8 hours** and click **Update Weekly Plan** to see immediate re-allocation.
5. Review the **Funding Strategy & Award Compliance** section:
   - Read the 3 critical distinctions: `CAN APPLY` vs `CAN RECEIVE` vs `CAN HOLD CONCURRENTLY`.
   - Read the compliance warning: *"Concurrent award rule: Needs verification. Official awarding guidelines determine whether multiple awards may be held simultaneously."*

---

## 3. Automated Regression Verification

To verify all scenarios programmatically:
```bash
python test_live_block2.py
```
This runs 14 automated assertions covering health, baseline funding gap, discovery filtering, deterministic eligibility rules, funding impact, shared blocker detection, cascade unblocking, and frontend HTTP rendering.
