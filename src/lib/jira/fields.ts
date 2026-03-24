/**
 * Jira WBSGantt 커스텀 필드 ID 매핑 상수입니다.
 * 실제 Jira 인스턴스의 커스텀 필드와 1:1 대응됩니다.
 */

/** 시작일 (WBSGantt) */
export const GANTT_START_DATE = 'customfield_10332';

/** 완료일 (WBSGantt) */
export const GANTT_END_DATE = 'customfield_10333';

/** 기준선 시작일 */
export const BASELINE_START = 'customfield_10334';

/** 기준선 완료일 */
export const BASELINE_END = 'customfield_10335';

/** 진행 상황 */
export const GANTT_PROGRESS = 'customfield_10336';

/** 유닛 % */
export const GANTT_UNIT = 'customfield_10338';

/** 계획 공수 */
export const PLANNED_EFFORT = 'customfield_11728';

/** 남은 계획 공수 */
export const REMAINING_EFFORT = 'customfield_11731';

/** 투입 공수 (MH) */
export const ACTUAL_EFFORT = 'customfield_11480';

/** Story Points */
export const STORY_POINTS = 'customfield_10106';

/** Jira Sprint */
export const SPRINT_FIELD = 'customfield_10104';

/** 커스텀 필드 ID와 한국어 라벨 매핑 */
const FIELD_LABELS: Record<string, string> = {
  [GANTT_START_DATE]: '시작일 (WBSGantt)',
  [GANTT_END_DATE]: '완료일 (WBSGantt)',
  [BASELINE_START]: '기준선 시작일',
  [BASELINE_END]: '기준선 완료일',
  [GANTT_PROGRESS]: '진행 상황',
  [GANTT_UNIT]: '유닛 %',
  [PLANNED_EFFORT]: '계획 공수',
  [REMAINING_EFFORT]: '남은 계획 공수',
  [ACTUAL_EFFORT]: '투입 공수 (MH)',
  [STORY_POINTS]: 'Story Points',
  [SPRINT_FIELD]: 'Sprint',
  summary: '제목',
  status: '상태',
  issuetype: '이슈 유형',
  assignee: '담당자',
  reporter: '보고자',
  priority: '우선순위',
  parent: '상위 이슈',
  sprint: '스프린트',
  created: '생성일',
  updated: '수정일',
  resolutiondate: '해결일',
};

/** Jira 표준 필드 목록 */
const STANDARD_FIELDS = [
  'summary',
  'status',
  'issuetype',
  'assignee',
  'reporter',
  'priority',
  'parent',
  'sprint',
  'created',
  'updated',
  'resolutiondate',
] as const;

/** WBSGantt 커스텀 필드 목록 */
const CUSTOM_FIELDS = [
  GANTT_START_DATE,
  GANTT_END_DATE,
  BASELINE_START,
  BASELINE_END,
  GANTT_PROGRESS,
  GANTT_UNIT,
  PLANNED_EFFORT,
  REMAINING_EFFORT,
  ACTUAL_EFFORT,
  STORY_POINTS,
  SPRINT_FIELD,
] as const;

/**
 * Jira 검색 시 요청할 전체 필드 목록입니다.
 * 표준 필드와 WBSGantt 커스텀 필드를 모두 포함합니다.
 * @example
 * ```typescript
 * const response = await client.searchIssues(jql, JIRA_FIELDS_TO_FETCH);
 * ```
 */
export const JIRA_FIELDS_TO_FETCH: string[] = [...STANDARD_FIELDS, ...CUSTOM_FIELDS];

/**
 * Jira 필드 ID에 해당하는 한국어 라벨을 반환합니다.
 * @param fieldId - Jira 필드 ID (표준 필드 또는 커스텀 필드 ID)
 * @returns 한국어 필드 라벨, 매핑이 없으면 fieldId를 그대로 반환
 * @example
 * ```typescript
 * getFieldLabel('customfield_10332') // '시작일 (WBSGantt)'
 * getFieldLabel('status')           // '상태'
 * getFieldLabel('unknown_field')    // 'unknown_field'
 * ```
 */
export function getFieldLabel(fieldId: string): string {
  return FIELD_LABELS[fieldId] ?? fieldId;
}
