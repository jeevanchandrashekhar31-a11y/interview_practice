import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

export async function transcribeAudio(audioBuffer, mimeType, questionText) {
  if (!genAI) {
    throw new Error("Gemini API not configured properly.");
  }

  // Using the requested model; to be swapped to gemini-3.5-flash later
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-pro',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

    const prompt = `You are an expert interview transcription assistant.

Listen to the provided audio answer and perform the following tasks:
1. Transcribe the answer accurately.
2. If the audio contains no discernible speech or is completely silent, you must return transcript: "", status: "error", and do not invent any answer content under any circumstances.

Respond with ONLY valid JSON matching this schema:
{
  "transcript": "string",
  "status": "success" | "error"
}`;

  const audioPart = {
    inlineData: {
      data: audioBuffer.toString('base64'),
      mimeType: mimeType
    }
  };

  try {
    const result = await model.generateContent([prompt, audioPart]);
    const text = result.response.text();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log("--- RAW GEMINI RESPONSE ---");
      console.log(text);
      console.log("---------------------------");
    }

    // In case the model includes markdown formatting despite the JSON MIME type
    const jsonString = text.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error in transcribeAudio (Gemini API):', error);
    return {
      transcript: "",
      status: "error"
    };
  }
}

export async function evaluateAnswer(audioBuffer, mimeType, questionText, priorHistory = [], rubric = 'Focus on standard STAR methodology (Situation, Task, Action, Result). Evaluate clarity, standard professional competency, and structured storytelling.') {
  if (!genAI) {
    throw new Error("Gemini API not configured properly.");
  }

  // Using the requested model; to be swapped to gemini-3.5-flash later
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-pro',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `You are an expert interview coach evaluating a candidate's verbal response.

The interview question asked is:
"${questionText}"

Prior History:
${JSON.stringify(priorHistory)}

Persona / Rubric Focus:
${rubric}

Listen to the provided audio answer and perform the following tasks:
1. Transcribe the answer accurately.
2. If the audio contains no discernible speech or is completely silent, you must return transcript: "", status: "error", and do not invent any answer content under any circumstances.
3. Score the answer from 0.0 to 1.0 on specificity/concreteness (vague, generic answers score low; answers with real concrete detail score high).
4. Score the answer from 0.0 to 1.0 on how directly it answers the actual question asked (relevance).
5. Score the answer from 0.0 to 1.0 on structure (whether Situation/Task/Action/Result are identifiably present).
6. Give 2-3 short, specific, actionable feedback points. Do not give generic encouragement. Focus on exactly what the candidate should improve or what specific thing they did exceptionally well.
7. Write a "scorecardNote" — a 1-2 sentence note (under 30 words) in the voice of an interviewer's internal scorecard comment, specific to the actual answer (not generic).
8. Rewrite the candidate's answer in a clear STAR structure (Situation, Task, Action, Result), in 3-5 sentences, from the first-person perspective, as if the candidate had said it that way. CRITICAL: Use ONLY facts, numbers, and experiences the candidate actually mentioned. Do not invent any new details.
9. Compare this answer to the prior answers given in Prior History. If there is a factual or characterological contradiction, set contradictionFlag=true and write a contradictionNote phrasing the tension neutrally. If no contradiction, set contradictionFlag=false and contradictionNote=null.

Respond with ONLY valid JSON matching this schema:
{
  "transcript": "string",
  "specificityScore": number,
  "relevanceScore": number,
  "structureScore": number,
  "feedback": ["string", "string"],
  "scorecardNote": "string",
  "modelRewrite": "string",
  "status": "success" | "error",
  "contradictionFlag": boolean,
  "contradictionNote": "string" | null
}`;

  const audioPart = {
    inlineData: {
      data: audioBuffer.toString('base64'),
      mimeType: mimeType
    }
  };

  try {
    const result = await model.generateContent([prompt, audioPart]);
    const text = result.response.text();
    
    if (process.env.NODE_ENV !== 'production') {
      console.log("--- RAW GEMINI RESPONSE ---");
      console.log(text);
      console.log("---------------------------");
    }

    // In case the model includes markdown formatting despite the JSON MIME type
    const jsonString = text.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error in evaluateAnswer (Gemini API):', error);
    return {
      transcript: "",
      specificityScore: 0,
      relevanceScore: 0,
      structureScore: 0,
      feedback: [],
      modelRewrite: "",
      status: "error"
    };
  }
}

export async function generateFollowUp(transcript, originalQuestion, contradictionNote = null) {
  if (!genAI) {
    throw new Error("Gemini API not configured properly.");
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-pro',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `You are an expert interviewer. The candidate just answered the following question:
"${originalQuestion}"

Their answer was:
"${transcript}"

${contradictionNote ? `The candidate's answer contradicted a previous answer: "${contradictionNote}". Your task is to generate exactly one natural follow-up question that addresses this contradiction. Phrase the follow-up neutrally, naming the specific tension between the answers.` : `Your task is to generate exactly one natural follow-up question that probes deeper into something specific the candidate mentioned (a claim, a number, a named tool, a decision they made). Make it conversational and relevant.`}

Respond with ONLY valid JSON matching this schema:
{
  "followUpQuestion": "string"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonString = text.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error in generateFollowUp (Gemini API):', error);
    throw new Error("Failed to generate follow-up question.");
  }
}


export async function generateQuestions(jobDescription, rubric = 'Focus on standard STAR methodology (Situation, Task, Action, Result). Evaluate clarity, standard professional competency, and structured storytelling.') {
  if (!genAI) {
    throw new Error("Gemini API not configured properly.");
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-pro',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `You are an expert technical recruiter preparing an interview for the following job description:
"${jobDescription}"

Your task is to generate exactly 6 interview questions tailored to the skills and role in the job description, and calibrated using this Persona / Rubric Focus:
"${rubric}"

The 6 questions must strictly follow this order of categories:
1. "intro"
2. "strength"
3. "weakness"
4. "challenge"
5. "motivation"
6. "behavioral"

Respond with ONLY a valid JSON array of objects, with no markdown formatting. Each object must exactly match this schema:
[
  {
    "id": number (e.g. 1 to 6),
    "text": "string (the interview question)",
    "category": "string (exactly one of: intro, strength, weakness, challenge, motivation, behavioral)"
  }
]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonString = text.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error in generateQuestions (Gemini API):', error);
    throw new Error("Failed to generate questions.");
  }
}

export async function generateSessionSummary(sessionResults) {
  if (!genAI) {
    throw new Error("Gemini API not configured properly.");
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-pro',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });

  const prompt = `You are an expert interview coach wrapping up a practice session.

Here are the candidate's answers and scores for the session:
${JSON.stringify(sessionResults, null, 2)}

Provide a concise, 2-3 sentence overarching piece of advice on what they should focus on before a real interview. Focus on the weakest areas or general trends. Use encouraging but direct language in the second person ("You").

Respond with ONLY valid JSON matching this schema:
{
  "summary": "string"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonString = text.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error in generateSessionSummary (Gemini API):', error);
    throw new Error("Failed to generate session summary.");
  }
}
