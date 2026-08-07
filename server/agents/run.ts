import { InMemoryRunner } from '@google/adk';
import { agent } from './agent.js';

async function main() {
  const runner = new InMemoryRunner({ agent, appName: 'test-app' });
  try {
    const stream = runner.runEphemeral({
      userId: 'test-user',
      newMessage: { parts: [{ text: "Hello! Please echo: 'ADK is cool!'" }] }
    });
    
    for await (const event of stream) {
      if (event.content && event.content.parts) {
        console.log(`[${event.author}]`, JSON.stringify(event.content.parts, null, 2));
      } else {
        console.log("Event:", JSON.stringify(event, null, 2));
      }
    }
  } catch (err) {
    console.error("Runner failed:", err);
  }
}

main();
