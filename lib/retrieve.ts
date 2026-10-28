import { knowledge, type KnowledgeChunk } from "./business";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "do", "does", "you", "your", "i", "can",
  "could", "please", "what", "how", "when", "where", "much", "me", "my",
  "to", "for", "in", "on", "at", "of", "and", "or",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

// Simple, explainable retrieval (RAG-lite): score each chunk by keyword
// and token overlap. This is deliberately not an LLM guess — in free mode
// the answer IS the retrieved chunk, so prices and hours cannot be invented.
export function retrieve(question: string, topK = 1): KnowledgeChunk[] {
  const q = tokens(question);
  if (q.length === 0) return [];
  const scored = knowledge.map((chunk) => {
    const chunkTokens = new Set(tokens(chunk.text + " " + chunk.keywords.join(" ")));
    let score = 0;
    for (const t of q) {
      if (chunkTokens.has(t)) score += 2;
      if (chunk.keywords.includes(t)) score += 2;
    }
    return { chunk, score };
  });
  return scored
    .filter((s) => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.chunk);
}
