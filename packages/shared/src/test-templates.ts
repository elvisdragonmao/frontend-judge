/**
 * Built-in Playwright test templates for common assignment patterns.
 *
 * Each template is a function that accepts parameters and returns
 * a complete Playwright test file string. Teachers can pick one or
 * combine several, then tweak the generated code.
 */

export interface TestTemplate {
  /** Unique slug */
  id: string;
  /** Display name */
  name: string;
  /** Short description shown in the UI */
  description: string;
  /** Which assignment types this template applies to */
  applicableTo: Array<"html-css-js" | "react">;
  /** Category for grouping in the UI */
  category:
    | "html-elements"
    | "styling"
    | "functionality"
    | "page"
    | "screenshot"
    | "react";
  /** The template function — receives params, returns Playwright test code */
  generate: (params: Record<string, string>) => string;
  /** Parameter definitions for the UI form */
  params: Array<{
    key: string;
    label: string;
    placeholder: string;
    defaultValue: string;
    /** 'text' | 'textarea' | 'number' */
    type: "text" | "textarea" | "number";
  }>;
}

// ═══════════════════════════════════════════════════════════
// HTML Elements — check for required elements
// ═══════════════════════════════════════════════════════════

const htmlRequiredElements: TestTemplate = {
  id: "html-required-elements",
  name: "必要 HTML 元素檢查",
  description:
    "檢查頁面是否包含指定的 HTML 元素（如 nav, header, footer, main, h1 等）",
  applicableTo: ["html-css-js", "react"],
  category: "html-elements",
  params: [
    {
      key: "selectors",
      label: "要檢查的 CSS selectors（每行一個）",
      placeholder: "nav\nheader\nfooter\nmain\nh1",
      defaultValue: "nav\nheader\nmain\nfooter",
      type: "textarea",
    },
  ],
  generate: (params) => {
    const selectors = (params["selectors"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const tests = selectors
      .map(
        (sel) => `
test('頁面包含 <${sel}> 元素', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('${sel}').first()).toBeVisible();
});`,
      )
      .join("\n");

    return `import { test, expect } from '@playwright/test';
${tests}
`;
  },
};

const htmlElementCount: TestTemplate = {
  id: "html-element-count",
  name: "HTML 元素數量檢查",
  description:
    "檢查特定元素的數量是否符合預期（例如至少 3 個 li、至少 2 張圖片）",
  applicableTo: ["html-css-js", "react"],
  category: "html-elements",
  params: [
    {
      key: "rules",
      label: "規則（每行一條：selector,最少數量）",
      placeholder: "li,3\nimg,2\na,5",
      defaultValue: "li,3\nimg,1",
      type: "textarea",
    },
  ],
  generate: (params) => {
    const rules = (params["rules"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [selector, count] = line.split(",").map((s) => s.trim());
        return { selector: selector!, count: parseInt(count ?? "1", 10) };
      });

    const tests = rules
      .map(
        (r) => `
test('頁面至少有 ${r.count} 個 <${r.selector}> 元素', async ({ page }) => {
  await page.goto('/');
  const elements = page.locator('${r.selector}');
  await expect(elements).toHaveCount(${r.count}, { timeout: 5000 });
});`,
      )
      .join("\n");

    return `import { test, expect } from '@playwright/test';
${tests}
`;
  },
};

const htmlFormElements: TestTemplate = {
  id: "html-form-elements",
  name: "表單元素檢查",
  description: "檢查頁面是否有完整的表單結構（form, input, label, button）",
  applicableTo: ["html-css-js", "react"],
  category: "html-elements",
  params: [
    {
      key: "formSelector",
      label: "表單 selector",
      placeholder: "form",
      defaultValue: "form",
      type: "text",
    },
    {
      key: "inputNames",
      label: "必要 input name 屬性（每行一個）",
      placeholder: "name\nemail\npassword",
      defaultValue: "name\nemail",
      type: "textarea",
    },
    {
      key: "requireSubmitButton",
      label: "需要 submit 按鈕 (1=是, 0=否)",
      placeholder: "1",
      defaultValue: "1",
      type: "text",
    },
  ],
  generate: (params) => {
    const formSel = params["formSelector"] ?? "form";
    const inputNames = (params["inputNames"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const requireSubmit = params["requireSubmitButton"] !== "0";

    let tests = `
test('頁面包含表單', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('${formSel}').first()).toBeVisible();
});
`;

    for (const name of inputNames) {
      tests += `
test('表單包含 name="${name}" 的 input', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('${formSel} [name="${name}"]').first()).toBeAttached();
});
`;
    }

    tests += `
test('表單的 input 都有對應的 label', async ({ page }) => {
  await page.goto('/');
  const inputs = page.locator('${formSel} input:not([type="hidden"]):not([type="submit"])');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const id = await input.getAttribute('id');
    if (id) {
      await expect(page.locator(\`label[for="\${id}"]\`)).toBeAttached();
    }
  }
});
`;

    if (requireSubmit) {
      tests += `
test('表單包含送出按鈕', async ({ page }) => {
  await page.goto('/');
  const submit = page.locator('${formSel} button[type="submit"], ${formSel} input[type="submit"]');
  await expect(submit.first()).toBeAttached();
});
`;
    }

    return `import { test, expect } from '@playwright/test';\n${tests}`;
  },
};

// ═══════════════════════════════════════════════════════════
// Styling — CSS property checks
// ═══════════════════════════════════════════════════════════

const stylingPropertyCheck: TestTemplate = {
  id: "styling-property-check",
  name: "CSS 樣式屬性檢查",
  description:
    "檢查元素是否有指定的 CSS 屬性值（如 display: flex, color, font-size 等）",
  applicableTo: ["html-css-js", "react"],
  category: "styling",
  params: [
    {
      key: "rules",
      label: "規則（每行一條：selector | 屬性 | 預期值）",
      placeholder:
        "nav | display | flex\nh1 | font-size | 24px\nbody | margin | 0px",
      defaultValue: "nav | display | flex",
      type: "textarea",
    },
  ],
  generate: (params) => {
    const rules = (params["rules"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [selector, prop, value] = line.split("|").map((s) => s.trim());
        return { selector: selector!, prop: prop!, value: value! };
      });

    const tests = rules
      .map(
        (r) => `
test('${r.selector} 的 ${r.prop} 應為 ${r.value}', async ({ page }) => {
  await page.goto('/');
  const el = page.locator('${r.selector}').first();
  await expect(el).toBeVisible();
  const value = await el.evaluate((e, prop) => getComputedStyle(e).getPropertyValue(prop), '${r.prop}');
  expect(value).toBe('${r.value}');
});`,
      )
      .join("\n");

    return `import { test, expect } from '@playwright/test';
${tests}
`;
  },
};

const stylingResponsive: TestTemplate = {
  id: "styling-responsive",
  name: "RWD 響應式檢查",
  description: "在不同視窗寬度下檢查元素的可見性或樣式",
  applicableTo: ["html-css-js", "react"],
  category: "styling",
  params: [
    {
      key: "rules",
      label: "規則（每行一條：寬度 | selector | visible/hidden）",
      placeholder:
        "375 | .desktop-nav | hidden\n375 | .mobile-menu | visible\n1024 | .desktop-nav | visible",
      defaultValue:
        "375 | .mobile-menu | visible\n1024 | .desktop-nav | visible",
      type: "textarea",
    },
  ],
  generate: (params) => {
    const rules = (params["rules"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [width, selector, visibility] = line
          .split("|")
          .map((s) => s.trim());
        return {
          width: parseInt(width!, 10),
          selector: selector!,
          visible: visibility === "visible",
        };
      });

    const tests = rules
      .map(
        (r) => `
test('${r.width}px 寬度下 ${r.selector} 應${r.visible ? "可見" : "隱藏"}', async ({ page }) => {
  await page.setViewportSize({ width: ${r.width}, height: 800 });
  await page.goto('/');
  const el = page.locator('${r.selector}').first();
  await expect(el).${r.visible ? "toBeVisible" : "toBeHidden"}();
});`,
      )
      .join("\n");

    return `import { test, expect } from '@playwright/test';
${tests}
`;
  },
};

const stylingColorContrast: TestTemplate = {
  id: "styling-no-default",
  name: "禁止瀏覽器預設樣式",
  description:
    "檢查元素沒有使用瀏覽器預設的 margin/padding、有自訂字體或背景色等",
  applicableTo: ["html-css-js", "react"],
  category: "styling",
  params: [
    {
      key: "bodyNoMargin",
      label: "檢查 body 無預設 margin (1=是)",
      placeholder: "1",
      defaultValue: "1",
      type: "text",
    },
    {
      key: "customFont",
      label: "檢查是否使用自訂字體 (1=是)",
      placeholder: "1",
      defaultValue: "1",
      type: "text",
    },
    {
      key: "hasBackground",
      label: "檢查 body 有自訂背景色 (1=是)",
      placeholder: "0",
      defaultValue: "0",
      type: "text",
    },
  ],
  generate: (params) => {
    const checks: string[] = [];

    if (params["bodyNoMargin"] !== "0") {
      checks.push(`
test('body 不使用瀏覽器預設 margin', async ({ page }) => {
  await page.goto('/');
  const margin = await page.locator('body').evaluate(e => getComputedStyle(e).margin);
  expect(margin).toBe('0px');
});`);
    }

    if (params["customFont"] !== "0") {
      checks.push(`
test('頁面使用自訂字體', async ({ page }) => {
  await page.goto('/');
  const font = await page.locator('body').evaluate(e => getComputedStyle(e).fontFamily);
  // Should not be the raw browser default (typically "Times New Roman" or serif)
  expect(font.toLowerCase()).not.toContain('times');
});`);
    }

    if (params["hasBackground"] === "1") {
      checks.push(`
test('body 有自訂背景色', async ({ page }) => {
  await page.goto('/');
  const bg = await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor);
  // Default is rgba(0, 0, 0, 0) or transparent
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
});`);
    }

    return `import { test, expect } from '@playwright/test';\n${checks.join("\n")}
`;
  },
};

// ═══════════════════════════════════════════════════════════
// Functionality — JS interaction checks
// ═══════════════════════════════════════════════════════════

const funcClickEvent: TestTemplate = {
  id: "func-click-event",
  name: "按鈕點擊事件",
  description: "點擊按鈕後檢查頁面是否出現預期的變化（文字顯示、class 切換等）",
  applicableTo: ["html-css-js", "react"],
  category: "functionality",
  params: [
    {
      key: "buttonSelector",
      label: "按鈕 selector",
      placeholder: "#myButton",
      defaultValue: "#myButton",
      type: "text",
    },
    {
      key: "resultSelector",
      label: "結果顯示的 selector",
      placeholder: "#result",
      defaultValue: "#result",
      type: "text",
    },
    {
      key: "expectedText",
      label: "預期出現的文字",
      placeholder: "Hello!",
      defaultValue: "Hello!",
      type: "text",
    },
  ],
  generate: (params) => {
    return `import { test, expect } from '@playwright/test';

test('點擊按鈕後顯示預期文字', async ({ page }) => {
  await page.goto('/');
  await page.click('${params["buttonSelector"] ?? "#myButton"}');
  await expect(page.locator('${params["resultSelector"] ?? "#result"}')).toHaveText('${params["expectedText"] ?? "Hello!"}');
});
`;
  },
};

const funcFormSubmit: TestTemplate = {
  id: "func-form-submit",
  name: "表單送出驗證",
  description: "填寫表單欄位並送出，檢查送出後的結果或驗證訊息",
  applicableTo: ["html-css-js", "react"],
  category: "functionality",
  params: [
    {
      key: "fields",
      label: "欄位填寫（每行：selector | 值）",
      placeholder: "#name | 小明\n#email | test@example.com",
      defaultValue: "#name | 小明\n#email | test@example.com",
      type: "textarea",
    },
    {
      key: "submitSelector",
      label: "送出按鈕 selector",
      placeholder: 'button[type="submit"]',
      defaultValue: 'button[type="submit"]',
      type: "text",
    },
    {
      key: "successSelector",
      label: "成功訊息 selector",
      placeholder: ".success-message",
      defaultValue: ".success-message",
      type: "text",
    },
    {
      key: "successText",
      label: "成功訊息文字（留空表示只檢查可見性）",
      placeholder: "送出成功",
      defaultValue: "",
      type: "text",
    },
  ],
  generate: (params) => {
    const fields = (params["fields"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [selector, value] = line.split("|").map((s) => s.trim());
        return { selector: selector!, value: value! };
      });

    const fillSteps = fields
      .map((f) => `  await page.fill('${f.selector}', '${f.value}');`)
      .join("\n");

    const assertion = params["successText"]
      ? `  await expect(page.locator('${params["successSelector"]}')).toHaveText('${params["successText"]}');`
      : `  await expect(page.locator('${params["successSelector"]}')).toBeVisible();`;

    return `import { test, expect } from '@playwright/test';

test('填寫表單並送出', async ({ page }) => {
  await page.goto('/');
${fillSteps}
  await page.click('${params["submitSelector"] ?? 'button[type="submit"]'}');
${assertion}
});

test('空白送出應顯示驗證錯誤', async ({ page }) => {
  await page.goto('/');
  await page.click('${params["submitSelector"] ?? 'button[type="submit"]'}');
  // 原生 HTML5 驗證不會通過，表單不應被送出
  // 或者自訂驗證訊息應出現
  const url = page.url();
  // 頁面應該還在同一頁（沒有跳轉）
  expect(url).toContain('/');
});
`;
  },
};

const funcLocalStorage: TestTemplate = {
  id: "func-localstorage",
  name: "LocalStorage 資料保存",
  description: "檢查互動後是否有正確使用 localStorage 保存資料",
  applicableTo: ["html-css-js", "react"],
  category: "functionality",
  params: [
    {
      key: "action",
      label: "觸發動作（click selector）",
      placeholder: "#saveBtn",
      defaultValue: "#saveBtn",
      type: "text",
    },
    {
      key: "storageKey",
      label: "localStorage key",
      placeholder: "userData",
      defaultValue: "userData",
      type: "text",
    },
  ],
  generate: (params) => {
    return `import { test, expect } from '@playwright/test';

test('操作後 localStorage 有保存資料', async ({ page }) => {
  await page.goto('/');
  await page.click('${params["action"] ?? "#saveBtn"}');
  const value = await page.evaluate((key) => localStorage.getItem(key), '${params["storageKey"] ?? "userData"}');
  expect(value).not.toBeNull();
});

test('重新載入頁面後 localStorage 資料仍在', async ({ page }) => {
  await page.goto('/');
  await page.click('${params["action"] ?? "#saveBtn"}');
  await page.reload();
  const value = await page.evaluate((key) => localStorage.getItem(key), '${params["storageKey"] ?? "userData"}');
  expect(value).not.toBeNull();
});
`;
  },
};

// ═══════════════════════════════════════════════════════════
// Page — overall page quality checks
// ═══════════════════════════════════════════════════════════

const pageTitle: TestTemplate = {
  id: "page-title",
  name: "頁面標題檢查",
  description: "檢查 <title> 是否包含指定文字",
  applicableTo: ["html-css-js", "react"],
  category: "page",
  params: [
    {
      key: "title",
      label: "預期標題（支援正則）",
      placeholder: "My Website",
      defaultValue: "My Website",
      type: "text",
    },
  ],
  generate: (params) => {
    return `import { test, expect } from '@playwright/test';

test('頁面標題包含指定文字', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/${params["title"] ?? "My Website"}/);
});
`;
  },
};

const pageMeta: TestTemplate = {
  id: "page-meta",
  name: "頁面 meta 標籤檢查",
  description: "檢查 meta viewport、charset、description 等是否正確設定",
  applicableTo: ["html-css-js", "react"],
  category: "page",
  params: [
    {
      key: "requireViewport",
      label: "需要 viewport meta (1=是)",
      placeholder: "1",
      defaultValue: "1",
      type: "text",
    },
    {
      key: "requireCharset",
      label: "需要 charset meta (1=是)",
      placeholder: "1",
      defaultValue: "1",
      type: "text",
    },
    {
      key: "requireDescription",
      label: "需要 description meta (1=是)",
      placeholder: "0",
      defaultValue: "0",
      type: "text",
    },
  ],
  generate: (params) => {
    const tests: string[] = [];

    if (params["requireViewport"] !== "0") {
      tests.push(`
test('頁面有 viewport meta 標籤', async ({ page }) => {
  await page.goto('/');
  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).toBeAttached();
  const content = await viewport.getAttribute('content');
  expect(content).toContain('width=device-width');
});`);
    }

    if (params["requireCharset"] !== "0") {
      tests.push(`
test('頁面有 charset 宣告', async ({ page }) => {
  await page.goto('/');
  const charset = page.locator('meta[charset]');
  await expect(charset).toBeAttached();
});`);
    }

    if (params["requireDescription"] === "1") {
      tests.push(`
test('頁面有 description meta 標籤', async ({ page }) => {
  await page.goto('/');
  const desc = page.locator('meta[name="description"]');
  await expect(desc).toBeAttached();
  const content = await desc.getAttribute('content');
  expect(content!.length).toBeGreaterThan(0);
});`);
    }

    return `import { test, expect } from '@playwright/test';\n${tests.join("\n")}
`;
  },
};

const pageMultiPage: TestTemplate = {
  id: "page-multi-page",
  name: "多頁面導航檢查",
  description: "檢查網站是否有多個頁面，連結是否可正常導航",
  applicableTo: ["html-css-js", "react"],
  category: "page",
  params: [
    {
      key: "links",
      label: "要檢查的頁面路徑（每行一條：路徑 | 預期標題或元素 selector）",
      placeholder: "/ | h1\n/about | h1\n/contact | form",
      defaultValue: "/ | h1\n/about | h1",
      type: "textarea",
    },
  ],
  generate: (params) => {
    const links = (params["links"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [path, selector] = line.split("|").map((s) => s.trim());
        return { path: path!, selector: selector! };
      });

    const tests = links
      .map(
        (l) => `
test('${l.path} 頁面可正常載入', async ({ page }) => {
  await page.goto('${l.path}');
  await expect(page.locator('${l.selector}').first()).toBeVisible();
});`,
      )
      .join("\n");

    return `import { test, expect } from '@playwright/test';
${tests}

test('頁面間的連結可正常導航', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('a[href]');
  const count = await links.count();
  expect(count).toBeGreaterThan(0);
});
`;
  },
};

const pageNoConsoleErrors: TestTemplate = {
  id: "page-no-console-errors",
  name: "無 Console 錯誤",
  description: "確認頁面載入後沒有 JavaScript console error",
  applicableTo: ["html-css-js", "react"],
  category: "page",
  params: [],
  generate: () => {
    return `import { test, expect } from '@playwright/test';

test('頁面載入無 console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  expect(errors).toEqual([]);
});
`;
  },
};

const pageAccessibility: TestTemplate = {
  id: "page-accessibility",
  name: "基礎無障礙檢查",
  description: "檢查圖片是否有 alt、語意化標籤、heading 順序等基礎無障礙項目",
  applicableTo: ["html-css-js", "react"],
  category: "page",
  params: [],
  generate: () => {
    return `import { test, expect } from '@playwright/test';

test('所有圖片都有 alt 屬性', async ({ page }) => {
  await page.goto('/');
  const images = page.locator('img');
  const count = await images.count();
  for (let i = 0; i < count; i++) {
    const alt = await images.nth(i).getAttribute('alt');
    expect(alt, \`第 \${i + 1} 張圖片缺少 alt 屬性\`).not.toBeNull();
  }
});

test('頁面使用語意化 HTML 標籤', async ({ page }) => {
  await page.goto('/');
  // 至少使用一種語意化標籤
  const semantic = page.locator('header, nav, main, article, section, aside, footer');
  const count = await semantic.count();
  expect(count, '頁面應使用至少一個語意化標籤').toBeGreaterThan(0);
});

test('heading 層級正確（從 h1 開始）', async ({ page }) => {
  await page.goto('/');
  const h1 = page.locator('h1');
  await expect(h1.first()).toBeAttached();
});

test('互動元素可用鍵盤 focus', async ({ page }) => {
  await page.goto('/');
  const buttons = page.locator('button, a[href], input, select, textarea');
  const count = await buttons.count();
  if (count > 0) {
    await buttons.first().focus();
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  }
});
`;
  },
};

// ═══════════════════════════════════════════════════════════
// Screenshot — always useful as final step
// ═══════════════════════════════════════════════════════════

const screenshotCapture: TestTemplate = {
  id: "screenshot-capture",
  name: "截圖擷取",
  description: "載入頁面後擷取全頁截圖（會顯示在 submission grid 中）",
  applicableTo: ["html-css-js", "react"],
  category: "screenshot",
  params: [
    {
      key: "pages",
      label: "要截圖的路徑（每行一條）",
      placeholder: "/\n/about",
      defaultValue: "/",
      type: "textarea",
    },
  ],
  generate: (params) => {
    const pages = (params["pages"] ?? "/")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const tests = pages
      .map(
        (p, i) => `
test('截圖 ${p}', async ({ page }) => {
  await page.goto('${p}');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/screenshot${i > 0 ? `-${i}` : ""}.png', fullPage: true });
});`,
      )
      .join("\n");

    return `import { test } from '@playwright/test';
${tests}
`;
  },
};

// ═══════════════════════════════════════════════════════════
// React — component-specific checks
// ═══════════════════════════════════════════════════════════

const reactComponentRender: TestTemplate = {
  id: "react-component-render",
  name: "React 元件渲染檢查",
  description: "檢查 React 元件是否正確渲染、props 資料是否顯示",
  applicableTo: ["react"],
  category: "react",
  params: [
    {
      key: "selectors",
      label: "要檢查的元素 selector（每行一個：selector | 預期文字）",
      placeholder:
        '[data-testid="app-title"] | My App\n[data-testid="user-list"] |',
      defaultValue: '[data-testid="app-title"] | My App',
      type: "textarea",
    },
  ],
  generate: (params) => {
    const rules = (params["selectors"] ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((line) => {
        const [selector, text] = line.split("|").map((s) => s.trim());
        return { selector: selector!, text: text ?? "" };
      });

    const tests = rules
      .map((r) => {
        if (r.text) {
          return `
test('${r.selector} 顯示正確文字', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('${r.selector}')).toHaveText('${r.text}');
});`;
        }
        return `
test('${r.selector} 正確渲染', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('${r.selector}').first()).toBeVisible();
});`;
      })
      .join("\n");

    return `import { test, expect } from '@playwright/test';
${tests}
`;
  },
};

const reactStateInteraction: TestTemplate = {
  id: "react-state-interaction",
  name: "React 狀態互動檢查",
  description: "檢查 React 元件的狀態管理：計數器、toggle、列表新增刪除等",
  applicableTo: ["react"],
  category: "react",
  params: [
    {
      key: "scenario",
      label: "情境 (counter / toggle / list)",
      placeholder: "counter",
      defaultValue: "counter",
      type: "text",
    },
  ],
  generate: (params) => {
    const scenario = params["scenario"] ?? "counter";

    if (scenario === "toggle") {
      return `import { test, expect } from '@playwright/test';

test('toggle 按鈕可切換狀態', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('[data-testid="toggle"], button:has-text("Toggle"), .toggle-btn').first();
  const target = page.locator('[data-testid="toggle-target"], .toggle-target').first();

  await toggle.click();
  await expect(target).toBeVisible();

  await toggle.click();
  await expect(target).toBeHidden();
});
`;
    }

    if (scenario === "list") {
      return `import { test, expect } from '@playwright/test';

test('可新增項目到列表', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('[data-testid="list-input"], input[type="text"]').first();
  const addBtn = page.locator('[data-testid="add-btn"], button:has-text("Add"), button:has-text("新增")').first();
  const list = page.locator('[data-testid="list"], ul, ol').first();

  const beforeCount = await list.locator('li').count();
  await input.fill('Test item');
  await addBtn.click();
  const afterCount = await list.locator('li').count();
  expect(afterCount).toBe(beforeCount + 1);
});

test('可刪除列表中的項目', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('[data-testid="list-input"], input[type="text"]').first();
  const addBtn = page.locator('[data-testid="add-btn"], button:has-text("Add"), button:has-text("新增")').first();

  await input.fill('To delete');
  await addBtn.click();

  const deleteBtn = page.locator('[data-testid="delete-btn"], button:has-text("Delete"), button:has-text("刪除")').first();
  const list = page.locator('[data-testid="list"], ul, ol').first();
  const beforeCount = await list.locator('li').count();
  await deleteBtn.click();
  const afterCount = await list.locator('li').count();
  expect(afterCount).toBe(beforeCount - 1);
});
`;
    }

    // Default: counter
    return `import { test, expect } from '@playwright/test';

test('計數器初始值為 0', async ({ page }) => {
  await page.goto('/');
  const counter = page.locator('[data-testid="count"], .count, #count').first();
  await expect(counter).toHaveText('0');
});

test('點擊加號後計數增加', async ({ page }) => {
  await page.goto('/');
  const increment = page.locator('[data-testid="increment"], button:has-text("+"), button:has-text("Increment")').first();
  const counter = page.locator('[data-testid="count"], .count, #count').first();

  await increment.click();
  await expect(counter).toHaveText('1');

  await increment.click();
  await expect(counter).toHaveText('2');
});

test('點擊減號後計數減少', async ({ page }) => {
  await page.goto('/');
  const increment = page.locator('[data-testid="increment"], button:has-text("+")').first();
  const decrement = page.locator('[data-testid="decrement"], button:has-text("-"), button:has-text("Decrement")').first();
  const counter = page.locator('[data-testid="count"], .count, #count').first();

  await increment.click();
  await increment.click();
  await decrement.click();
  await expect(counter).toHaveText('1');
});
`;
  },
};

// ═══════════════════════════════════════════════════════════
// Export all templates
// ═══════════════════════════════════════════════════════════

export const TEST_TEMPLATES: TestTemplate[] = [
  // HTML elements
  htmlRequiredElements,
  htmlElementCount,
  htmlFormElements,
  // Styling
  stylingPropertyCheck,
  stylingResponsive,
  stylingColorContrast,
  // Functionality
  funcClickEvent,
  funcFormSubmit,
  funcLocalStorage,
  // Page
  pageTitle,
  pageMeta,
  pageMultiPage,
  pageNoConsoleErrors,
  pageAccessibility,
  // Screenshot
  screenshotCapture,
  // React
  reactComponentRender,
  reactStateInteraction,
];

export const TEMPLATE_CATEGORIES = [
  { id: "html-elements" as const, name: "HTML 元素" },
  { id: "styling" as const, name: "CSS 樣式" },
  { id: "functionality" as const, name: "功能互動" },
  { id: "page" as const, name: "頁面品質" },
  { id: "screenshot" as const, name: "截圖" },
  { id: "react" as const, name: "React" },
];
