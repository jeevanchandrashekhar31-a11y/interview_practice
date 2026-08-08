export function computeDeliveryMetrics(transcript, durationSeconds) {
  if (!transcript || durationSeconds <= 0) {
    return {
      wpm: 0,
      fillerCount: 0,
      fillerRate: 0,
      paceLabel: "optimal",
      fillerLabel: "clean"
    };
  }

  // Count words
  const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  
  // Calculate WPM
  const minutes = durationSeconds / 60;
  const wpm = Math.round(wordCount / minutes);

  // Count filler words
  const fillerRegex = /\b(um|uh|like|you know|so|actually|basically|i mean)\b/gi;
  const matches = transcript.match(fillerRegex);
  const fillerCount = matches ? matches.length : 0;

  // Calculate filler rate (per 100 words)
  const fillerRate = wordCount > 0 ? Math.round((fillerCount / wordCount) * 100) : 0;

  // Determine pace label
  let paceLabel = "optimal";
  if (wpm < 130) paceLabel = "too slow";
  else if (wpm > 160) paceLabel = "too fast";

  // Determine filler label
  let fillerLabel = "clean";
  if (fillerRate > 4) fillerLabel = "distracting";
  else if (fillerRate > 2) fillerLabel = "noticeable";

  return { wpm, fillerCount, fillerRate, paceLabel, fillerLabel };
}

export function computeAlignment(wpm, fillerRate, specificityScore, structureScore) {
  const isHighConfidence = wpm >= 130 && wpm <= 160 && fillerRate <= 2;
  const contentScore = (specificityScore + structureScore) / 2;
  const isHighContent = contentScore >= 0.7;

  let alignmentLabel = "";
  let alignmentExplanation = "";

  if (isHighConfidence && isHighContent) {
    alignmentLabel = "Aligned — strong answer";
    alignmentExplanation = "Your delivery was confident and your content was highly specific and structured.";
  } else if (isHighConfidence && !isHighContent) {
    alignmentLabel = "Confident but vague";
    alignmentExplanation = "Your delivery was smooth, but the answer lacked concrete details and structure.";
  } else if (!isHighConfidence && isHighContent) {
    alignmentLabel = "Substance not landing";
    alignmentExplanation = "You had great structured content, but pacing or filler words detracted from the delivery.";
  } else {
    alignmentLabel = "Needs work on both";
    alignmentExplanation = "Both your delivery pacing/fillers and the concreteness of your content need improvement.";
  }

  return { alignmentLabel, alignmentExplanation };
}
