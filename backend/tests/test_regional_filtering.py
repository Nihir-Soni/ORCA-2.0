import pytest
from datetime import datetime
from app.data.providers.imd import is_alert_relevant_to_location, IMDProvider

def test_chennai_filters_out_andhra_pradesh():
    ap_alert = "There is a possibility of lightning in your area. During thunderstorms, avoid trees, towers, poles, fields, and open spaces. Seek shelter in safe buildings - Andhra Pradesh Government."
    assert is_alert_relevant_to_location("", ap_alert, "", "Andhra Pradesh-SDMA", "Chennai", "Tamil Nadu") is False

def test_chennai_filters_out_other_inland_states():
    ut_alert = "Heavy rainfall alert for Dehradun and Nainital districts."
    assert is_alert_relevant_to_location("", ut_alert, "", "Uttarakhand-SDMA", "Chennai", "Tamil Nadu") is False

def test_chennai_filters_out_distant_tamil_nadu_districts():
    cuddalore_alert = "Moderate Rain with Thunderstorm and Lightning is very likely to occur at isolated places over Cuddalore, Mayiladuthurai, Nagapattinam, Ramanathapuram, Thoothukkudi, Karaikal in next 3 hours."
    assert is_alert_relevant_to_location("", cuddalore_alert, "", "IMD Chennai", "Chennai", "Tamil Nadu") is False
    # But for Cuddalore itself, it should be accepted
    assert is_alert_relevant_to_location("", cuddalore_alert, "", "IMD Chennai", "Cuddalore", "Tamil Nadu") is True

def test_chennai_keeps_chennai_specific_alert():
    chennai_alert = "Light to Moderate Rain with Thunderstorm and Lightning is very likely to occur at a few places over Ariyalur, Chengalpattu, Chennai, Kancheepuram in next 3 hours."
    assert is_alert_relevant_to_location("", chennai_alert, "", "IMD Chennai", "Chennai", "Tamil Nadu") is True

def test_mumbai_filters_out_chennai_and_other_states():
    chennai_alert = "Light to Moderate Rain with Thunderstorm and Lightning is very likely to occur at a few places over Chennai, Kancheepuram."
    assert is_alert_relevant_to_location("", chennai_alert, "", "IMD Chennai", "Mumbai", "Maharashtra") is False

def test_mumbai_keeps_mumbai_region_alert():
    mumbai_alert = "Heavy to very heavy rain likely at isolated places in Mumbai, Thane, and Palghar districts."
    assert is_alert_relevant_to_location("", mumbai_alert, "", "IMD Mumbai", "Mumbai", "Maharashtra") is True

def test_bay_of_bengal_north_tn_relevance():
    bob_alert = "Squally weather likely over Southwest Bay of Bengal off North Tamil Nadu coast."
    assert is_alert_relevant_to_location("", bob_alert, "", "IMD", "Chennai", "Tamil Nadu") is True
    # Should not match Mumbai
    assert is_alert_relevant_to_location("", bob_alert, "", "IMD", "Mumbai", "Maharashtra") is False
