import express from 'express';
import multer from 'multer';
import { evaluateAnswer, generateQuestions, generateSessionSummary, transcribeAudio, generateFollowUp } from '../services/gemini.js';
import { computeDeliveryMetrics, computeAlignment } from '../services/metrics.js';
import { checkGrounding } from '../services/grounding.js';
import { PERSONA_RUBRICS } from '../config/personas.js';
import questions from '../config/questions.js';
import { InMemoryRunner } from '@google/adk';
import { orchestratorAgent } from '../agents/interview_agents.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/interview/questions - Fetch all questions
router.get('/questions', (req, res) => {
  res.json(questions);
});

// POST /api/interview/answer - Process audio answer from frontend
router.post('/answer', upload.single('audio'), async (req, res, next) => {
  try {
    const audioFile = req.file;
    const questionId = parseInt(req.body.questionId, 10);
    let questionText = req.body.questionText;
    const isFollowUp = req.body.isFollowUp === 'true';
    const durationSeconds = parseFloat(req.body.durationSeconds) || 0;
    const persona = req.body.persona || 'generic';
    const rubric = PERSONA_RUBRICS[persona] || PERSONA_RUBRICS['generic'];
    
    let priorHistory = [];
    try {
      if (req.body.priorHistory) {
        priorHistory = JSON.parse(req.body.priorHistory);
      }
    } catch (e) {
      console.error("Failed to parse priorHistory", e);
    }

    if (!audioFile) {
      return res.status(400).json({ success: false, error: "No audio file provided." });
    }

    if (!questionId && !questionText) {
      return res.status(400).json({ success: false, error: "No question provided." });
    }

    if (questionId) {
      const question = questions.find(q => q.id === questionId);
      if (!question) {
        return res.status(400).json({ success: false, error: "Invalid questionId." });
      }
      questionText = question.text;
    }

    console.log(`Received audio file size: ${audioFile.size} bytes (${(audioFile.size / 1024).toFixed(2)} KB)`);

    // 5KB check
    if (audioFile.size < 5000) {
      return res.status(400).json({ success: false, error: "Audio too short or empty — please record a longer message." });
    }

    const useADK = process.env.USE_ADK_ORCHESTRATOR !== 'false';

    if (useADK) {
      try {
        console.log("Routing to ADK Orchestrator path");
        const transcriptionResult = await transcribeAudio(audioFile.buffer, audioFile.mimetype, questionText);

        if (transcriptionResult.status === 'error' || !transcriptionResult.transcript || transcriptionResult.transcript.trim() === '') {
          return res.status(400).json({
            success: false,
            error: "Failed to extract valid speech. Please try again."
          });
        }

        const runner = new InMemoryRunner({ agent: orchestratorAgent, appName: 'interview-app' });
        const stream = runner.runEphemeral({
          userId: 'user',
          stateDelta: { transcript: transcriptionResult.transcript, questionText, isFollowUp, priorHistory, rubric },
          newMessage: { parts: [{ text: "Please evaluate the candidate's answer." }] }
        });

        let evaluatorData = null;
        let coachData = null;

        for await (const event of stream) {
          if (event.author === 'EvaluatorAgent') {
            if (event.content && event.content.parts) {
              const textPart = event.content.parts.find((p) => p.text);
              if (textPart) {
                try {
                  evaluatorData = JSON.parse(textPart.text);
                } catch (e) {
                  console.error("Failed to parse evaluator JSON:", e);
                }
              }
            }
          } else if (event.author === 'CoachAgent') {
            if (event.content && event.content.parts) {
              const textPart = event.content.parts.find((p) => p.text);
              if (textPart) {
                try {
                  coachData = JSON.parse(textPart.text);
                } catch (e) {
                  console.error("Failed to parse coach JSON:", e);
                }
              }
            }
          }
        }

        if (!evaluatorData || !coachData) {
          throw new Error("Sequential sub-agents failed to evaluate the transcript.");
        }

        const metrics = computeDeliveryMetrics(transcriptionResult.transcript, durationSeconds);
        const alignment = computeAlignment(metrics.wpm, metrics.fillerRate, evaluatorData.specificityScore, evaluatorData.structureScore);
        const grounding = checkGrounding(transcriptionResult.transcript, coachData.modelRewrite);

        const finalData = {
          transcript: transcriptionResult.transcript,
          status: "success",
          ...evaluatorData,
          ...coachData,
          ...metrics,
          ...alignment,
          ...grounding,
          askFollowUp: !!(evaluatorData.followUpQuestion && evaluatorData.followUpQuestion.trim() !== ""),
          orchestratorReasoning: evaluatorData.orchestratorReasoning || "Merged agent decided follow up based on score.",
        };

        return res.json({
          success: true,
          data: finalData
        });
      } catch (err) {
        console.error("ADK Orchestrator failed, falling back to legacy evaluateAnswer", err);
      }
    }

    console.log("Handling request via Legacy Fallback Path");
    const evaluationResult = await evaluateAnswer(audioFile.buffer, audioFile.mimetype, questionText, priorHistory, rubric);

    // If Gemini flags it as an error (e.g. silent/no speech)
    if (evaluationResult.status === 'error' || !evaluationResult.transcript || evaluationResult.transcript.trim() === '') {
      return res.status(400).json({
        success: false,
        error: "Failed to extract valid speech. Please try again."
      });
    }

    // Simulate orchestrator logic for fallback path
    let askFollowUp = false;
    let followUpQuestion = "";
    let orchestratorReasoning = "No follow-up needed (Fallback default).";

    if (!isFollowUp) {
      const s = evaluationResult.specificityScore;
      const r = evaluationResult.relevanceScore;
      const st = evaluationResult.structureScore;

      if (evaluationResult.contradictionFlag) {
        // Priority 0: Contradiction forces a follow-up
        askFollowUp = true;
        orchestratorReasoning = "Fallback path flagged a contradiction and forced a follow-up.";
      } else if (s >= 0.8 && r >= 0.8 && st >= 0.8) {
        // Priority 1: Strong answer, default no follow-up
        askFollowUp = false;
      } else if (s < 0.6 || r < 0.6 || st < 0.6) {
        // Priority 2: Weak answer, always follow up
        askFollowUp = true;
      } else {
        // Priority 3: Scores between 0.6 and 0.8. 
        // The ADK orchestrator uses an LLM to check for "specific unexplained gaps" here.
        // Without an LLM in the fallback JS logic, we default to false to prevent over-triggering,
        // mirroring the ADK prompt's rule: "Default assumption... is NO follow-up".
        askFollowUp = false; 
      }
      
      if (askFollowUp) {
        try {
          const followUpData = await generateFollowUp(evaluationResult.transcript, questionText, evaluationResult.contradictionNote);
          followUpQuestion = followUpData.followUpQuestion || followUpData; // Depending on format
          if (!evaluationResult.contradictionFlag) {
            orchestratorReasoning = "Fallback path generated follow-up based on legacy score thresholds.";
          }
        } catch(e) {
          console.error("Fallback follow-up generation failed", e);
          askFollowUp = false;
        }
      }
    }

    const metrics = computeDeliveryMetrics(evaluationResult.transcript, durationSeconds);
    const alignment = computeAlignment(metrics.wpm, metrics.fillerRate, evaluationResult.specificityScore, evaluationResult.structureScore);
    const grounding = checkGrounding(evaluationResult.transcript, evaluationResult.modelRewrite);

    // Success response
    return res.json({
      success: true,
      data: {
        ...evaluationResult,
        ...metrics,
        ...alignment,
        ...grounding,
        askFollowUp,
        followUpQuestion,
        orchestratorReasoning
      }
    });
  } catch (error) {
    console.error("Error processing interview answer:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "An unexpected error occurred while processing the answer."
    });
  }
});

// POST /api/interview/followup - Generate follow up question
router.post('/followup', async (req, res, next) => {
  try {
    const { transcript, originalQuestion } = req.body;

    if (!transcript || !originalQuestion) {
      return res.status(400).json({ success: false, error: "Missing transcript or originalQuestion." });
    }

    const result = await generateFollowUp(transcript, originalQuestion);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error generating follow-up:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "An unexpected error occurred while generating follow-up."
    });
  }
});


// POST /api/interview/generate-questions - Generate questions based on job description
router.post('/generate-questions', async (req, res) => {
  try {
    const { jobDescription, persona } = req.body;
    if (!jobDescription || jobDescription.trim() === '') {
      return res.json(questions);
    }
    
    const rubric = PERSONA_RUBRICS[persona] || PERSONA_RUBRICS['generic'];
    const generated = await generateQuestions(jobDescription, rubric);
    if (Array.isArray(generated) && generated.length > 0) {
      return res.json(generated);
    }
    // Fallback if returned empty or wrong format
    return res.json(questions);
  } catch (error) {
    console.error("Error generating questions, falling back to default:", error);
    return res.json(questions);
  }
});

// POST /api/interview/summary - Generate summary of session
router.post('/summary', async (req, res) => {
  const { sessionResults } = req.body;
  
  if (!sessionResults || !Array.isArray(sessionResults)) {
    return res.status(400).json({ success: false, error: "Missing sessionResults." });
  }

  try {
    const generated = await generateSessionSummary(sessionResults);
    return res.json(generated);
  } catch (error) {
    console.error("Error generating session summary:", error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

export default router;
