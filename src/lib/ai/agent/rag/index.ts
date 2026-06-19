import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SCORING_METHOD, DEFAULT_SCORING_WEIGHTS, SCORE_STATUS_THRESHOLDS } from '@/common/constants';
import type { RagDocument, RagIntent, SelectedRagDocuments } from './types';

export type { RagDocument, RagIntent, SelectedRagDocuments };

export const RAG_DOC_CHAR_BUDGET = 3600;
export const RAG_DOC_MAX_COUNT = 4;
const FILE_DOC_CHAR_LIMIT = 700;
const RAG_DOCUMENT_ROOT = path.join(process.cwd(), 'src/lib/ai/agent/rag/documents');

const TEMPLATE_VALUES: Record<string, string> = {
  scoringMethodName: DEFAULT_SCORING_METHOD.name,
  scoringMethodSummary: DEFAULT_SCORING_METHOD.summary,
  compositeJiraWeightPercent: String(Math.round(DEFAULT_SCORING_WEIGHTS.compositeJiraWeight * 100)),
  compositeGitlabWeightPercent: String(Math.round(DEFAULT_SCORING_WEIGHTS.compositeGitlabWeight * 100)),
  jiraCompletionWeight: String(DEFAULT_SCORING_WEIGHTS.jira.completion),
  jiraScheduleWeight: String(DEFAULT_SCORING_WEIGHTS.jira.schedule),
  jiraEffortWeight: String(DEFAULT_SCORING_WEIGHTS.jira.effort),
  jiraWorklogWeight: String(DEFAULT_SCORING_WEIGHTS.jira.worklog),
  gitlabMrProductivityWeight: String(DEFAULT_SCORING_WEIGHTS.gitlab.mrProductivity),
  gitlabReviewParticipationWeight: String(DEFAULT_SCORING_WEIGHTS.gitlab.reviewParticipation),
  gitlabFeedbackResolutionWeight: String(DEFAULT_SCORING_WEIGHTS.gitlab.feedbackResolution),
  gitlabLeadTimeWeight: String(DEFAULT_SCORING_WEIGHTS.gitlab.leadTime),
  gitlabCiPassRateWeight: String(DEFAULT_SCORING_WEIGHTS.gitlab.ciPassRate),
  compositeGoodMin: String(SCORE_STATUS_THRESHOLDS.composite.goodMin),
  compositeWarnMin: String(SCORE_STATUS_THRESHOLDS.composite.warnMin),
};

let ragDocumentCache: RagDocument[] | null = null;

function normalize(input: string) {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function applyTemplateValues(input: string) {
  return input.replace(/\{\{(\w+)\}\}/g, (match, key: string) => TEMPLATE_VALUES[key] ?? match);
}

function parseFrontmatterValue(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(/^['"]|['"]$/g, '');
}

function parseRagMarkdown(filePath: string, content: string): RagDocument {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`RAG 문서 frontmatter가 없습니다: ${filePath}`);
  }

  const metadata: Record<string, string | string[]> = {};
  let activeListKey: string | null = null;
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch && activeListKey) {
      const current = metadata[activeListKey];
      metadata[activeListKey] = [...(Array.isArray(current) ? current : []), parseFrontmatterValue(listMatch[1])];
      continue;
    }

    const keyValueMatch = line.match(/^(\w+):\s*(.*)$/);
    if (!keyValueMatch) continue;

    const [, key, value] = keyValueMatch;
    if (value.trim() === '') {
      metadata[key] = [];
      activeListKey = key;
    } else {
      metadata[key] = parseFrontmatterValue(value);
      activeListKey = null;
    }
  }

  const label = metadata.label;
  const detail = metadata.detail;
  const category = metadata.category;
  if (typeof label !== 'string' || typeof detail !== 'string' || typeof category !== 'string') {
    throw new Error(`RAG 문서 필수 메타데이터가 부족합니다: ${filePath}`);
  }

  return {
    label,
    detail,
    category: category as RagDocument['category'],
    keywords: Array.isArray(metadata.keywords) ? metadata.keywords : [],
    intents: Array.isArray(metadata.intents) ? (metadata.intents as RagIntent[]) : undefined,
    priority: typeof metadata.priority === 'string' ? Number(metadata.priority) : undefined,
    snippet: applyTemplateValues(match[2].trim()),
  };
}

async function readMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return readMarkdownFiles(entryPath);
      return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : [];
    }),
  );

  return files.flat().sort();
}

export async function listRagDocuments(): Promise<RagDocument[]> {
  if (ragDocumentCache) return ragDocumentCache;

  const files = await readMarkdownFiles(RAG_DOCUMENT_ROOT);
  const documents = await Promise.all(
    files.map(async (filePath) => parseRagMarkdown(filePath, await readFile(filePath, 'utf8'))),
  );
  ragDocumentCache = documents;
  return documents;
}

export async function getAgentPromptGuidelines() {
  const documents = await listRagDocuments();
  return {
    persona: documents.find((document) => document.label === 'TeamScope AI Persona')?.snippet ?? '',
    guardrails: documents.find((document) => document.label === 'TeamScope Answer Guardrails')?.snippet ?? '',
  };
}

function getRagMatchInfo(prompt: string, intent: RagIntent, document: RagDocument) {
  const normalizedPrompt = normalize(prompt);
  const matchedKeywords = document.keywords.filter((keyword) => normalizedPrompt.includes(normalize(keyword)));
  const matchedIntent = Boolean(document.intents?.includes(intent));
  let score = matchedIntent ? 1 : 0;
  for (const keyword of document.keywords) {
    if (normalizedPrompt.includes(normalize(keyword))) score += keyword.length > 4 ? 3 : 2;
  }
  score += (document.priority ?? 0) / 100;

  const reasonParts = [];
  if (matchedKeywords.length) reasonParts.push(`질의 키워드 ${matchedKeywords.slice(0, 4).join(', ')}와 연결`);
  if (matchedIntent) reasonParts.push(`의도 ${intent}와 맞음`);
  if (document.priority) reasonParts.push(`기본 우선순위 ${document.priority}`);

  return {
    score,
    matchedKeywords,
    matchedIntent,
    reason: reasonParts.length ? reasonParts.join(' · ') : '기본 RAG 후보로 보강',
  };
}

export async function selectRelevantRagDocuments(prompt: string, intent: RagIntent): Promise<SelectedRagDocuments> {
  const allDocuments = await listRagDocuments();
  const scoredDocs = allDocuments
    .map((document) => ({ document, match: getRagMatchInfo(prompt, intent, document) }))
    .map(({ document, match }) => ({ document, ...match }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ document, score, matchedKeywords, matchedIntent, reason }) => ({ document, score, matchedKeywords, matchedIntent, reason }));

  const selectedDocs: Array<{
    document: RagDocument;
    score: number;
    matchedKeywords: string[];
    matchedIntent: boolean;
    reason: string;
  }> = [];
  let usedChars = 0;
  for (const item of scoredDocs) {
    const { document } = item;
    if (selectedDocs.length >= RAG_DOC_MAX_COUNT) break;
    if (usedChars + document.snippet.length > RAG_DOC_CHAR_BUDGET && selectedDocs.length > 0) continue;
    selectedDocs.push(item);
    usedChars += document.snippet.length;
  }

  if (selectedDocs.length === 0) {
    selectedDocs.push(
      ...allDocuments.slice(0, 2).map((document) => ({
        document,
        score: 0,
        matchedKeywords: [],
        matchedIntent: false,
        reason: '직접 매칭된 문서가 없어 기본 TeamScope 기준으로 보강',
      })),
    );
  }

  if (intent === 'guide' || /readme|changelog|변경사항|가이드|사용법|도움말/i.test(prompt)) {
    for (const fileName of ['README.md', 'CHANGELOG.md']) {
      try {
        const content = await readFile(path.join(process.cwd(), fileName), 'utf8');
        const compact = content.replace(/\s+/g, ' ').slice(0, FILE_DOC_CHAR_LIMIT);
        selectedDocs.push({
          document: {
            label: fileName,
            detail: '프로젝트 설명과 최근 변경사항',
            keywords: [],
            category: 'workspace-doc',
            snippet: `${fileName}: ${compact}`,
          },
          score: 1,
          matchedKeywords: ['가이드'],
          matchedIntent: intent === 'guide',
          reason: '가이드/변경사항 관련 질문이라 프로젝트 문서를 함께 참조',
        });
      } catch {
        // 문서가 없어도 에이전트 실행은 계속합니다.
      }
    }
  }

  return {
    snippets: selectedDocs.map(({ document }) => document.snippet),
    docs: selectedDocs.map(({ document }) => ({ label: document.label, detail: document.detail })),
    selectedLabels: selectedDocs.map(({ document }) => document.label),
    reasons: selectedDocs.map(({ document, score, matchedKeywords, matchedIntent, reason }) => ({
      label: document.label,
      category: document.category,
      score: Math.round(score * 100) / 100,
      matchedKeywords,
      matchedIntent,
      reason,
    })),
  };
}
