'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MemberMappingForm, ProjectManagementForm, GroupManagementForm, ScoringWeightSlider } from '@/components/settings';
import { Users, FolderGit2, Layers, SlidersHorizontal } from 'lucide-react';

/** 탭 정의 */
const TABS = [
  { id: 'members', label: '멤버 매핑', icon: Users },
  { id: 'projects', label: '프로젝트 관리', icon: FolderGit2 },
  { id: 'groups', label: '그룹 관리', icon: Layers },
  { id: 'scoring', label: '스코어링 가중치', icon: SlidersHorizontal },
] as const;

type TabId = (typeof TABS)[number]['id'];

/** 탭 ID에 해당하는 컴포넌트 매핑 */
const TAB_COMPONENTS: Record<TabId, React.ComponentType> = {
  members: MemberMappingForm,
  projects: ProjectManagementForm,
  groups: GroupManagementForm,
  scoring: ScoringWeightSlider,
};

/**
 * 설정 메인 페이지.
 * 탭 기반으로 멤버 매핑, 프로젝트 관리, 그룹 관리, 스코어링 가중치 설정을 제공합니다.
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('members');

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설정</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          팀 스코프 대시보드의 데이터 소스, 멤버 매핑, 스코어링 설정을 관리합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="설정 탭">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <ActiveComponent />
      </div>
    </div>
  );
}
