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
                        matched.append(f"Annual family income ₹{int(income):,} is within limit of ₹{int(req_income):,}")
                    else:
                        unmatched.append(f"Annual family income ₹{int(income):,} exceeds limit of ₹{int(req_income):,}")
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
                if cval.lower() == state:
                    matched.append(f"Domicile state '{profile.state}' matches requirement")
                else:
                    unmatched.append(f"Domicile state '{profile.state}' does not match requirement ({cval})")
                    is_hard_ineligible = True

            elif rtype == "CATEGORY":
                if cval.lower() == "needs verification":
                    needs_verif.append(desc)
                else:
                    allowed_cats = [c.strip().lower() for c in cval.split(",")]
                    if category in allowed_cats:
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
            "verification_notes": needs_verif,
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
