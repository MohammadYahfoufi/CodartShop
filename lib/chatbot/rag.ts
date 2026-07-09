import { promises as fs } from 'fs';
import path from 'path';

export type KnowledgeChunk = {
  source: string;
  chunk: string;
  score: number;
};

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreChunk(queryTerms: string[], chunk: string) {
  const text = normalize(chunk);
  if (!text) return 0;

  let score = 0;
  for (const term of queryTerms) {
    if (!term) continue;
    const count = text.split(term).length - 1;
    score += count * 3;
    if (text.includes(term)) score += 2;
  }

  return score;
}

function chunkText(text: string) {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + CHUNK_SIZE);
    chunks.push(text.slice(start, end).trim());
    if (end >= text.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks.filter(Boolean);
}

async function readKnowledgeFiles() {
  try {
    const entries = await fs.readdir(KNOWLEDGE_DIR, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());
    const documents: Array<{ source: string; text: string }> = [];

    for (const file of files) {
      const fullPath = path.join(KNOWLEDGE_DIR, file.name);
      const text = await fs.readFile(fullPath, 'utf8');
      documents.push({ source: file.name, text });
    }

    return documents;
  } catch {
    return [];
  }
}

export async function retrieveRelevantContext(query: string, limit = 4) {
  const queryTerms = normalize(query)
    .split(' ')
    .filter((term) => term.length > 2)
    .slice(0, 12);

  if (queryTerms.length === 0) {
    return [];
  }

  const documents = await readKnowledgeFiles();
  const chunks: KnowledgeChunk[] = [];

  for (const document of documents) {
    for (const chunk of chunkText(document.text)) {
      const score = scoreChunk(queryTerms, chunk);
      if (score > 0) {
        chunks.push({ source: document.source, chunk, score });
      }
    }
  }

  return chunks.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function formatContext(chunks: KnowledgeChunk[]) {
  if (chunks.length === 0) {
    return 'No knowledge base context matched the user request.';
  }

  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] Source: ${chunk.source}\n${chunk.chunk.trim()}`,
    )
    .join('\n\n');
}
