import type {
  GitlabMRResponse,
  GitlabNoteResponse,
  ParsedMergeRequest,
  ParsedNote,
  MRMetrics,
  FetchDeveloperMRsOptions,
} from './_types';
import type { GitlabClient } from './client';

/**
 * GitLab MR 원시 응답을 정규화된 내부 형식으로 변환합니다.
 *
 * API 응답의 snake_case 필드를 camelCase로 변환하고,
 * 불필요한 필드를 제거하여 앱 내부에서 사용하기 쉬운 형태로 만듭니다.
 *
 * @param raw - GitLab MR API 원시 응답
 * @returns 정규화된 Merge Request 데이터
 * @example
 * ```typescript
 * const raw = await client.getMergeRequests({ state: 'merged' });
 * const parsed = raw.map(parseMergeRequest);
 * console.log(parsed[0].authorUsername); // 'john.doe'
 * ```
 */
export function parseMergeRequest(raw: GitlabMRResponse): ParsedMergeRequest {
  return {
    iid: raw.iid,
    title: raw.title,
    state: raw.state,
    authorUsername: raw.author.username,
    authorName: raw.author.name,
    sourceBranch: raw.source_branch,
    targetBranch: raw.target_branch,
    createdAt: raw.created_at,
    mergedAt: raw.merged_at,
    notesCount: raw.user_notes_count,
    changesCount: raw.changes_count ? parseInt(raw.changes_count, 10) : 0,
    additions: raw.additions ?? 0,
    deletions: raw.deletions ?? 0,
    labels: raw.labels,
    isDraft: raw.draft || raw.work_in_progress,
    webUrl: raw.web_url,
  };
}

/**
 * GitLab Note 원시 응답을 정규화된 내부 형식으로 변환합니다.
 *
 * system=false인 노트만 실제 리뷰 코멘트로 표시합니다.
 *
 * @param raw - GitLab Note API 원시 응답
 * @returns 정규화된 Note 데이터
 * @example
 * ```typescript
 * const rawNotes = await client.getMRNotes(42);
 * const parsed = rawNotes.map(parseNote);
 * const reviewComments = parsed.filter((n) => n.isReviewComment);
 * ```
 */
export function parseNote(raw: GitlabNoteResponse): ParsedNote {
  return {
    id: raw.id,
    body: raw.body,
    authorUsername: raw.author.username,
    authorName: raw.author.name,
    isReviewComment: !raw.system,
    isResolvable: raw.resolvable,
    isResolved: raw.resolved ?? false,
    createdAt: raw.created_at,
  };
}

/**
 * 특정 개발자의 Merge Request 목록을 조회합니다.
 *
 * 기간(period) 옵션을 지정하면 해당 날짜 이후에 생성된 MR만 가져옵니다.
 * 자동 페이지네이션으로 모든 결과를 반환합니다.
 *
 * @param client - GitLab API 클라이언트
 * @param username - 개발자 GitLab 사용자명
 * @param options - 조회 옵션 (기간, 상태 필터)
 * @returns 정규화된 Merge Request 배열
 * @example
 * ```typescript
 * const mrs = await fetchDeveloperMRs(client, 'john.doe', {
 *   period: '2026-01-01',
 *   state: 'merged',
 * });
 * ```
 */
export async function fetchDeveloperMRs(
  client: GitlabClient,
  username: string,
  options: FetchDeveloperMRsOptions = {},
): Promise<ParsedMergeRequest[]> {
  const { period, state = 'all' } = options;

  const queryParams = new URLSearchParams({
    author_username: username,
    state,
    per_page: '100',
  });

  if (period) {
    queryParams.set('created_after', new Date(period).toISOString());
  }

  const rawMRs = await client.fetchAllPages<GitlabMRResponse>(`/merge_requests?${queryParams.toString()}`);
  return rawMRs.map(parseMergeRequest);
}

/**
 * 특정 Merge Request과 해당 노트(댓글)를 함께 조회합니다.
 *
 * MR 변경 사항과 노트를 병렬로 가져와 성능을 최적화합니다.
 *
 * @param client - GitLab API 클라이언트
 * @param mrIid - Merge Request 내부 ID
 * @returns MR 데이터와 정규화된 노트 배열
 * @example
 * ```typescript
 * const { mr, notes } = await fetchMRWithNotes(client, 42);
 * console.log(mr.title, notes.length);
 * ```
 */
export async function fetchMRWithNotes(
  client: GitlabClient,
  mrIid: number,
): Promise<{ mr: ParsedMergeRequest; notes: ParsedNote[] }> {
  const [mrRaw, notesRaw] = await Promise.all([client.getMRChanges(mrIid), client.getMRNotes(mrIid)]);

  return {
    mr: parseMergeRequest(mrRaw),
    notes: notesRaw.map(parseNote),
  };
}

/**
 * 특정 Merge Request의 메트릭을 계산합니다.
 *
 * 리드 타임(생성~병합), 전체 노트 수, 리뷰 코멘트 수, 해결된 스레드 수를 산출합니다.
 *
 * @param client - GitLab API 클라이언트
 * @param mrIid - Merge Request 내부 ID
 * @returns MR 메트릭 데이터
 * @example
 * ```typescript
 * const metrics = await fetchMRMetrics(client, 42);
 * console.log(`리드 타임: ${metrics.leadTime}초, 리뷰 코멘트: ${metrics.reviewNotesCount}개`);
 * ```
 */
export async function fetchMRMetrics(client: GitlabClient, mrIid: number): Promise<MRMetrics> {
  const { mr, notes } = await fetchMRWithNotes(client, mrIid);

  const reviewNotes = notes.filter((note) => note.isReviewComment);
  const resolvedNotes = notes.filter((note) => note.isResolvable && note.isResolved);

  let leadTime: number | null = null;
  if (mr.mergedAt) {
    const createdMs = new Date(mr.createdAt).getTime();
    const mergedMs = new Date(mr.mergedAt).getTime();
    leadTime = Math.round((mergedMs - createdMs) / 1000);
  }

  return {
    leadTime,
    notesCount: notes.length,
    reviewNotesCount: reviewNotes.length,
    resolvedCount: resolvedNotes.length,
  };
}

/**
 * 특정 개발자가 다른 사람의 MR에 남긴 리뷰 활동을 조회합니다.
 *
 * 해당 개발자가 작성자가 아닌 MR 중에서 리뷰 코멘트를 남긴 MR 목록을 반환합니다.
 * 최근 100개의 병합된 MR을 대상으로 조회합니다.
 *
 * @param client - GitLab API 클라이언트
 * @param username - 리뷰어 GitLab 사용자명
 * @returns MR과 해당 사용자의 리뷰 코멘트가 포함된 배열
 * @example
 * ```typescript
 * const reviews = await fetchDeveloperReviewActivity(client, 'john.doe');
 * reviews.forEach(({ mr, reviewNotes }) => {
 *   console.log(`${mr.title}: ${reviewNotes.length}개 리뷰 코멘트`);
 * });
 * ```
 */
export async function fetchDeveloperReviewActivity(
  client: GitlabClient,
  username: string,
): Promise<{ mr: ParsedMergeRequest; reviewNotes: ParsedNote[] }[]> {
  const allMRs = await client.fetchAllPages<GitlabMRResponse>('/merge_requests?state=merged&per_page=100');

  const othersMRs = allMRs.filter((mr) => mr.author.username !== username);

  const results: { mr: ParsedMergeRequest; reviewNotes: ParsedNote[] }[] = [];

  const batchSize = 5;
  for (let i = 0; i < othersMRs.length; i += batchSize) {
    const batch = othersMRs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (rawMR) => {
        const rawNotes = await client.getMRNotes(rawMR.iid);
        const userReviewNotes = rawNotes.filter((note) => !note.system && note.author.username === username).map(parseNote);

        if (userReviewNotes.length > 0) {
          return { mr: parseMergeRequest(rawMR), reviewNotes: userReviewNotes };
        }
        return null;
      }),
    );

    for (const result of batchResults) {
      if (result) results.push(result);
    }
  }

  return results;
}
