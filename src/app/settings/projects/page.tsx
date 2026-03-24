import { ProjectManagementForm } from '@/components/settings';

/**
 * 프로젝트 관리 전용 페이지.
 * 설정 탭의 프로젝트 관리 폼을 단독으로 렌더링합니다.
 */
export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">프로젝트 관리</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Jira 및 GitLab 프로젝트 연동을 관리합니다.</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <ProjectManagementForm />
      </div>
    </div>
  );
}
