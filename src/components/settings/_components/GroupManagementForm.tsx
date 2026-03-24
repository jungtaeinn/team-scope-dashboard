'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Save, X, Pencil, Trash2, Loader2, Users, UserPlus, UserMinus } from 'lucide-react';

interface GroupMember {
  id: string;
  name: string;
  groupId?: string | null;
}

interface GroupData {
  id: string;
  name: string;
  members: GroupMember[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

/**
 * 개발자 그룹 관리 폼.
 * 그룹 CRUD와 멤버 배정을 DB/API 기반으로 처리합니다.
 */
export function GroupManagementForm() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [developers, setDevelopers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [groupRes, devRes] = await Promise.all([fetch('/api/groups'), fetch('/api/developers')]);
      const groupJson = (await groupRes.json()) as ApiResponse<Array<{ id: string; name: string; developers: GroupMember[] }>>;
      const devJson = (await devRes.json()) as ApiResponse<Array<{ id: string; name: string; groupId?: string | null; isActive: boolean }>>;

      if (groupJson.success && groupJson.data) {
        setGroups(
          groupJson.data.map((group) => ({
            id: group.id,
            name: group.name,
            members: group.developers ?? [],
          })),
        );
      }

      if (devJson.success && devJson.data) {
        setDevelopers(
          devJson.data
            .filter((dev) => dev.isActive)
            .map((dev) => ({
              id: dev.id,
              name: dev.name,
              groupId: dev.groupId ?? null,
            })),
        );
      }
    } catch (error) {
      console.error('그룹 데이터 조회 실패:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const unassigned = useMemo(
    () => developers.filter((dev) => !dev.groupId),
    [developers],
  );

  const handleAddGroup = useCallback(async () => {
    if (!newGroupName.trim()) return;
    setIsSaving(true);
    try {
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      setNewGroupName('');
      setIsAddingGroup(false);
      await loadData();
    } catch (error) {
      console.error('그룹 추가 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [newGroupName, loadData]);

  const handleStartEditGroup = useCallback((group: GroupData) => {
    setEditingGroupId(group.id);
    setEditGroupName(group.name);
  }, []);

  const handleSaveGroupName = useCallback(async () => {
    if (!editingGroupId || !editGroupName.trim()) return;
    setIsSaving(true);
    try {
      await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingGroupId, name: editGroupName.trim() }),
      });
      setEditingGroupId(null);
      setEditGroupName('');
      await loadData();
    } catch (error) {
      console.error('그룹명 수정 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [editingGroupId, editGroupName, loadData]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    setIsSaving(true);
    try {
      await fetch(`/api/groups?id=${groupId}`, { method: 'DELETE' });
      await loadData();
    } catch (error) {
      console.error('그룹 삭제 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [loadData]);

  const handleAddMember = useCallback(async (groupId: string, member: GroupMember) => {
    setIsSaving(true);
    try {
      await fetch('/api/developers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, groupId }),
      });
      await loadData();
    } catch (error) {
      console.error('그룹 멤버 추가 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [loadData]);

  const handleRemoveMember = useCallback(async (memberId: string) => {
    setIsSaving(true);
    try {
      await fetch('/api/developers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberId, groupId: '' }),
      });
      await loadData();
    } catch (error) {
      console.error('그룹 멤버 제거 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [loadData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">그룹 관리</h3>
        <button
          type="button"
          onClick={() => setIsAddingGroup(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
            'bg-blue-600 text-white hover:bg-blue-700 transition-colors',
          )}
        >
          <Plus className="h-4 w-4" />
          그룹 추가
        </button>
      </div>

      {isAddingGroup && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 p-3 dark:border-blue-700 dark:bg-blue-900/10">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleAddGroup()}
            placeholder="그룹 이름 입력"
            autoFocus
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => void handleAddGroup()}
            disabled={isSaving}
            className="rounded p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingGroup(false);
              setNewGroupName('');
            }}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">그룹 데이터를 불러오는 중입니다...</div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-gray-400" />
                  {editingGroupId === group.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && void handleSaveGroupName()}
                        className="rounded border border-gray-300 px-2 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                        autoFocus
                      />
                      <button type="button" onClick={() => void handleSaveGroupName()} className="text-green-600">
                        <Save className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingGroupId(null)} className="text-gray-400">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</span>
                  )}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {group.members.length}명
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditGroup(group)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteGroup(group.id)}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="px-4 py-2">
                {group.members.length === 0 ? (
                  <p className="py-2 text-center text-xs text-gray-400">소속 멤버가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 py-1">
                    {group.members.map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {member.name}
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(member.id)}
                          className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {expandedGroupId === group.id && unassigned.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">미배정 개발자:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {unassigned.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => void handleAddMember(group.id, member)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs',
                            'border-blue-300 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20',
                          )}
                        >
                          <UserPlus className="h-3 w-3" />
                          {member.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && !isLoading && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-800/30">
          <div className="mb-2 flex items-center gap-2">
            <UserMinus className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">미배정 ({unassigned.length}명)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-400"
              >
                {member.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium',
            'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300',
          )}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          자동 저장됨
        </button>
      </div>
    </div>
  );
}
