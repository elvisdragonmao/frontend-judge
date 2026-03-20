const PATH_SEPARATOR = "/";

export const DEFAULT_UPLOAD_IGNORED_PATHS = [
  ".git/**",
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  "coverage/**",
] as const;

export const DEFAULT_REACT_ALLOWED_PATHS = ["**/*"] as const;

export const DEFAULT_BLOCKED_PATHS = [
  "package.json",
  "Dockerfile",
  "*.sh",
  "node_modules/**",
  "dist/**",
  ".env",
  ".env.*",
] as const;

export const DEFAULT_REACT_BLOCKED_PATHS = [
  "Dockerfile",
  "*.sh",
  "node_modules/**",
  "dist/**",
  ".env",
  ".env.*",
] as const;

export function normalizeSubmissionPath(input: string): string | null {
  const normalized = input.replaceAll("\\", PATH_SEPARATOR).trim();

  if (!normalized) {
    return null;
  }

  const segments = normalized
    .split(PATH_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return null;
  }

  if (segments.some((segment) => segment === "..")) {
    return null;
  }

  return segments.join(PATH_SEPARATOR);
}

export function matchesPathPattern(filePath: string, pattern: string): boolean {
  if (pattern === "**/*") {
    return true;
  }

  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);

    if (!prefix.includes(PATH_SEPARATOR)) {
      const segments = filePath.split(PATH_SEPARATOR);
      return segments.includes(prefix);
    }

    return filePath === prefix || filePath.startsWith(`${prefix}/`);
  }

  if (pattern.startsWith("*.")) {
    return filePath.endsWith(pattern.slice(1));
  }

  return filePath === pattern;
}

export function shouldIgnoreUploadPath(
  filePath: string,
  ignoredPaths: readonly string[] = DEFAULT_UPLOAD_IGNORED_PATHS,
): boolean {
  return ignoredPaths.some((pattern) => matchesPathPattern(filePath, pattern));
}

export function isSubmissionPathAllowed(
  filePath: string,
  allowedPaths: readonly string[] = ["**/*"],
  blockedPaths: readonly string[] = [],
): boolean {
  const isAllowed = allowedPaths.some((pattern) =>
    matchesPathPattern(filePath, pattern),
  );
  if (!isAllowed) {
    return false;
  }

  return !blockedPaths.some((pattern) => matchesPathPattern(filePath, pattern));
}
