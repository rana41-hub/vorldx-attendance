"""Idempotent database seeding script for VorldX Attendance System.
Seeds default administrator account and core reference data if not present.
"""
import sys
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import select
from app.database import SessionLocal
from app.core.security import hash_password
from app.models.enums import UserRole
from app.models.user import User
from app.models.employee import Employee


def seed_data():
    db = SessionLocal()
    try:
        # 1. Seed Default Admin Account
        admin_id = "ADM-001"
        admin = db.scalar(select(User).where(User.admin_id == admin_id))
        if not admin:
            admin = User(
                admin_id=admin_id,
                email="admin@vorldx.com",
                password_hash=hash_password("Admin@VorldX2026"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            print(f"[SEED] Created default admin account: {admin_id} (admin@vorldx.com)")
        else:
            print(f"[SEED] Admin account {admin_id} already exists.")

        # 2. Seed Reference Employee if table is empty
        sample_emp_code = "VX-0101"
        emp = db.scalar(select(Employee).where(Employee.employee_code == sample_emp_code))
        if not emp:
            emp = Employee(
                employee_code=sample_emp_code,
                first_name="Alex",
                last_name="Vance",
                department="Engineering",
                designation="Lead Systems Architect",
                phone="+1-555-0101",
            )
            db.add(emp)
            db.flush()

            # Seed user account for sample employee
            emp_user = User(
                email="alex.vance@vorldx.com",
                password_hash=hash_password("Employee@VorldX2026"),
                role=UserRole.EMPLOYEE,
                is_active=True,
            )
            db.add(emp_user)
            db.flush()

            emp.user_id = emp_user.id
            print(f"[SEED] Created sample employee: {sample_emp_code} (Alex Vance) with activated login.")
        else:
            print(f"[SEED] Sample employee {sample_emp_code} already exists.")

        db.commit()
        print("[SEED] Seeding completed successfully.")
    except Exception as exc:
        db.rollback()
        print(f"[SEED ERROR] Seeding failed: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
