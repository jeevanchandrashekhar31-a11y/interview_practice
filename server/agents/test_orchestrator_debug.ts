import { InMemoryRunner } from '@google/adk';
import { orchestratorAgent } from './interview_agents.js';

async function main() {
  const questionText = "Tell me about a challenge you faced at work and how you handled it.";
  const transcriptB = "Um, yeah, I've faced a lot of challenges at work. Like there was this one time things were kind of difficult with a project, and I just worked hard and eventually we got through it. I think communication was important. It was a good learning experience for me.";
  
  console.log(`\n--- Running Transcript B (weak) - RUN 2 with full log ---`);
  const runner = new InMemoryRunner({ agent: orchestratorAgent, appName: 'test-app' });
  const stream = runner.runEphemeral({
    userId: 'test-user',
    newMessage: { parts: [{ text: JSON.stringify({ transcript: transcriptB, questionText }) }] }
  });
  
  for await (const event of stream) {
    console.log(JSON.stringify(event, null, 2));
  }
}

main().catch(console.error);
