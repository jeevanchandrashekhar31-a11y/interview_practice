# 🎙️ Interview Practice App

**Real-time, AI-driven mock interviews with agentic feedback and dynamic follow-up questioning.**

[**🔴 Live Demo**](https://interview-practice-jxtc.onrender.com/)

---

## 📌 Overview

The **Interview Practice App** helps candidates refine their interview skills by simulating realistic, conversational interview environments. Instead of static forms or rigid text inputs, candidates answer questions verbally using their microphone. An orchestrated pipeline of AI agents transcribes the audio, evaluates the response, provides structured coaching, and decides in real-time whether a follow-up question is necessary to probe deeper into unexplained gaps.

## ✨ Key Features

- **🗣️ Voice-First Interaction**: Uses the browser's native `MediaRecorder` API to capture verbal responses, simulating the pressure and flow of a real interview.
- **🧠 ADK Agent Pipeline**: Powered by Google's Agent Development Kit (ADK), the application routes data through specialized agents:
  - **EvaluatorAgent**: Scores the answer based on Specificity, Relevance, and Structure (STAR method), and decides if a follow-up question is needed.
  - **CoachAgent**: Rewrites the candidate's answer into a polished, professional narrative.
  - **InterviewerAgent**: (When triggered) Generates a highly specific follow-up question targeting vague or unexplained claims in the candidate's answer.
- **⚡ Single-Pass Orchestration**: The Evaluator and Coach are bundled into a `SequentialAgent` for optimal latency and reduced API calls, passing state seamlessly down the chain.
- **🛡️ Fallback Resiliency**: Features a robust legacy fallback path using direct Gemini API calls if the ADK orchestrator is disabled or encounters an error, ensuring uninterrupted service.

## 🏗️ Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js + Express (ESM) |
| **Agent Framework** | `@google/adk` (Agent Development Kit) |
| **AI Model** | Gemini (`gemini-3.1-flash-lite`) via `@google/generative-ai` |
| **Frontend** | Vanilla HTML / CSS / JS (No heavy framework dependencies) |
| **Hosting** | Containerized via Docker, deployed on Render |

## 🚀 Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jeevanchandrashekhar31-a11y/interview_practice.git
   cd interview_practice
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=8080
   USE_ADK_ORCHESTRATOR=true
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:8080`.

## 🧪 Testing

The repository includes programmatic testing scripts to verify the ADK orchestration logic locally without the frontend:

```bash
# Run the pipeline against pre-recorded transcript scenarios
npx tsx --env-file=.env server/scripts/verify_9b_merged.ts
```