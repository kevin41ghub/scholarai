from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(
        Integer,
        ForeignKey("students.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    institution = Column(String(255), nullable=True)
    course = Column(String(255), nullable=True)
    year = Column(String(50), nullable=True)
    cgpa = Column(Float, nullable=True)  # Non-mandatory for profiles or registration
    twelfth_percentage = Column(Float, nullable=True)
    category = Column(String(50), nullable=True)
    state = Column(String(100), nullable=True)
    gender = Column(String(50), nullable=True)

    # Personal Information Extensions
    dob = Column(String(50), nullable=True)  # Date of birth (YYYY-MM-DD)
    district = Column(String(100), nullable=True)
    native_state = Column(String(100), nullable=True)

    # Academic & Institutional Information Extensions
    education_level = Column(String(50), nullable=True)  # Diploma, Undergraduate, Postgraduate, Other
    stream = Column(String(100), nullable=True)  # Engineering & Technology, Arts & Science, Other
    university = Column(String(255), nullable=True)
    admission_year = Column(String(20), nullable=True)
    current_semester = Column(String(20), nullable=True)
    qualifying_exam = Column(String(100), nullable=True)  # e.g. HSC / 12th, Diploma, UG Degree
    qualifying_marks = Column(Float, nullable=True)  # Qualifying marks or percentage
    institution_type = Column(String(50), nullable=True)  # Government, Government-aided, Private
    admission_quota = Column(String(50), nullable=True)  # GOVERNMENT_QUOTA | MANAGEMENT_QUOTA
    hosteller_status = Column(String(50), nullable=True)  # DAY_SCHOLAR | HOSTELLER
    mode_of_study = Column(String(50), nullable=True)  # Regular / Full-Time, Lateral Entry, Part-Time
    studied_govt_school_6_to_12 = Column(Boolean, nullable=True)  # Studied 6th to 12th in Tamil Nadu Government School
    board_of_education = Column(String(100), nullable=True)  # Tamil Nadu State Board, CBSE, ICSE, Other
    is_first_graduate = Column(Boolean, nullable=True)
    school_type = Column(String(100), nullable=True)  # Government School (Classes 6-12), Government-aided, Private/Matriculation
    school_study_history = Column(Text, nullable=True)  # Detailed schooling history for Pudhumai Penn / Tamil Pudhalvan

    # Community & Sensitive Statutory Reservation Attributes
    community_subcategory = Column(String(100), nullable=True)  # Retained only for legacy DB compatibility; not collected in UI
    minority_status = Column(String(100), nullable=True)  # None, Religious Minority (Muslim), Religious Minority (Christian), Linguistic Minority, Other
    special_category = Column(String(100), nullable=True)  # None, Differently Abled (PwD), Children of Ex-Servicemen, Wards of Deceased Defense Personnel, Sports Person (State/National)
    domicile_status = Column(String(100), nullable=True)

    # Sports & Athletic Achievements
    participates_in_sports = Column(Boolean, nullable=True)
    sport_discipline = Column(String(100), nullable=True)
    sports_competition_level = Column(String(50), nullable=True)  # School / Zonal, District, State, National, International
    sports_achievement_type = Column(String(100), nullable=True)  # Winner / 1st Place, Runner-up / 2nd Place, Bronze / 3rd Place, State/National Representation, Participation
    sports_certificate_status = Column(String(50), nullable=True)  # Have Verified Official Certificate, Available / Pending Verification, Applied / In Progress, Not Available
    sports_achievement_year = Column(String(20), nullable=True)

    # Disability & Accessibility Accommodations (Privacy-conscious & Optional)
    has_disability = Column(Boolean, nullable=True)
    disability_consent_given = Column(Boolean, nullable=True)
    disability_category = Column(String(100), nullable=True)  # Locomotor / Orthopedic, Visual Impairment, Hearing Impairment, Speech & Language, Intellectual Disability, Multiple Disabilities, Other
    disability_percentage = Column(Float, nullable=True)  # Statutory benchmark >= 40%
    udid_card_status = Column(String(50), nullable=True)  # UDID Card Available, State Disability Certificate Available, Applied / In Progress, Not Available
    accessibility_needs = Column(String(255), nullable=True)  # Screen reader support, High contrast / Large text, Keyboard navigation, None

    # Bank & Benefit Distribution Attributes (Masked/Readiness)
    bank_readiness = Column(String(50), nullable=True, default="NOT_CONFIGURED")  # READY | NOT_CONFIGURED | ACCOUNT_ACTIVE
    account_holder_name = Column(String(255), nullable=True)
    dbt_enabled = Column(Boolean, nullable=True)
    dbt_seeding_status = Column(String(50), nullable=True)  # Yes / No / In Progress / Don't Know
    ration_card_type = Column(String(100), nullable=True)  # Priority (PHH), Antyodaya (AAY), Non-Priority (NPHH), Not Available / Don't Know
    bank_name = Column(String(100), nullable=True)
    bank_branch = Column(String(100), nullable=True)

    # Identity & Aadhaar Verification State
    aadhaar_verification_status = Column(String(50), nullable=True, default="NOT_PROVIDED")  # NOT_PROVIDED | VERIFICATION_REQUIRED | VERIFICATION_PENDING | VERIFIED_AUTHORIZED | VERIFICATION_FAILED
    aadhaar_masked = Column(String(50), nullable=True)  # Masked reference only e.g. XXXXXXXX1234
    aadhaar_consent_given = Column(Boolean, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="profile")
