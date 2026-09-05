const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const COMPATIBLE_MAJOR_RANGE_PATTERN = /^\^(0|[1-9]\d*)\.0\.0$/u;

/** Verifies one canonical compatible-major declaration against its installed stable release. */
export const isCompatiblePackageDependency = (installedVersion, declaredRange) => {
  const installedMatch =
    typeof installedVersion === 'string' ? STABLE_VERSION_PATTERN.exec(installedVersion) : null;
  const rangeMatch =
    typeof declaredRange === 'string' ? COMPATIBLE_MAJOR_RANGE_PATTERN.exec(declaredRange) : null;

  if (installedMatch === null || rangeMatch === null || installedMatch[1] !== rangeMatch[1]) {
    return false;
  }

  return rangeMatch[1] !== '0' || (installedMatch[2] === '0' && installedMatch[3] === '0');
};
