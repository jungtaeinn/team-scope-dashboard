import './load-env.mjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_WORKSPACE_ID } from '@/lib/app-info';

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/team_scope?schema=public';
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const DONE_STATUSES = ['done', 'closed', 'resolved', '완료', 'complete', '닫힘', '해결됨', '해결', '종료'];
const PERIOD = new Date().toISOString().slice(0, 7); // "2026-03"

async function main() {
  console.log('========================================');
  console.log(` 점수 산출 — 기간: ${PERIOD}`);
  console.log('========================================\n');

  const developers = await prisma.developer.findMany({
    where: { workspaceId: DEFAULT_WORKSPACE_ID, isActive: true },
  });

  for (const dev of developers) {
    console.log(`\n--- ${dev.name} ---`);

    // === Jira 점수 ===
    const jiraIssues = await prisma.jiraIssue.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID, assigneeId: dev.id },
    });

    const totalIssues = jiraIssues.length;
    const completedIssues = jiraIssues.filter((i) =>
      DONE_STATUSES.includes(i.status.toLowerCase()),
    );

    // 1) 티켓 완료율 (25점)
    const completionRatio = totalIssues > 0 ? completedIssues.length / totalIssues : 0;
    const ticketCompletionRate = Math.round(completionRatio * 25 * 100) / 100;

    // 2) 일정 준수율 (25점) — baselineEnd vs ganttEndDate
    let scheduleAdherence = 0;
    const issuesWithBaseline = completedIssues.filter((i) => i.baselineEnd && i.ganttEndDate);
    if (issuesWithBaseline.length > 0) {
      let onTimeCount = 0;
      for (const issue of issuesWithBaseline) {
        if (!issue.baselineEnd || !issue.ganttEndDate) continue;
        const baseline = new Date(issue.baselineEnd).getTime();
        const actual = new Date(issue.ganttEndDate).getTime();
        const diffDays = (actual - baseline) / (1000 * 60 * 60 * 24);
        if (diffDays <= 0) onTimeCount += 1.0;
        else if (diffDays <= 3) onTimeCount += 0.75;
        else if (diffDays <= 7) onTimeCount += 0.5;
        else onTimeCount += 0.1;
      }
      scheduleAdherence = Math.round((onTimeCount / issuesWithBaseline.length) * 25 * 100) / 100;
    } else {
      scheduleAdherence = totalIssues > 0 ? 12.5 : 0;
    }

    // 3) 공수 정확도 (25점) — plannedEffort vs actualEffort
    let effortAccuracy = 0;
    const issuesWithEffort = jiraIssues.filter((i) => i.plannedEffort != null && i.actualEffort != null && i.plannedEffort > 0);
    if (issuesWithEffort.length > 0) {
      let accuracySum = 0;
      for (const issue of issuesWithEffort) {
        if (issue.plannedEffort == null || issue.actualEffort == null || issue.plannedEffort <= 0) continue;
        const planned = issue.plannedEffort;
        const actual = issue.actualEffort;
        const deviation = Math.abs(actual - planned) / planned;
        if (deviation <= 0.1) accuracySum += 1.0;
        else if (deviation <= 0.3) accuracySum += 0.75;
        else if (deviation <= 0.5) accuracySum += 0.5;
        else accuracySum += 0.2;
      }
      effortAccuracy = Math.round((accuracySum / issuesWithEffort.length) * 25 * 100) / 100;
    } else {
      effortAccuracy = totalIssues > 0 ? 12.5 : 0;
    }

    // 4) 작업일지 성실도 (25점) — timeSpent 기록 여부
    const issuesWithTimeSpent = jiraIssues.filter((i) => i.timeSpent != null && i.timeSpent > 0);
    const worklogRatio = totalIssues > 0 ? issuesWithTimeSpent.length / totalIssues : 0;
    const worklogDiligence = Math.round(worklogRatio * 25 * 100) / 100;

    const jiraTotal = Math.round((ticketCompletionRate + scheduleAdherence + effortAccuracy + worklogDiligence) * 100) / 100;

    console.log(`  [Jira] 총 이슈: ${totalIssues}, 완료: ${completedIssues.length}`);
    console.log(`    티켓 완료율: ${ticketCompletionRate}/25`);
    console.log(`    일정 준수율: ${scheduleAdherence}/25`);
    console.log(`    공수 정확도: ${effortAccuracy}/25`);
    console.log(`    작업일지 성실도: ${worklogDiligence}/25`);
    console.log(`    Jira 합계: ${jiraTotal}/100`);

    // === GitLab 점수 ===
    const gitlabMRs = await prisma.gitlabMR.findMany({
      where: { workspaceId: DEFAULT_WORKSPACE_ID, authorId: dev.id },
    });

    const mergedMRs = gitlabMRs.filter((mr) => mr.state === 'merged');
    const totalMRs = gitlabMRs.length;

    // 1) MR 생산성 (20점)
    const mrProductivity = Math.min(20, Math.round((mergedMRs.length / Math.max(5, 1)) * 20 * 100) / 100);

    // 2) 코드 리뷰 참여도 (25점) — 다른 사람 MR에 남긴 코멘트
    const reviewNotes = await prisma.gitlabNote.findMany({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        authorId: dev.id,
        isSystem: false,
        mr: { authorId: { not: dev.id } },
      },
    });
    const reviewParticipation = Math.min(25, Math.round((reviewNotes.length / Math.max(10, 1)) * 25 * 100) / 100);

    // 3) 피드백 반영률 (20점) — 받은 코멘트 중 resolved 비율
    const receivedNotes = await prisma.gitlabNote.findMany({
      where: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        mr: { authorId: dev.id },
        authorId: { not: dev.id },
        isResolvable: true,
      },
    });
    const resolvedNotes = receivedNotes.filter((n) => n.isResolved);
    const feedbackResolution = receivedNotes.length > 0
      ? Math.round((resolvedNotes.length / receivedNotes.length) * 20 * 100) / 100
      : (totalMRs > 0 ? 15 : 0);

    // 4) MR 리드 타임 (20점)
    let mrLeadTime = 0;
    const mergedWithDates = mergedMRs.filter((mr) => mr.mrCreatedAt && mr.mrMergedAt);
    if (mergedWithDates.length > 0) {
      let leadTimeScore = 0;
      for (const mr of mergedWithDates) {
        if (!mr.mrCreatedAt || !mr.mrMergedAt) continue;
        const created = new Date(mr.mrCreatedAt).getTime();
        const merged = new Date(mr.mrMergedAt).getTime();
        const hours = (merged - created) / (1000 * 60 * 60);
        if (hours <= 24) leadTimeScore += 1.0;
        else if (hours <= 48) leadTimeScore += 0.75;
        else if (hours <= 72) leadTimeScore += 0.5;
        else leadTimeScore += 0.2;
      }
      mrLeadTime = Math.round((leadTimeScore / mergedWithDates.length) * 20 * 100) / 100;
    } else {
      mrLeadTime = totalMRs > 0 ? 10 : 0;
    }

    // 5) CI 통과율 (15점) — 데이터 없으면 기본값
    const ciPassRate = totalMRs > 0 ? 12 : 0;

    const gitlabTotal = Math.round((mrProductivity + reviewParticipation + feedbackResolution + mrLeadTime + ciPassRate) * 100) / 100;

    console.log(`  [GitLab] 총 MR: ${totalMRs}, 머지: ${mergedMRs.length}`);
    console.log(`    MR 생산성: ${mrProductivity}/20`);
    console.log(`    리뷰 참여도: ${reviewParticipation}/25`);
    console.log(`    피드백 반영률: ${feedbackResolution}/20`);
    console.log(`    MR 리드타임: ${mrLeadTime}/20`);
    console.log(`    CI 통과율: ${ciPassRate}/15`);
    console.log(`    GitLab 합계: ${gitlabTotal}/100`);

    // === 종합 점수 ===
    const composite = Math.round((jiraTotal * 0.5 + gitlabTotal * 0.5) * 100) / 100;
    let grade = 'F';
    if (composite >= 90) grade = 'A';
    else if (composite >= 80) grade = 'B';
    else if (composite >= 70) grade = 'C';
    else if (composite >= 60) grade = 'D';

    console.log(`  [종합] ${composite}점 — ${grade}등급`);

    // DB 저장
    await prisma.score.upsert({
      where: { workspaceId_developerId_period: { workspaceId: DEFAULT_WORKSPACE_ID, developerId: dev.id, period: PERIOD } },
      update: {
        jiraScore: jiraTotal,
        gitlabScore: gitlabTotal,
        compositeScore: composite,
        breakdown: JSON.stringify({
          jira: { ticketCompletionRate, scheduleAdherence, effortAccuracy, worklogDiligence, total: jiraTotal },
          gitlab: { mrProductivity, reviewParticipation, feedbackResolution, mrLeadTime, ciPassRate, total: gitlabTotal },
        }),
        calculatedAt: new Date(),
      },
      create: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        developerId: dev.id,
        period: PERIOD,
        jiraScore: jiraTotal,
        gitlabScore: gitlabTotal,
        compositeScore: composite,
        breakdown: JSON.stringify({
          jira: { ticketCompletionRate, scheduleAdherence, effortAccuracy, worklogDiligence, total: jiraTotal },
          gitlab: { mrProductivity, reviewParticipation, feedbackResolution, mrLeadTime, ciPassRate, total: gitlabTotal },
        }),
      },
    });
  }

  console.log('\n========================================');
  console.log(' 점수 산출 완료!');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('점수 산출 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
