# Product Requirements Document (PRD): AI-Powered Interview Coach

## 1. Executive Summary
The AI-Powered Interview Coach is a high-performance, web-based mock interview platform designed to provide job seekers with instantaneous, high-fidelity feedback on behavioral interview questions. By leveraging Google’s Antigravity (ADK) framework and Gemini 1.5 Flash-Lite, the system orchestrates multiple specialized AI agents to evaluate transcripts, detect factual contradictions, and rewrite responses into the industry-standard STAR (Situation, Task, Action, Result) format—all within a target latency of under 4 seconds.

## 2. Problem Statement
Job seekers often lack access to high-quality, objective feedback for behavioral interviews. Existing AI solutions typically provide generic advice or suffer from high latency and "hallucinations" (inventing facts the candidate didn't say). There is a need for a tool that provides rigorous, grounded evaluation, detects inconsistencies across a session, and offers actionable, rewritten examples of how to improve.

## 3. Goals & Objectives
*   **Real-time Feedback:** Deliver a comprehensive feedback payload in under 4 seconds.
*   **High Fidelity:** Ensure all AI-generated advice is grounded in the candidate's actual spoken words.
*   **Agentic Intelligence:** Use a multi-agent pipeline to separate "evaluation" from "coaching" for higher accuracy.
*   **Scalability:** Maintain a stateless backend to support high concurrent user volume without complex session management.
*   **Engagement:** Provide shareable, visual "scorecards" to encourage viral growth and repeat usage.

## 4. Target Users / Stakeholders
*   **Candidates:** Job seekers practicing for behavioral interviews (STAR method).
*   **Persona-Specific Users:** Candidates targeting specific environments (e.g., Google GCA, Startup Hacker).
*   **Engineering Leadership:** Stakeholders focused on system resilience, latency, and cost-efficiency.

## 5. Functional Requirements

### 5.1 Interview Setup & Persona Selection
*   The system shall allow users to select from predefined Interview Personas (e.g., Generic STAR, Google GCA, Startup Hacker).
*   The system shall present a behavioral question based on the selected persona.

### 5.2 Audio Capture & Client-Side Processing
*   The system shall capture user audio via the **MediaRecorder API**.
*   The system shall implement a local **RMS-based silence detection engine** to prevent the submission of empty or silent recordings.
*   The system shall stream audio to the backend in WebM format.

### 5.3 Agentic Orchestration (Google ADK)
*   The system shall use a **SequentialAgent pipeline** to process the transcript.
*   **Evaluator Agent:**
    *   Assign numerical scores (0-100) for Specificity, Relevance, and Structure.
    *   Generate internal "interviewer scorecard notes."
    *   Determine if a follow-up question is required based on score thresholds or vague answers.
*   **Coach Agent:**
    *   Rewrite the candidate's answer into a first-person STAR format.
    *   Strictly adhere to the facts provided in the transcript.

### 5.4 Deterministic Rules Engine (Side-car)
*   **Grounding Checker:** Cross-reference proper nouns and numbers in the Coach Agent's rewrite against the original transcript to flag unverified claims.
*   **Delivery Metrics:** Calculate Words-Per-Minute (WPM) and filler word frequency (e.g., "um", "ah", "like").
*   **Alignment Matrix:** Combine delivery metrics with content scores to categorize the performance (e.g., "Confident but Vague").

### 5.5 Session Management & Follow-ups
*   **Contradiction Engine:** Compare the current answer against the session history to flag factual or characterological inconsistencies.
*   **Dynamic Follow-ups:** Trigger follow-up questions if the Evaluator Agent detects a contradiction or a low specificity score.

### 5.6 Reporting & Sharing
*   The system shall generate a **Feedback Card** containing scores, notes, and the STAR rewrite.
*   The system shall use an **HTML5 Canvas engine** to generate a shareable, offline scorecard image for social sharing.

## 6. Non-Functional Requirements
*   **Latency:** Total round-trip time (audio submission to feedback) must be < 4 seconds.
*   **Statelessness:** The backend must not store session state; all history must be passed from the client in each request.
*   **Resilience:** A circuit breaker must exist to bypass the ADK orchestrator and call the Gemini API directly if the agent pipeline fails.
*   **Cost Efficiency:** Use Gemini 1.5 Flash-Lite to minimize inference costs.

## 7. System Architecture Overview
The system is divided into three logical layers:
1.  **Client Layer:** Vanilla HTML/JS frontend handling audio capture, silence detection, and scorecard rendering.
2.  **Application & Orchestration Layer:** Node.js/Express backend managing the Google ADK pipeline and the Deterministic Rules Engine.
3.  **Google AI & Cloud Layer:** Gemini Speech-to-Text for transcription and Gemini 1.5 Flash-Lite for agentic reasoning.

## 8. Tech Stack
*   **Frontend:** Vanilla JavaScript, MediaRecorder API, HTML5 Canvas, Web Audio API.
*   **Backend:** Node.js, Express.js, TypeScript, Multer (audio buffering).
*   **AI Orchestration:** Google Antigravity (ADK) Framework, `InMemoryRunner`.
*   **AI Models:** Gemini 1.5 Flash-Lite, Gemini Speech-to-Text API.
*   **Patterns:** SequentialAgent Pipeline, Circuit Breaker (Fallback).

## 9. Data Requirements
*   **Stateless Flow:** The client maintains an array of `[{question, transcript, score}]` and sends the full context to the backend with every new recording.
*   **Audio Format:** WebM (Client) converted to raw buffers (Backend) for Gemini STT.
*   **Payload:** JSON-based communication between the Orchestrator and the Rules Engine.

## 10. API Specifications
*   **POST /api/interview/process:**
    *   **Input:** Multipart/form-data (Audio file + JSON session history + Persona ID).
    *   **Output:** JSON object containing `transcript`, `scores`, `star_rewrite`, `follow_up_question` (optional), `grounding_flags`, and `delivery_metrics`.

## 11. Security Requirements
*   **Authentication:** API endpoints should be protected via standard Auth headers (if integrated with a user system).
*   **Data Privacy:** Audio buffers must be processed in memory and never persisted to disk to ensure candidate privacy.
*   **API Protection:** Implement rate limiting on the Express server to prevent Gemini API quota exhaustion.

## 12. Deployment & Infrastructure
*   **Environment:** Node.js runtime (v18+).
*   **Cloud:** Optimized for Google Cloud Platform (GCP) to minimize latency between the backend and Gemini services.
*   **CI/CD:** Automated testing for the Deterministic Rules Engine to ensure WPM and Grounding logic remains accurate.

## 13. Success Metrics
*   **Average Response Latency:** Target < 4.0s.
*   **Grounding Accuracy:** < 5% false positive rate for unverified claim flags.
*   **User Retention:** Percentage of users completing a full 5-question interview session.
*   **Virality:** Number of scorecard images generated/downloaded.

## 14. Timeline & Milestones
*   **Phase 1 (MVP):** Basic STT and single-agent feedback (Evaluator only).
*   **Phase 2 (Agentic Core):** Integration of ADK, SequentialAgent pipeline, and Coach Agent.
*   **Phase 3 (Logic & Resilience):** Deterministic Rules Engine, Grounding Checker, and Fallback Circuit Breaker.
*   **Phase 4 (UX/Polish):** Canvas scorecard generation and Persona-specific prompt tuning.

## 15. Open Questions & Risks
*   **Risk:** Gemini 1.5 Flash-Lite latency may spike during peak hours, threatening the 4s target.
*   **Risk:** Client-side silence detection may vary across different hardware/microphones.
*   **Question:** Should we support multi-language interviews, or is the initial scope strictly English?
*   **Question:** Will the "Contradiction Engine" require a larger context window if the interview exceeds 10+ questions?