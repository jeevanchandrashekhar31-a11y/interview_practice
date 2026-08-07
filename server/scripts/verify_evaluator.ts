import { evaluatorAgent } from '../agents/interview_agents.js';
import { InMemoryRunner } from '@google/adk';

const questionText = "Tell me about a challenge you faced at work and how you handled it.";

const transcripts = {
  A: "At my previous internship, our deployment pipeline was failing about 30% of the time due to flaky tests. I was tasked with stabilizing it. I audited the test suite, identified 12 tests with race conditions, rewrote them using proper async waits, and added a retry mechanism for genuinely flaky external dependencies. Within three weeks, our pipeline success rate went from 70% to 98%, and deploy time dropped from 45 minutes to 20 minutes.",
};

async function testTranscript(name: string, transcriptText: string) {
  console.log(`\n=== Testing Transcript ${name} (Evaluator Only) ===`);
  const runner = new InMemoryRunner({ agent: evaluatorAgent, appName: 'test-app' });
  const stream = runner.runEphemeral({
    userId: 'user',
    newMessage: { parts: [{ text: JSON.stringify({ transcript: transcriptText, questionText, isFollowUp: false }) }] }
  });

  for await (const event of stream) {
    if (event.author === 'EvaluatorAgent') {
      const text = event.content?.parts?.find(p => p.text)?.text;
      if (text) {
        console.log("EVALUATOR DATA:", JSON.stringify(JSON.parse(text), null, 2));
      }
    }
  }
}

async function run() {
  try {
    await testTranscript("A", transcripts.A);
  } catch (err) {
    console.error("Test failed", err);
  }
}

run();
