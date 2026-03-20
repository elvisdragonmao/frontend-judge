import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(
    null,
  );
  const [params, setParams] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);

  const available = TEST_TEMPLATES.filter((template) =>
    template.applicableTo.includes(assignmentType),
  );

  const categories = TEMPLATE_CATEGORIES.filter((category) =>
    available.some((template) => template.category === category.id),
  );

  const handleSelect = useCallback((template: TestTemplate) => {
    setSelectedTemplate(template);
    const defaults: Record<string, string> = {};
    for (const param of template.params) {
      defaults[param.key] = param.defaultValue;
    }
    setParams(defaults);
    setPreview(null);
  }, []);

  const handlePreview = useCallback(() => {
    if (!selectedTemplate) return;
    setPreview(selectedTemplate.generate(params));
  }, [selectedTemplate, params]);

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return;
    onApply(selectedTemplate.generate(params));
    setSelectedTemplate(null);
    setPreview(null);
    setActiveCategory(null);
  }, [selectedTemplate, params, onApply]);

  const handleAppendApply = useCallback(() => {
    if (!selectedTemplate) return;
    onApply(`\n${selectedTemplate.generate(params)}`);
    setSelectedTemplate(null);
    setPreview(null);
  }, [selectedTemplate, params, onApply]);

  const getTemplateName = (template: TestTemplate) =>
    t(`templatePicker.templates.${template.id}.name`, {
      defaultValue: template.name,
    });

  const getTemplateDescription = (template: TestTemplate) =>
    t(`templatePicker.templates.${template.id}.description`, {
      defaultValue: template.description,
    });

  const getParamLabel = (
    template: TestTemplate,
    key: string,
    fallback: string,
  ) =>
    t(`templatePicker.templates.${template.id}.params.${key}.label`, {
      defaultValue: fallback,
    });

  const getParamPlaceholder = (
    template: TestTemplate,
    key: string,
    fallback: string,
  ) =>
    t(`templatePicker.templates.${template.id}.params.${key}.placeholder`, {
      defaultValue: fallback,
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Button
            key={category.id}
            type="button"
            variant={activeCategory === category.id ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setActiveCategory(
                activeCategory === category.id ? null : category.id,
              )
            }
          >
            {t(`templatePicker.categories.${category.id}`, {
              defaultValue: category.name,
            })}
          </Button>
        ))}
      </div>

      {activeCategory && (
        <div className="grid gap-2 md:grid-cols-2">
          {available
            .filter((template) => template.category === activeCategory)
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
                      <p className="text-sm font-medium">
                        {getTemplateName(template)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getTemplateDescription(template)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0">
                      {template.params.length > 0
                        ? t("templatePicker.paramCount", {
                            count: template.params.length,
                          })
                        : t("templatePicker.noConfig")}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("templatePicker.paramSettings", {
                name: getTemplateName(selectedTemplate),
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplate.params.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("templatePicker.noExtraSettings")}
              </p>
            )}

            {selectedTemplate.params.map((param) => (
              <div key={param.key} className="space-y-1">
                <label className="text-sm font-medium">
                  {getParamLabel(selectedTemplate, param.key, param.label)}
                </label>
                {param.type === "textarea" ? (
                  <textarea
                    value={params[param.key] ?? ""}
                    onChange={(event) =>
                      setParams({ ...params, [param.key]: event.target.value })
                    }
                    placeholder={getParamPlaceholder(
                      selectedTemplate,
                      param.key,
                      param.placeholder,
                    )}
                    className="min-h-[80px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                ) : (
                  <Input
                    type={param.type === "number" ? "number" : "text"}
                    value={params[param.key] ?? ""}
                    onChange={(event) =>
                      setParams({ ...params, [param.key]: event.target.value })
                    }
                    placeholder={getParamPlaceholder(
                      selectedTemplate,
                      param.key,
                      param.placeholder,
                    )}
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
                {t("templatePicker.previewCode")}
              </Button>
              <Button type="button" size="sm" onClick={handleApply}>
                {t("templatePicker.applyReplace")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAppendApply}
              >
                {t("templatePicker.applyAppend")}
              </Button>
            </div>

            {preview && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {t("templatePicker.generatedCode")}
                </p>
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
