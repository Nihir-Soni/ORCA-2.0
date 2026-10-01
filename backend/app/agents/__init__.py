"""The ORCA agent crew."""

from . import (cyclone_agent, explanation_agent, gis_agent, intent_agent,  # noqa: F401
               ocean_agent, pfz_agent, planner, risk_agent, route_agent,
               weather_agent, web_agent)

AGENT_NAMES = ["intent", "planner", "weather", "ocean", "pfz", "cyclone",
               "gis", "risk", "route", "explanation", "web"]

