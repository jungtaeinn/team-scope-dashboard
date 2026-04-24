const MIN_MAJOR = 22;
const MIN_MINOR = 6;

function parseNodeVersion(version) {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return {
    major: Number.parseInt(major, 10) || 0,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
}

function isSupportedNodeVersion(version) {
  if (version.major > MIN_MAJOR) return true;
  if (version.major < MIN_MAJOR) return false;
  return version.minor >= MIN_MINOR;
}

const currentVersion = parseNodeVersion(process.versions.node);

if (!isSupportedNodeVersion(currentVersion)) {
  console.error(
    `[TeamScope] Node.js ${MIN_MAJOR}.${MIN_MINOR}+ 가 필요합니다. 현재 버전: ${process.versions.node}`,
  );
  console.error('[TeamScope] 이 프로젝트는 TypeScript 스크립트를 위해 --experimental-strip-types 플래그를 사용합니다.');
  process.exit(1);
}
