/** 시트 컬럼 정의 */
export interface SheetColumn {
  /** 데이터 객체의 키 */
  key: string;
  /** 한국어 헤더 이름 */
  header: string;
  /** 컬럼 너비 (문자 수 기준) */
  width: number;
}

/** 팀 전체 요약 시트 컬럼 정의 */
export const TEAM_SUMMARY_COLUMNS: SheetColumn[] = [
  { key: 'name', header: '개발자', width: 16 },
  { key: 'group', header: '소속 그룹', width: 14 },
  { key: 'period', header: '평가 기간', width: 12 },
  { key: 'jiraTotal', header: 'Jira 점수', width: 10 },
  { key: 'gitlabTotal', header: 'GitLab 점수', width: 12 },
  { key: 'composite', header: '종합 점수', width: 10 },
  { key: 'grade', header: '등급', width: 6 },
  { key: 'ticketCompletionRate', header: '티켓 완료율', width: 12 },
  { key: 'scheduleAdherence', header: '일정 준수율', width: 12 },
  { key: 'effortAccuracy', header: '공수 정확도', width: 12 },
  { key: 'worklogDiligence', header: '작업일지 성실도', width: 16 },
  { key: 'mrProductivity', header: 'MR 생산성', width: 12 },
  { key: 'reviewParticipation', header: '코드 리뷰 참여도', width: 16 },
  { key: 'feedbackResolution', header: '피드백 반영률', width: 14 },
  { key: 'mrLeadTime', header: 'MR 리드 타임', width: 14 },
  { key: 'ciPassRate', header: 'CI 통과율', width: 10 },
];

/** 개발자 상세 시트 컬럼 정의 */
export const DEVELOPER_DETAIL_COLUMNS: SheetColumn[] = [
  { key: 'category', header: '항목', width: 18 },
  { key: 'score', header: '점수', width: 10 },
  { key: 'maxScore', header: '만점', width: 8 },
  { key: 'percentage', header: '달성률 (%)', width: 12 },
  { key: 'description', header: '비고', width: 30 },
];

/** Jira 이슈 목록 시트 컬럼 정의 */
export const JIRA_ISSUE_COLUMNS: SheetColumn[] = [
  { key: 'issueKey', header: '이슈 키', width: 14 },
  { key: 'summary', header: '제목', width: 40 },
  { key: 'status', header: '상태', width: 12 },
  { key: 'issueType', header: '유형', width: 10 },
  { key: 'assigneeId', header: '담당자', width: 14 },
  { key: 'priority', header: '우선순위', width: 10 },
  { key: 'storyPoints', header: 'SP', width: 6 },
  { key: 'ganttStartDate', header: 'WBS 시작일', width: 14 },
  { key: 'ganttEndDate', header: 'WBS 완료일', width: 14 },
  { key: 'baselineStart', header: '기준선 시작', width: 14 },
  { key: 'baselineEnd', header: '기준선 완료', width: 14 },
  { key: 'ganttProgress', header: '진행률 (%)', width: 12 },
  { key: 'plannedEffort', header: '계획 공수', width: 10 },
  { key: 'actualEffort', header: '투입 공수', width: 10 },
  { key: 'remainingEffort', header: '남은 공수', width: 10 },
  { key: 'dueDate', header: '마감일', width: 12 },
];

/** GitLab MR 목록 시트 컬럼 정의 */
export const GITLAB_MR_COLUMNS: SheetColumn[] = [
  { key: 'iid', header: 'MR #', width: 8 },
  { key: 'title', header: '제목', width: 40 },
  { key: 'state', header: '상태', width: 10 },
  { key: 'authorName', header: '작성자', width: 14 },
  { key: 'sourceBranch', header: '소스 브랜치', width: 24 },
  { key: 'targetBranch', header: '타겟 브랜치', width: 16 },
  { key: 'createdAt', header: '생성일', width: 14 },
  { key: 'mergedAt', header: '병합일', width: 14 },
  { key: 'notesCount', header: '댓글 수', width: 8 },
  { key: 'changesCount', header: '변경 파일', width: 10 },
  { key: 'additions', header: '추가 줄', width: 8 },
  { key: 'deletions', header: '삭제 줄', width: 8 },
  { key: 'labels', header: '라벨', width: 20 },
  { key: 'isDraft', header: '드래프트', width: 10 },
  { key: 'webUrl', header: 'URL', width: 36 },
];
