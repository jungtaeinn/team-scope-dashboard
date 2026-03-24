'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
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
  ExternalLink,
} from 'lucide-react';

interface ProjectConfig {
  id: string;
  name: string;
  type: 'jira' | 'gitlab';
  baseUrl: string;
  projectKey: string;
  isActive: boolean;
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

const EMPTY_FORM: ProjectFormData = {
  name: '',
  type: 'jira',
  baseUrl: '',
  token: '',
  projectKey: '',
};

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
  const [isSaving, setIsSaving] = useState(false);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/projects');
      const json = (await res.json()) as ApiResponse<ProjectConfig[]>;
      if (json.success && json.data) {
        setProjects(json.data);
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

  const handleOpenAdd = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTestStatus('idle');
    setTestMessage('');
    setIsFormOpen(true);
  }, []);

  const handleStartEdit = useCallback((project: ProjectConfig) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      type: project.type,
      baseUrl: project.baseUrl,
      token: '',
      projectKey: project.projectKey,
    });
    setTestStatus('idle');
    setTestMessage('');
    setIsFormOpen(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTestStatus('idle');
    setTestMessage('');
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage('');
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
      const data = (await res.json()) as ApiResponse<unknown>;
      if (data.success) {
        setTestStatus('success');
        setTestMessage(data.message ?? '연결 성공');
      } else {
        setTestStatus('fail');
        setTestMessage(data.error ?? '연결 실패');
      }
    } catch {
      setTestStatus('fail');
      setTestMessage('연결 테스트 중 오류가 발생했습니다.');
    }
  }, [form]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.baseUrl.trim()) return;
    setIsSaving(true);
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
      }
    } catch (error) {
      console.error('프로젝트 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [editingId, form, handleCloseForm, loadProjects]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
      await loadProjects();
    } catch (error) {
      console.error('프로젝트 삭제 실패:', error);
    }
  }, [loadProjects]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">프로젝트 관리</h3>
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
      </div>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isFormOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{editingId ? '프로젝트 편집' : '새 프로젝트'}</h4>
            <button type="button" onClick={handleCloseForm} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">이름</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="프로젝트 이름"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">유형</label>
              <div className="relative">
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'jira' | 'gitlab' }))}
                  className="w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 pr-8 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="jira">Jira</option>
                  <option value="gitlab">GitLab</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">URL</label>
              <input
                type="url"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://jira.example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">토큰</label>
              <input
                type="password"
                value={form.token}
                onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                placeholder={editingId ? '변경하려면 입력' : 'Personal Access Token'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">프로젝트 키</label>
              <input
                type="text"
                value={form.projectKey}
                onChange={(e) => setForm((f) => ({ ...f, projectKey: e.target.value }))}
                placeholder={form.type === 'jira' ? 'APM' : '907'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          {testStatus !== 'idle' && (
            <div
              className={cn(
                'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                testStatus === 'success' && 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                testStatus === 'fail' && 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
                testStatus === 'testing' && 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
              )}
            >
              {testStatus === 'testing' && <Loader2 className="h-4 w-4 animate-spin" />}
              {testStatus === 'success' && <CheckCircle2 className="h-4 w-4" />}
              {testStatus === 'fail' && <XCircle className="h-4 w-4" />}
              {testStatus === 'testing' ? '연결 테스트 중...' : testMessage}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={!form.baseUrl || !form.token || testStatus === 'testing'}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium',
                'text-gray-700 hover:bg-gray-100 transition-colors dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {testStatus === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              연결 테스트
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !form.name.trim()}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">프로젝트를 불러오는 중입니다...</div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-4 transition-colors',
                project.isActive
                  ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                  : 'border-gray-100 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/50',
              )}
            >
              <div className="flex items-center gap-3">
                <TypeBadge type={project.type} />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {project.baseUrl} · {project.projectKey}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStartEdit(project)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(project.id)}
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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
    </div>
  );
}
