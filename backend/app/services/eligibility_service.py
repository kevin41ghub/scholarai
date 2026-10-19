from typing import Dict, Any, List
from app.models.student import Student
from app.models.scholarship import Scholarship
from app.models.eligibility_rule import EligibilityRule


class EligibilityService:
    @staticmethod
    def evaluate_scholarship(student: Student, scholarship: Scholarship) -> Dict[str, Any]:
        """
        Deterministic scholarship eligibility evaluation.
        Never guarantees eligibility or awards.
        Returns:
            status: 'eligible' | 'possibly_eligible' | 'ineligible' | 'needs_verification'
            score: float (0.0 to 100.0)
            reasons: list of detailed explanation strings
            matched_rules: list of matched criteria descriptions
            unmatched_rules: list of failed criteria descriptions
            verification_notes: list of items needing verification
        """
        profile = student.profile
        funding = student.funding_profile

        if not profile or not funding:
            return {
                "status": "needs_verification",
                "score": 0.0,
                "reasons": ["Student profile or funding details are incomplete."],
                "matched_rules": [],
                "unmatched_rules": [],
                "verification_notes": ["Complete your profile to determine eligibility."],
            }

        if scholarship.status == "INACTIVE" or scholarship.verification_status == "RETIRED_DEMO":
            return {
                "status": "ineligible",
                "score": 0.0,
                "reasons": ["This scholarship record has been retired from active funding cycles."],
                "matched_rules": [],
                "unmatched_rules": ["Scheme is inactive or retired"],
                "verification_notes": ["No active applications can be accepted for this scheme."],
            }

        rules: List[EligibilityRule] = scholarship.eligibility_rules
        if not rules:
            return {
                "status": "possibly_eligible",
                "score": 75.0,
                "reasons": ["No restrictive eligibility rules specified in demo record."],
                "matched_rules": ["General student body"],
                "unmatched_rules": [],
                "verification_notes": ["Check official provider guidelines for unstated requirements."],
            }

        matched = []
        unmatched = []
        needs_verif = []
        is_hard_ineligible = False

        cgpa = float(profile.cgpa or 0.0)
        twelfth = float(profile.twelfth_percentage or 0.0)
        income = float(funding.annual_family_income or 0.0)
        course = (profile.course or "").lower()
        year = (profile.year or "").lower()
        state = (profile.state or "").lower()
        category = (profile.category or "").lower()
        gender = (getattr(profile, "gender", "Male") or "Male").lower()

        # Tamil Nadu Stream Check
        is_engineering = any(kw in course for kw in ["b.e", "b.tech", "engineering", "m.tech", "m.e"])
        is_arts_science = any(kw in course for kw in ["b.sc", "b.a", "b.com", "bca", "bba", "m.sc", "m.a", "arts", "science", "commerce", "humanities"])

        if scholarship.stream == "ARTS_SCIENCE" and is_engineering and not is_arts_science:
            unmatched.append("Scheme is designated exclusively for Arts & Science programs; student profile indicates Engineering.")
            is_hard_ineligible = True
        elif scholarship.stream == "ENGINEERING" and is_arts_science and not is_engineering:
            unmatched.append("Scheme is designated exclusively for Engineering programs (B.E./B.Tech); student profile indicates Arts & Science.")
            is_hard_ineligible = True
        elif scholarship.stream in ["ARTS_SCIENCE", "ENGINEERING", "BOTH"]:
            matched.append(f"Program matches stream requirement ({scholarship.stream})")

        # Study Level Check (UG vs PG)
        is_pg = any(kw in course or kw in year for kw in ["pg", "postgraduate", "master", "m.tech", "m.sc", "m.a", "m.e", "ph.d", "phd"])
        if scholarship.study_level == "PG" and not is_pg:
            unmatched.append("Scheme is restricted to Postgraduate (PG) students; student profile indicates undergraduate standing.")
            is_hard_ineligible = True
        elif scholarship.study_level == "UG" and is_pg:
            unmatched.append("Scheme is restricted to Undergraduate (UG) students; student profile indicates postgraduate standing.")
            is_hard_ineligible = True
        elif scholarship.study_level in ["UG", "PG", "BOTH"]:
            matched.append(f"Academic level satisfies scheme requirement ({scholarship.study_level})")

        # Tamil Nadu Residency Requirement
        tn_req_val = getattr(scholarship, "tn_residency_required", False)
        is_tn_residency_mandatory = tn_req_val in [True, "YES", "yes", "True", "true", "1", 1]
        if is_tn_residency_mandatory:
            if state in ["tamil nadu", "tamilnadu", "tn"]:
                matched.append("Tamil Nadu state domicile verified.")
            else:
                unmatched.append(f"Tamil Nadu residency/domicile is strictly required; student profile indicates '{profile.state or 'Not Provided'}'.")
                is_hard_ineligible = True

        # Autonomous College Compatibility Context & Caveats (Informational)
        context_notes = []
        if getattr(scholarship, "autonomous_compatibility", None):
            context_notes.append(f"Autonomous College Policy: {scholarship.autonomous_compatibility}")
        if getattr(scholarship, "unresolved_questions", None):
            context_notes.append(f"Provider Verification Requirement: {scholarship.unresolved_questions}")

        for rule in rules:
            rtype = rule.rule_type.upper()
            cval = rule.criteria_value.strip()
            desc = rule.description

            if rtype == "MIN_CGPA":
                try:
                    req_cgpa = float(cval)
                    if cgpa >= req_cgpa:
                        matched.append(f"CGPA {cgpa:.2f} satisfies minimum requirement of {req_cgpa:.2f}")
                    else:
                        unmatched.append(f"CGPA {cgpa:.2f} is below minimum requirement of {req_cgpa:.2f}")
                        is_hard_ineligible = True
                except ValueError:
                    needs_verif.append(f"Could not parse CGPA requirement: {cval}")

            elif rtype == "MAX_INCOME":
                try:
                    req_income = float(cval)
                    if income <= req_income:
                        matched.append(f"Annual family income ₹{int(income):,} is within statutory limit of ₹{int(req_income):,}")
                    else:
                        unmatched.append(f"Annual family income ₹{int(income):,} exceeds statutory ceiling of ₹{int(req_income):,}")
                        is_hard_ineligible = True
                except ValueError:
                    needs_verif.append(f"Could not parse income limit: {cval}")

            elif rtype == "MIN_12TH_PERCENTAGE":
                try:
                    req_12th = float(cval)
                    if twelfth >= req_12th:
                        matched.append(f"12th score {twelfth:.1f}% meets minimum requirement of {req_12th:.1f}%")
                    else:
                        unmatched.append(f"12th score {twelfth:.1f}% is below minimum requirement of {req_12th:.1f}%")
                        is_hard_ineligible = True
                except ValueError:
                    needs_verif.append(f"Could not parse 12th percentage: {cval}")

            elif rtype == "COURSE":
                # Check degree level or course field
                allowed_courses = [c.strip().lower() for c in cval.split(",")]
                if any(ac in course for ac in allowed_courses):
                    matched.append(f"Course '{profile.course}' matches eligible programs ({cval})")
                else:
                    unmatched.append(f"Course '{profile.course}' does not match required program ({cval})")
                    is_hard_ineligible = True

            elif rtype == "YEAR":
                if cval.lower() in year or year in cval.lower():
                    matched.append(f"Academic year '{profile.year}' satisfies eligibility")
                else:
                    unmatched.append(f"Academic year '{profile.year}' does not match requirement ({cval})")
                    is_hard_ineligible = True

            elif rtype == "STATE":
                if cval.lower() == state or (cval.lower() == "tamil nadu" and state in ["tamil nadu", "tamilnadu", "tn"]):
                    matched.append(f"Domicile state '{profile.state}' matches requirement")
                else:
                    unmatched.append(f"Domicile state '{profile.state}' does not match requirement ({cval})")
                    is_hard_ineligible = True

            elif rtype == "CATEGORY":
                if cval.lower() == "needs verification":
                    needs_verif.append(desc)
                else:
                    allowed_cats = [c.strip().lower() for c in cval.split(",")]
                    # Map common category abbreviations
                    cat_synonyms = {
                        "bc": ["bc", "obc", "backward classes"],
                        "mbc": ["mbc", "most backward classes", "dnc"],
                        "sc": ["sc", "scheduled caste", "sca"],
                        "st": ["st", "scheduled tribe"],
                    }
                    expanded_allowed = set(allowed_cats)
                    for cat_key in allowed_cats:
                        if cat_key in cat_synonyms:
                            expanded_allowed.update(cat_synonyms[cat_key])

                    if category in expanded_allowed:
                        matched.append(f"Reservation category '{profile.category}' satisfies eligibility")
                    else:
                        unmatched.append(f"Reservation category '{profile.category}' not in eligible list ({cval})")
                        is_hard_ineligible = True

            elif rtype == "GENDER":
                if cval.lower() == gender:
                    matched.append(f"Applicant gender matches scheme restriction ({cval})")
                else:
                    unmatched.append(f"Scheme restricted to {cval} applicants only; student profile indicates {profile.gender or 'Male'}")
                    is_hard_ineligible = True

            else:
                needs_verif.append(f"Special criteria: {desc}")

        # Determine overall evaluation status
        if is_hard_ineligible:
            status = "ineligible"
            score = 15.0
        elif needs_verif or scholarship.verification_status == "NEEDS_VERIFICATION":
            status = "needs_verification"
            score = 65.0
        elif len(unmatched) == 0:
            status = "eligible"
            score = 95.0
        else:
            status = "possibly_eligible"
            score = 50.0

        all_notes = needs_verif + context_notes
        all_reasons = []
        if status == "eligible":
            all_reasons.append("Likely eligible based on your provided profile attributes.")
            all_reasons.extend(matched)
        elif status == "ineligible":
            all_reasons.append("Ineligible based on deterministic profile criteria.")
            all_reasons.extend(unmatched)
        elif status == "needs_verification":
            all_reasons.append("Potential fit, but specific document/eligibility requirements need verification.")
            all_reasons.extend(needs_verif)
            all_reasons.extend(matched)
        else:
            all_reasons.extend(matched)
            all_reasons.extend(unmatched)

        return {
            "status": status,
            "score": score,
            "reasons": all_reasons,
            "matched_rules": matched,
            "unmatched_rules": unmatched,
            "verification_notes": all_notes,
            "disclaimer": "AI assists. Official sources decide. Student approves. Never guaranteed."
        }


eligibility_service = EligibilityService()


def evaluate_scholarship_eligibility(db, scholarship_id: int, student_id: int) -> Dict[str, Any]:
    student = db.query(Student).filter(Student.id == student_id).first()
    scholarship = db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()
    if not student or not scholarship:
        return {
            "status": "needs_verification",
            "score": 0.0,
            "reasons": ["Record not found."],
            "matched_rules": [],
            "unmatched_rules": [],
            "verification_notes": [],
            "disclaimer": "AI assists. Official sources decide. Student approves."
        }
    return eligibility_service.evaluate_scholarship(student, scholarship)
