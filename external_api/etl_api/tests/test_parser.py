import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from src.core.standardize import standardize_value

def test_standardize_value():
    val, unit, notes = standardize_value("45 m")
    assert val == 45
    assert unit == "m"
    assert len(notes) == 0

def test_standardize_float():
    val, unit, notes = standardize_value("45.5 MT")
    assert val == 45.5
    assert unit == "MT"

def test_standardize_invalid_number():
    val, unit, notes = standardize_value("Four m")
    assert val == "Four m"
    assert "parse warning: non-numeric start" in notes

def test_standardize_ambiguous():
    val, unit, notes = standardize_value("approx 120-130")
    assert "ambiguous value" in notes
