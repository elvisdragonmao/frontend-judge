const PLAYWRIGHT_TEST_IMPORT_RE =
  /^import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]@playwright\/test['"];?\s*$/gm;

const PLAYWRIGHT_IMPORT_PRIORITY = new Map([
  ["test", 0],
  ["expect", 1],
]);

function sortPlaywrightImports(a: string, b: string) {
  return (
    (PLAYWRIGHT_IMPORT_PRIORITY.get(a) ?? Number.MAX_SAFE_INTEGER) -
      (PLAYWRIGHT_IMPORT_PRIORITY.get(b) ?? Number.MAX_SAFE_INTEGER) ||
    a.localeCompare(b)
  );
}

export function normalizePlaywrightTestContent(content: string) {
  const imports = new Set<string>();
  const body = content.replace(
    PLAYWRIGHT_TEST_IMPORT_RE,
    (_, names: string) => {
      for (const name of names.split(",")) {
        const normalizedName = name.trim();
        if (normalizedName) {
          imports.add(normalizedName);
        }
      }
      return "";
    },
  );

  if (imports.size === 0) {
    return content;
  }

  const importLine = `import { ${Array.from(imports).sort(sortPlaywrightImports).join(", ")} } from '@playwright/test';`;
  const trimmedBody = body.trim();

  return trimmedBody ? `${importLine}\n\n${trimmedBody}\n` : `${importLine}\n`;
}
