export const APP_ROLES = ['owner', 'maintainer', 'developer', 'reporter', 'guest'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Owner',
  maintainer: 'Maintainer',
  developer: 'Developer',
  reporter: 'Reporter',
  guest: 'Guest',
};

export interface AppNavigationItem {
  href: string;
  label: string;
  icon: 'home' | 'users' | 'settings' | 'guide';
  roles: AppRole[];
}

export const APP_NAV_ITEMS: AppNavigationItem[] = [
  { href: '/', label: '대시보드', icon: 'home', roles: ['owner', 'maintainer', 'developer', 'reporter', 'guest'] },
  { href: '/developer', label: '개발자', icon: 'users', roles: ['owner', 'maintainer', 'developer'] },
  { href: '/settings', label: '설정', icon: 'settings', roles: ['owner', 'maintainer'] },
  { href: '/guide', label: '가이드', icon: 'guide', roles: ['owner', 'maintainer', 'developer', 'reporter', 'guest'] },
];

const KNOWN_ROLES = new Set<string>(APP_ROLES);

export function normalizeRole(value: string | null | undefined): AppRole {
  if (!value) return 'guest';
  const lower = value.toLowerCase();
  if (KNOWN_ROLES.has(lower)) return lower as AppRole;
  if (lower === 'admin') return 'maintainer';
  if (lower === 'member') return 'developer';
  return 'guest';
}

export function canAccessSettings(role: AppRole) {
  return role === 'owner' || role === 'maintainer';
}

export function canAccessDeveloper(role: AppRole) {
  return role === 'owner' || role === 'maintainer' || role === 'developer';
}

export function canManageData(role: AppRole) {
  return role === 'owner' || role === 'maintainer';
}

export function canExport(role: AppRole) {
  return role === 'owner' || role === 'maintainer' || role === 'reporter';
}

export function getVisibleNavItems(role: AppRole) {
  return APP_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
