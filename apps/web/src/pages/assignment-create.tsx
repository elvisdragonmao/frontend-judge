import { useState, useCallback } from "react";
import { DEFAULT_REACT_ASSIGNMENT_SPEC } from "@judge/shared";
import { useParams, useNavigate } from "react-router";
import { useCreateAssignment } from "@/hooks/use-api";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TestTemplatePicker } from "@/components/test-template-picker";

export function AssignmentCreatePage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const createMutation = useCreateAssignment();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"html-css-js" | "react">("html-css-js");
  const [dueDate, setDueDate] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [testContent, setTestContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const handleApplyTemplate = useCallback(
    (code: string) => {
      if (code.startsWith("\n") && testContent) {
        // Append mode: merge imports and append tests
        const existing = testContent;
        const newCode = code.trimStart();

        // Remove duplicate import lines from the new code
        const newLines = newCode.split("\n");
        const filtered = newLines.filter(
          (line) =>
            !line.startsWith("import ") || !existing.includes(line.trim()),
        );
        setTestContent(existing + "\n" + filtered.join("\n"));
      } else {
        setTestContent(code);
      }
    },
    [testContent],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      {
        classId,
        title,
        description,
        type,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        allowMultipleSubmissions: allowMultiple,
        spec: {
          startCommand:
            type === "react"
              ? DEFAULT_REACT_ASSIGNMENT_SPEC.startCommand
              : "static",
          testContent: testContent || undefined,
          timeoutMs: 60_000,
          allowedPaths:
            type === "react"
              ? [...DEFAULT_REACT_ASSIGNMENT_SPEC.allowedPaths]
              : ["**/*"],
          blockedPaths: [...DEFAULT_REACT_ASSIGNMENT_SPEC.blockedPaths],
        },
      },
      {
        onSuccess: () => navigate(`/classes/${classId}`),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageTitle title="建立作業" />
      <h1 className="text-2xl font-bold">建立作業</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基本資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">標題</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="作業標題"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">題型</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === "html-css-js" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType("html-css-js")}
                >
                  HTML / CSS / JS
                </Button>
                <Button
                  type="button"
                  variant={type === "react" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType("react")}
                >
                  React
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">截止時間（選填）</label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allowMultiple"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
                className="h-4 w-4"
              />
              <label htmlFor="allowMultiple" className="text-sm">
                允許多次提交
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">題目描述 (Markdown)</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? "編輯" : "預覽"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showPreview ? (
              <MarkdownRenderer content={description} />
            ) : (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="用 Markdown 撰寫題目描述..."
                className="min-h-[200px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">測試規格</CardTitle>
              <Button
                type="button"
                variant={showTemplatePicker ? "default" : "outline"}
                size="sm"
                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              >
                {showTemplatePicker ? "收起模板" : "使用測試模板"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template picker */}
            {showTemplatePicker && (
              <TestTemplatePicker
                assignmentType={type}
                onApply={handleApplyTemplate}
              />
            )}

            {/* Manual editor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Playwright 測試腳本</label>
              <p className="text-xs text-muted-foreground">
                可從上方模板產生，或自行撰寫。支援「覆蓋套用」（取代目前內容）與「追加套用」（合併到現有腳本後面）。
              </p>
              <textarea
                value={testContent}
                onChange={(e) => setTestContent(e.target.value)}
                placeholder={`import { test, expect } from '@playwright/test';\n\ntest('頁面標題正確', async ({ page }) => {\n  await page.goto('/');\n  await expect(page).toHaveTitle(/My Page/);\n});`}
                className="min-h-[250px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            取消
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "建立中..." : "建立作業"}
          </Button>
        </div>
      </form>
    </div>
  );
}
