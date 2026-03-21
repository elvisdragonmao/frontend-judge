import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRegister, useRegistrationStatus } from "@/hooks/use-api";
import { ApiError } from "@/lib/api";
import { LogIn, UserPlus } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

export function RegisterPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { login } = useAuth();
	const { data: registrationStatus, isLoading } = useRegistrationStatus();
	const registerMutation = useRegister();

	const [username, setUsername] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [formError, setFormError] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setFormError("");

		if (password !== confirmPassword) {
			setFormError(t("pages.register.passwordMismatch"));
			return;
		}

		registerMutation.mutate(
			{ username, displayName, password },
			{
				onSuccess: data => {
					login(data.token, data.user);
					navigate("/classes");
				},
				onError: error => {
					if (error instanceof ApiError && error.statusCode === 403) {
						setFormError(t("pages.register.closedMessage"));
						return;
					}
					if (error instanceof ApiError && error.statusCode === 409) {
						setFormError(t("pages.register.usernameTaken"));
						return;
					}
					setFormError(t("pages.register.failed"));
				}
			}
		);
	};

	const closed = !isLoading && !registrationStatus?.registrationEnabled;

	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<PageTitle title={t("pages.register.title")} />
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle className="text-center text-xl">{t("pages.register.title")}</CardTitle>
				</CardHeader>
				<CardContent>
					{closed ? (
						<div className="space-y-4 text-center">
							<p className="text-sm text-muted-foreground">{t("pages.register.closedMessage")}</p>
							<Button variant="outline" className="w-full" asChild>
								<Link to="/login">
									<LogIn />
									{t("pages.register.backToLogin")}
								</Link>
							</Button>
						</div>
					) : (
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<label className="text-sm font-medium">{t("pages.register.username")}</label>
								<Input value={username} onChange={e => setUsername(e.target.value)} placeholder={t("pages.register.usernamePlaceholder")} autoFocus required minLength={2} />
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium">{t("pages.register.displayName")}</label>
								<Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t("pages.register.displayNamePlaceholder")} required />
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium">{t("pages.register.password")}</label>
								<Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t("pages.register.passwordPlaceholder")} required minLength={6} />
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium">{t("pages.register.confirmPassword")}</label>
								<Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t("pages.register.confirmPasswordPlaceholder")} required minLength={6} />
							</div>
							<p className="text-center text-xs text-muted-foreground">{t("pages.register.hint")}</p>
							{formError && <p className="text-sm text-destructive">{formError}</p>}
							<Button type="submit" className="w-full" disabled={registerMutation.isPending || isLoading}>
								<UserPlus />
								{registerMutation.isPending ? t("pages.register.submitting") : t("pages.register.submit")}
							</Button>
							<Button type="button" variant="ghost" className="w-full" asChild>
								<Link to="/login">
									<LogIn />
									{t("pages.register.backToLogin")}
								</Link>
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
