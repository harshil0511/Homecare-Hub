"""
Test configuration for HomeCare Hub backend.
Uses the real SQLAlchemy Base so model metadata is available for column-level tests.
No live DB connection required for schema/model/logic tests.
"""
import sys
import os

# Ensure the backend/ directory is on the path so `app.*` imports work.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
