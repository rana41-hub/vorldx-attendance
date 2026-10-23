"""add_attendance_correction_and_audit_logs

Revision ID: e85f4019b7a1
Revises: d77322e04cb6
Create Date: 2026-10-22 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e85f4019b7a1'
down_revision: Union[str, Sequence[str], None] = 'd77322e04cb6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add correction columns to attendance_records
    op.add_column(
        'attendance_records',
        sa.Column('is_corrected', sa.Boolean(), server_default=sa.text('false'), nullable=False)
    )
    op.add_column(
        'attendance_records',
        sa.Column('corrected_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'attendance_records',
        sa.Column('corrected_by', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_attendance_records_corrected_by_users',
        'attendance_records',
        'users',
        ['corrected_by'],
        ['id'],
        ondelete='SET NULL'
    )

    # 2. Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=True),
        sa.Column('action_type', sa.String(length=50), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=True),
        sa.Column('attendance_record_id', sa.Integer(), nullable=True),
        sa.Column('policy_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('previous_values', sa.Text(), nullable=True),
        sa.Column('updated_values', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['attendance_record_id'], ['attendance_records.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['policy_id'], ['attendance_policies.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_logs_action_type'), 'audit_logs', ['action_type'], unique=False)
    op.create_index(op.f('ix_audit_logs_admin_id'), 'audit_logs', ['admin_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_employee_id'), 'audit_logs', ['employee_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_attendance_record_id'), 'audit_logs', ['attendance_record_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_policy_id'), 'audit_logs', ['policy_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_policy_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_attendance_record_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_employee_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_admin_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action_type'), table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_constraint('fk_attendance_records_corrected_by_users', 'attendance_records', type_='foreignkey')
    op.drop_column('attendance_records', 'corrected_by')
    op.drop_column('attendance_records', 'corrected_at')
    op.drop_column('attendance_records', 'is_corrected')
