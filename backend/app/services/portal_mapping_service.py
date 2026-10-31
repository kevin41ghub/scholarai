"""
SCHOLARAi Portal Mapping Service
Provides verified official form field mappings, grouped sections,
individual and group copy helpers, and step-by-step portal filing guidance.

Core Principle: "AI assists. Official sources decide. Student approves."
Rule: Never invent official form fields or assume portal compatibility.
"""

from typing import List, Dict, Any, Optional
from app.models.scholarship import Scholarship
from app.schemas.application import (
    ApplicationFormFieldItem,
    ApplicationRequirementResponse,
    PortalFieldItem,
    PortalSectionMapping,
)


class PortalMappingService:
    """
    Evaluates official portals and provides verified section-by-section
    field mapping, individual/grouped copy data, and portal-specific guidance.
    """

    def detect_portal_type(self, scholarship: Scholarship) -> str:
        """
        Classifies the portal into known statutory workflows:
        - NSP: National Scholarship Portal (scholarships.gov.in)
        - TN_SSP: Tamil Nadu State Scholarship Portal (sspdept.tnega.org)
        - PUDHUMAI_PENN: Pudhumai Penn / Tamil Pudhalvan Higher Education Assurance
        - TNEA: Tamil Nadu Engineering Admissions / DOTE (tneaonline.org)
        - TNDCE_OFFLINE: Directorate of Collegiate Education (tndce.tn.gov.in)
        - MANUAL_ASSISTANCE_ONLY: Other real official portals without automated mapping
        - UNSUPPORTED: Demo, retired, or schemes without official application URL
        """
        if not scholarship:
            return "UNSUPPORTED"

        if scholarship.status == "INACTIVE" or scholarship.verification_status == "RETIRED_DEMO":
            return "UNSUPPORTED"

        url = (scholarship.application_url or "").lower()
        guideline = (scholarship.official_guideline_url or "").lower()
        combined = f"{url} {guideline}"

        if not url or url.startswith("#demo"):
            return "UNSUPPORTED"

        if "scholarships.gov.in" in combined:
            return "NSP"
        if "sspdept.tnega.org" in combined:
            return "TN_SSP"
        if "pudhumaipenn.tn.gov.in" in combined or "tamilpudhalvan.tn.gov.in" in combined:
            return "PUDHUMAI_PENN"
        if "tneaonline.org" in combined:
            return "TNEA"
        if "tndce.tn.gov.in" in combined:
            return "TNDCE_OFFLINE"

        if url.startswith("http://") or url.startswith("https://"):
            return "MANUAL_ASSISTANCE_ONLY"

        return "UNSUPPORTED"

    def build_portal_mappings(
        self,
        scholarship: Scholarship,
        fields: List[ApplicationFormFieldItem],
        requirements: List[Any],
    ) -> List[PortalSectionMapping]:
        portal_type = self.detect_portal_type(scholarship)
        field_dict = {f.key: f for f in fields}

        if portal_type == "NSP":
            return self._build_nsp_mapping(field_dict, requirements)
        elif portal_type == "TN_SSP":
            return self._build_tn_ssp_mapping(field_dict, requirements)
        elif portal_type == "PUDHUMAI_PENN":
            return self._build_pudhumai_penn_mapping(field_dict, requirements)
        elif portal_type == "TNEA":
            return self._build_tnea_mapping(field_dict, requirements)
        elif portal_type == "TNDCE_OFFLINE":
            return self._build_tndce_offline_mapping(field_dict, requirements)
        elif portal_type == "MANUAL_ASSISTANCE_ONLY":
            return self._build_manual_assistance_mapping(scholarship, field_dict, requirements)
        else:
            return self._build_unsupported_mapping(scholarship)

    def _create_portal_field(
        self,
        source_key: str,
        official_label: str,
        input_type: str,
        field_item: Optional[ApplicationFormFieldItem],
        guidance: Optional[str] = None,
    ) -> PortalFieldItem:
        val = str(field_item.value) if field_item and field_item.value is not None else None
        is_conf = bool(field_item.is_confirmed) if field_item else False
        v_status = field_item.verification_status if field_item else "NOT_PROVIDED"
        guidance_text = guidance or (field_item.guidance if field_item else None)

        return PortalFieldItem(
            key=source_key,
            official_field_label=official_label,
            portal_input_type=input_type,
            value=val,
            is_confirmed=is_conf,
            verification_status=v_status,
            guidance_tip=guidance_text,
            copy_value=val or "",
        )

    def _compile_grouped_text(self, section_title: str, fields: List[PortalFieldItem]) -> str:
        lines = [f"[{section_title}]"]
        for f in fields:
            val_display = f.value if (f.value and f.value.strip()) else "[Not Provided]"
            lines.append(f"• {f.official_field_label}: {val_display}")
        return "\n".join(lines)

    # --------------------------------------------------------------------------
    # 1. National Scholarship Portal (NSP)
    # --------------------------------------------------------------------------
    def _build_nsp_mapping(
        self,
        field_dict: Dict[str, ApplicationFormFieldItem],
        requirements: List[Any],
    ) -> List[PortalSectionMapping]:
        sections: List[PortalSectionMapping] = []

        # Section 1: Registration & Aadhaar OTR
        s1_fields = [
            self._create_portal_field("full_name", "Full Name (as per Aadhaar / School Certificate)", "text", field_dict.get("full_name"), "Must match Aadhaar name exactly."),
            self._create_portal_field("date_of_birth", "Date of Birth (DD/MM/YYYY)", "date", field_dict.get("date_of_birth"), "Birth date as recorded on Class X Certificate."),
            self._create_portal_field("gender", "Gender", "select", field_dict.get("gender"), "Statutory gender on government identity records."),
        ]
        s1_complete = all(bool(f.value and f.is_confirmed) for f in s1_fields)
        sections.append(
            PortalSectionMapping(
                section_id="nsp_sec_1",
                section_title="1. Registration & Aadhaar OTR Verification",
                section_description="Aadhaar One-Time Registration (OTR) authentication and demographic matching.",
                fields=s1_fields,
                grouped_copy_text=self._compile_grouped_text("1. Registration & Aadhaar OTR Verification", s1_fields),
                is_complete=s1_complete,
            )
        )

        # Section 2: Academic Institution & Enrolment
        s2_fields = [
            self._create_portal_field("institution_name", "Institution Name / AISHE Code", "text", field_dict.get("institution_name"), "Verify your college matches the official AISHE registered code."),
            self._create_portal_field("course_program", "Present Class / Course / Department", "text", field_dict.get("course_program"), "Enrolled undergraduate or postgraduate degree."),
            self._create_portal_field("academic_year", "Present Class Year", "text", field_dict.get("academic_year"), "Active progression curriculum year."),
            self._create_portal_field("cgpa_score", "Previous Class / Semester Percentage (%)", "number", field_dict.get("cgpa_score"), "Qualifying examination score percentage."),
            self._create_portal_field("institution_type", "College Standing Classification", "select", field_dict.get("institution_type"), "Government, Government-aided, or Private autonomous collegiate status."),
        ]
        s2_complete = all(bool(f.value and f.is_confirmed) for f in s2_fields if f.key != "cgpa_score")
        sections.append(
            PortalSectionMapping(
                section_id="nsp_sec_2",
                section_title="2. Academic Enrolment & Institution Details",
                section_description="College AISHE code, present course, progression year, and qualifying scores.",
                fields=s2_fields,
                grouped_copy_text=self._compile_grouped_text("2. Academic Enrolment & Institution Details", s2_fields),
                is_complete=s2_complete,
            )
        )

        # Section 3: Demographic, Domicile & Income Details
        s3_fields = [
            self._create_portal_field("state_residence", "State of Domicile", "select", field_dict.get("state_residence"), "State where permanent nativity certificate is held."),
            self._create_portal_field("community_category", "Category / Community", "select", field_dict.get("community_category"), "Statutory community category recognized by government revenue records."),
            self._create_portal_field("annual_income", "Annual Family Income (INR)", "number", field_dict.get("annual_income"), "Gross family income certified by Tahsildar / Revenue Authority."),
            self._create_portal_field("hosteller_status", "Day Scholar / Hosteller", "select", field_dict.get("hosteller_status"), "College-approved resident hosteller or day scholar."),
        ]
        s3_complete = all(bool(f.value and f.is_confirmed) for f in s3_fields)
        sections.append(
            PortalSectionMapping(
                section_id="nsp_sec_3",
                section_title="3. Domicile, Category & Financial Information",
                section_description="Permanent nativity, statutory community reservation, and certified income limits.",
                fields=s3_fields,
                grouped_copy_text=self._compile_grouped_text("3. Domicile, Category & Financial Information", s3_fields),
                is_complete=s3_complete,
            )
        )

        # Section 4: Bank Account Details (DBT Direct Electronic Credit)
        s4_fields = [
            self._create_portal_field("bank_account_holder", "Bank Account Holder Name (Must match Student)", "text", field_dict.get("bank_account_holder"), "Active single savings account in student's name."),
            self._create_portal_field("bank_name", "Bank Institution Name", "text", field_dict.get("bank_name"), "Scheduled commercial or public sector bank."),
            self._create_portal_field("bank_account_number", "Bank Account Number", "text", field_dict.get("bank_account_number"), "Account number for electronic DBT credit."),
            self._create_portal_field("bank_ifsc_code", "Bank Branch IFSC Code", "text", field_dict.get("bank_ifsc_code"), "11-character Indian Financial System Code."),
        ]
        s4_complete = all(bool(f.value and f.is_confirmed) for f in s4_fields)
        sections.append(
            PortalSectionMapping(
                section_id="nsp_sec_4",
                section_title="4. Direct Benefit Transfer (DBT) Bank Details",
                section_description="Aadhaar-seeded bank account details for central/state electronic fund disbursement.",
                fields=s4_fields,
                grouped_copy_text=self._compile_grouped_text("4. Direct Benefit Transfer (DBT) Bank Details", s4_fields),
                is_complete=s4_complete,
            )
        )

        # Section 5: Document Vault Verification
        doc_fields: List[PortalFieldItem] = []
        for req in requirements:
            doc_name = getattr(req, "name", "Document")
            doc_type = getattr(req, "document_type", "OTHER")
            doc_status = getattr(req, "status", "MISSING")
            doc_fields.append(
                PortalFieldItem(
                    key=f"doc_{doc_type.lower()}",
                    official_field_label=f"Mandatory Upload: {doc_name}",
                    portal_input_type="file",
                    value=doc_status if doc_status in ["AVAILABLE", "VERIFIED"] else None,
                    is_confirmed=(doc_status in ["AVAILABLE", "VERIFIED"]),
                    verification_status=doc_status,
                    guidance_tip=f"Upload verified PDF copy of {doc_name} from your Document Vault.",
                    copy_value=doc_name,
                )
            )
        s5_complete = all(f.is_confirmed for f in doc_fields)
        sections.append(
            PortalSectionMapping(
                section_id="nsp_sec_5",
                section_title="5. Mandatory Documents & Institutional Endorsement",
                section_description="Authenticated certificates required for portal upload and college nodal officer signoff.",
                fields=doc_fields,
                grouped_copy_text=self._compile_grouped_text("5. Mandatory Documents Checklist", doc_fields),
                is_complete=s5_complete,
            )
        )

        return sections

    # --------------------------------------------------------------------------
    # 2. Tamil Nadu State Scholarship Portal (SSP / UMIS)
    # --------------------------------------------------------------------------
    def _build_tn_ssp_mapping(
        self,
        field_dict: Dict[str, ApplicationFormFieldItem],
        requirements: List[Any],
    ) -> List[PortalSectionMapping]:
        sections: List[PortalSectionMapping] = []

        s1_fields = [
            self._create_portal_field("full_name", "Student Legal Name", "text", field_dict.get("full_name"), "Must match UMIS Student Profile."),
            self._create_portal_field("institution_name", "Enrolled College / University", "text", field_dict.get("institution_name"), "Autonomous or affiliated college enrolled standing."),
            self._create_portal_field("course_program", "Degree Program & Branch of Study", "text", field_dict.get("course_program"), "Enrolled discipline."),
            self._create_portal_field("academic_year", "Current Progression Year", "text", field_dict.get("academic_year"), "Active academic progression year."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="ssp_sec_1",
                section_title="1. UMIS Student Profile & Enrolment",
                section_description="University Management Information System (UMIS) profile registration.",
                fields=s1_fields,
                grouped_copy_text=self._compile_grouped_text("1. UMIS Student Profile & Enrolment", s1_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s1_fields),
            )
        )

        s2_fields = [
            self._create_portal_field("community_category", "Revenue Community Category (BC/MBC/DNC/SC/ST)", "select", field_dict.get("community_category"), "Validated through Tamil Nadu Revenue Department e-District database."),
            self._create_portal_field("annual_income", "Certified Family Annual Income (INR)", "number", field_dict.get("annual_income"), "Gross income as stated on Tahsildar Income Certificate."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="ssp_sec_2",
                section_title="2. Statutory Revenue Certificates (e-District)",
                section_description="Real-time verification against Tamil Nadu e-District portal revenue records.",
                fields=s2_fields,
                grouped_copy_text=self._compile_grouped_text("2. Statutory Revenue Certificates (e-District)", s2_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s2_fields),
            )
        )

        s3_fields = [
            self._create_portal_field("admission_quota", "Admission Quota Allotment", "select", field_dict.get("admission_quota"), "Single Window Government Counseling vs Management / Institutional Quota."),
            self._create_portal_field("hosteller_status", "Residential Accommodation (Hosteller / Day Scholar)", "select", field_dict.get("hosteller_status"), "Approved hostel resident or day scholar."),
            self._create_portal_field("first_graduate", "First Graduate Tuition Waiver Opt-in", "select", field_dict.get("first_graduate"), "Indicates eligibility for TNEA First Graduate concession."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="ssp_sec_3",
                section_title="3. College Allotment Quota & Accommodation",
                section_description="Government single-window counseling verification and residential standing.",
                fields=s3_fields,
                grouped_copy_text=self._compile_grouped_text("3. College Allotment Quota & Accommodation", s3_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s3_fields if f.key != "first_graduate"),
            )
        )

        s4_fields = [
            self._create_portal_field("bank_account_holder", "Account Holder Name", "text", field_dict.get("bank_account_holder"), "Active single savings account in applicant's name."),
            self._create_portal_field("bank_name", "Disbursement Bank", "text", field_dict.get("bank_name"), "Bank holding active Aadhaar NPCI seeding."),
            self._create_portal_field("bank_account_number", "Bank Account Number", "text", field_dict.get("bank_account_number"), "Account number for electronic DBT credit."),
            self._create_portal_field("bank_ifsc_code", "Branch IFSC Code", "text", field_dict.get("bank_ifsc_code"), "11-character IFSC code."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="ssp_sec_4",
                section_title="4. DBT Aadhaar-Linked Bank Details",
                section_description="Disbursement bank account verified with NPCI Aadhaar payment bridge.",
                fields=s4_fields,
                grouped_copy_text=self._compile_grouped_text("4. DBT Aadhaar-Linked Bank Details", s4_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s4_fields),
            )
        )

        return sections

    # --------------------------------------------------------------------------
    # 3. Pudhumai Penn / Tamil Pudhalvan Higher Education Assurance
    # --------------------------------------------------------------------------
    def _build_pudhumai_penn_mapping(
        self,
        field_dict: Dict[str, ApplicationFormFieldItem],
        requirements: List[Any],
    ) -> List[PortalSectionMapping]:
        sections: List[PortalSectionMapping] = []

        s1_fields = [
            self._create_portal_field("full_name", "Student Legal Name", "text", field_dict.get("full_name"), "Must match Tamil Nadu EMIS school records."),
            self._create_portal_field("institution_name", "Current Enrolled College", "text", field_dict.get("institution_name"), "Enrolled higher education institution."),
            self._create_portal_field("course_program", "Degree Program", "text", field_dict.get("course_program"), "Active undergraduate degree."),
            self._create_portal_field("academic_year", "Progression Year", "text", field_dict.get("academic_year"), "Active collegiate year."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="pp_sec_1",
                section_title="1. Higher Education Enrolment",
                section_description="Collegiate standing and degree verification for ₹1,000/month monthly stipend.",
                fields=s1_fields,
                grouped_copy_text=self._compile_grouped_text("1. Higher Education Enrolment", s1_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s1_fields),
            )
        )

        s2_fields = [
            self._create_portal_field("bank_account_holder", "Account Holder Name", "text", field_dict.get("bank_account_holder"), "Must match applicant identity."),
            self._create_portal_field("bank_name", "Bank Name", "text", field_dict.get("bank_name"), "Bank holding active DBT electronic transfer."),
            self._create_portal_field("bank_account_number", "Account Number", "text", field_dict.get("bank_account_number"), "Savings account number."),
            self._create_portal_field("bank_ifsc_code", "IFSC Code", "text", field_dict.get("bank_ifsc_code"), "11-character IFSC code."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="pp_sec_2",
                section_title="2. Direct Benefit Transfer (DBT) Bank Seeding",
                section_description="Mandatory single account with Aadhaar seeding for monthly electronic transfers.",
                fields=s2_fields,
                grouped_copy_text=self._compile_grouped_text("2. Direct Benefit Transfer (DBT) Bank Seeding", s2_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s2_fields),
            )
        )

        return sections

    # --------------------------------------------------------------------------
    # 4. Tamil Nadu Engineering Admissions (TNEA / DOTE)
    # --------------------------------------------------------------------------
    def _build_tnea_mapping(
        self,
        field_dict: Dict[str, ApplicationFormFieldItem],
        requirements: List[Any],
    ) -> List[PortalSectionMapping]:
        sections: List[PortalSectionMapping] = []

        s1_fields = [
            self._create_portal_field("full_name", "Applicant Legal Name", "text", field_dict.get("full_name"), "Name as per Class XII Marksheet."),
            self._create_portal_field("date_of_birth", "Date of Birth", "date", field_dict.get("date_of_birth"), "Birth date proof."),
            self._create_portal_field("state_residence", "Nativity / Domicile State", "select", field_dict.get("state_residence"), "Tamil Nadu Nativity status."),
            self._create_portal_field("community_category", "Community Reservation Category", "select", field_dict.get("community_category"), "BC, MBC/DNC, SC, SCA, ST, OC."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="tnea_sec_1",
                section_title="1. Candidate Registration & Profile",
                section_description="Single-window counseling registration and statutory reservation details.",
                fields=s1_fields,
                grouped_copy_text=self._compile_grouped_text("1. Candidate Registration & Profile", s1_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s1_fields),
            )
        )

        s2_fields = [
            self._create_portal_field("first_graduate", "First Graduate Tuition Concession Claim", "select", field_dict.get("first_graduate"), "Select Yes if eligible for First Graduate tuition fee concession."),
            self._create_portal_field("admission_quota", "Counseling Allotment Quota", "select", field_dict.get("admission_quota"), "Single Window Government Counseling code."),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="tnea_sec_2",
                section_title="2. Special Concessions & Quota Claims",
                section_description="First Graduate, Sports, and Preferential Quota benefit applications.",
                fields=s2_fields,
                grouped_copy_text=self._compile_grouped_text("2. Special Concessions & Quota Claims", s2_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s2_fields if f.key != "first_graduate"),
            )
        )

        return sections

    # --------------------------------------------------------------------------
    # 5. Tamil Nadu Directorate of Collegiate Education (TNDCE Offline / Desk)
    # --------------------------------------------------------------------------
    def _build_tndce_offline_mapping(
        self,
        field_dict: Dict[str, ApplicationFormFieldItem],
        requirements: List[Any],
    ) -> List[PortalSectionMapping]:
        sections: List[PortalSectionMapping] = []

        s1_fields = [
            self._create_portal_field("full_name", "Student Legal Name", "text", field_dict.get("full_name")),
            self._create_portal_field("institution_name", "Enrolled College (Aided Shift / Department)", "text", field_dict.get("institution_name")),
            self._create_portal_field("course_program", "Degree Course of Study", "text", field_dict.get("course_program")),
            self._create_portal_field("academic_year", "Progression Year", "text", field_dict.get("academic_year")),
            self._create_portal_field("institution_type", "Institution Classification Standing", "select", field_dict.get("institution_type")),
            self._create_portal_field("community_category", "Community Category", "select", field_dict.get("community_category")),
            self._create_portal_field("annual_income", "Certified Family Annual Income (INR)", "number", field_dict.get("annual_income")),
        ]
        sections.append(
            PortalSectionMapping(
                section_id="tndce_sec_1",
                section_title="1. Prescribed Collegiate Endorsement Dossier",
                section_description="Official offline application dossier for submission to your College Scholarship Desk / Principal.",
                fields=s1_fields,
                grouped_copy_text=self._compile_grouped_text("1. Prescribed Collegiate Endorsement Dossier", s1_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in s1_fields),
            )
        )

        return sections

    # --------------------------------------------------------------------------
    # 6. Manual Assistance Only (Real Portals without custom schema)
    # --------------------------------------------------------------------------
    def _build_manual_assistance_mapping(
        self,
        scholarship: Scholarship,
        field_dict: Dict[str, ApplicationFormFieldItem],
        requirements: List[Any],
    ) -> List[PortalSectionMapping]:
        all_portal_fields = [
            self._create_portal_field(f.key, f.label, "text", f, f.guidance)
            for f in field_dict.values()
        ]
        return [
            PortalSectionMapping(
                section_id="manual_sec_all",
                section_title=f"1. Verified Student Dossier ({scholarship.official_portal_name or 'Official Portal'})",
                section_description="Use the individual copy helpers below to enter your verified data into the external portal.",
                fields=all_portal_fields,
                grouped_copy_text=self._compile_grouped_text("1. Verified Student Dossier", all_portal_fields),
                is_complete=all(bool(f.value and f.is_confirmed) for f in all_portal_fields if f.key in ["full_name", "annual_income"]),
            )
        ]

    # --------------------------------------------------------------------------
    # 7. Unsupported / Demo Schemes
    # --------------------------------------------------------------------------
    def _build_unsupported_mapping(self, scholarship: Scholarship) -> List[PortalSectionMapping]:
        return [
            PortalSectionMapping(
                section_id="unsupported_sec",
                section_title="Official Portal Form Mapping Unavailable",
                section_description=(
                    f"'{scholarship.name}' is an archived or offline fellowship that does not support "
                    "direct external portal form-filling assistance."
                ),
                fields=[],
                grouped_copy_text="Official portal form mapping is unavailable for this scheme.",
                is_complete=False,
            )
        ]


portal_mapping_service = PortalMappingService()

