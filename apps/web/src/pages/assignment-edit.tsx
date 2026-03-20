import { useCallback, useEffect, useState } from "react";
import { Code2, Eye, FileCode2, Save, Sparkles, X } from "@/lib/icons";
import { useTranslation } from "react-i18next";
import { DEFAULT_REACT_ASSIGNMENT_SPEC } from "@judge/shared";
import { useNavigate, useParams } from "react-router";
import { useAssignmentDetail, useUpdateAssignment } from "@/hooks/use-api";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TestTemplatePicker } from "@/components/test-template-picker";

export function AssignmentEditPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assignment, isLoading } = useAssignmentDetail(id!);
  const updateMutation = useUpdateAssignment(id!);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"html-css-js" | "react">("html-css-js");
  const [dueDate, setDueDate] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(true);
  const [testContent, setTestContent] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [submissionRecordAction, setSubmissionRecordAction] = useState<
    "keep" | "delete"
  >("keep");

  useEffect(() => {
    if (!assignment) return;
    setTitle(assignment.title);
    setDescription(assignment.description);
    setType(assignment.type);
    setDueDate(
      assignment.dueDate
        ? new Date(assignment.dueDate).toISOString().slice(0, 16)
        : "",
    );
    setAllowMultiple(assignment.allowMultipleSubmissions);
    setTestContent(assignment.spec?.testContent ?? "");
  }, [assignment]);

  const handleApplyTemplate = useCallback(
    (code: string) => {
      if (code.startsWith("\n") && testContent) {
        const existing = testContent;
        const newCode = code.trimStart();
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
    updateMutation.mutate(
      {
        title,
        description,
        type,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        allowMultipleSubmissions: allowMultiple,
        submissionRecordAction,
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
        onSuccess: () => navigate(`/assignments/${id}`),
      },
    );
  };

  if (isLoading) {
    return (
      <>
        <PageTitle title={t("pages.assignmentEdit.loadingTitle")} />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  if (!assignment) {
    return (
      <>
        <PageTitle title={t("pages.assignmentEdit.notFoundTitle")} />
        <p className="text-muted-foreground">
          {t("pages.assignmentEdit.notFoundTitle")}
        </p>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title={t("pages.assignmentEdit.pageTitle", { title: assignment.title })}
      />
      <h1 className="text-2xl font-bold">{t("pages.assignmentEdit.title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("pages.assignmentForm.basicInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("pages.assignmentForm.titleLabel")}
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("pages.assignmentForm.titlePlaceholder")}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("pages.assignmentForm.typeLabel")}
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === "html-css-js" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType("html-css-js")}
                >
                  <Code2 />
                  {t("assignmentTypes.html-css-js")}
                </Button>
                <Button
                  type="button"
                  variant={type === "react" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType("react")}
                >
                  <FileCode2 />
                  {t("assignmentTypes.react")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("pages.assignmentForm.dueDateOptional")}
              </label>
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
                {t("pages.assignmentForm.allowMultiple")}
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("pages.assignmentEdit.submissionRecordActionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="submissionRecordAction"
                value="keep"
                checked={submissionRecordAction === "keep"}
                onChange={() => setSubmissionRecordAction("keep")}
              />
              {t("pages.assignmentEdit.keepRecords")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="submissionRecordAction"
                value="delete"
                checked={submissionRecordAction === "delete"}
                onChange={() => setSubmissionRecordAction("delete")}
              />
              {t("pages.assignmentEdit.deleteRecords")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("pages.assignmentEdit.deleteHelp")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t("pages.assignmentForm.descriptionMarkdown")}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? <Code2 /> : <Eye />}
                {showPreview ? t("common.edit") : t("common.preview")}
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
                placeholder={t("pages.assignmentForm.descriptionPlaceholder")}
                className="min-h-[200px] w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t("pages.assignmentForm.testSpec")}
              </CardTitle>
              <Button
                type="button"
                variant={showTemplatePicker ? "default" : "outline"}
                size="sm"
                onClick={() => setShowTemplatePicker(!showTemplatePicker)}
              >
                <Sparkles />
                {showTemplatePicker
                  ? t("pages.assignmentForm.hideTemplates")
                  : t("pages.assignmentForm.showTemplates")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showTemplatePicker && (
              <TestTemplatePicker
                assignmentType={type}
                onApply={handleApplyTemplate}
              />
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("pages.assignmentForm.playwrightScript")}
              </label>
              <textarea
                value={testContent}
                onChange={(e) => setTestContent(e.target.value)}
                placeholder={t("pages.assignmentForm.scriptPlaceholder")}
                className="min-h-[250px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            <X />
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            <Save />
            {updateMutation.isPending
              ? t("pages.assignmentEdit.updating")
              : t("pages.assignmentEdit.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
