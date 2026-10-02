import time
import json
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.ai_log import AIInteractionLog
from app.models.planner import PlannerGoal
from app.models.evidence import Evidence
from app.services.ai.tools import AIToolkit
from app.services.ai.provider import get_ai_provider, DemoAIProvider
from app.services.ai.prompt_guard import sanitize_untrusted_content
from app.schemas.assistant import ChatMessageRequest, ChatMessageResponse, ActionConfirmation

logger = logging.getLogger(__name__)


def process_assistant_chat(
    db: Session,
    student_id: int,
    request: ChatMessageRequest
) -> ChatMessageResponse:
    """
    Process conversational request to the SCHOLARAi Assistant.
    Utilizes controlled tools to gather live portfolio facts,
    applies prompt injection guard, enforces trust labeling,
    and handles action confirmations safely.
    """
    start_time = time.time()
    toolkit = AIToolkit(db=db, student_id=student_id)
    raw_message = sanitize_untrusted_content(request.message.strip())
    msg_lower = raw_message.lower()

    tools_used: List[str] = []
    sources_cited: List[str] = []
    pending_action: Optional[ActionConfirmation] = None

    # 1. Check if user is confirming a pending action
    if request.confirmed_action and request.confirmed_action.status == "CONFIRMED":
        action = request.confirmed_action
        if action.action_type == "UPDATE_WEEKLY_HOURS":
            new_hours = float(action.proposed_payload.get("hours", 5.0))
            goal = db.query(PlannerGoal).filter(PlannerGoal.student_id == student_id).first()
            if goal:
                goal.available_hours_per_week = new_hours
                db.commit()
                return ChatMessageResponse(
                    reply=f"Confirmed and updated. Your available weekly study/application hours have been set to {new_hours:g} hours per week.",
                    trust_category="FACTS FROM USER DATA",
                    sources_cited=["Student Planner Settings"],
                    tools_used=["update_planner_goal"],
                    model_provider="demo-rules-confirmed"
                )
        elif action.action_type == "VERIFY_EVIDENCE":
            ev_id = action.proposed_payload.get("evidence_id")
            ev = db.query(Evidence).filter(Evidence.id == ev_id, Evidence.student_id == student_id).first()
            if ev:
                ev.verification_status = "VERIFIED"
                db.commit()
                return ChatMessageResponse(
                    reply=f"Confirmed. Evidence record '{ev.title}' has been marked as VERIFIED upon your explicit approval.",
                    trust_category="FACTS FROM USER DATA",
                    sources_cited=["Student Evidence Bank"],
                    tools_used=["verify_evidence"],
                    model_provider="demo-rules-confirmed"
                )

    # 2. Check for action mutation requests requiring confirmation
    if "hour" in msg_lower and ("set" in msg_lower or "update" in msg_lower or "change" in msg_lower):
        # Look for numbers
        import re
        nums = re.findall(r"\b\d+(?:\.\d+)?\b", raw_message)
        if nums:
            val = float(nums[0])
            pending_action = ActionConfirmation(
                action_type="UPDATE_WEEKLY_HOURS",
                description=f"Update your weekly available application time to {val:g} hours?",
                proposed_payload={"hours": val},
                status="PENDING"
            )
            return ChatMessageResponse(
                reply=f"I detected a request to change your available weekly application hours to {val:g} hours.\n\nPer SCHOLARAi Trust Rules, student confirmation is required before modifying your planning portfolio.",
                trust_category="AI SUGGESTIONS",
                pending_action_confirmation=pending_action,
                tools_used=["detect_action_intent"],
                model_provider="demo-scholar-v1"
            )

    # 3. Intent Routing & Structured Response Formulation
    reply = ""
    trust_category = "AI ANALYSIS"
    suggested_prompts: List[str] = [
        "What should I do today?",
        "What is blocking my applications?",
        "Which scholarships should I focus on?",
        "How much funding am I pursuing?",
    ]

    if "block" in msg_lower or "document" in msg_lower:
        tools_used.extend(["find_application_blockers", "get_missing_documents"])
        blockers = toolkit.find_application_blockers()
        missing_docs = toolkit.get_missing_documents()
        
        if blockers:
            b = blockers[0]
            reply = (
                f"**Current Highest-Impact Shared Blocker:**\n\n"
                f"• **Document:** {b['document_name']}\n"
                f"• **Current Status:** Missing\n"
                f"• **Impact:** Directly blocks **{b['affected_application_count']} active applications** "
                f"({', '.join(b['affected_scholarship_names'])})\n"
                f"• **Potential Funding Affected:** ₹{b['potential_funding_affected']:,.0f}\n\n"
                f"**Why this matters:** Providing this one document unblocks all 3 applications simultaneously. "
                f"Head to the Documents page to update availability once obtained."
            )
            trust_category = "FACTS FROM USER DATA"
            sources_cited = ["Student Application & Document Registry"]
        elif missing_docs:
            doc_names = ", ".join(d["name"] for d in missing_docs)
            reply = f"You have {len(missing_docs)} missing document(s): {doc_names}."
            trust_category = "FACTS FROM USER DATA"
            sources_cited = ["Student Document Registry"]
        else:
            reply = "You currently have no missing documents or shared blockers blocking your active applications!"
            trust_category = "FACTS FROM USER DATA"

    elif "today" in msg_lower or "next" in msg_lower or "work on" in msg_lower or "action" in msg_lower:
        tools_used.extend(["get_next_best_actions", "find_application_blockers"])
        actions = toolkit.get_next_best_actions()
        if actions:
            top = actions[0]
            reply = (
                f"**Recommended Next Action:**\n\n"
                f"1. **{top.get('title', 'Action')}**\n"
                f"   • **Urgency:** {top.get('urgency', 'NORMAL')}\n"
                f"   • **Why:** {top.get('reason', '')}\n"
                f"   • **What it unblocks:** {top.get('blocker_impact', 'Progress toward submission')}\n"
                f"   • **Estimated Effort:** {top.get('effort_estimate', '1-2 hours')}\n"
                f"   • **Potential Funding Affected:** ₹{top.get('potential_funding_impact', 0):,.0f}\n\n"
            )
            if len(actions) > 1:
                second = actions[1]
                reply += f"2. **Secondary Priority:** {second.get('title')} ({second.get('effort_estimate')})\n\n"
            reply += "*(Recommendation ranked by deterministic deadline urgency, shared blocker impact, and funding coverage.)*"
            trust_category = "AI SUGGESTIONS"
            sources_cited = ["SCHOLARAi Deterministic Next-Best-Action Engine"]
        else:
            reply = "No pending actions found in your queue. You are in good shape!"
            trust_category = "AI ANALYSIS"

    elif "funding" in msg_lower or "gap" in msg_lower or "pursuing" in msg_lower:
        tools_used.extend(["get_user_funding_goal", "get_user_applications"])
        fg = toolkit.get_user_funding_goal()
        apps = toolkit.get_user_applications()
        pursued = sum(a["amount"] for a in apps if a["status"] not in ("REJECTED", "WITHDRAWN"))

        reply = (
            f"**Your Funding Summary:**\n\n"
            f"• **Annual Education Cost:** ₹{fg.get('annual_education_cost', 0):,.0f}\n"
            f"• **Existing Financial Support:** ₹{fg.get('existing_support', 0):,.0f}\n"
            f"• **Calculated Funding Gap:** **₹{fg.get('funding_gap', 0):,.0f}**\n"
            f"• **Potential Funding Under Pursuit:** ₹{pursued:,.0f} across {len(apps)} active application(s)\n\n"
            f"⚠️ *Trust Reminder: 'Potential funding pursued' reflects maximum award amounts if selected. "
            f"Official scholarship providers decide final awards; concurrent receipt rules may apply.*"
        )
        trust_category = "FACTS FROM USER DATA"
        sources_cited = ["Student Funding Profile (backend-calculated)"]

    elif "scholarship" in msg_lower or "focus" in msg_lower or "match" in msg_lower:
        tools_used.extend(["search_scholarships", "get_user_funding_goal"])
        scholarships = toolkit.search_scholarships(limit=4)
        s_list = []
        for s in scholarships:
            s_list.append(f"• **{s['name']}** ({s['provider']}) — ₹{s['amount']:,.0f} [Status: {s['verification_status']}]")
        
        reply = (
            f"**Top Potential Scholarships for Your Profile:**\n\n"
            + "\n".join(s_list) +
            f"\n\n**Guidance:**\n"
            f"Focus first on **CSR STEM Bursary** due to its urgent approaching deadline, followed by "
            f"**National Merit-cum-Means Scholarship** which covers 83% of your ₹60,000 funding gap."
        )
        trust_category = "OFFICIAL SOURCE INFORMATION"
        sources_cited = ["Demo Scholarship Catalog (DEMO DATA)"]

    elif "evidence" in msg_lower:
        tools_used.append("get_user_evidence")
        ev_items = toolkit.get_user_evidence()
        if ev_items:
            items_str = "\n".join(f"• **{e['title']}** ({e['category']}) — Source: {e['source_name']} [{e['verification_status']}]" for e in ev_items[:4])
            reply = f"**Available Reusable Evidence:**\n\n{items_str}\n\nYou can reuse these approved facts across personal statements and short answers without inventing credentials."
        else:
            reply = "No evidence items found in your Evidence Bank. Add projects, academic achievements, or leadership roles under the Evidence tab."
        trust_category = "FACTS FROM USER DATA"
        sources_cited = ["Student Evidence Bank"]

    else:
        # General question with knowledge retrieval
        tools_used.append("retrieve_scholarship_knowledge")
        chunks = toolkit.retrieve_scholarship_knowledge(raw_message)
        if chunks:
            top_chunk = chunks[0]
            reply = (
                f"Based on stored knowledge records:\n\n"
                f"\"{top_chunk['chunk_text']}\"\n\n"
                f"*(Section: {top_chunk['section']})*"
            )
            trust_category = "OFFICIAL SOURCE INFORMATION"
            sources_cited = [f"{top_chunk['source_name']} (Last verified: {top_chunk['last_verified_at']})"]
        else:
            reply = (
                f"I am SCHOLARAi Assistant. I can help coordinate your scholarship applications, "
                f"identify shared blockers, guide personal statement drafts using your Evidence Bank, "
                f"and calculate deadline risks.\n\n"
                f"What would you like to review: **Shared blockers**, **Next best actions**, or **Scholarship matches**?"
            )
            trust_category = "AI ANALYSIS"

    # 4. Audit Log Recording
    latency = int((time.time() - start_time) * 1000)
    try:
        log_entry = AIInteractionLog(
            student_id=student_id,
            request_type="chat",
            model_provider="demo-scholar-v1",
            tools_used=json.dumps(tools_used),
            sources_retrieved=json.dumps(sources_cited),
            response_status="SUCCESS",
            latency_ms=latency
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        logger.warning(f"Could not record AI interaction log: {e}")
        db.rollback()

    return ChatMessageResponse(
        reply=reply,
        trust_category=trust_category,
        sources_cited=sources_cited,
        suggested_prompts=suggested_prompts,
        pending_action_confirmation=pending_action,
        tools_used=tools_used,
        model_provider="demo-scholar-v1"
    )
