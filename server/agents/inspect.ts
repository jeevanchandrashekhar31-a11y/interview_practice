import * as adk from '@google/adk';
import { agent } from './agent.js';

console.log("ADK Exports:", Object.keys(adk));
console.log("Agent keys:", Object.keys(agent));
console.log("Agent prototype:", Object.getOwnPropertyNames(Object.getPrototypeOf(agent)));
