import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Sidebar } from '@/components/_ui';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/** 앱 메타데이터 */
export const metadata: Metadata = {
  title: 'TeamScope - 개발자 성과 대시보드',
  description: '프론트엔드 개발팀의 Jira·GitLab 활동 기반 성과 지표를 시각화하는 대시보드',
};

/**
 * 루트 레이아웃
 * @description 사이드바 + 메인 콘텐츠 영역 구조, 글로벌 프로바이더 적용
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <Sidebar />
          <main className="min-h-screen pl-0 lg:pl-[var(--sidebar-width)]">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
