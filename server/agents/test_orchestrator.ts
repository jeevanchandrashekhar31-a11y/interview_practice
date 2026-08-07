import { InMemoryRunner } from '@google/adk';
import { orchestratorAgent } from './interview_agents.js';

async function runTest(label: string, transcript: string, questionText: string) {
  console.log(`\n--- Running ${label} ---`);
  const runner = new InMemoryRunner({ agent: orchestratorAgent, appName: 'test-app' });
  const stream = runner.runEphemeral({
    userId: 'test-user',
    newMessage: { parts: [{ text: JSON.stringify({ transcript, questionText }) }] }
  });
  
  let finalResult: any = null;
  for await (const event of stream) {
    if (event.author === 'OrchestratorAgent') {
      if (event.content && event.content.parts) {
        // Find the final text response which is the JSON object we want
        const textPart = event.content.parts.find((p: any) => p.text);
        if (textPart) {
          try {
            finalResult = JSON.parse(textPart.text);
          } catch (e) {
            finalResult = textPart.text;
          }
        }
      }
    }
  }
  
  if (finalResult && typeof finalResult === 'object') {
    console.log(`specificityScore: ${finalResult.specificityScore}`);
    console.log(`relevanceScore: ${finalResult.relevanceScore}`);
    console.log(`structureScore: ${finalResult.structureScore}`);
    console.log(`askFollowUp: ${finalResult.askFollowUp}`);
    console.log(`followUpQuestion: ${finalResult.followUpQuestion}`);
    console.log(`orchestratorReasoning: ${finalResult.orchestratorReasoning}`);
  } else {
    console.log("Failed to parse result:", finalResult);
  }
}

async function main() {
  const questionText = "Tell me about a challenge you faced at work and how you handled it.";
  
  const transcriptA = "At my previous internship, our deployment pipeline was failing about 30% of the time due to flaky tests. I was tasked with stabilizing it. I audited the test suite, identified 12 tests with race conditions, rewrote them using proper async waits, and added a retry mechanism for genuinely flaky external dependencies. Within three weeks, our pipeline success rate went from 70% to 98%, and deploy time dropped from 45 minutes to 20 minutes.";
  const transcriptB = "Um, yeah, I've faced a lot of challenges at work. Like there was this one time things were kind of difficult with a project, and I just worked hard and eventually we got through it. I think communication was important. It was a good learning experience for me.";
  const transcriptC = "I led a team of 5 people to migrate our database, and we hit a major issue with data corruption that took a while to fix, but we got it done and the client was happy.";
  
  await runTest("Transcript A (strong)", transcriptA, questionText);
  await runTest("Transcript B (weak)", transcriptB, questionText);
  await runTest("Transcript C (borderline)", transcriptC, questionText);
  await runTest("Transcript B (weak) - RUN 2", transcriptB, questionText);
}

main().catch(console.error);
