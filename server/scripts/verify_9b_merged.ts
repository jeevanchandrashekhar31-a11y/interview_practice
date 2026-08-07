import { orchestratorAgent } from '../agents/interview_agents.js';
import { InMemoryRunner } from '@google/adk';

const questionText = "Tell me about a challenge you faced at work and how you handled it.";

const transcripts = {
  A: "At my previous internship, our deployment pipeline was failing about 30% of the time due to flaky tests. I was tasked with stabilizing it. I audited the test suite, identified 12 tests with race conditions, rewrote them using proper async waits, and added a retry mechanism for genuinely flaky external dependencies. Within three weeks, our pipeline success rate went from 70% to 98%, and deploy time dropped from 45 minutes to 20 minutes.",
  B: "Um, yeah, I've faced a lot of challenges at work. Like there was this one time things were kind of difficult with a project, and I just worked hard and eventually we got it done. It was tough but I learned a lot.",
  C: "I led a team of 5 people to migrate our database, and we hit a major issue with data corruption that took a while to fix, but we got it done and the client was happy."
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const url = args[0];
  const options = args[1];
  
  if (url && typeof url === 'string' && url.includes('generativelanguage.googleapis.com')) {
    try {
      const body = JSON.parse(options.body);
      // Only log the EvaluatorAgent prompt
      if (JSON.stringify(body).includes("Evaluates the candidate's answer on specificity")) {
        console.log("\n=================== RAW GEMINI PROMPT ===================");
        console.log(JSON.stringify(body, null, 2));
        console.log("=========================================================\n");
      }
    } catch(e) {}
  }
  return originalFetch(...args);
};

async function testTranscript(name, transcriptText) {
  console.log(`\n=== Testing Transcript ${name} ===`);
  const runner = new InMemoryRunner({ agent: orchestratorAgent, appName: 'test-app' });
  const stream = runner.runEphemeral({
    userId: 'user',
    stateDelta: { transcript: transcriptText, questionText, isFollowUp: false },
    newMessage: { parts: [{ text: "Please evaluate the candidate's answer." }] }
  });

  let evaluatorData = {};
  let coachData = {};

  for await (const event of stream) {
    if (event.author === 'EvaluatorAgent' && event.content) {
      const text = event.content?.parts?.find(p => p.text)?.text;
      if (text) {
        try { evaluatorData = JSON.parse(text); } catch (e) {}
      }
    } else if (event.author === 'CoachAgent' && event.content) {
      const text = event.content?.parts?.find(p => p.text)?.text;
      if (text) {
        try { coachData = JSON.parse(text); } catch (e) {}
      }
    }
  }

  const finalData = {
    ...evaluatorData,
    ...coachData,
    askFollowUp: !!(evaluatorData.followUpQuestion && evaluatorData.followUpQuestion.trim() !== ""),
    orchestratorReasoning: evaluatorData.orchestratorReasoning || "Merged agent decided follow up based on score.",
  };

  console.log("FINAL DATA:", JSON.stringify(finalData, null, 2));
}

async function run() {
  // await testTranscript("A", transcripts.A);
  // await testTranscript("B", transcripts.B);
  await testTranscript("C", transcripts.C);
}
run();
