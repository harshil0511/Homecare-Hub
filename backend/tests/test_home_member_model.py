"""Tests for HomeMember model — schema-level, no live DB needed."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.secretary.domain.model import HomeMember


def test_home_member_has_required_columns():
    cols = {c.name for c in HomeMember.__table__.columns}
    assert "id" in cols
    assert "society_id" in cols
    assert "full_name" in cols
    assert "family_members" in cols
    assert "house_no" in cols
    assert "mobile" in cols
    assert "created_at" in cols


def test_home_member_tablename():
    assert HomeMember.__tablename__ == "home_members"
