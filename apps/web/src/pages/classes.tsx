import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { PageTitle } from "@/components/page-title";
import { useAuth } from "@/stores/auth";
import { useClasses, useCreateClass } from "@/hooks/use-api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStaff } from "@judge/shared";
import { useState } from "react";

export function ClassesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: classes, isLoading } = useClasses();
  const createClassMutation = useCreateClass();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createClassMutation.mutate(
      { name, description },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setShowCreate(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageTitle title={t("pages.classes.title")} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("pages.classes.title")}</h1>
        {user && isStaff(user.role) && (
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate
              ? t("pages.classes.cancelCreate")
              : t("pages.classes.createClass")}
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="flex gap-3">
              <Input
                placeholder={t("pages.classes.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                placeholder={t("pages.classes.descriptionPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button type="submit" disabled={createClassMutation.isPending}>
                {t("pages.classes.create")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes?.map((cls) => (
          <Link key={cls.id} to={`/classes/${cls.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{cls.name}</CardTitle>
                <CardDescription>
                  {cls.description || t("pages.classes.noDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>
                    {t("pages.classes.memberCount", { count: cls.memberCount })}
                  </span>
                  <span>
                    {t("pages.classes.assignmentCount", {
                      count: cls.assignmentCount,
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {classes?.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground">
          {user?.role === "student"
            ? t("pages.classes.emptyStudent")
            : t("pages.classes.emptyStaff")}
        </p>
      )}
    </div>
  );
}
