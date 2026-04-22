export type RagIntent =
  | 'analysis'
  | 'developer_detail'
  | 'settings_ai'
  | 'settings_project'
  | 'guide'
  | 'dashboard';

export type RagDocument = {
  label: string;
  detail: string;
  snippet: string;
  keywords: string[];
  intents?: RagIntent[];
  priority?: number;
  category: 'teamscope' | 'project-management' | 'persona' | 'workspace-doc';
};

export type SelectedRagDocuments = {
  snippets: string[];
  docs: Array<{ label: string; detail: string }>;
  selectedLabels: string[];
  reasons: Array<{
    label: string;
    category: RagDocument['category'];
    score: number;
    matchedKeywords: string[];
    matchedIntent: boolean;
    reason: string;
  }>;
};
