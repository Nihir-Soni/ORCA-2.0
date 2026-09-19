"""Regression tests for intent classification and grounding rules.

Problems addressed:
  1. "tell me about the fish productivity trend in this region"
     was incorrectly routed to fishing_safety instead of historical_analysis.
  2. LLM was generating unsupported regional CHL/SST ranking claims.

These tests cover the OFFLINE (deterministic keyword) classifier only —
the Groq LLM path is not called here so tests are fast and network-free.
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.agents.intent_agent import _classify


# ── Helper ────────────────────────────────────────────────────────────────────

def must_be_historical(query: str) -> None:
    result = _classify(query)
    assert result == "historical_analysis", (
        f"Expected historical_analysis for query:\n  {query!r}\n"
        f"Got: {result!r}"
    )


def must_not_be_historical(query: str, expected: str) -> None:
    result = _classify(query)
    assert result == expected, (
        f"Expected {expected!r} for query:\n  {query!r}\n"
        f"Got: {result!r}"
    )


# ── Problem 1: productivity / trend queries → historical_analysis ─────────────

class TestHistoricalIntentClassification:
    """All of these must route to historical_analysis."""

    def test_fish_productivity_trend(self):
        must_be_historical("tell me about the fish productivity trend in this region")

    def test_marine_productivity_changed(self):
        must_be_historical("How has marine productivity changed here?")

    def test_chlorophyll_increased_last_month(self):
        must_be_historical("Has chlorophyll increased over the last month?")

    def test_sst_trend_near_mangalore(self):
        must_be_historical("What is the SST trend near Mangalore?")

    def test_ocean_conditions_last_30_days(self):
        must_be_historical("How have ocean conditions changed in the last 30 days?")

    def test_productivity_higher_last_month(self):
        must_be_historical("Was productivity higher last month?")

    def test_chlorophyll_past_90_days(self):
        must_be_historical("How has chlorophyll changed over the past 90 days?")

    def test_productivity_trend_standalone(self):
        must_be_historical("productivity trend near Kochi")

    def test_ocean_productivity(self):
        must_be_historical("ocean productivity over the past week")

    def test_conditions_over_time(self):
        must_be_historical("How have conditions changed over time?")

    def test_chlorophyll_declining(self):
        must_be_historical("Is chlorophyll declining here?")

    def test_sst_rising(self):
        must_be_historical("Has the SST been rising near Mangalore?")

    def test_how_did_conditions_change(self):
        must_be_historical("How did conditions change last week?")

    def test_was_it_better_previously(self):
        must_be_historical("Was marine productivity better previously?")

    def test_fish_productivity_decreased(self):
        must_be_historical("Has fish productivity decreased over the past month?")

    def test_current_speed_trend(self):
        must_be_historical("What is the current speed trend here?")

    def test_last_3_months(self):
        must_be_historical("Show me conditions over the last 3 months")

    def test_history(self):
        must_be_historical("What is the history of SST here?")

    # Multilingual
    def test_hindi_trend(self):
        must_be_historical("यहाँ क्लोरोफिल की प्रवृत्ति क्या है?")

    def test_kannada_trend(self):
        must_be_historical("ಇಲ್ಲಿ ಕ್ಲೋರೋಫಿಲ್ ಪ್ರವೃತ್ತಿ ಏನು?")


# ── Existing safe-flow queries must NOT become historical ─────────────────────

class TestNonHistoricalRoutingPreserved:
    """These must NOT be rerouted to historical_analysis."""

    def test_safety_query_not_historical(self):
        must_not_be_historical(
            "Is it safe to venture into the sea tomorrow?",
            "fishing_safety",
        )

    def test_pfz_query_not_historical(self):
        must_not_be_historical(
            "Where is the nearest PFZ?",
            "find_pfz",
        )

    def test_emergency_not_historical(self):
        must_not_be_historical(
            "SOS! I need help returning to port!",
            "emergency",
        )

    def test_route_not_historical(self):
        must_not_be_historical(
            "What is the safest route to the fishing zone?",
            "route",
        )

    def test_cyclone_alert_not_historical(self):
        must_not_be_historical(
            "Is there a cyclone warning active?",
            "alerts",
        )


# ── Grounding rule: regional comparison without spatial data ──────────────────

class TestGroundingRules:
    """
    These tests verify that the classifier routes regional-comparison queries
    correctly. Grounding enforcement (preventing hallucinated regional claims)
    happens in the LLM prompt — we can only test routing here.

    The query "Which regions show high CHL and SST?" should route to
    marine_conditions (current) or general_query, NOT historical_analysis,
    because it is asking for current spatial ranking, not temporal change.
    """

    def test_regional_chl_sst_not_historical(self):
        result = _classify(
            "Which regions show high chlorophyll concentration and favourable sea surface temperature?"
        )
        # Must NOT be historical_analysis — no temporal/trend signal
        assert result != "historical_analysis", (
            "Regional snapshot query should not become historical_analysis"
        )
        # Acceptable: marine_conditions, weather, fishing_safety, find_pfz — any of these
        # are fine. The key requirement is it does NOT route to historical_analysis.
        assert result in ("marine_conditions", "weather", "fishing_safety", "find_pfz"), (
            f"Unexpected intent for regional comparison: {result!r}"
        )

    def test_where_to_fish_not_historical(self):
        result = _classify("Where should I go to find fish today?")
        # Should be find_pfz or fishing_safety — any is acceptable; must NOT be historical
        assert result in ("find_pfz", "fishing_safety"), (
            f"'where to fish today' should be find_pfz or fishing_safety, got {result!r}"
        )

    def test_safe_now_not_historical(self):
        result = _classify("Is it safe to fish right now?")
        assert result == "fishing_safety", (
            f"Current safety query should be fishing_safety, got {result!r}"
        )
