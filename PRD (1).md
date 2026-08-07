# Interview Practice — Product Requirements Document

## 1. Summary
Interview Practice is a voice-first web application that helps job seekers rehearse
interview answers and receive immediate, structured AI feedback. The user speaks their
answer, and a multi-agent evaluation pipeline built on Google's Agent Development Kit
(ADK) scores it, rewrites it into a stronger STAR-structured version, and dynamically
decides whether a real interviewer would naturally probe deeper — asking a targeted
follow-up only when one is actually warranted.

## 2. Problem Statement
Most interview-prep tools are either static question banks with no feedback, or generic
AI graders that score a submitted answer once and stop. Neither replicates what makes a
real interview hard: a good interviewer listens, adapts, and pushes back on vague or
incomplete answers in real time. Job seekers rehearsing alone get no equivalent of that
pressure, and generic feedback ("be more specific") doesn't tell them what was actually
missing.

## 3. Target Users
Job seekers preparing for behavioral and technical interviews — students, career
changers, and professionals targeting a specific role, who want to rehearse out loud
(not just think through answers silently) and get feedback that reacts to what they
actually said.

## 4. Core User Flow
1. **Setup** — user optionally pastes a job description; the app generates 6 tailored
   interview questions across fixed categories (Intro, Strength, Weakness, Challenge,
   Motivation, Behavioral). If skipped, a static default question set is used.
2. **Record** — user records a spoken answer via the browser's MediaRecorder API.
3. **Local silence check** — the client computes RMS energy on the recording and
   rejects empty/near-silent audio before it's ever uploaded, saving an API call.
4. **Transcription** — the backend sends the audio to Gemini's multimodal endpoint,
   which returns an accurate transcript.
5. **Multi-agent evaluation** — the transcript is passed into an ADK `SequentialAgent`
   pipeline:
   - **EvaluatorAgent** scores the answer on Specificity, Relevance, and Structure
     (STAR presence), each 0.0–1.0, generates 2–3 actionable feedback points, and
     decides — using an explicit priority-tiered rule set, not a blanket threshold —
     whether a follow-up question is warranted, generating one if so.
   - **CoachAgent** rewrites the answer in clean STAR structure, strictly limited to
     facts the candidate actually stated (no invented details).
6. **Feedback** — scores, feedback, and the model rewrite render in the UI. If a
   follow-up was triggered, a "Continue" button lets the user record a response to it,
   which is scored the same way (with follow-up chaining capped at one level deep).
7. **Completion** — once all questions (and any follow-ups) are answered, a summary
   screen shows average scores across the three dimensions, flags the single weakest
   area, and lists a per-question breakdown.

## 5. Feature List

**Core interaction**
- Voice-first recording and playback (no typed answers)
- Client-side silence detection before upload
- Job-description-driven question tailoring, with graceful fallback to a static set

**AI / Agent layer**
- Multi-agent architecture built on Google ADK (TypeScript), not a single scripted
  Gemini call
- Dynamic, content-aware follow-up decisioning — the agent reasons about *what was
  actually said* (e.g. a mentioned-but-unexplained claim) rather than only thresholding
  a numeric score
- STAR-structured model rewrite grounded strictly in the candidate's own stated facts
- Follow-up chaining capped at one level per question to avoid runaway loops

**Resilience / production-readiness**
- `USE_ADK_ORCHESTRATOR` feature flag with a fully independent fallback evaluation path
  (direct Gemini calls, same response schema, same tuned decision thresholds) so the
  app degrades gracefully rather than failing if the agent layer has an issue
- Graceful handling of microphone permission denial and network upload failures
- Verified end-to-end on both the primary and fallback paths before deployment

**UI/UX**
- Session progress indicator ("Question X of Y")
- Live waveform visualization during recording, driven by real mic amplitude (reuses
  the same audio analyser used for the silence check)
- Distinct typographic treatment for the live transcript (monospace) versus UI chrome
- Collapsible "Agent Trace" panel showing which agents fired and their reasoning, for
  transparency into the decision-making process

## 6. Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS, MediaRecorder API, Web Audio API (RMS + waveform)
- **Backend:** Node.js, Express, Multer (in-memory audio upload)
- **AI:** Google Gemini API (`gemini-3.1-flash-lite`), multimodal audio transcription,
  Google Agent Development Kit (`@google/adk`) for multi-agent orchestration
- **Deployment:** Docker, deployed on Render

## 7. Success Metrics (for this build)
- A full session (base questions + at least one follow-up) completes end to end with
  no errors, on both the primary and fallback evaluation paths
- The follow-up decision measurably tracks answer quality: strong/complete answers do
  not trigger a follow-up; vague answers do; answers with a specific-but-unexplained
  claim are correctly flagged even when their aggregate score isn't the lowest
- The model rewrite never introduces facts absent from the original transcript

## 8. Explicit Non-Goals (cut for scope, given solo development and a fixed deadline)
- Real-time streaming conversational interview (Gemini Live API) — the follow-up loop
  is a discrete evaluate-then-ask cycle, not a continuous live conversation
- Video/webcam analysis (pacing, eye contact) — audio-only
- Persistent user accounts or cross-session progress history
- Filler-word / speech-pace / prosody scoring
