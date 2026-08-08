import { LlmAgent, SequentialAgent } from '@google/adk';
import { z } from 'zod';

export const evaluatorAgent = new LlmAgent({
  name: 'EvaluatorAgent',
  model: 'gemini-3.1-pro',
  description: 'Evaluates the candidate\'s answer on specificity, relevance, and structure.',
  inputSchema: z.object({
    transcript: z.string(),
    questionText: z.string(),
    isFollowUp: z.boolean(),
    priorHistory: z.array(z.object({
      questionText: z.string(),
      transcript: z.string()
    })).optional(),
    rubric: z.string().optional(),
  }),
  outputSchema: z.object({
    specificityScore: z.number().min(0).max(1),
    relevanceScore: z.number().min(0).max(1),
    structureScore: z.number().min(0).max(1),
    feedback: z.array(z.string()),
    followUpQuestion: z.string(),
    orchestratorReasoning: z.string(),
    contradictionFlag: z.boolean(),
    contradictionNote: z.string().nullable(),
    scorecardNote: z.string()
  }),
  instruction: `You are an expert interview coach evaluating a candidate's verbal response.

Question: {{questionText}}
Transcript: {{transcript}}
Is Follow-Up?: {{isFollowUp}}

Persona / Rubric Focus: {{rubric}}

When providing feedback and generating a followUpQuestion, calibrate your tone and your specific areas of focus according to the Persona / Rubric Focus provided above (if any).

Listen to the provided transcript and perform the following tasks:
1. Score the answer from 0.0 to 1.0 on specificity/concreteness (vague, generic answers score low; answers with real concrete detail score high).
2. Score the answer from 0.0 to 1.0 on how directly it answers the actual question asked (relevance).
3. Score the answer from 0.0 to 1.0 on structure (whether Situation/Task/Action/Result are identifiably present).
4. Give 2-3 short, specific, actionable feedback points. Do not give generic encouragement. Focus on exactly what the candidate should improve or what specific thing they did exceptionally well.
5. Write a "scorecardNote" — a 1-2 sentence note (under 30 words) in the voice of an interviewer's internal scorecard comment, specific to the actual answer (not generic).
6. DECIDE whether a follow-up is warranted using this exact priority order:
   - If isFollowUp is true: ALWAYS set followUpQuestion to "". We never chain follow-ups.
   - Priority 1: If specificityScore, relevanceScore, AND structureScore are all 0.8 or higher, the answer is strong and complete. Default to followUpQuestion: "". ONLY override this and ask a follow-up if there is a specific outcome, decision, or result stated in the transcript WITHOUT any explanation of the reasoning or mechanism behind it.
   - Priority 2: If any score is below 0.6, generate a followUpQuestion targeting the weakest, most under-explained part of the answer.
   - Priority 3: For scores in between, follow up only if you can name a specific claim, decision, or outcome that is mentioned but not explained.
   - Default assumption for any complete, well-scored answer is NO follow-up (followUpQuestion: "").
7. Compare this answer to the prior answers given in priorHistory. If there is a factual or characterological contradiction, set contradictionFlag=true and write a contradictionNote phrasing the tension neutrally. If contradicted, force followUpQuestion to ask about this contradiction and set orchestratorReasoning accordingly, overriding the priority-tier rules. If no contradiction, set contradictionFlag=false and contradictionNote=null.
8. Populate "orchestratorReasoning" with a single sentence explaining your decision whether to ask a followUpQuestion or not.`,
});

export const coachAgent = new LlmAgent({
  name: 'CoachAgent',
  model: 'gemini-3.1-flash',
  description: 'Rewrites the candidate\'s answer into a stronger STAR structure.',
  inputSchema: z.object({
    transcript: z.string(),
  }),
  outputSchema: z.object({
    modelRewrite: z.string(),
  }),
  instruction: `You are an expert interview coach rewriting a candidate's verbal response.

Transcript: {{transcript}}

Review the EvaluatorAgent's scores and feedback from the conversation history.
Rewrite the candidate's answer in a clear STAR structure (Situation, Task, Action, Result), in 3-5 sentences, from the first-person perspective, as if the candidate had said it that way. CRITICAL: Use ONLY facts, numbers, and experiences the candidate actually mentioned. Do not invent any new details.`,
});

export const orchestratorAgent = new SequentialAgent({
  name: 'OrchestratorAgent',
  subAgents: [evaluatorAgent, coachAgent]
});
