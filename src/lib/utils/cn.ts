import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSS 클래스를 병합합니다.
 * clsx로 조건부 클래스를 처리하고, tailwind-merge로 충돌을 해결합니다.
 * @param inputs - 병합할 클래스 값 목록
 * @returns 병합된 클래스 문자열
 * @example
 * ```typescript
 * cn('px-4 py-2', isActive && 'bg-blue-500', 'px-6')
 * // => 'py-2 px-6 bg-blue-500' (px-4가 px-6으로 병합)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
