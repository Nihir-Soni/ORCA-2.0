import { useEffect, useRef, useState } from "react";
import type { Language } from "../types";
import { PauseGlyph, PlayGlyph } from "./glyphs";

type L10n = Record<Language, string>;

export interface TourStep {
  title: L10n;
  say: L10n;
  /** Question to run through the full agent pipeline for this step. */
  ask?: string;
  /** Switch view before narrating. */
  tab?: "home" | "ask" | "authority" | "system";
  /** How long to dwell after the action, in ms. */
  dwell: number;
  /** Highlighted feature name shown as a chip. */
  feature?: string;
  /** Continue the existing conversation instead of starting a fresh one. */
  followUp?: boolean;
}

/**
 * The scripted walkthrough. Runs unattended — this is both the "explain the
 * product in 3 minutes" tour and the fallback if a live demo goes wrong.
 */
export const TOUR: TourStep[] = [
  {
    title: {
      en: "What ORCA is",
      hi: "ORCA क्या है",
      kn: "ORCA ಎಂದರೇನು",
    },
    say: {
      en: "ORCA is not a chatbot. It is a crew of ten AI agents that read India's marine data together and return one safe, explainable decision for a fisher.",
      hi: "ORCA कोई चैटबॉट नहीं है। यह दस AI एजेंटों की एक टीम है जो भारत का समुद्री डेटा मिलकर पढ़ती है और मछुआरे के लिए एक सुरक्षित, समझाने योग्य फ़ैसला देती है।",
      kn: "ORCA ಚಾಟ್‌ಬಾಟ್ ಅಲ್ಲ. ಇದು ಭಾರತದ ಸಮುದ್ರದ ಡೇಟಾವನ್ನು ಒಟ್ಟಾಗಿ ಓದಿ ಮೀನುಗಾರರಿಗೆ ಸುರಕ್ಷಿತ ಮತ್ತು ವಿವರಿಸಬಹುದಾದ ನಿರ್ಧಾರ ನೀಡುವ ಹತ್ತು AI ಏಜೆಂಟ್‌ಗಳ ತಂಡ.",
    },
    tab: "home",
    dwell: 7000,
    feature: "Overview",
  },
  {
    title: {
      en: "It opens knowing where you are",
      hi: "खुलते ही आपकी जगह जानता है",
      kn: "ತೆರೆದ ಕೂಡಲೇ ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ತಿಳಿಯುತ್ತದೆ",
    },
    say: {
      en: "The moment the app opens it finds the fisher's position and reads the sea around it — no typing, no settings. He sees his answer before he asks a question.",
      hi: "ऐप खुलते ही मछुआरे की जगह ढूँढ लेता है और आसपास का समुद्र पढ़ लेता है — न कुछ टाइप करना, न कोई सेटिंग। सवाल पूछने से पहले ही जवाब सामने होता है।",
      kn: "ಆ್ಯಪ್ ತೆರೆದ ಕೂಡಲೇ ಮೀನುಗಾರರ ಸ್ಥಳವನ್ನು ಕಂಡು ಸುತ್ತಲಿನ ಸಮುದ್ರವನ್ನು ಓದುತ್ತದೆ — ಟೈಪಿಂಗ್ ಅಥವಾ ಸೆಟ್ಟಿಂಗ್ ಅಗತ್ಯವಿಲ್ಲ. ಪ್ರಶ್ನೆ ಕೇಳುವ ಮುನ್ನವೇ ಉತ್ತರ ಸಿದ್ಧವಾಗಿರುತ್ತದೆ.",
    },
    tab: "home",
    dwell: 9000,
    feature: "Auto location",
  },
  {
    title: {
      en: "Plain words, not weather jargon",
      hi: "सीधी भाषा, मौसम की तकनीकी नहीं",
      kn: "ಹವಾಮಾನ ಜಾರ್ಗನ್ ಅಲ್ಲ, ಸರಳ ಪದಗಳು",
    },
    say: {
      en: "Everything is written the way a fisherman speaks: do not enter the red area between 2 PM and 6 PM, areas 1, 2 and 3 are your best chances, stay about three hours.",
      hi: "सब कुछ उसी भाषा में जो मछुआरा बोलता है: दोपहर 2 से 6 बजे तक लाल इलाक़े में मत जाओ, जगह 1, 2, 3 सबसे अच्छी हैं, क़रीब तीन घंटे रुको।",
      kn: "ಎಲ್ಲವೂ ಮೀನುಗಾರರು ಮಾತನಾಡುವ ರೀತಿಯಲ್ಲಿ: ಮಧ್ಯಾಹ್ನ 2ರಿಂದ 6ರವರೆಗೆ ಕೆಂಪು ಪ್ರದೇಶಕ್ಕೆ ಹೋಗಬೇಡಿ, 1, 2 ಮತ್ತು 3ನೇ ಪ್ರದೇಶಗಳು ಉತ್ತಮ ಅವಕಾಶಗಳು, ಸುಮಾರು ಮೂರು ಗಂಟೆ ಇರಿ.",
    },
    tab: "home",
    dwell: 10000,
    feature: "Plain language",
  },
  {
    title: {
      en: "Where the fish are, within 100 km",
      hi: "100 किमी में मछली कहाँ है",
      kn: "100 ಕಿಮೀ ಒಳಗೆ ಮೀನು ಎಲ್ಲಿವೆ",
    },
    say: {
      en: "ORCA scores every ground within 100 kilometres for environmental suitability, and ranks them by what the trip is actually worth — a slightly better ground twice as far is usually the wrong advice.",
      hi: "ORCA 100 किलोमीटर के हर इलाक़े को पर्यावरणीय उपयुक्तता पर आँकता है, और यात्रा की असली क़ीमत से रैंक करता है — थोड़ी बेहतर पर दुगनी दूर जगह अक्सर ग़लत सलाह होती है।",
      kn: "ORCA 100 ಕಿಲೋಮೀಟರ್ ಒಳಗಿನ ಪ್ರತಿಯೊಂದು ಪ್ರದೇಶಕ್ಕೆ ಪರಿಸರ ಸೂಕ್ತತೆಯ ಅಂಕ ನೀಡಿ, ಪ್ರವಾಸದ ನಿಜವಾದ ಮೌಲ್ಯದಿಂದ ಕ್ರಮಗೊಳಿಸುತ್ತದೆ — ಸ್ವಲ್ಪ ಉತ್ತಮವಾದರೂ ಎರಡು ಪಟ್ಟು ದೂರದ ಪ್ರದೇಶ ಸಾಮಾನ್ಯವಾಗಿ ತಪ್ಪು ಸಲಹೆ.",
    },
    tab: "home",
    dwell: 10000,
    feature: "Environmental suitability",
  },
  {
    title: {
      en: "How long to stay, and the next two days",
      hi: "कितनी देर रुकें, और अगले दो दिन",
      kn: "ಎಷ್ಟು ಹೊತ್ತು ಇರಬೇಕು ಮತ್ತು ಮುಂದಿನ ಎರಡು ದಿನಗಳು",
    },
    say: {
      en: "It recommends how many hours to work the ground, what the trip should earn after fuel, and shows whether tomorrow or the day after will be better.",
      hi: "यह बताता है कि कितने घंटे काम करें, ईंधन के बाद यात्रा से कितना मिलेगा, और कल या परसों बेहतर होगा या नहीं।",
      kn: "ಎಷ್ಟು ಗಂಟೆ ಮೀನುಗಾರಿಕೆ ಮಾಡಬೇಕು, ಇಂಧನದ ನಂತರ ಪ್ರವಾಸದಿಂದ ಎಷ್ಟು ಲಾಭ, ಮತ್ತು ನಾಳೆ ಅಥವಾ ನಾಡಿದ್ದು ಉತ್ತಮವೇ ಎಂಬುದನ್ನು ಇದು ಹೇಳುತ್ತದೆ.",
    },
    tab: "home",
    dwell: 9000,
    feature: "Trip plan · economics",
  },
  {
    title: {
      en: "Ask in your own language",
      hi: "अपनी भाषा में पूछिए",
      kn: "ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಿ",
    },
    say: {
      en: "A fisherman near Mumbai asks in Kannada whether he can go out at 6 AM tomorrow. ORCA detects the language itself — no setting to change.",
      hi: "मुंबई के पास एक मछुआरा कन्नड़ में पूछता है कि कल सुबह 6 बजे जा सकता है या नहीं। ORCA भाषा ख़ुद पहचान लेता है — कोई सेटिंग नहीं बदलनी।",
      kn: "ಮುಂಬೈ ಹತ್ತಿರದ ಮೀನುಗಾರರು ನಾಳೆ ಬೆಳಿಗ್ಗೆ 6 ಗಂಟೆಗೆ ಹೊರಡಬಹುದೇ ಎಂದು ಕನ್ನಡದಲ್ಲಿ ಕೇಳುತ್ತಾರೆ. ORCA ಭಾಷೆಯನ್ನು ತಾನೇ ಗುರುತಿಸುತ್ತದೆ — ಯಾವುದೇ ಸೆಟ್ಟಿಂಗ್ ಬದಲಾಯಿಸಬೇಕಿಲ್ಲ.",
    },
    ask: "ನಾಳೆ ಬೆಳಿಗ್ಗೆ 6 ಗಂಟೆಗೆ ಮುಂಬೈ ಹತ್ತಿರ ಮೀನುಗಾರಿಕೆಗೆ ಹೋಗಬಹುದೇ?",
    dwell: 9000,
    feature: "Multilingual · voice",
  },
  {
    title: {
      en: "A decision, with reasons",
      hi: "फ़ैसला, कारणों के साथ",
      kn: "ಕಾರಣಗಳೊಂದಿಗೆ ನಿರ್ಧಾರ",
    },
    say: {
      en: "70 out of 100 — HIGH RISK. Every point is attributed: an active IMD fishermen warning, high waves, strong winds. Nothing is a black box.",
      hi: "100 में 70 — ज़्यादा जोखिम। हर अंक का हिसाब है: IMD की सक्रिय चेतावनी, ऊँची लहरें, तेज़ हवा। कुछ भी ब्लैक बॉक्स नहीं।",
      kn: "100ರಲ್ಲಿ 70 — ಹೆಚ್ಚಿನ ಅಪಾಯ. ಪ್ರತಿಯೊಂದು ಅಂಕಕ್ಕೂ ಕಾರಣವಿದೆ: IMD ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆ, ಎತ್ತರದ ಅಲೆಗಳು, ಬಲವಾದ ಗಾಳಿ. ಯಾವುದೂ ಬ್ಲ್ಯಾಕ್ ಬಾಕ್ಸ್ ಅಲ್ಲ.",
    },
    dwell: 9000,
    feature: "Explainable risk",
  },
  {
    title: {
      en: "It knows when to go instead",
      hi: "कब जाना ठीक है, यह भी बताता है",
      kn: "ಯಾವಾಗ ಹೋಗಬೇಕು ಎಂಬುದನ್ನೂ ಹೇಳುತ್ತದೆ",
    },
    say: {
      en: "The 24-hour timeline shows the safe window. ORCA does not just say no — it says conditions improve after 11:00, come back then.",
      hi: "24 घंटे की टाइमलाइन सुरक्षित समय दिखाती है। ORCA सिर्फ़ मना नहीं करता — कहता है 11 बजे के बाद हालात सुधरेंगे, तब आइए।",
      kn: "24 ಗಂಟೆಗಳ ಕಾಲರೇಖೆ ಸುರಕ್ಷಿತ ಸಮಯವನ್ನು ತೋರಿಸುತ್ತದೆ. ORCA ಕೇವಲ ಬೇಡ ಎಂದು ಹೇಳುವುದಿಲ್ಲ — 11 ಗಂಟೆಯ ನಂತರ ಪರಿಸ್ಥಿತಿ ಸುಧಾರಿಸುತ್ತದೆ, ಆಗ ಬನ್ನಿ ಎಂದು ಹೇಳುತ್ತದೆ.",
    },
    dwell: 8000,
    feature: "Risk timeline",
  },
  {
    title: {
      en: "It remembers the conversation",
      hi: "बातचीत याद रखता है",
      kn: "ಸಂಭಾಷಣೆಯನ್ನು ನೆನಪಿಡುತ್ತದೆ",
    },
    say: {
      en: "He asks a follow-up: what about 12 PM? ORCA keeps the place and the day, re-checks only what changed, and the risk drops to MODERATE.",
      hi: "वह आगे पूछता है: दोपहर 12 बजे क्या? ORCA जगह और दिन याद रखता है, सिर्फ़ बदला हुआ दोबारा जाँचता है, और जोखिम घटकर मध्यम हो जाता है।",
      kn: "ಅವರು ಮುಂದುವರಿಸಿ ಕೇಳುತ್ತಾರೆ: ಮಧ್ಯಾಹ್ನ 12 ಗಂಟೆಗೆ ಹೇಗಿರುತ್ತದೆ? ORCA ಸ್ಥಳ ಮತ್ತು ದಿನವನ್ನು ನೆನಪಿಟ್ಟು ಬದಲಾಗಿದ್ದನ್ನು ಮಾತ್ರ ಮರುಪರಿಶೀಲಿಸುತ್ತದೆ, ಅಪಾಯ ಮಧ್ಯಮವಾಗುತ್ತದೆ.",
    },
    ask: "ಮಧ್ಯಾಹ್ನ 12 ಗಂಟೆಗೆ ಹೇಗಿರುತ್ತದೆ?",
    followUp: true, // must NOT reset the session — that is the whole point
    dwell: 9000,
    feature: "Context memory",
  },
  {
    title: {
      en: "Official warnings always win",
      hi: "आधिकारिक चेतावनी हमेशा ऊपर",
      kn: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆಗಳು ಯಾವಾಗಲೂ ಮೇಲುಗೈ",
    },
    say: {
      en: "Near Paradip a severe cyclone warning is in force — and the storm is drawn on the chart, warning area hatched, track heading for the coast. A deterministic rule forces EXTREME.",
      hi: "पारादीप के पास भीषण चक्रवात की चेतावनी लागू है — तूफ़ान नक़्शे पर बना है, चेतावनी क्षेत्र और तट की ओर उसका रास्ता भी। एक निश्चित नियम EXTREME लागू कर देता है।",
      kn: "ಪಾರಾದೀಪ್ ಹತ್ತಿರ ತೀವ್ರ ಚಂಡಮಾರುತದ ಎಚ್ಚರಿಕೆ ಜಾರಿಯಲ್ಲಿದೆ — ಚಂಡಮಾರುತ, ಎಚ್ಚರಿಕೆ ಪ್ರದೇಶ ಮತ್ತು ಕರಾವಳಿಯತ್ತ ಸಾಗುವ ಮಾರ್ಗವನ್ನು ನಕ್ಷೆಯಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ. ಒಂದು ನಿಶ್ಚಿತ ನಿಯಮ EXTREME ಅನ್ನು ಜಾರಿಗೊಳಿಸುತ್ತದೆ.",
    },
    ask: "Is there a cyclone near Paradip? Can I go fishing?",
    dwell: 10000,
    feature: "Safety override",
  },
  {
    title: {
      en: "Where the fish are likely to be",
      hi: "मछली कहाँ मिल सकती है",
      kn: "ಮೀನುಗಳು ಎಲ್ಲಿರುವ ಸಾಧ್ಯತೆ ಇದೆ",
    },
    say: {
      en: "Asked in Hindi near Kochi, ORCA ranks potential fishing zones from sea-surface-temperature fronts and chlorophyll — the same reasoning INCOIS uses. It never claims to see fish.",
      hi: "कोच्चि के पास हिंदी में पूछने पर ORCA तापमान और क्लोरोफिल से संभावित मत्स्य क्षेत्र रैंक करता है — वही तरीक़ा जो INCOIS अपनाता है। मछली देखने का दावा कभी नहीं करता।",
      kn: "ಕೊಚ್ಚಿ ಹತ್ತಿರ ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿದಾಗ ORCA ಸಮುದ್ರದ ಮೇಲ್ಮೈ ತಾಪಮಾನ ಮತ್ತು ಕ್ಲೋರೊಫಿಲ್ ಆಧರಿಸಿ ಸಂಭಾವ್ಯ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳನ್ನು ಕ್ರಮಗೊಳಿಸುತ್ತದೆ — INCOIS ಬಳಸುವಂತಹ ತರ್ಕ. ಮೀನುಗಳನ್ನು ನೋಡಿದ್ದೇವೆ ಎಂದು ಎಂದಿಗೂ ಹೇಳುವುದಿಲ್ಲ.",
    },
    ask: "कोच्चि के पास मछली पकड़ने का क्षेत्र कहाँ है?",
    dwell: 10000,
    feature: "PFZ intelligence",
  },
  {
    title: {
      en: "The safest route is not the shortest",
      hi: "सबसे सुरक्षित रास्ता सबसे छोटा नहीं",
      kn: "ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗವೇ ಅತಿ ಚಿಕ್ಕದು ಅಲ್ಲ",
    },
    say: {
      en: "The direct track to the fishing ground cuts through a port channel and a naval exercise area. ORCA plans around them — five kilometres longer, and legal.",
      hi: "सीधा रास्ता बंदरगाह चैनल और नौसेना क्षेत्र से होकर जाता है। ORCA उनके चारों ओर से योजना बनाता है — पाँच किलोमीटर लंबा, पर क़ानूनी।",
      kn: "ನೇರ ಮಾರ್ಗವು ಬಂದರು ಕಾಲುವೆ ಮತ್ತು ನೌಕಾಪಡೆಯ ಪ್ರದೇಶದ ಮೂಲಕ ಸಾಗುತ್ತದೆ. ORCA ಅವುಗಳನ್ನು ತಪ್ಪಿಸಿ ಮಾರ್ಗ ರೂಪಿಸುತ್ತದೆ — ಐದು ಕಿಲೋಮೀಟರ್ ಉದ್ದವಾದರೂ ಕಾನೂನುಬದ್ಧ.",
    },
    ask: "Give me the safest route to the nearest fishing zone near Mumbai",
    dwell: 11000,
    feature: "Route + geofencing",
  },
  {
    title: {
      en: "Drag the boat anywhere",
      hi: "नाव कहीं भी खींचिए",
      kn: "ದೋಣಿಯನ್ನು ಎಲ್ಲಿಯಾದರೂ ಎಳೆಯಿರಿ",
    },
    say: {
      en: "The vessel marker is draggable. Drop it near a restricted area and ORCA geofences that exact position live — this is what warns a fisher before he crosses a maritime boundary.",
      hi: "नाव का निशान खींचा जा सकता है। प्रतिबंधित क्षेत्र के पास छोड़िए और ORCA उसी जगह की जाँच तुरंत करता है — यही मछुआरे को सीमा पार करने से पहले चेताता है।",
      kn: "ದೋಣಿಯ ಗುರುತನ್ನು ಎಳೆಯಬಹುದು. ಅದನ್ನು ನಿರ್ಬಂಧಿತ ಪ್ರದೇಶದ ಹತ್ತಿರ ಇಟ್ಟರೆ ORCA ಆ ಸ್ಥಳವನ್ನು ತಕ್ಷಣ ಪರಿಶೀಲಿಸುತ್ತದೆ — ಗಡಿ ದಾಟುವ ಮುನ್ನ ಮೀನುಗಾರರಿಗೆ ಎಚ್ಚರಿಕೆ ನೀಡುತ್ತದೆ.",
    },
    dwell: 9000,
    feature: "Live geofence",
  },
  {
    title: {
      en: "Ten agents, working in parallel",
      hi: "दस एजेंट, एक साथ",
      kn: "ಹತ್ತು ಏಜೆಂಟ್‌ಗಳು, ಏಕಕಾಲದಲ್ಲಿ",
    },
    say: {
      en: "The agent panel shows what actually ran: weather, ocean, fishing zones, alerts and GIS all fan out concurrently, then the risk engine waits for every one of them.",
      hi: "एजेंट पैनल दिखाता है कि असल में क्या चला: मौसम, समुद्र, मत्स्य क्षेत्र, चेतावनियाँ और GIS साथ-साथ चलते हैं, फिर रिस्क इंजन सबका इंतज़ार करता है।",
      kn: "ಏಜೆಂಟ್ ಫಲಕದಲ್ಲಿ ನಿಜವಾಗಿ ಏನು ನಡೆಯುತ್ತಿದೆ ಎಂಬುದು ಕಾಣುತ್ತದೆ: ಹವಾಮಾನ, ಸಮುದ್ರ, ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು, ಎಚ್ಚರಿಕೆಗಳು ಮತ್ತು GIS ಏಕಕಾಲದಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತವೆ, ನಂತರ ಅಪಾಯ ಎಂಜಿನ್ ಎಲ್ಲರಿಗಾಗಿ ಕಾಯುತ್ತದೆ.",
    },
    dwell: 9000,
    feature: "Agent crew",
  },
  {
    title: {
      en: "The engine room",
      hi: "इंजन रूम",
      kn: "ಎಂಜಿನ್ ಕೊಠಡಿ",
    },
    say: {
      en: "The system view shows the whole machine running: live providers feeding a 72-hour series cache, ten agents fanning out, the safety floors no model can undo — and the coast being read live, port by port.",
      hi: "सिस्टम व्यू पूरी मशीन चलती हुई दिखाता है: लाइव स्रोत, 72 घंटे का कैश, दस एजेंट, सुरक्षा नियम जिन्हें कोई मॉडल नहीं बदल सकता — और तट की लाइव रीडिंग, बंदरगाह-दर-बंदरगाह।",
      kn: "ಸಿಸ್ಟಮ್ ದೃಶ್ಯವು ಸಂಪೂರ್ಣ ಯಂತ್ರವನ್ನು ತೋರಿಸುತ್ತದೆ: ಲೈವ್ ಮೂಲಗಳು, 72 ಗಂಟೆಗಳ ಕ್ಯಾಶ್, ಹತ್ತು ಏಜೆಂಟ್‌ಗಳು, ಯಾವುದೇ ಮಾದರಿ ಬದಲಾಯಿಸಲಾಗದ ಸುರಕ್ಷತಾ ನಿಯಮಗಳು — ಮತ್ತು ಬಂದರುಗಟ್ಟಲೆ ಕರಾವಳಿಯ ಲೈವ್ ಓದು.",
    },
    tab: "system" as const,
    dwell: 11000,
    feature: "Architecture · live feed",
  },
  {
    title: {
      en: "It scales past one fisherman",
      hi: "एक मछुआरे से आगे",
      kn: "ಒಬ್ಬ ಮೀನುಗಾರನಿಗಿಂತ ಮುಂದೆ",
    },
    say: {
      en: "The authority view scores every landing centre on the coast with the same engine — the district administration sees the same evidence the fisher sees.",
      hi: "प्रशासन व्यू उसी इंजन से तट के हर लैंडिंग सेंटर को आँकता है — ज़िला प्रशासन वही प्रमाण देखता है जो मछुआरा देखता है।",
      kn: "ಪ್ರಾಧಿಕಾರ ದೃಶ್ಯವು ಅದೇ ಎಂಜಿನ್‌ನಿಂದ ಕರಾವಳಿಯ ಪ್ರತಿಯೊಂದು ಲ್ಯಾಂಡಿಂಗ್ ಕೇಂದ್ರಕ್ಕೆ ಅಂಕ ನೀಡುತ್ತದೆ — ಜಿಲ್ಲಾಡಳಿತವು ಮೀನುಗಾರರು ನೋಡುವ ಅದೇ ಸಾಕ್ಷ್ಯವನ್ನು ನೋಡುತ್ತದೆ.",
    },
    tab: "authority" as const,
    dwell: 10000,
    feature: "Authority dashboard",
  },
  {
    title: {
      en: "Built to be trusted",
      hi: "भरोसे के लिए बना",
      kn: "ನಂಬಿಕೆಗಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ",
    },
    say: {
      en: "Every value carries its source, timestamp and confidence. Simulated data is always labelled. ORCA is decision support — it never replaces an official advisory.",
      hi: "हर मान के साथ उसका स्रोत, समय और भरोसा है। नक़ली डेटा पर हमेशा लेबल है। ORCA निर्णय में सहायक है — आधिकारिक सलाह की जगह कभी नहीं लेता।",
      kn: "ಪ್ರತಿಯೊಂದು ಮೌಲ್ಯಕ್ಕೂ ಅದರ ಮೂಲ, ಸಮಯ ಮತ್ತು ವಿಶ್ವಾಸವಿದೆ. ಅನುಕರಿಸಿದ ಡೇಟಾಗೆ ಯಾವಾಗಲೂ ಲೇಬಲ್ ಇರುತ್ತದೆ. ORCA ನಿರ್ಧಾರಕ್ಕೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ — ಅಧಿಕೃತ ಸಲಹೆಗೆ ಎಂದಿಗೂ ಪರ್ಯಾಯವಲ್ಲ.",
    },
    tab: "home",
    dwell: 8000,
    feature: "Provenance",
  },
];

export default function GuidedTour({
  step,
  language = "en",
  paused,
  onPause,
  onNext,
  onPrev,
  onExit,
}: {
  step: number;
  language?: Language;
  paused: boolean;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}) {
  const s = TOUR[step];
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number>(Date.now());

  // Progress bar driven by wall-clock, not rAF, so it still advances when the
  // window is not compositing.
  useEffect(() => {
    startedAt.current = Date.now();
    setProgress(0);
    if (paused) return;
    const id = window.setInterval(() => {
      setProgress(Math.min(1, (Date.now() - startedAt.current) / s.dwell));
    }, 100);
    return () => window.clearInterval(id);
  }, [step, paused, s.dwell]);

  if (!s) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex justify-center p-4">
      <div
        className="panel rule-double pointer-events-auto w-full max-w-3xl shadow-2xl"
        style={{ background: "var(--paper-bright)" }}
      >
        {/* progress */}
        <div className="h-[3px] bg-ink-900/10">
          <div
            className="h-full bg-ink-900 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="flex items-start gap-4 px-5 py-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[2px] bg-ink-900 font-display text-[16px] font-black text-paper-50">
            {step + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-display text-[16px] font-bold text-ink-900">
                {s.title[language] ?? s.title.en}
              </h3>
              {s.feature && (
                <span className="border border-chart-500/50 bg-chart-100/50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-chart-700">
                  {s.feature}
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-400">
                {step + 1} / {TOUR.length}
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-700">
              {s.say[language] ?? s.say.en}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onPrev}
              disabled={step === 0}
              title="Previous"
              className="btn-square !h-8 !w-8 disabled:opacity-30"
            >
              ‹
            </button>
            <button
              onClick={onPause}
              title={paused ? "Resume" : "Pause"}
              className="grid h-9 w-9 place-items-center rounded-[2px] bg-ink-900 text-paper-50 transition hover:bg-ink-700"
            >
              {paused ? <PlayGlyph size={12} /> : <PauseGlyph size={12} />}
            </button>
            <button onClick={onNext} title="Next" className="btn-square !h-8 !w-8">
              ›
            </button>
            <button
              onClick={onExit}
              title="Exit tour"
              className="btn-square !h-8 !w-8 hover:!border-risk-extreme hover:!bg-risk-extreme"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
