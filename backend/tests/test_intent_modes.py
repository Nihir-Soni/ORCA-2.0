from unittest.mock import patch

import pytest

from app.agents import intent_agent, planner
from app.schemas import ChatRequest, Intent, AgentResult
from app.services.groq_intent import GroqIntentError


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("Is it safe to go fishing tomorrow?", "fishing_safety"),
        ("Show the PFZ near Mumbai", "find_pfz"),
        ("मौसम और बारिश कैसी है?", "weather"),
        ("क्या कल मछली पकड़ना सुरक्षित है?", "fishing_safety"),
        ("ಅಲೆ ಮತ್ತು ಸಮುದ್ರದ ಪರಿಸ್ಥಿತಿ ಹೇಗಿದೆ?", "marine_conditions"),
        ("ನಾಳೆ ಮೀನುಗಾರಿಕೆಗೆ ಹೋಗುವುದು ಸುರಕ್ಷಿತವೇ?", "fishing_safety"),
        ("Give me the safest route to Mumbai", "route"),
        ("SOS help me return to the nearest port", "emergency"),
    ],
)
def test_offline_keyword_intent_is_deterministic(query, expected):
    result = intent_agent.run(query, mode="OFFLINE")

    assert result.data["intent"] == expected
    assert result.data["intent_source"] == "KEYWORD_OFFLINE"


def test_offline_never_calls_groq():
    with patch("app.agents.intent_agent.extract_intent", side_effect=AssertionError("Groq called")):
        result = intent_agent.run("क्या यह सुरक्षित है?", mode="OFFLINE")

    assert result.data["intent_source"] == "KEYWORD_OFFLINE"


def test_ai_validates_and_normalizes_llm_payload():
    payload = {
        "intent": "marine_conditions",
        "activity": "fishing",
        "location_text": "Mumbai",
        "date": "2026-09-16",
        "time": "06:00",
        "language": "en",
        "needs": ["weather", "ocean"],
    }
    with patch("app.agents.intent_agent.extract_intent", return_value=payload):
        result = intent_agent.run("What are the sea conditions if I leave from Mumbai?", mode="AI")

    assert result.data["intent"] == "marine_conditions"
    assert result.data["location"]["name"] == "Mumbai"
    assert result.data["intent_source"] == "GROQ_LLM"


def test_ai_rejects_invalid_intent_falls_back():
    with patch("app.agents.intent_agent.extract_intent", return_value={"intent": "launch_missiles"}):
        result = intent_agent.run("is it safe to go fishing", mode="AI")

    assert result.ok is True
    assert result.data["intent"] == "fishing_safety"  # keyword fallback matched 'safe'
    assert result.data["intent_source"] == "KEYWORD_OFFLINE"


def test_chat_request_defaults_to_offline():
    assert ChatRequest(message="safe").mode == "OFFLINE"


def test_planner_receives_selected_intent_mode():
    with patch("app.agents.planner.intent_agent.run") as mock_intent:
        mock_intent.return_value = AgentResult(agent="intent", data=Intent().model_dump())
        with patch("app.agents.planner.get_data_mode", return_value="DEMO"):
            with patch("app.agents.planner.explanation_agent.run", return_value=AgentResult(agent="explanation")):
                planner.handle(ChatRequest(message="safe", mode="AI", session_id="mode-test"))

    assert mock_intent.call_args.kwargs["mode"] == "AI"