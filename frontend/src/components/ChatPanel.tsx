import { useEffect, useRef, useState } from "react";
import type { ChatMessage, IntentMode, Language } from "../types";
import { CourseArrow, MicGlyph, StopGlyph } from "./glyphs";
import StructuredResponseTable from "./StructuredResponseTable";

const PLACEHOLDER: Record<Language, string> = {
  en: "Ask about safety, fishing zones, routes, weather…",
  hi: "सुरक्षा, मत्स्य क्षेत्र, मौसम के बारे में पूछें…",
  kn: "ಸುರಕ್ಷತೆ, ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶ, ಹವಾಮಾನದ ಬಗ್ಗೆ ಕೇಳಿ…",
};

const T: Record<Language, Record<string, string>> = {
  en: {
    title: "ASK ORCA",
    sub: "Marine Intelligence Console",
    you: "YOU",
    emptyMain: "Ask about safety, fishing zones, routes or marine warnings.",
    emptySub: "ORCA maintains context across follow-up questions.",
    busy: "agents processing…",
  },
  hi: {
    title: "ORCA से पूछें",
    sub: "समुद्री बुद्धिमत्ता कंसोल",
    you: "आप",
    emptyMain: "सुरक्षा, मत्स्य क्षेत्र, मार्ग या चेतावनियों के बारे में पूछिए।",
    emptySub: "ORCA संदर्भ याद रखता है।",
    busy: "एजेंट काम कर रहे हैं…",
  },
  kn: {
    title: "ORCA ಅನ್ನು ಕೇಳಿ",
    sub: "ಸಮುದ್ರ ಬುದ್ಧಿಮತ್ತೆ ಕನ್ಸೋಲ್",
    you: "ನೀವು",
    emptyMain: "ಸುರಕ್ಷತೆ, ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು, ಮಾರ್ಗಗಳ ಬಗ್ಗೆ ಕೇಳಿ.",
    emptySub: "ORCA ಸಂದರ್ಭವನ್ನು ನೆನಪಿಡುತ್ತದೆ.",
    busy: "ಏಜೆಂಟ್‌ಗಳು ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿವೆ…",
  },
};

const SPEECH_LOCALE: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
};

function getRecognition(): any | null {
  try {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

export default function ChatPanel({
  messages,
  busy,
  language,
  suggestions,
  onSend,
  onLanguage,
  intentMode,
  onIntentMode,
}: {
  messages: ChatMessage[];
  busy: boolean;
  language: Language;
  suggestions: string[];
  onSend: (text: string) => void;
  onLanguage: (lang: Language) => void;
  intentMode: IntentMode;
  onIntentMode: (mode: IntentMode) => void;
}) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    onSend(v);
    setText("");
    setSpeechError(null);
  };

  const toggleMic = () => {
    setSpeechError(null);
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {}
      setListening(false);
      return;
    }
    const rec = getRecognition();
    if (!rec) {
      setSpeechError(
        language === "kn"
          ? "ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆಯನ್ನು ಈ ಬ್ರೌಸರ್ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ. Chrome ಅಥವಾ Edge ಬಳಸಿ."
          : language === "hi"
          ? "इस ब्राउज़र में स्पीच-टू-टेक्स्ट समर्थित नहीं है। कृपया Chrome या Edge का उपयोग करें।"
          : "Speech-to-text is not supported in this browser. Please use Chrome or Edge."
      );
      return;
    }
    try {
      rec.lang = SPEECH_LOCALE[language] || "en-IN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const said = e.results?.[0]?.[0]?.transcript;
        if (said) {
          setText(said);
          setListening(false);
          submit(said);
        }
      };
      rec.onerror = (err: any) => {
        console.warn("Speech recognition error:", err);
        setListening(false);
        if (err?.error === "not-allowed") {
          setSpeechError(
            language === "hi"
              ? "माइक्रोफ़ोन की अनुमति अस्वीकृत है।"
              : language === "kn"
              ? "ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿಯನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ."
              : "Microphone access was denied. Please allow microphone permissions."
          );
        }
      };
      rec.onend = () => {
        setListening(false);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
    } catch (err) {
      console.warn("Speech recognition start failed:", err);
      setListening(false);
      setSpeechError("Could not start voice recognition. Please verify microphone permissions.");
    }
  };

  const lang = T[language] ?? T.en;

  return (
    <div className="console-panel">

      {/* ---- HEADER ---- */}
      <div className="console-hd">
        <div>
          <div className="console-title">
            <span className="console-sonar-dot" />
            {lang.title}
          </div>
          <div style={{
            fontFamily: "'Fraunces Variable', Georgia, serif",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-dim)",
            marginTop: 1,
          }}>
            {lang.sub}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <div role="group" aria-label="Ask ORCA input mode" style={{ display: "flex", alignItems: "center", gap: 3, padding: 3, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
            {(["OFFLINE", "AI"] as IntentMode[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onIntentMode(option)}
                aria-pressed={intentMode === option}
                title={option === "OFFLINE" ? "Works without AI or internet" : "Natural-language understanding via Groq AI"}
                style={{
                  padding: "4px 7px",
                  border: "1px solid",
                  borderColor: intentMode === option ? "var(--ocean)" : "transparent",
                  background: intentMode === option ? "rgba(0,168,204,0.16)" : "transparent",
                  color: intentMode === option ? "var(--ocean-bright)" : "var(--text-dim)",
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                {option}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
          {(["en", "hi", "kn"] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => onLanguage(l)}
              style={{
                padding: "3px 8px",
                borderRadius: 1,
                border: "1px solid",
                borderColor: language === l ? "var(--ocean)" : "var(--border)",
                background: language === l ? "rgba(0,168,204,0.12)" : "transparent",
                color: language === l ? "var(--ocean-bright)" : "var(--text-dim)",
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.08em",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {l === "en" ? "EN" : l === "hi" ? "HI" : "KN"}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* ---- MESSAGES ---- */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {messages.length === 0 && (
          <div className="console-idle">
            {/* Console crosshair */}
            <div style={{ position: "relative", width: 52, height: 52, opacity: 0.28 }}>
              <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden>
                <circle cx="26" cy="26" r="20" stroke="var(--ocean)" strokeWidth="1" strokeDasharray="3 4" />
                <line x1="26" y1="2" x2="26" y2="14" stroke="var(--ocean)" strokeWidth="1" />
                <line x1="26" y1="38" x2="26" y2="50" stroke="var(--ocean)" strokeWidth="1" />
                <line x1="2" y1="26" x2="14" y2="26" stroke="var(--ocean)" strokeWidth="1" />
                <line x1="38" y1="26" x2="50" y2="26" stroke="var(--ocean)" strokeWidth="1" />
                <circle cx="26" cy="26" r="3" fill="var(--ocean)" opacity="0.6" />
              </svg>
            </div>
            <div>
              <div className="console-idle-label">Console Ready</div>
              <div className="console-idle-text">{lang.emptyMain}</div>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 9.5,
                color: "var(--text-faint)",
                marginTop: 8,
                letterSpacing: "0.08em",
              }}>
                {lang.emptySub}
              </div>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className="animate-rise"
            style={{
              display: "flex",
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{ maxWidth: "88%" }}>
              {/* Role label */}
              <div
                className="console-sender"
                style={{
                  color: m.role === "user" ? "var(--ocean-dim)" : "var(--text-faint)",
                  textAlign: m.role === "user" ? "right" : "left",
                }}
              >
                {m.role === "user" ? `${lang.you} ▸` : "ORCA ◎"}
              </div>

              {/* Bubble */}
              <div className={m.role === "user" ? "console-bubble-user" : "console-bubble-orca"}>
                {m.text}
              </div>

              {/* ORCA response meta */}
              {m.role === "orca" && m.response && (
                <div style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 5,
                  paddingLeft: 2,
                }}>
                  {m.response.elapsed_ms && (
                    <span style={{
                      fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 8,
                      color: "var(--text-faint)",
                      letterSpacing: "0.1em",
                    }}>
                      {(m.response.elapsed_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                  {m.response.trace && m.response.trace.length > 0 && (
                    <span style={{
                      fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 8,
                      color: "var(--text-faint)",
                      letterSpacing: "0.08em",
                    }}>
                      {m.response.trace.filter(t => t.status === "ok").length}/{m.response.trace.length} agents
                    </span>
                  )}
                  <span style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 8,
                    color: "var(--text-faint)",
                    letterSpacing: "0.08em",
                  }}>
                    {m.response.intent.intent_source === "GROQ_LLM" ? "Groq AI" : "Offline Intent Engine"}
                  </span>
                </div>
              )}
              {m.role === "orca" && m.response?.structured && (
                <StructuredResponseTable structured={m.response.structured} />
              )}
            </div>
          </div>
        ))}


        {/* Busy indicator — signal dots */}
        {busy && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div className="console-busy">
              <div className="console-busy-dots">
                <span /><span /><span />
              </div>
              <span className="console-busy-text">{lang.busy}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ---- SUGGESTIONS ---- */}
      {suggestions.length > 0 && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "8px 14px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              disabled={busy}
              style={{
                padding: "4px 10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                color: "var(--text-mid)",
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "'Inter', system-ui, sans-serif",
                opacity: busy ? 0.4 : 1,
              }}
              onMouseEnter={(e) => {
                if (!busy) {
                  e.currentTarget.style.borderColor = "var(--ocean-dim)";
                  e.currentTarget.style.color = "var(--ocean)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-mid)";
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* ---- SPEECH STATUS / ERROR ---- */}
      {speechError && (
        <div style={{
          padding: "6px 12px",
          background: "rgba(239,68,68,0.1)",
          borderTop: "1px solid rgba(239,68,68,0.3)",
          color: "#EF4444",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
        }}>
          <span>⚠ {speechError}</span>
          <button
            onClick={() => setSpeechError(null)}
            style={{ background: "transparent", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 14 }}
          >
            ×
          </button>
        </div>
      )}

      {listening && (
        <div style={{
          padding: "6px 12px",
          background: "rgba(239,68,68,0.12)",
          borderTop: "1px solid rgba(239,68,68,0.3)",
          color: "#EF4444",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
          letterSpacing: "0.06em",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", display: "inline-block", animation: "blink 0.8s ease-in-out infinite" }} />
          <span>{language === "kn" ? "🎙 ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ... ಮಾತನಾಡಿ" : language === "hi" ? "🎙 सुन रहे हैं... बोलिए" : "🎙 Listening for voice input... Speak now"}</span>
        </div>
      )}

      {/* ---- INPUT ---- */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderTop: "1px solid var(--border)",
        background: "rgba(0,0,0,0.2)",
        flexShrink: 0,
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(text)}
          placeholder={listening ? (language === "kn" ? "🎙 ಕೇಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತಿದೆ..." : language === "hi" ? "🎙 सुन रहे हैं..." : "🎙 Listening...") : PLACEHOLDER[language]}
          disabled={busy}
          className="field"
          style={{ flex: 1, minWidth: 0 }}
        />

        {/* Mic button (ALWAYS VISIBLE for STT) */}
        <button
          onClick={toggleMic}
          type="button"
          title={listening ? "Stop listening" : "Voice input (Speech to text)"}
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 2,
            border: "1px solid",
            cursor: "pointer",
            transition: "all 0.2s",
            ...(listening ? {
              borderColor: "#EF4444",
              background: "rgba(239,68,68,0.25)",
              color: "#EF4444",
              animation: "inkblink 1.2s ease-in-out infinite",
              boxShadow: "0 0 12px rgba(239,68,68,0.4)",
            } : {
              borderColor: "var(--border-mid)",
              background: "transparent",
              color: "var(--text-mid)",
            }),
          }}
          onMouseEnter={(e) => {
            if (!listening) {
              e.currentTarget.style.borderColor = "var(--ocean)";
              e.currentTarget.style.color = "var(--ocean)";
            }
          }}
          onMouseLeave={(e) => {
            if (!listening) {
              e.currentTarget.style.borderColor = "var(--border-mid)";
              e.currentTarget.style.color = "var(--text-mid)";
            }
          }}
        >
          {listening ? <StopGlyph size={12} /> : <MicGlyph size={16} />}
        </button>

        {/* Send button */}
        <button
          onClick={() => submit(text)}
          disabled={busy || !text.trim()}
          title="Send"
          style={{
            width: 38,
            height: 38,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 2,
            border: "none",
            background: busy || !text.trim() ? "var(--surface-3)" : "var(--ocean)",
            color: busy || !text.trim() ? "var(--text-faint)" : "#020810",
            cursor: busy || !text.trim() ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            opacity: busy || !text.trim() ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (!busy && text.trim()) {
              e.currentTarget.style.background = "var(--ocean-bright)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            if (!busy && text.trim()) {
              e.currentTarget.style.background = "var(--ocean)";
              e.currentTarget.style.transform = "translateY(0)";
            }
          }}
        >
          <CourseArrow size={16} />
        </button>
      </div>
    </div>
  );
}
