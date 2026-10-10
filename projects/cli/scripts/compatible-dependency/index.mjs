const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const COMPATIBLE_STABLE_RANGE_PATTERN = /^\^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

/** Verifies a stable caret minimum before consumer dependencies are available to import. */
export const isCompatiblePackageDependency = (installedVersion, declaredRange) => {
  const installedMatch =
    typeof installedVersion === 'string' ? STABLE_VERSION_PATTERN.exec(installedVersion) : null;
  const rangeMatch =
    typeof declaredRange === 'string' ? COMPATIBLE_STABLE_RANGE_PATTERN.exec(declaredRange) : null;

  if (installedMatch === null || rangeMatch === null || installedMatch[1] !== rangeMatch[1]) {
    return false;
  }

  const installed = installedMatch.slice(1).map(Number);
  const minimum = rangeMatch.slice(1).map(Number);
  if (!installed.every(Number.isSafeInteger) || !minimum.every(Number.isSafeInteger)) return false;
  if (minimum[0] === 0 && installed[1] !== minimum[1]) return false;
  if (minimum[0] === 0 && minimum[1] === 0 && installed[2] !== minimum[2]) return false;
  return installed[1] > minimum[1] || (installed[1] === minimum[1] && installed[2] >= minimum[2]);
};
