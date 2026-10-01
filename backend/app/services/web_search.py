"""Web Search Service for ORCA.

Provides web search capabilities for general marine queries, fish species,
local market prices, harbour catches, and regional fisheries info.
"""
from __future__ import annotations

import re
from html import unescape
from typing import Dict, List
import httpx


def search_web(query: str, location_name: str = "", max_results: int = 5) -> List[Dict[str, str]]:
    """Search the web using multi-tiered fallbacks (DDGS library -> DDG HTML -> Wikipedia API)."""
    search_query = query.strip()
    if location_name and location_name.lower() not in search_query.lower():
        search_query = f"{search_query} {location_name}"

    results: List[Dict[str, str]] = []

    # Method 1: Try duckduckgo_search / ddgs library
    try:
        try:
            from duckduckgo_search import DDGS
        except ImportError:
            from ddgs import DDGS  # type: ignore

        with DDGS() as ddgs:
            res = list(ddgs.text(search_query, max_results=max_results))
            if res:
                for r in res:
                    results.append({
                        "title": r.get("title", ""),
                        "snippet": r.get("body", r.get("snippet", "")),
                        "link": r.get("href", r.get("link", ""))
                    })
                if results:
                    return results
    except Exception as exc:
        print(f"WebSearch DDGS warning: {exc}")

    # Method 2: Fallback to DuckDuckGo HTML scraping via httpx
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        resp = httpx.post(
            "https://html.duckduckgo.com/html/",
            data={"q": search_query},
            headers=headers,
            timeout=6.0,
            follow_redirects=True
        )
        if resp.status_code == 200:
            snippets = re.findall(r'<a class="result__snippet[^"]*"[^>]*>(.*?)</a>', resp.text, re.DOTALL)
            urls = re.findall(r'<a class="result__url[^"]*"[^>]*href="([^"]*)"', resp.text, re.DOTALL)
            for i, s in enumerate(snippets[:max_results]):
                clean_text = unescape(re.sub(r'<[^>]+>', '', s)).strip()
                link = urls[i].strip() if i < len(urls) else ""
                if clean_text:
                    results.append({
                        "title": f"Web Result {i+1}",
                        "snippet": clean_text,
                        "link": link
                    })
            if results:
                return results
    except Exception as exc:
        print(f"WebSearch DDG HTML warning: {exc}")

    # Method 3: Wikipedia API fallback
    try:
        resp = httpx.get(
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "search",
                "srsearch": search_query,
                "format": "json",
                "utf8": 1
            },
            timeout=5.0
        )
        if resp.status_code == 200:
            data = resp.json()
            search_items = data.get("query", {}).get("search", [])
            for item in search_items[:max_results]:
                snippet = unescape(re.sub(r'<[^>]+>', '', item.get("snippet", "")))
                title = item.get("title", "")
                results.append({
                    "title": title,
                    "snippet": snippet,
                    "link": f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
                })
    except Exception as exc:
        print(f"WebSearch Wikipedia warning: {exc}")

    return results
