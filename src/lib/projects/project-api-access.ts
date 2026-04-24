import type { AppRole } from '../auth/roles';

export function getProjectReadRoles(includeToken: boolean): AppRole[] | undefined {
  return includeToken ? ['owner'] : undefined;
}
