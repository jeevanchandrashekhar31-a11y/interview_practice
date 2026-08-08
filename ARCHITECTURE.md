# System Architecture Overview

This document outlines the architecture of the AI-Powered Interview Coach application, separated into three logical layers: the Client Layer, Application & Orchestration Layer, and the Google AI / Cloud Services Layer.

## Layer 1: Client & User Experience
The frontend is built for simplicity and high performance, executing exclusively in the browser.

*   **Browser Client (Interview UI):** A Vanilla HTML/CSS/JS frontend.
*   **Audio Capture:** Implements the `MediaRecorder API` to record user speech. 
*   **Silence Detection:** An initial client-side guardrail that calculates the Root Mean Square (RMS) of audio buffers, immediately rejecting empty or excessively quiet recordings (`rms < 0.01`) to save backend bandwidth.
*   **Scorecard Engine:** An HTML5 Canvas implementation that takes the final aggregated session data and draws a shareable graphical scorecard, triggering a local PNG download without needing a backend rendering service.

## Layer 2: Application & Orchestration (Node.js)
The middle tier is a completely stateless Express.js server. Because no session data is stored on disk or in a database, the system avoids synchronization issues and scales easily.

*   **Interview Backend Service:** An Express.js router that manages raw audio buffering using `Multer` (in-memory) and acts as the gateway to the AI orchestrator. It receives the `priorHistory` from the client on every request to maintain context.
*   **Google Antigravity (ADK) Orchestrator:** The core agent framework. It runs a `SequentialAgent` pipeline via an `InMemoryRunner`, handling the flow of data between the LLM agents.
*   **Evaluator Agent (Agent 1):** The first agent in the ADK pipeline. It performs strict numerical scoring (Specificity, Relevance, Structure), generates an interviewer "scorecard note", and executes the **Contradiction Engine** to cross-reference current answers against past statements. Based on these outputs, it dynamically decides if a follow-up question is warranted.
*   **Coach Agent (Agent 2):** The second agent in the pipeline. It takes the original transcript and rewrites it into a perfect STAR (Situation, Task, Action, Result) format in the first person.
*   **Deterministic Rules Engine:** A side-car layer of pure Node.js logic that executes post-processing on the LLM outputs:
    *   *Delivery Metrics:* Calculates Words-Per-Minute (WPM) and filler word ratios.
    *   *Grounding Checker:* Deterministically extracts proper nouns and standalone numbers from the Coach Agent's rewrite and ensures they exist in the raw transcript, flagging any unsupported claims to prevent AI hallucination.

## Layer 3: Google AI & Cloud Services
The foundation layer providing the actual machine learning inference capabilities.

*   **Gemini Speech-to-Text:** Serves as the initial transcription layer, converting the WebM audio buffers from the backend into raw text transcripts before agent processing begins.
*   **Gemini 1.5 Flash-Lite:** The primary Large Language Model (LLM) powering both the Evaluator and Coach agents. It was chosen for its optimal balance of ultra-low latency (~1.5s inference) and cost-efficiency.
*   **Direct Gemini API (Fallback Circuit Breaker):** A resilient legacy path. If the ADK Orchestrator fails or times out, the backend bypasses the agent pipeline and calls the standard Gemini API SDK directly to ensure the user still receives baseline feedback.

---

## Data Flow
1. **Stream Audio:** The Browser Client captures and streams a WebM audio buffer to the Interview Backend Service.
2. **Transcription:** The Backend passes the buffer to Gemini Speech-to-Text, returning a transcript.
3. **Orchestrate Pipeline:** The Backend injects the transcript, question text, and prior history into the ADK Orchestrator.
4. **Step 1 - Evaluate:** The Evaluator Agent runs inference against Gemini 1.5 Flash-Lite to generate scores and detect contradictions.
5. **Step 2 - Coach Rewrite:** The Coach Agent runs inference to rewrite the answer.
6. **Grounding & WPM Check:** The raw outputs pass through the Deterministic Rules Engine for pacing analysis and hallucination checks.
7. **Final Payload:** The consolidated, validated JSON payload is returned to the Browser Client for UI rendering.
*(If Step 3 fails, the system routes directly to the Fallback Circuit Breaker in Step 2).*
