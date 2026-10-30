from typing import Dict, Any, List
from datetime import datetime, timezone
from app.models.student import Student
from app.models.scholarship import Scholarship
from app.models.eligibility_rule import EligibilityRule


class EligibilityService:
    @staticmethod
    def evaluate_scholarship(student: Student, scholarship: Scholarship) -> Dict[str, Any]:
        """
        Deterministic scholarship eligibility evaluation.
        Never guarantees eligibility or awards.
        Classifies results into four structured recommendation categories:
        1. Likely Eligible
        2. Potentially Eligible — More Information Required
        3. Currently Ineligible — Explain Why
        4. Deadline or Application Window Needs Verification
        """
        profile = student.profile
        funding = student.funding_profile

        if not profile or not funding:
            return {
                "status": "needs_verification",
                "recommendation_category": "POTENTIALLY_ELIGIBLE",
                "score": 0.0,
                "reasons": ["Student profile or financial details are incomplete."],
                "matched_rules": [],
                "unmatched_rules": [],
                "verification_notes": ["Complete your profile to determine eligibility."],
                "missing_information": ["Personal profile details", "Financial overview"],
                "disclaimer": "AI assists. Official sources decide. Student approves. Never guaranteed."
            }

        if scholarship.status == "INACTIVE" or scholarship.verification_status == "RETIRED_DEMO":
            return {
                "status": "ineligible",
                "recommendation_category": "CURRENTLY_INELIGIBLE",
                "score": 0.0,
                "reasons": ["This scholarship record has been retired from active funding cycles."],
                "matched_rules": [],
                "unmatched_rules": ["Scheme is inactive or retired"],
                "verification_notes": ["No active applications can be accepted for this scheme."],
                "missing_information": [],
                "disclaimer": "AI assists. Official sources decide. Student approves."
            }

        now = datetime.now(timezone.utc)
        deadline = scholarship.deadline
        if deadline is not None and deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)

        is_window_unverified = (
            scholarship.application_window_status in ["EXPIRED_OR_CLOSED", "CLOSED", "ANNOUNCED_TENTATIVE"]
            or (deadline is not None and deadline < now)
            or scholarship.source_verification_status in ["ELIGIBILITY_CONFIRMATION_REQUIRED", "EXPIRED_OR_CLOSED"]
        )

        rules: List[EligibilityRule] = scholarship.eligibility_rules
        matched = []
        unmatched = []
        needs_verif = []
        missing_info = []
        is_hard_ineligible = False

        cgpa = float(profile.cgpa) if getattr(profile, "cgpa", None) is not None else None
        twelfth = float(profile.twelfth_percentage) if getattr(profile, "twelfth_percentage", None) is not None else None
        qual_marks = float(profile.qualifying_marks) if getattr(profile, "qualifying_marks", None) is not None else None
        academic_score = twelfth if twelfth is not None else (qual_marks if qual_marks is not None else None)

        income = float(funding.annual_family_income or 0.0)
        course = (profile.course or "").lower()
        year = (profile.year or "").lower()
        state = (profile.state or "Tamil Nadu").lower()
        native_state = (getattr(profile, "native_state", "Tamil Nadu") or "Tamil Nadu").lower()
        category = (profile.category or "BC").lower()
        gender = (getattr(profile, "gender", "Male") or "Male").lower()
        stream_val = (getattr(profile, "stream", "Engineering & Technology") or "").lower()
        inst_type = (getattr(profile, "institution_type", "Government-aided") or "").lower()
        school_type = (getattr(profile, "school_type", "") or "").lower()
        school_history = (getattr(profile, "school_study_history", "") or "").lower()

        # Stream & Academic Discipline Check
        is_engineering = (
            "engineering" in stream_val
            or any(kw in course for kw in ["b.e", "b.tech", "engineering", "m.tech", "m.e", "polytechnic", "diploma in eng"])
        )
        is_arts_science = (
            "arts" in stream_val or "science" in stream_val or "commerce" in stream_val
            or any(kw in course for kw in ["b.sc", "b.a", "b.com", "bca", "bba", "m.sc", "m.a", "arts", "science", "commerce", "humanities"])
        )

        if scholarship.stream == "ARTS_SCIENCE" and is_engineering and not is_arts_science:
            unmatched.append("Scheme is designated exclusively for Arts & Science programs; student profile indicates Engineering.")
            is_hard_ineligible = True
        elif scholarship.stream == "ENGINEERING" and is_arts_science and not is_engineering:
            unmatched.append("Scheme is designated exclusively for Engineering programs (B.E./B.Tech); student profile indicates Arts & Science.")
            is_hard_ineligible = True
        elif scholarship.stream in ["ARTS_SCIENCE", "ENGINEERING", "BOTH"]:
            matched.append(f"Program matches stream requirement ({scholarship.stream})")

        # Study Level Check (UG vs PG vs Diploma)
        ed_level = (getattr(profile, "education_level", "Undergraduate") or "Undergraduate").lower()
        is_pg = "postgraduate" in ed_level or any(kw in course or kw in year for kw in ["pg", "postgraduate", "master", "m.tech", "m.sc", "m.a", "m.e", "ph.d", "phd"])
        is_ug = "undergraduate" in ed_level or not is_pg

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
            if state in ["tamil nadu", "tamilnadu", "tn"] or native_state in ["tamil nadu", "tamilnadu", "tn"]:
                matched.append("Tamil Nadu state domicile verified.")
            else:
                unmatched.append(f"Tamil Nadu residency/domicile is strictly required; student profile indicates '{profile.state or 'Not Provided'}'.")
                is_hard_ineligible = True

        # Context Notes
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
                    if cgpa is not None:
                        if cgpa >= req_cgpa:
                            matched.append(f"Academic standing satisfies minimum criteria (CGPA {cgpa:.2f} >= {req_cgpa:.2f})")
                        else:
                            unmatched.append(f"Current CGPA {cgpa:.2f} is below minimum requirement of {req_cgpa:.2f}")
                            is_hard_ineligible = True
                    else:
                        # CGPA is optional; do NOT reject solely because CGPA not provided
                        needs_verif.append(f"Scheme mentions qualifying score of {req_cgpa:.2f}; verify semester marks or previous qualifying exam.")
                        missing_info.append("Academic score or marksheet")
                except ValueError:
                    needs_verif.append(f"Could not parse score requirement: {cval}")

            elif rtype == "MAX_INCOME":
                try:
                    req_income = float(cval)
                    if income > 0:
                        if income <= req_income:
                            matched.append(f"Annual family income ₹{int(income):,} is within statutory limit of ₹{int(req_income):,}")
                        else:
                            unmatched.append(f"Annual family income ₹{int(income):,} exceeds statutory ceiling of ₹{int(req_income):,}")
                            is_hard_ineligible = True
                    else:
                        needs_verif.append(f"Income ceiling is ₹{int(req_income):,}; family income not yet confirmed in profile.")
                        missing_info.append("Annual family income declaration")
                except ValueError:
                    needs_verif.append(f"Could not parse income limit: {cval}")

            elif rtype in ["MIN_12TH_PERCENTAGE", "MIN_MARKS"]:
                try:
                    req_marks = float(cval)
                    if academic_score is not None:
                        if academic_score >= req_marks:
                            matched.append(f"Qualifying score {academic_score:.1f}% meets minimum requirement of {req_marks:.1f}%")
                        else:
                            unmatched.append(f"Qualifying score {academic_score:.1f}% is below minimum requirement of {req_marks:.1f}%")
                            is_hard_ineligible = True
                    else:
                        needs_verif.append(f"Minimum {req_marks:.1f}% in qualifying examination required; marks not yet entered in profile.")
                        missing_info.append("Qualifying exam marks / 12th percentage")
                except ValueError:
                    needs_verif.append(f"Could not parse qualifying percentage: {cval}")

            elif rtype == "COURSE":
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
                if cval.lower() in [state, native_state] or (cval.lower() == "tamil nadu" and (state in ["tamil nadu", "tamilnadu", "tn"] or native_state in ["tamil nadu", "tamilnadu", "tn"])):
                    matched.append(f"Domicile state matches requirement ({cval})")
                else:
                    unmatched.append(f"Domicile state '{profile.state}' does not match requirement ({cval})")
                    is_hard_ineligible = True

            elif rtype == "CATEGORY":
                if cval.lower() == "needs verification":
                    needs_verif.append(desc)
                else:
                    allowed_cats = [c.strip().lower() for c in cval.split(",")]
                    cat_synonyms = {
                        "bc": ["bc", "obc", "backward classes", "backward class"],
                        "mbc": ["mbc", "most backward classes", "dnc", "denotified communities"],
                        "sc": ["sc", "scheduled caste", "sca", "scheduled caste arunthathiyar"],
                        "sca": ["sca", "scheduled caste arunthathiyar", "sc"],
                        "st": ["st", "scheduled tribe"],
                        "oc": ["oc", "open category", "general", "other communities"],
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

            elif rtype in ["ADMISSION_QUOTA", "QUOTA"]:
                req_quota = cval.strip().upper()
                admission_quota = getattr(profile, "admission_quota", None)
                if not admission_quota:
                    needs_verif.append(f"Admission quota ({req_quota}) requires verification in student profile")
                    missing_info.append("Admission quota (Govt Counselling vs Management)")
                else:
                    norm_quota = str(admission_quota).strip().upper()
                    if norm_quota == req_quota:
                        matched.append(f"Admission quota '{admission_quota}' satisfies statutory requirement ({req_quota})")
                    else:
                        unmatched.append(f"Scheme restricted to {req_quota} admissions; student profile indicates {admission_quota}")
                        is_hard_ineligible = True

            elif rtype in ["FIRST_GRADUATE", "IS_FIRST_GRADUATE"]:
                req_first_grad = cval.strip().upper() in ["TRUE", "YES", "1"]
                is_first_graduate = getattr(profile, "is_first_graduate", None)
                if is_first_graduate is None:
                    needs_verif.append("First Graduate status needs verification against Revenue Tahsildar FG Certificate")
                    missing_info.append("First Graduate certificate verification")
                elif is_first_graduate is True and req_first_grad:
                    matched.append("First graduate in immediate family verified")
                elif is_first_graduate is False and req_first_grad:
                    unmatched.append("Scheme is restricted to first-generation graduates; student profile indicates non-first-graduate")
                    is_hard_ineligible = True
                elif is_first_graduate is False and not req_first_grad:
                    matched.append("Non-first graduate profile matches general criteria")
                elif is_first_graduate is True and not req_first_grad:
                    matched.append("First graduate student eligible for general criteria")

            elif rtype in ["HOSTELLER_STATUS", "HOSTELLER"]:
                req_hostel = cval.strip().upper()
                hosteller_status = getattr(profile, "hosteller_status", None)
                if not hosteller_status:
                    needs_verif.append(f"Hosteller/residential status ({req_hostel}) requires institutional verification")
                else:
                    norm_hostel = str(hosteller_status).strip().upper()
                    if norm_hostel == req_hostel:
                        matched.append(f"Residential status '{hosteller_status}' satisfies scheme requirement ({req_hostel})")
                    else:
                        unmatched.append(f"Scheme restricted to {req_hostel}; student profile indicates {hosteller_status}")
                        is_hard_ineligible = True

            elif rtype in ["SCHOOL_TYPE", "GOVT_SCHOOL"]:
                studied_govt_flag = getattr(profile, "studied_govt_school_6_to_12", None)
                # Pudhumai Penn / Tamil Pudhalvan Government School check
                if studied_govt_flag is False or (school_type and "private" in school_type):
                    unmatched.append("Scheme requires schooling in Tamil Nadu Government schools from Classes 6 to 12; profile indicates non-government school.")
                    is_hard_ineligible = True
                elif (
                    studied_govt_flag is True
                    or "government school" in school_type
                    or "govt" in school_type
                    or "classes 6-12" in school_type
                    or "6_to_12" in school_type
                    or "government school" in school_history
                    or "emis" in school_history
                ):
                    matched.append("Tamil Nadu Government school attendance (Classes 6 to 12) verified")
                else:
                    needs_verif.append("Requires verification of attendance in Tamil Nadu Government schools (Classes 6 to 12) via EMIS certificate.")
                    missing_info.append("Government school bonafide / EMIS student ID")

            elif rtype in ["INSTITUTION_TYPE"]:
                req_inst = cval.strip().lower()
                if req_inst in inst_type or inst_type in req_inst:
                    matched.append(f"Institution type '{profile.institution_type}' satisfies requirement ({cval})")
                elif inst_type:
                    unmatched.append(f"Scheme restricted to {cval} institutions; student profile indicates {profile.institution_type}")
                    is_hard_ineligible = True
                else:
                    needs_verif.append(f"Requires verification of institution type ({cval})")

            elif rtype in ["SPORTS", "SPORTS_LEVEL", "SPORTS_ACHIEVEMENT", "SPORTS_PARTICIPATION"]:
                participates = getattr(profile, "participates_in_sports", False)
                level = getattr(profile, "sports_competition_level", None)
                discipline = getattr(profile, "sport_discipline", None) or "Sports / Athletics"
                cert_status = getattr(profile, "sports_certificate_status", "Not Available")

                if not participates:
                    unmatched.append("Scheme requires competitive sports participation / achievement; student profile indicates non-sports participant.")
                    is_hard_ineligible = True
                else:
                    req_level = cval.strip().upper() if cval else "ANY"
                    level_ranks = {"SCHOOL": 1, "ZONAL": 1, "DISTRICT": 2, "DIVISIONAL": 2, "STATE": 3, "NATIONAL": 4, "INTERNATIONAL": 5}
                    student_rank = 1
                    if level:
                        for lk, lv in level_ranks.items():
                            if lk in level.upper():
                                student_rank = max(student_rank, lv)

                    required_rank = 1
                    for lk, lv in level_ranks.items():
                        if lk in req_level:
                            required_rank = max(required_rank, lv)

                    if student_rank >= required_rank:
                        matched.append(f"Sports participation ({discipline} - {level or 'Active'}) satisfies criteria ({cval or 'Recognized Sports'})")
                        if cert_status in ["Have Verified Official Certificate", "Certificate Available / Pending Verification"]:
                            matched.append("Official sports certificate or Form-II/III available")
                        else:
                            needs_verif.append("Official certificate from recognized sports association / SDAT required for verification")
                            missing_info.append("Verified Sports Certificate")
                    else:
                        unmatched.append(f"Scheme requires {cval} level sports achievement; student profile indicates {level or 'lower tier'}.")
                        is_hard_ineligible = True

            elif rtype in ["DISABILITY", "DISABILITY_BENCHMARK", "PWD", "UDID"]:
                has_disability = getattr(profile, "has_disability", False)
                special_cat = getattr(profile, "special_category", "") or ""
                dis_pct = getattr(profile, "disability_percentage", None)
                udid_status = getattr(profile, "udid_card_status", "Not Available")

                indicated_disability = has_disability or any(k in special_cat.lower() for k in ["pwd", "differently abled", "disab"])

                if not indicated_disability:
                    unmatched.append("Scheme is strictly restricted to students with benchmark disabilities (PwD / Divyangjan); profile does not indicate disability.")
                    is_hard_ineligible = True
                else:
                    min_pct = 40.0
                    try:
                        if cval and cval.replace(".", "", 1).isdigit():
                            min_pct = float(cval)
                    except Exception:
                        pass

                    if dis_pct is not None:
                        if dis_pct >= min_pct:
                            matched.append(f"Disability percentage ({dis_pct}%) satisfies statutory benchmark criteria (>={min_pct}%)")
                        else:
                            unmatched.append(f"Statutory benchmark requires at least {min_pct}% disability; profile indicates {dis_pct}%")
                            is_hard_ineligible = True
                    else:
                        needs_verif.append(f"Requires verification of benchmark disability (>={min_pct}%) via UDID card or competent medical authority certificate")
                        missing_info.append("Disability percentage / UDID Card verification")

                    if udid_status in ["UDID Card Available", "State Disability Certificate Available"]:
                        matched.append(f"Disability documentation ({udid_status}) declared")
                    else:
                        needs_verif.append("Valid Unique Disability Identity (UDID) Card or state medical certificate required for portal authentication")
                        missing_info.append("UDID Card / Disability Certificate")

            elif rtype in ["GOVT_SCHOOL_7_POINT_5", "7_POINT_5_PERCENT_QUOTA"]:
                studied_govt_flag = getattr(profile, "studied_govt_school_6_to_12", None)
                if studied_govt_flag is False or (school_type and "private" in school_type):
                    unmatched.append("7.5% preferential reservation requires continuous schooling in Tamil Nadu Government schools from Classes 6 to 12; profile indicates non-government school.")
                    is_hard_ineligible = True
                elif studied_govt_flag is True or "government school" in school_type:
                    matched.append("Continuous schooling in Tamil Nadu Government schools (Classes 6-12) verified for 7.5% preferential quota eligibility")
                    context_notes.append("Admission Benefit Policy: Tamil Nadu Act 14 of 2021 provides 100% full fee concession (tuition, hostel, exam fees) for eligible government school students admitted under the 7.5% counselling quota. Requires admission allotment under the 7.5% government school category.")
                else:
                    needs_verif.append("Requires verification of continuous schooling in Tamil Nadu Government schools (Classes 6-12) via EMIS certificate.")
                    missing_info.append("Government school bonafide / EMIS student ID")

            else:
                needs_verif.append(f"Special criteria: {desc}")

        # Classify into 4 explicit recommendation categories:
        if is_hard_ineligible:
            rec_cat = "CURRENTLY_INELIGIBLE"
            status = "ineligible"
            score = 15.0
        elif is_window_unverified:
            rec_cat = "WINDOW_NEEDS_VERIFICATION"
            status = "needs_verification"
            score = 40.0
        elif needs_verif or missing_info or scholarship.verification_status == "NEEDS_VERIFICATION":
            rec_cat = "POTENTIALLY_ELIGIBLE"
            status = "needs_verification"
            score = 65.0
        elif len(unmatched) == 0:
            rec_cat = "LIKELY_ELIGIBLE"
            status = "eligible"
            score = 95.0
        else:
            rec_cat = "POTENTIALLY_ELIGIBLE"
            status = "possibly_eligible"
            score = 50.0

        all_notes = needs_verif + context_notes
        all_reasons = []
        if rec_cat == "LIKELY_ELIGIBLE":
            all_reasons.append("Likely eligible based on your verified profile attributes.")
            all_reasons.extend(matched)
        elif rec_cat == "CURRENTLY_INELIGIBLE":
            all_reasons.append("Currently ineligible based on deterministic profile criteria.")
            all_reasons.extend(unmatched)
        elif rec_cat == "POTENTIALLY_ELIGIBLE":
            all_reasons.append("Potentially eligible — more information or document verification required.")
            all_reasons.extend(needs_verif)
            all_reasons.extend(matched)
        elif rec_cat == "WINDOW_NEEDS_VERIFICATION":
            all_reasons.append("Application window or official notification cycle requires verification.")
            all_reasons.extend(needs_verif)

        return {
            "status": status,
            "recommendation_category": rec_cat,
            "score": score,
            "reasons": all_reasons,
            "matched_rules": matched,
            "unmatched_rules": unmatched,
            "verification_notes": all_notes,
            "missing_information": missing_info,
            "requirements_needing_verification": all_notes,
            "disclaimer": "AI assists. Official sources decide. Student approves. Never guaranteed."
        }


eligibility_service = EligibilityService()


def evaluate_scholarship_eligibility(db, scholarship_id: int, student_id: int) -> Dict[str, Any]:
    student = db.query(Student).filter(Student.id == student_id).first()
    scholarship = db.query(Scholarship).filter(Scholarship.id == scholarship_id).first()
    if not student or not scholarship:
        return {
            "status": "needs_verification",
            "recommendation_category": "POTENTIALLY_ELIGIBLE",
            "score": 0.0,
            "reasons": ["Record not found."],
            "matched_rules": [],
            "unmatched_rules": [],
            "verification_notes": [],
            "missing_information": [],
            "requirements_needing_verification": [],
            "disclaimer": "AI assists. Official sources decide. Student approves."
        }
    return eligibility_service.evaluate_scholarship(student, scholarship)
