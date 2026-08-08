import 'dotenv/config';
import { evaluatorAgent } from '../agents/interview_agents.js';

const SAMPLES = [
  {
    name: "Excellent Answer (Leadership)",
    questionText: "Tell me about a time you led a team through a difficult project.",
    transcript: "We had a critical deadline and the backend team was falling behind due to unexpected technical debt. I organized a daily sync to prioritize tasks, reallocated two frontend devs who had node experience to help with API endpoints, and scoped down the initial release to just the core features. We delivered the MVP on time and followed up with the remaining features two weeks later, resulting in a successful launch without team burnout.",
    expected: "excellent"
  },
  {
    name: "Vague Answer (Leadership)",
    questionText: "Tell me about a time you led a team through a difficult project.",
    transcript: "I always try to be a good leader. When things get hard, I just make sure everyone is communicating and working together. We had a project once that was pretty tough, but I just kept everyone focused and we got it done eventually.",
    expected: "vague"
  },
  {
    name: "Off-topic Answer (Conflict)",
    questionText: "Describe a situation where you had a conflict with a coworker.",
    transcript: "I'm really good at coding in React. In my last job, I built the entire frontend architecture using Redux and styled-components. It was super fast and the users loved the new design. I think my technical skills are my biggest strength.",
    expected: "off-topic"
  },
  {
    name: "Rambling Answer (Conflict)",
    questionText: "Describe a situation where you had a conflict with a coworker.",
    transcript: "Well, conflicts happen all the time, you know? Like, one time I wanted to get lunch at this taco place but my coworker wanted pizza. But seriously, at work, there was this guy Bob... or maybe his name was Bill? Anyway, he was always late. And I'm a very punctual person. So I told him he should be on time. And he got mad. But I think it's important to be on time. Eventually he quit, so I guess the problem solved itself.",
    expected: "rambling"
  },
  {
    name: "Excellent Answer (Conflict)",
    questionText: "Describe a situation where you had a conflict with a coworker.",
    transcript: "My coworker and I disagreed on the database architecture. I wanted Postgres, they wanted MongoDB. I set up a meeting where we both presented the pros and cons based on our specific read/write patterns. After looking at the data, we realized their MongoDB approach was actually better for our highly unstructured data needs. I agreed and helped them implement it, which ended up saving us weeks of migration time.",
    expected: "excellent"
  }
];

import { InMemoryRunner } from '@google/adk';

async function runEval(input) {
  const runner = new InMemoryRunner({ agent: evaluatorAgent, appName: 'test-app' });
  const stream = runner.runEphemeral({
    userId: 'test',
    stateDelta: input,
    newMessage: { parts: [{ text: "Evaluate." }] }
  });

  let data = null;
  for await (const event of stream) {
    if (event.author === 'EvaluatorAgent') {
      const textPart = event.content.parts.find(p => p.text);
      if (textPart) {
        try {
          data = JSON.parse(textPart.text);
        } catch (e) {
          console.error("Parse error", e);
        }
      }
    }
  }
  return data;
}

async function runTest() {
  console.log("Starting Eval Consistency Test...");
  const results = [];

  for (const sample of SAMPLES) {
    console.log(`\nTesting: ${sample.name}`);
    const input = {
      transcript: sample.transcript,
      questionText: sample.questionText,
      isFollowUp: false,
      priorHistory: [],
      rubric: ""
    };

    // Run 1
    const run1 = await runEval(input);
    const score1 = (run1.specificityScore + run1.relevanceScore + run1.structureScore) / 3;

    // Run 2
    const run2 = await runEval(input);
    const score2 = (run2.specificityScore + run2.relevanceScore + run2.structureScore) / 3;

    // Meaningful difference? (> 0.15 gap in average score)
    const diff = Math.abs(score1 - score2);
    if (diff > 0.15) {
      console.warn(`\n⚠️ HIGH VARIANCE DETECTED on ${sample.name}: Run 1 = ${score1.toFixed(2)}, Run 2 = ${score2.toFixed(2)}`);
    }

    results.push({
      name: sample.name,
      type: sample.expected,
      qType: sample.questionText.includes("team") ? "Leadership" : "Conflict",
      run1Score: score1,
      run2Score: score2,
      avgScore: (score1 + score2) / 2
    });
  }

  // Group by question type to run assertions
  const leadershipResults = results.filter(r => r.qType === "Leadership");
  const conflictResults = results.filter(r => r.qType === "Conflict");

  console.log("\n--- RESULTS TABLE ---");
  const tableData = results.map(r => {
    let passFail = "N/A";
    
    if (r.qType === "Leadership") {
      if (r.type === "excellent") passFail = r.avgScore > leadershipResults.find(x => x.type === "vague").avgScore ? "✅ PASS" : "❌ FAIL";
      if (r.type === "vague") passFail = r.avgScore < leadershipResults.find(x => x.type === "excellent").avgScore ? "✅ PASS" : "❌ PASS";
    } else {
      if (r.type === "excellent") passFail = r.avgScore > Math.max(conflictResults.find(x => x.type === "off-topic").avgScore, conflictResults.find(x => x.type === "rambling").avgScore) ? "✅ PASS" : "❌ FAIL";
      if (r.type === "off-topic") passFail = r.avgScore < conflictResults.find(x => x.type === "excellent").avgScore ? "✅ PASS" : "❌ FAIL";
      if (r.type === "rambling") passFail = r.avgScore < conflictResults.find(x => x.type === "excellent").avgScore ? "✅ PASS" : "❌ FAIL";
    }

    return {
      Sample: r.name,
      Run1: r.run1Score.toFixed(2),
      Run2: r.run2Score.toFixed(2),
      Variance: Math.abs(r.run1Score - r.run2Score).toFixed(2),
      Assertion: passFail
    };
  });

  console.table(tableData);
}

runTest().catch(console.error);
