'use client';

import { useCallback, useEffect, useMemo, useState, type SelectHTMLAttributes } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronDown, Loader2, MailPlus, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_ROLES, ROLE_LABELS, type AppRole } from '@/lib/auth/roles';

interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  joinedAt: string;
  lastActiveAt: string | null;
  isCurrentUser: boolean;
  canEditRole: boolean;
  canRemove: boolean;
}

interface WorkspaceInvitation {
  id: string;
  email: string;
  role: AppRole;
  invitedByName: string;
  invitedByEmail: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'expired' | string;
  canEditRole: boolean;
  canRemove: boolean;
}

interface WorkspaceAccessResponse {
  viewerRole: AppRole;
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

const DEFAULT_ROLE: AppRole = 'developer';

function formatRelativeTime(value: string | null) {
  if (!value) return '-';
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: ko });
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  dense?: boolean;
}

function SelectField({ className, children, dense = false, ...props }: SelectFieldProps) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          dense
            ? 'w-full appearance-none rounded border border-gray-300 px-2 py-1 pr-8 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
            : 'w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]',
          dense ? 'right-2.5 h-3.5 w-3.5' : 'right-3 h-4 w-4',
        )}
      />
    </div>
  );
}

export function WorkspaceAccessForm() {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [viewerRole, setViewerRole] = useState<AppRole>('maintainer');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, AppRole>>({});
  const [invitationRoleDrafts, setInvitationRoleDrafts] = useState<Record<string, AppRole>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>(DEFAULT_ROLE);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<AppRole>(DEFAULT_ROLE);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/workspace/members');
      const json = (await response.json().catch(() => null)) as ApiResponse<WorkspaceAccessResponse> | null;

      if (!response.ok || !json?.success) {
        throw new Error(json?.error ?? '접근 관리 데이터를 불러오지 못했습니다.');
      }

      setMembers(json.data.members);
      setInvitations(json.data.invitations);
      setViewerRole(json.data.viewerRole);
      setRoleDrafts(Object.fromEntries(json.data.members.map((member) => [member.id, member.role])));
      setInvitationRoleDrafts(Object.fromEntries(json.data.invitations.map((invitation) => [invitation.id, invitation.role])));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '접근 관리 데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ownerHint = useMemo(
    () => 'Owner 권한은 마지막 한 명 이상 유지되어야 하며, Maintainer는 Owner를 부여하거나 제거할 수 없습니다.',
    [],
  );
  const assignableRoles = useMemo(
    () => (viewerRole === 'owner' ? APP_ROLES : APP_ROLES.filter((role) => role !== 'owner')),
    [viewerRole],
  );

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setInviteLink(null);

    try {
      const response = await fetch('/api/workspace/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });

      const json = (await response.json().catch(() => null)) as ApiResponse<{
        invitation: WorkspaceInvitation;
        loginUrl: string;
      }> | null;

      if (!response.ok || !json?.success) {
        throw new Error(json?.error ?? '초대를 생성하지 못했습니다.');
      }

      setInviteEmail('');
      setInviteRole(DEFAULT_ROLE);
      setInviteLink(json.data.loginUrl);
      setStatusMessage('초대가 생성되었습니다. 초대받은 사용자가 같은 이메일로 로그인하면 워크스페이스에 자동 참여합니다.');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '초대를 생성하지 못했습니다.');
    } finally {
      setIsInviting(false);
    }
  }, [inviteEmail, inviteRole, loadData]);

  const handleCreateUser = useCallback(async () => {
    if (!createName.trim() || !createEmail.trim() || !createPassword) return;

    setIsCreatingUser(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/workspace/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          email: createEmail.trim(),
          password: createPassword,
          role: createRole,
        }),
      });

      const json = (await response.json().catch(() => null)) as ApiResponse<{
        id: string;
        name: string;
        email: string;
        role: AppRole;
      }> | null;

      if (!response.ok || !json?.success) {
        throw new Error(json?.error ?? '계정을 생성하지 못했습니다.');
      }

      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole(DEFAULT_ROLE);
      setStatusMessage('로그인 계정을 생성했습니다. 생성된 사용자는 이메일/비밀번호로 바로 로그인할 수 있습니다.');
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '계정을 생성하지 못했습니다.');
    } finally {
      setIsCreatingUser(false);
    }
  }, [createEmail, createName, createPassword, createRole, loadData]);

  const handleUpdateMemberRole = useCallback(
    async (id: string) => {
      setPendingActionId(id);
      setStatusMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/workspace/members', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'member',
            id,
            role: roleDrafts[id],
          }),
        });
        const json = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
        if (!response.ok || !json?.success) {
          throw new Error(json?.error ?? '권한을 변경하지 못했습니다.');
        }

        setStatusMessage('멤버 권한을 업데이트했습니다.');
        await loadData();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '권한을 변경하지 못했습니다.');
      } finally {
        setPendingActionId(null);
      }
    },
    [loadData, roleDrafts],
  );

  const handleUpdateInvitationRole = useCallback(
    async (id: string) => {
      setPendingActionId(id);
      setStatusMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/workspace/members', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'invitation',
            id,
            role: invitationRoleDrafts[id],
          }),
        });
        const json = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
        if (!response.ok || !json?.success) {
          throw new Error(json?.error ?? '초대 권한을 변경하지 못했습니다.');
        }

        setStatusMessage('초대 권한을 업데이트했습니다.');
        await loadData();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '초대 권한을 변경하지 못했습니다.');
      } finally {
        setPendingActionId(null);
      }
    },
    [invitationRoleDrafts, loadData],
  );

  const handleRemove = useCallback(
    async (kind: 'member' | 'invitation', id: string) => {
      setPendingActionId(id);
      setStatusMessage(null);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/workspace/members?kind=${kind}&id=${id}`, {
          method: 'DELETE',
        });
        const json = (await response.json().catch(() => null)) as ApiResponse<unknown> | null;
        if (!response.ok || !json?.success) {
          throw new Error(json?.error ?? '삭제하지 못했습니다.');
        }

        setStatusMessage(kind === 'member' ? '멤버를 제거했습니다.' : '초대를 취소했습니다.');
        await loadData();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '삭제하지 못했습니다.');
      } finally {
        setPendingActionId(null);
      }
    },
    [loadData],
  );

  const handleCopyLink = useCallback(async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setStatusMessage('로그인 링크를 복사했습니다.');
    } catch {
      setErrorMessage('로그인 링크를 복사하지 못했습니다.');
    }
  }, [inviteLink]);

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">워크스페이스 접근 관리</h3>
            <p className="text-sm text-muted-foreground">
              이메일 초대를 만들고 역할을 관리합니다. 초대받은 사용자는 같은 이메일로 로그인하면 자동으로 워크스페이스에 참여합니다.
            </p>
            <p className="text-xs text-muted-foreground">{ownerHint}</p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr),180px,auto] lg:max-w-2xl lg:self-start lg:pr-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="member@company.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <SelectField
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as AppRole)}
            >
              {assignableRoles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </SelectField>
            <button
              type="button"
              onClick={() => void handleInvite()}
              disabled={isInviting || !inviteEmail.trim()}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
              초대 추가
            </button>
          </div>
        </div>

        {(statusMessage || errorMessage || inviteLink) && (
          <div
            className={cn(
              'mt-4 rounded-lg border px-3 py-2 text-sm',
              errorMessage
                ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300'
                : 'border-border bg-muted/40 text-muted-foreground',
            )}
          >
            <div>{errorMessage ?? statusMessage}</div>
            {inviteLink && !errorMessage ? (
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="rounded bg-background px-2 py-1 text-xs text-foreground">{inviteLink}</code>
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  className="inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  로그인 링크 복사
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {viewerRole === 'owner' ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">로그인 계정 직접 생성</h3>
            <p className="text-sm text-muted-foreground">
              Owner는 로그인 가능한 사용자를 수기로 등록할 수 있습니다. 생성된 계정은 이메일/비밀번호로 바로 로그인합니다.
            </p>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <input
              type="text"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="이름"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              type="email"
              value={createEmail}
              onChange={(event) => setCreateEmail(event.target.value)}
              placeholder="user@company.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <input
              type="password"
              value={createPassword}
              onChange={(event) => setCreatePassword(event.target.value)}
              placeholder="비밀번호"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            <SelectField
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value as AppRole)}
            >
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="mt-5 flex justify-end pr-1 sm:pr-2">
            <button
              type="button"
              onClick={() => void handleCreateUser()}
              disabled={isCreatingUser || !createName.trim() || !createEmail.trim() || !createPassword}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              {isCreatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              계정 생성
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/40">
            <tr>
              {['이름', '이메일', '역할', '최근 활동', '액션'].map((header) => (
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
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  워크스페이스 멤버를 불러오는 중입니다...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  아직 등록된 멤버가 없습니다.
                </td>
              </tr>
            ) : (
              members.map((member) => {
                const isDirty = roleDrafts[member.id] !== member.role;

                return (
                  <tr key={member.id} className="transition-colors hover:bg-accent/40">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-foreground">
                      {member.name}
                      {member.isCurrentUser ? <span className="ml-2 text-xs text-muted-foreground">(나)</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{member.email}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {member.canEditRole ? (
                        <SelectField
                          dense
                          value={roleDrafts[member.id]}
                          onChange={(event) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [member.id]: event.target.value as AppRole,
                            }))
                          }
                        >
                          {assignableRoles.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </SelectField>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                      {formatRelativeTime(member.lastActiveAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        {member.canEditRole ? (
                          <button
                            type="button"
                            onClick={() => void handleUpdateMemberRole(member.id)}
                            disabled={!isDirty || pendingActionId === member.id}
                            className="rounded p-1 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-green-900/20"
                            aria-label={`${member.name} 권한 저장`}
                          >
                            {pendingActionId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        ) : null}
                        {member.canRemove ? (
                          <button
                            type="button"
                            onClick={() => void handleRemove('member', member.id)}
                            disabled={pendingActionId === member.id}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800"
                            aria-label={`${member.name} 제거`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/40">
            <tr>
              {['대기 중 초대', '역할', '만료', '액션'].map((header) => (
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
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  초대 내역을 불러오는 중입니다...
                </td>
              </tr>
            ) : invitations.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  대기 중인 초대가 없습니다.
                </td>
              </tr>
            ) : (
              invitations.map((invitation) => {
                const isDirty = invitationRoleDrafts[invitation.id] !== invitation.role;
                const statusClass =
                  invitation.status === 'expired'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

                return (
                  <tr key={invitation.id} className="transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3 text-sm text-foreground">
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {invitation.invitedByName} 초대 · {formatRelativeTime(invitation.createdAt)}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {invitation.canEditRole ? (
                        <SelectField
                          dense
                          value={invitationRoleDrafts[invitation.id]}
                          onChange={(event) =>
                            setInvitationRoleDrafts((prev) => ({
                              ...prev,
                              [invitation.id]: event.target.value as AppRole,
                            }))
                          }
                        >
                          {assignableRoles.map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </SelectField>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {ROLE_LABELS[invitation.role]}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusClass)}>
                        {invitation.status === 'expired' ? '만료' : `대기 중 · ${formatRelativeTime(invitation.expiresAt)}`}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        {invitation.canEditRole ? (
                          <button
                            type="button"
                            onClick={() => void handleUpdateInvitationRole(invitation.id)}
                            disabled={!isDirty || pendingActionId === invitation.id}
                            className="rounded p-1 text-green-600 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-green-900/20"
                            aria-label={`${invitation.email} 초대 저장`}
                          >
                            {pendingActionId === invitation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        ) : null}
                        {invitation.canRemove ? (
                          <button
                            type="button"
                            onClick={() => void handleRemove('invitation', invitation.id)}
                            disabled={pendingActionId === invitation.id}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800"
                            aria-label={`${invitation.email} 초대 취소`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
