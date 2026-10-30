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
    institution = Column(String(255), nullable=False)
    course = Column(String(255), nullable=False)
    year = Column(String(50), nullable=False)
    cgpa = Column(Float, nullable=True)  # Non-mandatory for profiles or registration
    twelfth_percentage = Column(Float, nullable=True)
    category = Column(String(50), nullable=False)
    state = Column(String(100), nullable=False, default="Tamil Nadu")
    gender = Column(String(50), nullable=True, default="Male")

    # Personal Information Extensions
    dob = Column(String(50), nullable=True)  # Date of birth (YYYY-MM-DD)
    district = Column(String(100), nullable=True)
    native_state = Column(String(100), nullable=True, default="Tamil Nadu")

    # Academic & Institutional Information Extensions
    education_level = Column(String(50), nullable=True, default="Undergraduate")  # Diploma, Undergraduate, Postgraduate, Other
    stream = Column(String(100), nullable=True, default="Engineering & Technology")  # Engineering & Technology, Arts & Science, Other
    university = Column(String(255), nullable=True)
    admission_year = Column(String(20), nullable=True)
    current_semester = Column(String(20), nullable=True)
    qualifying_exam = Column(String(100), nullable=True)  # e.g. HSC / 12th, Diploma, UG Degree
    qualifying_marks = Column(Float, nullable=True)  # Qualifying marks or percentage
    institution_type = Column(String(50), nullable=True, default="Government-aided")  # Government, Government-aided, Private
    admission_quota = Column(String(50), nullable=True, default="GOVERNMENT_QUOTA")  # GOVERNMENT_QUOTA | MANAGEMENT_QUOTA
    hosteller_status = Column(String(50), nullable=True, default="DAY_SCHOLAR")  # DAY_SCHOLAR | HOSTELLER
    is_first_graduate = Column(Boolean, nullable=True)
    school_type = Column(String(100), nullable=True)  # Government School (Classes 6-12), Government-aided, Private/Matriculation
    school_study_history = Column(Text, nullable=True)  # Detailed schooling history for Pudhumai Penn / Tamil Pudhalvan

    # Community & Sensitive Reservation Attributes
    community_subcategory = Column(String(100), nullable=True)  # Optional notified subcategory/caste where scheme requires

    # Bank & Benefit Distribution Attributes (Masked/Readiness)
    bank_readiness = Column(String(50), nullable=True, default="NOT_CONFIGURED")  # READY | NOT_CONFIGURED | ACCOUNT_ACTIVE
    account_holder_name = Column(String(255), nullable=True)
    dbt_enabled = Column(Boolean, nullable=True, default=False)
    bank_name = Column(String(100), nullable=True)
    bank_branch = Column(String(100), nullable=True)

    # Identity & Aadhaar Verification State
    aadhaar_verification_status = Column(String(50), nullable=True, default="NOT_PROVIDED")  # NOT_PROVIDED | VERIFICATION_REQUIRED | VERIFICATION_PENDING | VERIFIED_AUTHORIZED | VERIFICATION_FAILED
    aadhaar_masked = Column(String(50), nullable=True)  # Masked reference only e.g. XXXXXXXX1234
    aadhaar_consent_given = Column(Boolean, nullable=True, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    student = relationship("Student", back_populates="profile")
