'use client';

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import {
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  Check,
  Loader2,
  BadgeCheck,
  Link2,
  CheckCheck,
  Sparkles,
  Search,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { WorkspaceAccessForm } from './WorkspaceAccessForm';

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

interface ProjectOption {
  id: string;
  name: string;
  type: 'jira' | 'gitlab';
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

interface ProjectMemberCandidate {
  key: string;
  name: string;
  jiraUsername: string | null;
  gitlabUsername: string | null;
  corporateIdentifier: string | null;
  matchedDeveloperId: string | null;
  matchedDeveloperName: string | null;
  matchReason: string | null;
  matchScore: number | null;
  assigned: boolean;
}

interface ProjectMemberNotice {
  tone: 'error' | 'success';
  message: string;
}

interface SaveNotice {
  tone: 'error' | 'success';
  message: string;
}

const EMPTY_FORM: DeveloperFormData = {
  name: '',
  jiraUsername: '',
  gitlabUsername: '',
  groupId: '',
  isActive: true,
};
const PROJECT_CANDIDATE_PAGE_SIZE = 10;

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

interface ProjectSelectProps {
  value: string;
  projects: ProjectOption[];
  onValueChange: (value: string) => void;
}

function ProjectSelect({ value, projects, onValueChange }: ProjectSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedProject = projects.find((project) => project.id === value);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (nextValue: string) => {
      onValueChange(nextValue);
      setIsOpen(false);
    },
    [onValueChange],
  );

  const handleButtonKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="project-member-select-listbox"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleButtonKeyDown}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-border bg-[var(--card)] px-3 text-left text-sm text-[var(--foreground)] shadow-sm transition-colors',
          'hover:bg-[var(--accent)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]',
        )}
      >
        <span className={cn('truncate', !selectedProject && 'text-muted-foreground')}>
          {selectedProject
            ? `${selectedProject.name} (${selectedProject.type === 'jira' ? 'Jira' : 'GitLab'})`
            : '프로젝트 선택'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180 text-[var(--foreground)]',
          )}
        />
      </button>

      {isOpen ? (
        <div
          id="project-member-select-listbox"
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-lg border border-border bg-[var(--popover)] p-1.5 text-sm text-[var(--popover-foreground)] shadow-xl',
            'ring-1 ring-black/5 dark:ring-white/10',
          )}
        >
          <button
            type="button"
            role="option"
            aria-selected={!value}
            onClick={() => handleSelect('')}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
              !value
                ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
            )}
          >
            <Check className={cn('h-4 w-4 shrink-0', value ? 'opacity-0' : 'opacity-100')} />
            <span className="truncate">프로젝트 선택</span>
          </button>

          {projects.map((project) => {
            const isSelected = project.id === value;
            return (
              <button
                key={project.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(project.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                    : 'text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
                )}
              >
                <Check
                  className={cn('h-4 w-4 shrink-0 text-[var(--primary)]', isSelected ? 'opacity-100' : 'opacity-0')}
                />
                <span className="min-w-0 flex-1 truncate">
                  {project.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({project.type === 'jira' ? 'Jira' : 'GitLab'})
                  </span>
                </span>
              </button>
            );
          })}

          {projects.length === 0 ? (
            <div className="px-2.5 py-5 text-center text-sm text-muted-foreground">등록된 프로젝트가 없습니다.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 개발자-Jira/GitLab 사용자명 매핑 관리 폼.
 * DB 기반 데이터로 추가/편집/삭제 후 저장합니다.
 */
export function MemberMappingSections() {
  const [developers, setDevelopers] = useState<DeveloperMapping[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DeveloperFormData>(EMPTY_FORM);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<DeveloperFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectCandidates, setProjectCandidates] = useState<ProjectMemberCandidate[]>([]);
  const [isLoadingProjectMembers, setIsLoadingProjectMembers] = useState(false);
  const [isSavingProjectMembers, setIsSavingProjectMembers] = useState(false);
  const [hasLoadedProjectMembers, setHasLoadedProjectMembers] = useState(false);
  const [projectCandidateSearch, setProjectCandidateSearch] = useState('');
  const [projectCandidatePage, setProjectCandidatePage] = useState(1);
  const [projectMemberNotice, setProjectMemberNotice] = useState<ProjectMemberNotice | null>(null);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [devRes, groupRes, projectRes] = await Promise.all([
        fetch('/api/developers'),
        fetch('/api/groups'),
        fetch('/api/projects'),
      ]);
      const devJson = (await devRes.json()) as ApiResponse<
        Array<{
          id: string;
          name: string;
          jiraUsername?: string | null;
          gitlabUsername?: string | null;
          groupId?: string | null;
          isActive: boolean;
          group?: { id: string; name: string } | null;
        }>
      >;
      const groupJson = (await groupRes.json()) as ApiResponse<Array<{ id: string; name: string }>>;
      const projectJson = (await projectRes.json()) as ApiResponse<
        Array<{ id: string; name: string; type: 'jira' | 'gitlab' }>
      >;

      if (groupJson.success && groupJson.data) {
        setGroups(groupJson.data.map((g) => ({ id: g.id, name: g.name })));
      }

      if (projectJson.success && projectJson.data) {
        setProjects(projectJson.data.map((project) => ({ id: project.id, name: project.name, type: project.type })));
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

  const loadProjectMembers = useCallback(async () => {
    if (!selectedProjectId) {
      setProjectCandidates([]);
      setHasLoadedProjectMembers(false);
      setProjectCandidateSearch('');
      setProjectCandidatePage(1);
      setProjectMemberNotice(null);
      return;
    }

    setIsLoadingProjectMembers(true);
    setProjectMemberNotice(null);
    try {
      const res = await fetch(`/api/project-members?projectId=${selectedProjectId}`);
      const json = (await res.json()) as ApiResponse<{ candidates: ProjectMemberCandidate[] }>;
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? '프로젝트 멤버를 불러오지 못했습니다.');
      }
      setProjectCandidates(json.data.candidates);
      setProjectCandidateSearch('');
      setProjectCandidatePage(1);
      setHasLoadedProjectMembers(true);
    } catch (error) {
      console.error('프로젝트 멤버 조회 실패:', error);
      setProjectCandidates([]);
      setHasLoadedProjectMembers(false);
      setProjectMemberNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '프로젝트 멤버 조회 중 오류가 발생했습니다.',
      });
    } finally {
      setIsLoadingProjectMembers(false);
    }
  }, [selectedProjectId]);

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
    setSaveNotice(null);
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

      let syncMessage = '';
      if (selectedProjectId) {
        const syncRes = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: selectedProjectId }),
        });
        const syncJson = (await syncRes.json().catch(() => null)) as SyncResponse | null;
        if (!syncRes.ok || !syncJson?.success) {
          throw new Error(syncJson?.message ?? '데이터 동기화 중 오류가 발생했습니다.');
        }
        syncMessage = syncJson.message ? ` ${syncJson.message}` : ' 선택한 프로젝트 동기화까지 완료했습니다.';
      }

      await loadData();
      setSaveNotice({
        tone: 'success',
        message: selectedProjectId
          ? `멤버 매핑을 저장했습니다.${syncMessage}`
          : '멤버 매핑을 저장했습니다. 프로젝트를 선택하지 않아 전체 데이터 동기화는 실행하지 않았습니다.',
      });
    } catch (error) {
      console.error('개발자 매핑 저장 실패:', error);
      setSaveNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '개발자 매핑 저장/동기화 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [developers, loadData, selectedProjectId]);

  const handleToggleProjectCandidate = useCallback((key: string) => {
    setProjectCandidates((prev) =>
      prev.map((candidate) => (candidate.key === key ? { ...candidate, assigned: !candidate.assigned } : candidate)),
    );
  }, []);

  const handleSaveProjectMembers = useCallback(async () => {
    if (!selectedProjectId) return;

    setIsSavingProjectMembers(true);
    setProjectMemberNotice(null);
    try {
      const res = await fetch('/api/project-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          candidates: projectCandidates,
        }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? '프로젝트 멤버 저장에 실패했습니다.');
      }

      await loadData();
      await loadProjectMembers();
      setProjectMemberNotice({
        tone: 'success',
        message: '선택한 프로젝트 멤버를 저장했고, 기존 멤버 자동 매핑과 중복 정리까지 함께 반영했습니다.',
      });
    } catch (error) {
      console.error('프로젝트 멤버 저장 실패:', error);
      setProjectMemberNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '프로젝트 멤버 저장 중 오류가 발생했습니다.',
      });
    } finally {
      setIsSavingProjectMembers(false);
    }
  }, [loadData, loadProjectMembers, projectCandidates, selectedProjectId]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedCandidateCount = useMemo(
    () => projectCandidates.filter((candidate) => candidate.assigned).length,
    [projectCandidates],
  );
  const matchedCandidateCount = useMemo(
    () => projectCandidates.filter((candidate) => Boolean(candidate.matchedDeveloperId)).length,
    [projectCandidates],
  );
  const newCandidateCount = useMemo(
    () => projectCandidates.filter((candidate) => !candidate.matchedDeveloperId).length,
    [projectCandidates],
  );
  const filteredProjectCandidates = useMemo(() => {
    const keyword = projectCandidateSearch.trim().toLowerCase();
    if (!keyword) return projectCandidates;

    return projectCandidates.filter((candidate) => {
      const targets = [
        candidate.name,
        candidate.jiraUsername,
        candidate.gitlabUsername,
        candidate.corporateIdentifier,
        candidate.matchedDeveloperName,
      ];

      return targets.some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [projectCandidateSearch, projectCandidates]);
  const projectCandidatePageCount = Math.max(
    1,
    Math.ceil(filteredProjectCandidates.length / PROJECT_CANDIDATE_PAGE_SIZE),
  );
  const pagedProjectCandidates = useMemo(() => {
    const startIndex = (projectCandidatePage - 1) * PROJECT_CANDIDATE_PAGE_SIZE;
    return filteredProjectCandidates.slice(startIndex, startIndex + PROJECT_CANDIDATE_PAGE_SIZE);
  }, [filteredProjectCandidates, projectCandidatePage]);
  const projectCandidatePageStart =
    filteredProjectCandidates.length === 0 ? 0 : (projectCandidatePage - 1) * PROJECT_CANDIDATE_PAGE_SIZE + 1;
  const projectCandidatePageEnd = Math.min(
    projectCandidatePage * PROJECT_CANDIDATE_PAGE_SIZE,
    filteredProjectCandidates.length,
  );
  const projectCandidatePageItems = useMemo(() => {
    if (projectCandidatePageCount <= 7) {
      return Array.from({ length: projectCandidatePageCount }, (_, index) => index + 1);
    }

    const pages = new Set([1, projectCandidatePageCount]);
    for (let page = projectCandidatePage - 1; page <= projectCandidatePage + 1; page += 1) {
      if (page > 1 && page < projectCandidatePageCount) {
        pages.add(page);
      }
    }

    return [...pages].sort((a, b) => a - b);
  }, [projectCandidatePage, projectCandidatePageCount]);

  useEffect(() => {
    setProjectCandidatePage((page) => Math.min(page, projectCandidatePageCount));
  }, [projectCandidatePageCount]);

  useEffect(() => {
    setProjectCandidatePage(1);
  }, [projectCandidateSearch]);

  const handleAssignAllProjectCandidates = useCallback(() => {
    setProjectCandidates((prev) => prev.map((candidate) => ({ ...candidate, assigned: true })));
  }, []);

  const handleClearProjectCandidates = useCallback(() => {
    setProjectCandidates((prev) => prev.map((candidate) => ({ ...candidate, assigned: false })));
  }, []);

  const handleAssignMatchedProjectCandidates = useCallback(() => {
    setProjectCandidates((prev) =>
      prev.map((candidate) => ({
        ...candidate,
        assigned: Boolean(candidate.matchedDeveloperId),
      })),
    );
  }, []);

  return (
    <>
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">프로젝트 기준 멤버 불러오기</h3>
          <p className="text-sm text-muted-foreground">
            프로젝트를 선택하고 실제 등록 멤버를 조회한 뒤, 필요한 멤버만 선택해 저장하면 기존 멤버 매칭과 중복 정리까지
            자동으로 처리됩니다.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-4 lg:pr-2">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">프로젝트</label>
              <ProjectSelect
                value={selectedProjectId}
                projects={projects}
                onValueChange={(nextProjectId) => {
                  setSelectedProjectId(nextProjectId);
                  setProjectCandidates([]);
                  setHasLoadedProjectMembers(false);
                  setProjectCandidateSearch('');
                  setProjectCandidatePage(1);
                  setProjectMemberNotice(null);
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => void loadProjectMembers()}
              disabled={!selectedProjectId || isLoadingProjectMembers}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                'border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-sm hover:bg-[var(--accent)]',
                'lg:justify-self-end',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {isLoadingProjectMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              멤버 조회
            </button>
          </div>

          {selectedProject && (
            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)]">
                      {selectedProject.name}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                        selectedProject.type === 'jira'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                      )}
                    >
                      {selectedProject.type === 'jira' ? 'Jira 담당자/개발담당자' : 'GitLab 프로젝트 멤버'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    조회된 멤버 중 필요한 인원만 선택해 저장하면, 기존 개발자 자동 연결과 중복 병합까지 함께 처리되어
                    프로젝트 기준 필터와 동기화 대상이 더 정확해집니다.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[320px]">
                  <div className="rounded-lg border border-border bg-[var(--card)] px-3 py-2">
                    <div className="text-[var(--muted-foreground)]">조회 멤버</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {projectCandidates.length}명
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-[var(--card)] px-3 py-2">
                    <div className="text-[var(--muted-foreground)]">기존 매핑</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">{matchedCandidateCount}명</div>
                  </div>
                  <div className="rounded-lg border border-border bg-[var(--card)] px-3 py-2">
                    <div className="text-[var(--muted-foreground)]">선택됨</div>
                    <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {selectedCandidateCount}명
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {projectMemberNotice ? (
            <div
              className={cn(
                'mt-4 rounded-lg border px-3 py-2 text-sm',
                projectMemberNotice.tone === 'error'
                  ? 'border-red-500/25 bg-red-500/10 text-red-300'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
              )}
            >
              {projectMemberNotice.message}
            </div>
          ) : null}

          {projectCandidates.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border bg-muted/20">
                <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">조회된 프로젝트 멤버</h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      저장 시 기존 멤버는 자동 연결되고, 같은 사람으로 판단되는 중복 데이터도 함께 정리됩니다.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 lg:items-end">
                    <div className="relative w-full lg:w-72">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={projectCandidateSearch}
                        onChange={(event) => setProjectCandidateSearch(event.target.value)}
                        placeholder="이름, 식별자, 연결 멤버 검색"
                        className="h-9 w-full rounded-lg border border-border bg-[var(--card)] pl-8 pr-3 text-xs text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAssignMatchedProjectCandidates}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        기존 매핑만
                      </button>
                      <button
                        type="button"
                        onClick={handleAssignAllProjectCandidates}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        전체 선택
                      </button>
                      <button
                        type="button"
                        onClick={handleClearProjectCandidates}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                      >
                        초기화
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-3">
                  {pagedProjectCandidates.map((candidate) => (
                    <label
                      key={candidate.key}
                      className={cn(
                        'grid cursor-pointer gap-3 rounded-xl border px-4 py-3 text-sm transition-all',
                        'md:grid-cols-[auto,minmax(0,1.7fr),minmax(0,1fr),auto] md:items-center',
                        candidate.assigned
                          ? 'border-[color:color-mix(in_oklab,var(--primary)_38%,var(--border))] bg-[color:color-mix(in_oklab,var(--primary)_10%,var(--card))] shadow-sm'
                          : candidate.matchedDeveloperName
                            ? 'border-[color:color-mix(in_oklab,#10b981_24%,var(--border))] bg-[var(--card)] hover:border-[color:color-mix(in_oklab,#10b981_38%,var(--border))] hover:bg-accent/20'
                            : 'border-[color:color-mix(in_oklab,#f59e0b_18%,var(--border))] bg-[var(--card)] hover:border-[color:color-mix(in_oklab,#f59e0b_34%,var(--border))] hover:bg-accent/20',
                      )}
                    >
                      <div className="flex items-start pt-0.5 md:pt-0">
                        <input
                          type="checkbox"
                          checked={candidate.assigned}
                          onChange={() => handleToggleProjectCandidate(candidate.key)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-foreground">{candidate.name}</span>
                          {candidate.matchedDeveloperName ? (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400">
                                <BadgeCheck className="h-3 w-3" />
                                자동 매칭됨
                              </span>
                              {candidate.matchReason ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-300">
                                  <Sparkles className="h-3 w-3" />
                                  {candidate.matchReason}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300">
                              <Sparkles className="h-3 w-3" />
                              신규 생성
                            </span>
                          )}
                        </div>
                        {candidate.matchedDeveloperName ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="text-emerald-400">{candidate.matchedDeveloperName}</span> 레코드에
                            연결됩니다.
                          </p>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-muted-foreground">외부 식별자</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {candidate.gitlabUsername || candidate.jiraUsername ? (
                            <div className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs text-foreground">
                              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {candidate.gitlabUsername ? 'GitLab' : 'Jira'}
                              </span>
                              <code className="truncate">{candidate.gitlabUsername ?? candidate.jiraUsername}</code>
                            </div>
                          ) : null}
                          {candidate.corporateIdentifier ? (
                            <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-300">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-sky-300/80">
                                AC/AP
                              </span>
                              <code>{candidate.corporateIdentifier}</code>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center md:justify-end">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                            candidate.assigned
                              ? 'bg-[var(--primary)]/15 text-[var(--primary)]'
                              : 'bg-[var(--accent)] text-[var(--muted-foreground)]',
                          )}
                        >
                          {candidate.assigned ? '저장 대상' : '미선택'}
                        </span>
                      </div>
                    </label>
                  ))}
                  {filteredProjectCandidates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-[var(--card)] px-4 py-8 text-center text-sm text-muted-foreground">
                      검색 조건에 맞는 프로젝트 멤버가 없습니다.
                    </div>
                  ) : null}
                </div>

                {filteredProjectCandidates.length > PROJECT_CANDIDATE_PAGE_SIZE ? (
                  <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      {filteredProjectCandidates.length}명 중 {projectCandidatePageStart}-{projectCandidatePageEnd}명
                      표시
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setProjectCandidatePage(1)}
                        disabled={projectCandidatePage === 1}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-[var(--card)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="첫 페이지"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </button>
                      {projectCandidatePageItems.map((page, index) => {
                        const previousPage = projectCandidatePageItems[index - 1];
                        const hasGap = typeof previousPage === 'number' && page - previousPage > 1;
                        return (
                          <div key={page} className="flex items-center gap-1.5">
                            {hasGap ? <span className="px-1 text-xs text-muted-foreground">...</span> : null}
                            <button
                              type="button"
                              onClick={() => setProjectCandidatePage(page)}
                              aria-current={projectCandidatePage === page ? 'page' : undefined}
                              className={cn(
                                'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors',
                                projectCandidatePage === page
                                  ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]'
                                  : 'border-border bg-[var(--card)] text-muted-foreground hover:bg-accent hover:text-foreground',
                              )}
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setProjectCandidatePage(projectCandidatePageCount)}
                        disabled={projectCandidatePage === projectCandidatePageCount}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-[var(--card)] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                        aria-label="마지막 페이지"
                      >
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedCandidateCount}명</span>을 저장 대상으로
                  선택했습니다.
                  {!selectedCandidateCount && newCandidateCount > 0
                    ? ' 신규 생성 대상은 필요한 인원만 체크해서 저장해 주세요.'
                    : ' 저장 시 자동 매칭과 중복 정리가 함께 적용됩니다.'}
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveProjectMembers()}
                  disabled={isSavingProjectMembers}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    'bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {isSavingProjectMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSavingProjectMembers ? '프로젝트 멤버 저장 중...' : '선택 멤버 저장'}
                </button>
              </div>
            </div>
          )}

          {hasLoadedProjectMembers &&
            !isLoadingProjectMembers &&
            selectedProjectId &&
            projectCandidates.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                조회된 프로젝트 멤버가 없습니다. 프로젝트 이슈/멤버 권한 또는 토큰 상태를 함께 확인해 주세요.
              </p>
            )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between pr-1 sm:pr-2">
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
                          <SelectField
                            dense
                            value={editForm.groupId}
                            onChange={(e) => setEditForm((f) => ({ ...f, groupId: e.target.value }))}
                          >
                            <option value="">미배정</option>
                            {groups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </SelectField>
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
                    <SelectField
                      dense
                      value={newForm.groupId}
                      onChange={(e) => setNewForm((f) => ({ ...f, groupId: e.target.value }))}
                    >
                      <option value="">미배정</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </SelectField>
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

        {saveNotice ? (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              saveNotice.tone === 'error'
                ? 'border-red-500/25 bg-red-500/10 text-red-300'
                : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
            )}
          >
            {saveNotice.message}
          </div>
        ) : null}

        <div className="flex justify-end pr-1 sm:pr-2">
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
            {isSaving
              ? selectedProjectId
                ? '저장 및 선택 프로젝트 동기화 중...'
                : '매핑 저장 중...'
              : selectedProjectId
                ? '저장 + 선택 프로젝트 동기화'
                : '매핑 저장'}
          </button>
        </div>
      </section>
    </>
  );
}

export function MemberMappingForm() {
  return (
    <div className="space-y-6">
      <WorkspaceAccessForm />
    </div>
  );
}
