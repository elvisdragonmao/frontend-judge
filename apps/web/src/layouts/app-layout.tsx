import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Laptop, LogOut, Moon, Sun } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { isStaff } from "@judge/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Outlet, useNavigate } from "react-router";

export function AppLayout() {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const { t } = useTranslation();
	const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

	useEffect(() => {
		const stored = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
		if (stored) {
			setTheme(stored);
		}
	}, []);

	useEffect(() => {
		const root = document.documentElement;
		if (theme === "system") {
			root.classList.remove("latte", "mocha");
			localStorage.removeItem("theme");
			return;
		}

		root.classList.remove("latte", "mocha");
		root.classList.add(theme === "dark" ? "mocha" : "latte");
		localStorage.setItem("theme", theme);
	}, [theme]);

	const handleLogout = () => {
		logout();
		navigate("/login");
	};

	return (
		<div className="flex min-h-screen flex-col">
			{/* Navbar */}
			<header className="border-b border-border">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
					<div className="flex items-center gap-6">
						<Link to="/" className="flex items-center gap-2 text-lg font-bold">
							<img src="/ej.svg" alt="emjudge" className="size-7" />
						</Link>
						{user && (
							<nav className="flex items-center gap-4 text-sm">
								<Link to="/classes" className="text-muted-foreground transition-colors hover:text-foreground">
									{t("layout.nav.classes")}
								</Link>
								{isStaff(user.role) && (
									<Link to="/admin" className="text-muted-foreground transition-colors hover:text-foreground">
										{t("layout.nav.admin")}
									</Link>
								)}
							</nav>
						)}
					</div>
					<div className="flex items-center gap-3">
						<LanguageSwitcher />
						<Button variant="ghost" size="sm" onClick={() => setTheme(prev => (prev === "dark" ? "light" : prev === "light" ? "system" : "dark"))} aria-label={t("layout.theme.toggle")}>
							{theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Laptop />}
						</Button>
						{user && (
							<>
								<Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">
									{user.displayName}
								</Link>
								<Button variant="ghost" size="sm" onClick={handleLogout}>
									<LogOut />
									{t("layout.nav.logout")}
								</Button>
							</>
						)}
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="mx-auto w-full max-w-6xl flex-1 overflow-hidden px-4 py-6">
				<Outlet />
			</main>

			<footer className="border-t border-border/70 bg-background/80">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
					<p>emjudge 2026</p>
					<a href="https://github.com/elvisdragonmao/emjudge/" target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
						GitHub
					</a>
				</div>
			</footer>
		</div>
	);
}
