import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
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
  description: '프로젝트와 담당자 기준으로 Jira·GitLab 활동 기반 성과 지표를 시각화하는 대시보드',
  icons: {
    icon: [
      { url: '/icons/icon_16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon_16x16@2x.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon_32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon_32x32@2x.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/icon_64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/icon_64x64@2x.png', sizes: '128x128', type: 'image/png' },
      { url: '/icons/icon_128x128.png', sizes: '128x128', type: 'image/png' },
      { url: '/icons/icon_128x128@2x.png', sizes: '256x256', type: 'image/png' },
      { url: '/icons/icon_256x256.png', sizes: '256x256', type: 'image/png' },
      { url: '/icons/icon_256x256@2x.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon_512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon_512x512@2x.png', sizes: '1024x1024', type: 'image/png' },
    ],
    shortcut: [
      { url: '/icons/icon_16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon_32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon_128x128@2x.png', sizes: '256x256', type: 'image/png' },
      { url: '/icons/icon_256x256@2x.png', sizes: '512x512', type: 'image/png' },
    ],
  },
};

/**
 * 루트 레이아웃
 * @description 사이드바 + 메인 콘텐츠 영역 구조, 글로벌 프로바이더 적용
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
