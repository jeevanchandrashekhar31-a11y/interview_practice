export function checkGrounding(transcript, modelRewrite) {
  const unsupportedClaims = [];

  if (!modelRewrite || typeof modelRewrite !== 'string') {
    return { groundingPassed: true, unsupportedClaims };
  }

  const normalizedTranscript = (transcript || "").toLowerCase();

  // Stop words to exclude from proper noun checks
  const stopWords = new Set([
    "the", "a", "an", "i", "we", "they", "he", "she", "it", 
    "my", "our", "their", "his", "her", "its", "me", "us", "them",
    "and", "but", "or", "so", "because", "however", "therefore",
    "in", "on", "at", "to", "for", "with", "as", "by", "from",
    "this", "that", "these", "those", "is", "are", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "shall", "should", "can", "could", "may", "might", "must",
    "what", "who", "where", "when", "why", "how", "which",
    "if", "then", "else", "not", "no", "yes", "ok", "okay"
  ]);

  // Extract standalone numbers
  const numberRegex = /\b\d+([.,]\d+)?\b/g;
  const numbers = modelRewrite.match(numberRegex) || [];

  // Extract capitalized words (Proper Nouns heuristic)
  const properNounRegex = /\b[A-Z][a-z]+\b/g;
  const properNouns = modelRewrite.match(properNounRegex) || [];

  const claimsToCheck = [...new Set([...numbers, ...properNouns])];

  for (const claim of claimsToCheck) {
    const lowerClaim = claim.toLowerCase();
    
    // Skip stop words
    if (stopWords.has(lowerClaim)) {
      continue;
    }

    // Check if the claim exists in the transcript
    if (!normalizedTranscript.includes(lowerClaim)) {
      unsupportedClaims.push(claim);
    }
  }

  return {
    groundingPassed: unsupportedClaims.length === 0,
    unsupportedClaims
  };
}
