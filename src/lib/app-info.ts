import packageJson from '../../package.json';

export const APP_NAME = 'TeamScope';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version;
export const DEFAULT_WORKSPACE_ID = 'default-workspace';
