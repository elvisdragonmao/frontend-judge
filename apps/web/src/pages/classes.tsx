import { Link } from "react-router";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">班級</h1>
        {user && isStaff(user.role) && (
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "取消" : "建立班級"}
          </Button>
        )}
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreate} className="flex gap-3">
              <Input
                placeholder="班級名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                placeholder="描述（選填）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button type="submit" disabled={createClassMutation.isPending}>
                建立
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-muted-foreground">載入中...</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes?.map((cls) => (
          <Link key={cls.id} to={`/classes/${cls.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{cls.name}</CardTitle>
                <CardDescription>{cls.description || "無描述"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{cls.memberCount} 位成員</span>
                  <span>{cls.assignmentCount} 項作業</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {classes?.length === 0 && !isLoading && (
        <p className="text-center text-muted-foreground">
          {user?.role === "student" ? "你尚未加入任何班級" : "尚未建立任何班級"}
        </p>
      )}
    </div>
  );
}
