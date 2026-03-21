import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLogin, useRegistrationStatus } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { LogIn, UserPlus } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

export function LoginPage() {
	const { t } = useTranslation();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [errorMessage, setErrorMessage] = useState("");
	const { login } = useAuth();
	const navigate = useNavigate();
	const loginMutation = useLogin();
	const { data: registrationStatus } = useRegistrationStatus();

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMessage("");
		loginMutation.mutate(
			{ username, password },
			{
				onSuccess: data => {
					login(data.token, data.user);
					navigate("/classes");
				},
				onError: error => {
					if (error instanceof ApiError && error.statusCode === 401) {
						setErrorMessage(t("pages.login.invalidCredentials"));
						return;
					}

					setErrorMessage(t("pages.login.serverError"));
				}
			}
		);
	};

	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<PageTitle title={t("pages.login.title")} />
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-center text-xl">{t("pages.login.title")}</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium">{t("pages.login.username")}</label>
							<Input value={username} onChange={e => setUsername(e.target.value)} placeholder={t("pages.login.usernamePlaceholder")} autoFocus />
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">{t("pages.login.password")}</label>
							<Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("pages.login.passwordPlaceholder")} />
						</div>
						{errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
						<Button type="submit" className="w-full" disabled={loginMutation.isPending}>
							<LogIn />
							{loginMutation.isPending ? t("pages.login.submitting") : t("pages.login.submit")}
						</Button>
						<p className="text-center text-xs text-muted-foreground">{registrationStatus?.registrationEnabled ? t("pages.login.hintOpen") : t("pages.login.hintClosed")}</p>
						{registrationStatus?.registrationEnabled && (
							<Button type="button" variant="outline" className="w-full" asChild>
								<Link to="/register">
									<UserPlus />
									{t("pages.login.goRegister")}
								</Link>
							</Button>
						)}
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
