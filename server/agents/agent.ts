import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';

const pingTool = new FunctionTool({
  name: 'ping_tool',
  description: 'A tool that echoes back the input message.',
  parameters: z.object({
    message: z.string().describe("The message to echo back."),
  }),
  execute: ({ message }) => {
    return { status: 'success', report: `Pong! You said: ${message}` };
  }
});

export const agent = new LlmAgent({
  name: 'ping_agent',
  model: 'gemini-3.1-flash-lite',
  description: 'A simple agent that echoes messages.',
  instruction: 'You are a simple ping agent. When the user says something, use the ping_tool to echo it back, and tell the user what the tool replied.',
  tools: [pingTool]
});
