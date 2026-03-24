'use client';

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Pencil, Trash2, Plus, Save, X, Loader2 } from 'lucide-react';

interface DeveloperMapping {
  id: string;
  name: string;
  jiraUsername: string;
  gitlabUsername: string;
  groupId: string;
  groupName: string;
  isActive: boolean;
}

interface GroupOption {
  id: string;
  name: string;
}

interface DeveloperFormData {
  name: string;
  jiraUsername: string;
  gitlabUsername: string;
  groupId: string;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

interface SyncResponse {
  success: boolean;
  message?: string;
}

const EMPTY_FORM: DeveloperFormData = {
  name: '',
  jiraUsername: '',
  gitlabUsername: '',
  groupId: '',
  isActive: true,
};

/**
 * 개발자-Jira/GitLab 사용자명 매핑 관리 폼.
 * DB 기반 데이터로 추가/편집/삭제 후 저장합니다.
 */
export function MemberMappingForm() {
  const [developers, setDevelopers] = useState<DeveloperMapping[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DeveloperFormData>(EMPTY_FORM);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<DeveloperFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [devRes, groupRes] = await Promise.all([fetch('/api/developers'), fetch('/api/groups')]);
      const devJson = (await devRes.json()) as ApiResponse<Array<{
        id: string;
        name: string;
        jiraUsername?: string | null;
        gitlabUsername?: string | null;
        groupId?: string | null;
        isActive: boolean;
        group?: { id: string; name: string } | null;
      }>>;
      const groupJson = (await groupRes.json()) as ApiResponse<Array<{ id: string; name: string }>>;

      if (groupJson.success && groupJson.data) {
        setGroups(groupJson.data.map((g) => ({ id: g.id, name: g.name })));
      }

      if (devJson.success && devJson.data) {
        setDevelopers(
          devJson.data.map((dev) => ({
            id: dev.id,
            name: dev.name,
            jiraUsername: dev.jiraUsername ?? '',
            gitlabUsername: dev.gitlabUsername ?? '',
            groupId: dev.groupId ?? '',
            groupName: dev.group?.name ?? '-',
            isActive: dev.isActive,
          })),
        );
      }
    } catch (error) {
      console.error('멤버/그룹 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleStartEdit = useCallback((dev: DeveloperMapping) => {
    setEditingId(dev.id);
    setEditForm({
      name: dev.name,
      jiraUsername: dev.jiraUsername,
      gitlabUsername: dev.gitlabUsername,
      groupId: dev.groupId,
      isActive: dev.isActive,
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    setDevelopers((prev) =>
      prev.map((d) =>
        d.id === editingId
          ? {
              ...d,
              ...editForm,
              groupName: groups.find((g) => g.id === editForm.groupId)?.name ?? '-',
            }
          : d,
      ),
    );
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }, [editingId, editForm, groups]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/developers?id=${id}`, { method: 'DELETE' });
      setDevelopers((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error('개발자 삭제 실패:', error);
    }
  }, []);

  const handleAddNew = useCallback(() => {
    if (!newForm.name.trim()) return;
    const groupName = groups.find((g) => g.id === newForm.groupId)?.name ?? '-';
    const newDev: DeveloperMapping = {
      id: `temp-${Date.now()}`,
      ...newForm,
      groupName,
    };
    setDevelopers((prev) => [...prev, newDev]);
    setNewForm(EMPTY_FORM);
    setIsAddingNew(false);
  }, [newForm, groups]);

  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      for (const dev of developers) {
        const saveRes = await fetch('/api/developers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: dev.id.startsWith('temp-') ? undefined : dev.id,
            name: dev.name,
            jiraUsername: dev.jiraUsername,
            gitlabUsername: dev.gitlabUsername,
            groupId: dev.groupId || undefined,
            isActive: dev.isActive,
          }),
        });

        const saveJson = (await saveRes.json().catch(() => null)) as ApiResponse<unknown> | null;
        if (!saveRes.ok || !saveJson?.success) {
          throw new Error(saveJson?.error ?? '개발자 저장 중 오류가 발생했습니다.');
        }
      }

      const syncRes = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const syncJson = (await syncRes.json().catch(() => null)) as SyncResponse | null;
      if (!syncRes.ok || !syncJson?.success) {
        throw new Error(syncJson?.message ?? '데이터 동기화 중 오류가 발생했습니다.');
      }

      await loadData();
    } catch (error) {
      console.error('개발자 매핑 저장 실패:', error);
      alert(error instanceof Error ? error.message : '개발자 매핑 저장/동기화 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [developers, loadData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">멤버 매핑</h3>
        <button
          type="button"
          onClick={() => setIsAddingNew(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
            'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
          )}
        >
          <Plus className="h-4 w-4" />
          개발자 추가
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/40">
            <tr>
              {['이름', 'Jira 사용자명', 'GitLab 사용자명', '그룹', '활성', '액션'].map((header) => (
                <th
                  key={header}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  멤버 매핑 데이터를 불러오는 중입니다...
                </td>
              </tr>
            ) : (
              developers.map((dev) => (
                <tr key={dev.id} className="transition-colors hover:bg-accent/40">
                  {editingId === dev.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.jiraUsername}
                          onChange={(e) => setEditForm((f) => ({ ...f, jiraUsername: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editForm.gitlabUsername}
                          onChange={(e) => setEditForm((f) => ({ ...f, gitlabUsername: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editForm.groupId}
                          onChange={(e) => setEditForm((f) => ({ ...f, groupId: e.target.value }))}
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        >
                          <option value="">미배정</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground">{dev.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{dev.jiraUsername || '-'}</code>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{dev.gitlabUsername || '-'}</code>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{dev.groupName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                            dev.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
                          )}
                        >
                          {dev.isActive ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(dev)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(dev.id)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}

            {isAddingNew && (
              <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="이름"
                    value={newForm.name}
                    onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="Jira 사용자명"
                    value={newForm.jiraUsername}
                    onChange={(e) => setNewForm((f) => ({ ...f, jiraUsername: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    placeholder="GitLab 사용자명"
                    value={newForm.gitlabUsername}
                    onChange={(e) => setNewForm((f) => ({ ...f, gitlabUsername: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={newForm.groupId}
                    onChange={(e) => setNewForm((f) => ({ ...f, groupId: e.target.value }))}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="">미배정</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={newForm.isActive}
                    onChange={(e) => setNewForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleAddNew}
                      className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewForm(EMPTY_FORM);
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving || isLoading}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? '저장 및 동기화 중...' : '저장 + 동기화'}
        </button>
      </div>
    </div>
  );
}
