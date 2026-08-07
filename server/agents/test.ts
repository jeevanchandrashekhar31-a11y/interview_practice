import { InMemoryRunner } from '@google/adk';
import { evaluatorAgent, coachAgent, interviewerAgent, orchestratorAgent } from './interview_agents.js';

async function runAgent(agent: any, input: any) {
  console.log(`\n--- Running ${agent.name} ---`);
  const runner = new InMemoryRunner({ agent, appName: 'test-app' });
  const stream = runner.runEphemeral({
    userId: 'test-user',
    newMessage: { parts: [{ text: JSON.stringify(input) }] }
  });
  
  let finalResult = null;
  for await (const event of stream) {
    if (event.author === agent.name) {
      if (event.content && event.content.parts) {
        console.log(`[${event.author}]`, JSON.stringify(event.content.parts, null, 2));
        finalResult = event.content.parts;
      } else {
        console.log("Event:", JSON.stringify(event, null, 2));
      }
    } else {
      console.log(`[${event.author}]`, event.content?.parts ? JSON.stringify(event.content.parts, null, 2) : 'No parts');
    }
  }
  return finalResult;
}

async function main() {
  const sampleQuestion = "Tell me about a time you had to deal with a difficult teammate.";
  const sampleTranscript = "Well, one time a teammate wasn't doing their work, so I just did it for them to get it done on time.";
  
  // Test Evaluator
  const evaluatorInput = { questionText: sampleQuestion, transcript: sampleTranscript };
  const evalResult = await runAgent(evaluatorAgent, evaluatorInput);
  
  // Need to extract the parsed JSON from the result
  // The LlmAgent might return it as a structured payload if outputSchema is used, or a string.
  // Assuming it returns JSON string in text, we don't strictly need to parse it for the coach input if we pass it directly.
  
  // Test Coach
  const coachInput = { transcript: sampleTranscript, scores: evalResult };
  await runAgent(coachAgent, coachInput);
  
  // Test Interviewer
  const interviewerInput = { questionText: sampleQuestion, transcript: sampleTranscript };
  await runAgent(interviewerAgent, interviewerInput);
  
  console.log("\n\n==== RUNNING ORCHESTRATOR ====\n\n");
  await runAgent(orchestratorAgent, evaluatorInput);
}

main().catch(console.error);
