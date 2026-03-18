import { useState, useCallback } from "react";
import {
  TEST_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type TestTemplate,
} from "@judge/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface TestTemplatePickerProps {
  assignmentType: "html-css-js" | "react";
  onApply: (code: string) => void;
}

export function TestTemplatePicker({
  assignmentType,
  onApply,
}: TestTemplatePickerProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(
    null,
  );
  const [params, setParams] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);

  // Filter templates by assignment type
  const available = TEST_TEMPLATES.filter((t) =>
    t.applicableTo.includes(assignmentType),
  );

  const categories = TEMPLATE_CATEGORIES.filter((cat) =>
    available.some((t) => t.category === cat.id),
  );

  const handleSelect = useCallback((template: TestTemplate) => {
    setSelectedTemplate(template);
    // Initialize params with defaults
    const defaults: Record<string, string> = {};
    for (const p of template.params) {
      defaults[p.key] = p.defaultValue;
    }
    setParams(defaults);
    setPreview(null);
  }, []);

  const handlePreview = useCallback(() => {
    if (!selectedTemplate) return;
    const code = selectedTemplate.generate(params);
    setPreview(code);
  }, [selectedTemplate, params]);

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return;
    const code = selectedTemplate.generate(params);
    onApply(code);
    setSelectedTemplate(null);
    setPreview(null);
    setActiveCategory(null);
  }, [selectedTemplate, params, onApply]);

  const handleAppendApply = useCallback(() => {
    if (!selectedTemplate) return;
    const code = selectedTemplate.generate(params);
    // Append mode: pass code with a marker so parent can append
    onApply("\n" + code);
    setSelectedTemplate(null);
    setPreview(null);
  }, [selectedTemplate, params, onApply]);

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            type="button"
            variant={activeCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setActiveCategory(activeCategory === cat.id ? null : cat.id)
            }
          >
            {cat.name}
          </Button>
        ))}
      </div>

      {/* Template list */}
      {activeCategory && (
        <div className="grid gap-2 md:grid-cols-2">
          {available
            .filter((t) => t.category === activeCategory)
            .map((template) => (
              <Card
                key={template.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  selectedTemplate?.id === template.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => handleSelect(template)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{template.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {template.params.length > 0
                        ? `${template.params.length} 個參數`
                        : "無需設定"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Parameter form */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedTemplate.name} — 參數設定
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplate.params.length === 0 && (
              <p className="text-sm text-muted-foreground">
                此模板不需要額外設定。
              </p>
            )}

            {selectedTemplate.params.map((p) => (
              <div key={p.key} className="space-y-1">
                <label className="text-sm font-medium">{p.label}</label>
                {p.type === "textarea" ? (
                  <textarea
                    value={params[p.key] ?? ""}
                    onChange={(e) =>
                      setParams({ ...params, [p.key]: e.target.value })
                    }
                    placeholder={p.placeholder}
                    className="min-h-[80px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ) : (
                  <Input
                    type={p.type === "number" ? "number" : "text"}
                    value={params[p.key] ?? ""}
                    onChange={(e) =>
                      setParams({ ...params, [p.key]: e.target.value })
                    }
                    placeholder={p.placeholder}
                  />
                )}
              </div>
            ))}

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handlePreview}
              >
                預覽程式碼
              </Button>
              <Button type="button" size="sm" onClick={handleApply}>
                覆蓋套用
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAppendApply}
              >
                追加套用
              </Button>
            </div>

            {/* Preview */}
            {preview && (
              <div className="space-y-2">
                <p className="text-sm font-medium">產生的測試程式碼：</p>
                <pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs">
                  {preview}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
