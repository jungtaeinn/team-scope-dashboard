import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/** 레이아웃 저장 요청 바디 */
interface LayoutBody {
  /** 수정 시 기존 레이아웃 ID */
  id?: string;
  /** 레이아웃 이름 */
  name: string;
  /** 위젯 배치 JSON (WidgetConfig[]) */
  widgets: unknown[];
  /** 기본 레이아웃 여부 */
  isDefault?: boolean;
}

/**
 * GET /api/layouts
 * 저장된 대시보드 레이아웃 목록을 반환합니다.
 */
export async function GET() {
  try {
    const layouts = await prisma.dashboardLayout.findMany({
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = layouts.map((layout: any) => ({
      ...layout,
      widgets: safeParseJson(layout.widgets),
    }));

    return NextResponse.json({ success: true, data: parsed, error: null });
  } catch (error) {
    console.error('[Layouts] 조회 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '레이아웃 조회 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/layouts
 * 대시보드 레이아웃을 저장하거나 수정합니다.
 * isDefault=true인 경우 기존 기본 레이아웃의 isDefault를 false로 변경합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LayoutBody;

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: '레이아웃 이름은 필수입니다.' },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.widgets)) {
      return NextResponse.json(
        { success: false, data: null, error: '위젯 데이터는 배열이어야 합니다.' },
        { status: 400 },
      );
    }

    if (body.isDefault) {
      await prisma.dashboardLayout.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const widgetsJson = JSON.stringify(body.widgets);
    let layout;

    if (body.id) {
      layout = await prisma.dashboardLayout.update({
        where: { id: body.id },
        data: {
          name: body.name.trim(),
          widgets: widgetsJson,
          isDefault: body.isDefault ?? false,
        },
      });
    } else {
      layout = await prisma.dashboardLayout.create({
        data: {
          name: body.name.trim(),
          widgets: widgetsJson,
          isDefault: body.isDefault ?? false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { ...layout, widgets: safeParseJson(layout.widgets) },
      error: null,
    });
  } catch (error) {
    console.error('[Layouts] 저장 실패:', error);
    return NextResponse.json(
      { success: false, data: null, error: '레이아웃 저장 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

/** JSON 문자열을 안전하게 파싱합니다 */
function safeParseJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
