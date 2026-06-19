'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { createProjectTokenRequest, shouldCommitProjectTokenRequest, type ProjectTokenRequest } from '@/lib/projects/project-token-request';
import { MemberMappingSections } from './MemberMappingForm';
import {
  Plus,
  Save,
  X,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  FolderGit2,
  PlugZap,
  Info,
} from 'lucide-react';

interface ProjectConfig {
  id: string;
  name: string;
  type: 'jira' | 'gitlab';
  baseUrl: string;
  projectKey: string | null;
  isActive: boolean;
  token?: string;
}

interface ProjectFormData {
  name: string;
  type: 'jira' | 'gitlab';
  baseUrl: string;
  token: string;
  projectKey: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  message?: string;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'fail';
type ProjectActionNotice = { tone: 'success' | 'error'; message: string };

interface TestConnectionDetails {
  user?: string;
  username?: string;
  projectCheck?: string;
}

interface GroupImportApiData {
  importedCount: number;
  skippedCount: number;
  archivedCount: number;
  totalDiscovered: number;
}

const EMPTY_FORM: ProjectFormData = {
  name: '',
  type: 'jira',
  baseUrl: '',
  token: '',
  projectKey: '',
};

function normalizeProjectKey(projectKey: string | null | undefined) {
  return projectKey ?? '';
}

function TypeBadge({ type }: { type: 'jira' | 'gitlab' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        type === 'jira'
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      )}
    >
      {type === 'jira' ? 'Jira' : 'GitLab'}
    </span>
  );
}

/**
 * 프로젝트 연동 관리 폼.
 * DB에 저장된 프로젝트를 조회/추가/수정/삭제하고 연결 테스트를 수행합니다.
 */
export function ProjectManagementForm() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [testDetails, setTestDetails] = useState<TestConnectionDetails | null>(null);
  const [isGroupImporting, setIsGroupImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rowTestStatus, setRowTestStatus] = useState<Record<string, TestStatus>>({});
  const [rowTestMessage, setRowTestMessage] = useState<Record<string, string>>({});
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectActionNotice, setProjectActionNotice] = useState<ProjectActionNotice | null>(null);
  const [isProjectTokenVisible, setIsProjectTokenVisible] = useState(false);
  const [loadingTokenProjectId, setLoadingTokenProjectId] = useState<string | null>(null);
  const [projectsVersion, setProjectsVersion] = useState(0);
  const [showUrlGuide, setShowUrlGuide] = useState(false);
  const activeTokenRequestRef = useRef<ProjectTokenRequest | null>(null);
  const tokenRequestSequenceRef = useRef(0);
  const tokenRequestAbortRef = useRef<AbortController | null>(null);

  const handleFormChange = useCallback(<K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === 'type' || key === 'baseUrl' || key === 'token' || key === 'projectKey') {
      setTestStatus((prev) => (prev === 'success' || prev === 'fail' ? 'idle' : prev));
      setTestMessage('');
      setTestDetails(null);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/projects');
      const json = (await res.json()) as ApiResponse<ProjectConfig[]>;
      if (json.success && json.data) {
        setProjects(json.data.map((project) => ({ ...project, projectKey: normalizeProjectKey(project.projectKey) })));
      }
    } catch (error) {
      console.error('프로젝트 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    return () => {
      tokenRequestAbortRef.current?.abort();
    };
  }, []);

  const handleOpenAdd = useCallback(() => {
    setProjectActionNotice(null);
    setEditingId(null);
    tokenRequestAbortRef.current?.abort();
    tokenRequestAbortRef.current = null;
    activeTokenRequestRef.current = null;
    setForm(EMPTY_FORM);
    setIsProjectTokenVisible(false);
    setLoadingTokenProjectId(null);
    setTestStatus('idle');
    setTestMessage('');
    setTestDetails(null);
    setIsFormOpen(true);
  }, []);

  const handleStartEdit = useCallback(async (project: ProjectConfig) => {
    setProjectActionNotice(null);
    setEditingId(project.id);
    tokenRequestAbortRef.current?.abort();
    const abortController = new AbortController();
    tokenRequestAbortRef.current = abortController;
    const request = createProjectTokenRequest(++tokenRequestSequenceRef.current, project.id);
    activeTokenRequestRef.current = request;
    setIsProjectTokenVisible(false);
    setForm({
      name: project.name,
      type: project.type,
      baseUrl: project.baseUrl,
      token: '',
      projectKey: normalizeProjectKey(project.projectKey),
    });
    setTestStatus('idle');
    setTestMessage('');
    setTestDetails(null);
    setIsFormOpen(true);

    setLoadingTokenProjectId(project.id);
    try {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(project.id)}&includeToken=true`, {
        signal: abortController.signal,
      });
      const json = (await response.json()) as ApiResponse<ProjectConfig>;
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? '저장된 토큰을 불러오지 못했습니다.');
      }

      setForm((current) => {
        if (!shouldCommitProjectTokenRequest(activeTokenRequestRef.current, request)) return current;
        return {
          ...current,
          token: json.data.token ?? '',
        };
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('프로젝트 토큰 조회 실패:', error);
      setProjectActionNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '저장된 토큰을 불러오지 못했습니다.',
      });
    } finally {
      if (shouldCommitProjectTokenRequest(activeTokenRequestRef.current, request)) {
        setLoadingTokenProjectId(null);
        tokenRequestAbortRef.current = null;
      }
    }
  }, []);

  const handleCloseForm = useCallback(() => {
    tokenRequestAbortRef.current?.abort();
    tokenRequestAbortRef.current = null;
    activeTokenRequestRef.current = null;
    setIsFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsProjectTokenVisible(false);
    setLoadingTokenProjectId(null);
    setTestStatus('idle');
    setTestMessage('');
    setTestDetails(null);
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage('');
    setTestDetails(null);
    try {
      const res = await fetch('/api/projects/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          baseUrl: form.baseUrl,
          token: form.token,
          projectKey: form.projectKey,
        }),
      });
      const data = (await res.json()) as ApiResponse<unknown> & { details?: TestConnectionDetails };
      if (data.success) {
        setTestStatus('success');
        setTestMessage(data.message ?? '연결 성공');
        setTestDetails(data.details ?? null);
      } else {
        setTestStatus('fail');
        setTestMessage(data.error ?? '연결 실패');
      }
    } catch {
      setTestStatus('fail');
      setTestMessage('연결 테스트 중 오류가 발생했습니다.');
    }
  }, [form]);

  const detectedGroupPath = (() => {
    const check = testDetails?.projectCheck ?? '';
    const match = check.match(/^그룹 확인 완료 \((.+)\)$/);
    return match?.[1] ?? null;
  })();

  const handleGroupImport = useCallback(async () => {
    if (!detectedGroupPath || !form.name.trim() || !form.baseUrl.trim() || !form.token.trim()) return;
    setIsGroupImporting(true);
    setProjectActionNotice(null);
    try {
      const res = await fetch('/api/projects/group-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          baseUrl: form.baseUrl,
          token: form.token,
          groupPath: detectedGroupPath,
        }),
      });
      const data = (await res.json()) as ApiResponse<GroupImportApiData>;
      if (data.success && data.data) {
        await loadProjects();
        handleCloseForm();
        const { importedCount, skippedCount, archivedCount } = data.data;
        const parts = [`그룹 "${detectedGroupPath}" 에서 ${importedCount}개 프로젝트를 가져왔습니다.`];
        if (skippedCount > 0) parts.push(`(이미 등록된 ${skippedCount}개 건너뜀)`);
        if (archivedCount > 0) parts.push(`(보관된 ${archivedCount}개 제외)`);
        setProjectActionNotice({ tone: 'success', message: parts.join(' ') });
        setProjectsVersion((v) => v + 1);
      } else {
        throw new Error(data.error ?? '그룹 가져오기 중 오류가 발생했습니다.');
      }
    } catch (error) {
      setProjectActionNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '그룹 가져오기 중 오류가 발생했습니다.',
      });
    } finally {
      setIsGroupImporting(false);
    }
  }, [detectedGroupPath, form, handleCloseForm, loadProjects]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.baseUrl.trim()) return;
    setIsSaving(true);
    setProjectActionNotice(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          name: form.name,
          type: form.type,
          baseUrl: form.baseUrl,
          token: form.token || undefined,
          projectKey: form.projectKey,
        }),
      });
      const data = (await res.json()) as ApiResponse<ProjectConfig>;
      if (data.success) {
        await loadProjects();
        handleCloseForm();
        setProjectActionNotice({ tone: 'success', message: '프로젝트 연결 정보를 저장했습니다.' });
        setProjectsVersion((v) => v + 1);
      } else {
        throw new Error(data.error ?? '프로젝트 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('프로젝트 저장 실패:', error);
      setProjectActionNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '프로젝트 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [editingId, form, handleCloseForm, loadProjects]);

  const handleDelete = useCallback(
    async (project: ProjectConfig) => {
      setDeletingProjectId(project.id);
      setProjectActionNotice(null);
      try {
        const response = await fetch(`/api/projects?id=${project.id}`, { method: 'DELETE' });
        const json = (await response.json().catch(() => null)) as ApiResponse<{
          id: string;
          name: string;
          isActive: boolean;
          cleanup?: {
            jiraIssueCount: number;
            gitlabMrCount: number;
            gitlabNoteCount: number;
            projectDeveloperCount: number;
            scoreCount: number;
          };
        }> | null;
        if (!response.ok || !json?.success) {
          throw new Error(json?.error ?? '프로젝트 제거 중 오류가 발생했습니다.');
        }
        await loadProjects();
        const cleanup = json.data?.cleanup;
        const cleanedSnapshotCount = cleanup
          ? cleanup.jiraIssueCount + cleanup.gitlabMrCount + cleanup.gitlabNoteCount
          : 0;
        setProjectActionNotice({
          tone: 'success',
          message:
            cleanedSnapshotCount > 0
              ? `${project.name} 프로젝트를 제거하고 연결된 스냅샷 ${cleanedSnapshotCount}건을 정리했습니다.`
              : `${project.name} 프로젝트를 제거했습니다. 연결된 스냅샷은 남아있지 않습니다.`,
        });
      } catch (error) {
        console.error('프로젝트 삭제 실패:', error);
        setProjectActionNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : '프로젝트 제거 중 오류가 발생했습니다.',
        });
      } finally {
        setDeletingProjectId(null);
      }
    },
    [loadProjects],
  );

  const handleTestStoredConnection = useCallback(async (project: ProjectConfig) => {
    setRowTestStatus((prev) => ({ ...prev, [project.id]: 'testing' }));
    setRowTestMessage((prev) => ({ ...prev, [project.id]: '' }));

    try {
      const res = await fetch('/api/projects/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: project.id }),
      });
      const data = (await res.json()) as ApiResponse<unknown>;

      if (data.success) {
        setRowTestStatus((prev) => ({ ...prev, [project.id]: 'success' }));
        setRowTestMessage((prev) => ({ ...prev, [project.id]: data.message ?? '연결 성공' }));
      } else {
        setRowTestStatus((prev) => ({ ...prev, [project.id]: 'fail' }));
        setRowTestMessage((prev) => ({ ...prev, [project.id]: data.error ?? '연결 실패' }));
      }
    } catch {
      setRowTestStatus((prev) => ({ ...prev, [project.id]: 'fail' }));
      setRowTestMessage((prev) => ({ ...prev, [project.id]: '연결 테스트 중 오류가 발생했습니다.' }));
    }
  }, []);

  const isProjectFormSaveDisabled =
    isSaving ||
    !form.name.trim() ||
    !form.baseUrl.trim() ||
    (!editingId && (!form.token.trim() || testStatus !== 'success'));
  const projectFormSaveLabel = editingId ? '변경사항 저장' : '새 프로젝트 저장';

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">프로젝트 관리</h3>
          <div className="flex items-center gap-2">
            {isFormOpen ? (
              <>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium',
                    'text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  )}
                >
                  <X className="h-4 w-4" />
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isProjectFormSaveDisabled}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                    'bg-blue-600 text-white transition-colors hover:bg-blue-700',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {projectFormSaveLabel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleOpenAdd}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                  'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
                )}
              >
                <Plus className="h-4 w-4" />
                프로젝트 추가
              </button>
            )}
          </div>
        </div>

        <div
          className={cn(
            'overflow-hidden transition-all duration-300 ease-in-out',
            isFormOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {editingId ? '프로젝트 편집' : '새 프로젝트'}
              </h4>
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="프로젝트 이름"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">유형</label>
                <div className="relative">
                  <select
                    value={form.type}
                    onChange={(e) => handleFormChange('type', e.target.value as 'jira' | 'gitlab')}
                    className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="jira">Jira</option>
                    <option value="gitlab">GitLab</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
                  <button
                    type="button"
                    onClick={() => setShowUrlGuide(true)}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                    title="URL 입력 가이드 보기"
                    aria-label="URL 입력 가이드 보기"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={(e) => handleFormChange('baseUrl', e.target.value)}
                  placeholder={
                    form.type === 'jira'
                      ? 'https://jira.company.com 또는 https://company.atlassian.net'
                      : 'https://gitlab.company.com'
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                {form.type === 'gitlab' ? (
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    서버 호스트 URL만 입력하세요. 프로젝트 경로(group/project)는 아래 프로젝트 키 필드에 입력합니다.
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">토큰</label>
                <div className="relative">
                  <input
                    type={isProjectTokenVisible ? 'text' : 'password'}
                    value={form.token}
                    onChange={(e) => handleFormChange('token', e.target.value)}
                    placeholder={
                      loadingTokenProjectId === editingId
                        ? '저장된 토큰을 불러오는 중...'
                        : editingId
                          ? '저장된 토큰'
                          : 'Personal Access Token'
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setIsProjectTokenVisible((visible) => !visible)}
                    disabled={!form.token}
                    className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    title={isProjectTokenVisible ? '토큰 숨기기' : '토큰 보기'}
                    aria-label={isProjectTokenVisible ? '토큰 숨기기' : '토큰 보기'}
                  >
                    {isProjectTokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">프로젝트 키</label>
                <input
                  type="text"
                  value={form.projectKey}
                  onChange={(e) => handleFormChange('projectKey', e.target.value)}
                  placeholder={
                    form.type === 'jira'
                      ? 'PROJ (Jira 프로젝트 키)'
                      : 'group/project 또는 group-name (그룹 일괄 등록)'
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>

            {testStatus !== 'idle' && testStatus !== 'testing' && (
              <div
                className={cn(
                  'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                  testStatus === 'success' && 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                  testStatus === 'fail' && 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                )}
              >
                {testStatus === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {testStatus === 'fail' && <XCircle className="h-4 w-4" />}
                {testMessage}
              </div>
            )}

            {testStatus === 'success' && detectedGroupPath && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-900/20">
                <p className="mb-1.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                  GitLab 그룹이 감지됐습니다 — <code className="font-mono">{detectedGroupPath}</code>
                </p>
                <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-500">
                  그룹 하위 프로젝트를 모두 개별 프로젝트로 한 번에 가져옵니다. 이미 등록된 프로젝트는 건너뜁니다.
                </p>
                <button
                  type="button"
                  onClick={() => void handleGroupImport()}
                  disabled={isGroupImporting}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
                    'bg-amber-600 text-white hover:bg-amber-700 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {isGroupImporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FolderGit2 className="h-3.5 w-3.5" />
                  )}
                  {isGroupImporting ? '가져오는 중...' : '그룹 프로젝트 전체 가져오기'}
                </button>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={!form.name.trim() || !form.baseUrl.trim() || !form.token.trim() || testStatus === 'testing' || (loadingTokenProjectId !== null && loadingTokenProjectId === editingId)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium',
                  'text-gray-700 hover:bg-gray-100 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {testStatus === 'testing' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {testStatus === 'testing' ? '연결 확인 중' : '연결 테스트'}
              </button>
              {!detectedGroupPath && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isProjectFormSaveDisabled}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                    'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {projectFormSaveLabel}
                </button>
              )}
            </div>
          </div>
        </div>

        {projectActionNotice ? (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              projectActionNotice.tone === 'error'
                ? 'border-red-500/25 bg-red-500/10 text-red-300'
                : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
            )}
          >
            {projectActionNotice.message}
          </div>
        ) : null}

        <div className="space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              프로젝트를 불러오는 중입니다...
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  project.isActive
                    ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                    : 'border-gray-100 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/50',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <TypeBadge type={project.type} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {project.baseUrl}
                        {project.projectKey ? ` · ${project.projectKey}` : ''}
                      </p>
                      {rowTestStatus[project.id] &&
                      rowTestStatus[project.id] !== 'idle' &&
                      rowTestStatus[project.id] !== 'testing' ? (
                        <div
                          className={cn(
                            'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]',
                            rowTestStatus[project.id] === 'success' && 'bg-green-500/10 text-green-400',
                            rowTestStatus[project.id] === 'fail' && 'bg-red-500/10 text-red-400',
                          )}
                        >
                          {rowTestStatus[project.id] === 'success' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          <span>{rowTestMessage[project.id]}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleTestStoredConnection(project)}
                      disabled={rowTestStatus[project.id] === 'testing'}
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-gray-800"
                      title="연결 테스트"
                      aria-label={`${project.name} 연결 테스트`}
                    >
                      {rowTestStatus[project.id] === 'testing' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlugZap className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStartEdit(project)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                      title="수정"
                      aria-label={`${project.name} 수정`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(project)}
                      disabled={deletingProjectId === project.id}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                      title="삭제"
                      aria-label={`${project.name} 삭제`}
                    >
                      {deletingProjectId === project.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {!isLoading && projects.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              등록된 프로젝트가 없습니다. 위의 &ldquo;프로젝트 추가&rdquo; 버튼을 클릭하세요.
            </div>
          )}
        </div>
      </section>

      <MemberMappingSections projectsVersion={projectsVersion} />

      {showUrlGuide && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 px-4"
          onClick={() => setShowUrlGuide(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">URL 입력 가이드</p>
                <h3 className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100">URL과 프로젝트 키 분리 방법</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUrlGuide(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label="가이드 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* GitLab section */}
              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    GitLab
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">프로젝트 등록</span>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 font-mono text-xs dark:bg-gray-800">
                  <span className="text-gray-400">https://</span>
                  <span className="rounded bg-blue-100 px-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">gitlab.company.com</span>
                  <span className="text-gray-400">/</span>
                  <span className="rounded bg-emerald-100 px-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">ap-frontend/my-project</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-blue-50 px-2.5 py-2 dark:bg-blue-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">URL 필드</p>
                    <p className="mt-0.5 font-mono text-xs text-blue-700 dark:text-blue-300">https://gitlab.company.com</p>
                  </div>
                  <div className="rounded-md bg-emerald-50 px-2.5 py-2 dark:bg-emerald-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">프로젝트 키</p>
                    <p className="mt-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-300">ap-frontend/my-project</p>
                  </div>
                </div>
              </div>

              {/* GitLab group section */}
              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                    GitLab
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">그룹 일괄 등록</span>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 font-mono text-xs dark:bg-gray-800">
                  <span className="text-gray-400">https://</span>
                  <span className="rounded bg-blue-100 px-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">gitlab.company.com</span>
                  <span className="text-gray-400">/</span>
                  <span className="rounded bg-amber-100 px-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">ap-osulloc-service</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-blue-50 px-2.5 py-2 dark:bg-blue-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">URL 필드</p>
                    <p className="mt-0.5 font-mono text-xs text-blue-700 dark:text-blue-300">https://gitlab.company.com</p>
                  </div>
                  <div className="rounded-md bg-amber-50 px-2.5 py-2 dark:bg-amber-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500">프로젝트 키</p>
                    <p className="mt-0.5 font-mono text-xs text-amber-700 dark:text-amber-300">ap-osulloc-service</p>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                  연결 테스트 성공 시 그룹 하위 프로젝트 일괄 등록 버튼이 나타납니다.
                </p>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-800" />

              {/* Jira section */}
              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Jira
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">온프레미스 / 서버</span>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 font-mono text-xs dark:bg-gray-800">
                  <span className="text-gray-400">https://</span>
                  <span className="rounded bg-blue-100 px-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">jira.company.com</span>
                  <span className="text-gray-400">/projects/</span>
                  <span className="rounded bg-violet-100 px-0.5 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">PROJ</span>
                  <span className="text-gray-400">/issues</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-blue-50 px-2.5 py-2 dark:bg-blue-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">URL 필드</p>
                    <p className="mt-0.5 font-mono text-xs text-blue-700 dark:text-blue-300">https://jira.company.com</p>
                  </div>
                  <div className="rounded-md bg-violet-50 px-2.5 py-2 dark:bg-violet-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">프로젝트 키</p>
                    <p className="mt-0.5 font-mono text-xs text-violet-700 dark:text-violet-300">PROJ</p>
                  </div>
                </div>
              </div>

              {/* Jira Cloud section */}
              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Jira
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Jira Cloud (atlassian.net)</span>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2.5 font-mono text-xs dark:bg-gray-800">
                  <span className="text-gray-400">https://</span>
                  <span className="rounded bg-blue-100 px-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">company.atlassian.net</span>
                  <span className="text-gray-400">/jira/software/projects/</span>
                  <span className="rounded bg-violet-100 px-0.5 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">MYPROJ</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-blue-50 px-2.5 py-2 dark:bg-blue-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">URL 필드</p>
                    <p className="mt-0.5 font-mono text-xs text-blue-700 dark:text-blue-300">https://company.atlassian.net</p>
                  </div>
                  <div className="rounded-md bg-violet-50 px-2.5 py-2 dark:bg-violet-950/30">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">프로젝트 키</p>
                    <p className="mt-0.5 font-mono text-xs text-violet-700 dark:text-violet-300">MYPROJ</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
