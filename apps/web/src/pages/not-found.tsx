import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, LogIn, Sparkles } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function NotFoundPage() {
	const { isAuthenticated } = useAuth();
	const { t } = useTranslation();

	return (
		<div className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-card px-6 py-16 shadow-sm sm:px-10">
			<PageTitle title={t("pages.notFound.title")} />
			<div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--color-primary)_26%,transparent),transparent_68%)]" />
			<div className="pointer-events-none absolute right-[-4rem] top-10 h-32 w-32 rounded-full border border-primary/20 bg-primary/10 blur-2xl" />

			<div className="relative mx-auto flex max-w-3xl flex-col items-start gap-6 text-left">
				<div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-4 py-2 text-xs font-medium tracking-[0.24em] text-muted-foreground uppercase shadow-sm backdrop-blur-sm">
					<Sparkles className="size-3.5" />
					404
				</div>

				<div className="animate-fade-up delay-1 space-y-4">
					<p className="font-mono text-sm text-primary">/{t("pages.notFound.pathLabel")}</p>
					<h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">{t("pages.notFound.heading")}</h1>
					<p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{t("pages.notFound.description")}</p>
				</div>

				<div className="animate-fade-up delay-2 flex flex-wrap gap-3">
					<Button asChild>
						<Link to="/">
							<ArrowLeft />
							{t("pages.notFound.backHome")}
						</Link>
					</Button>
					<Button variant="outline" asChild>
						<Link to={isAuthenticated ? "/classes" : "/login"}>
							{isAuthenticated ? <BookOpen /> : <LogIn />}
							{t(isAuthenticated ? "pages.notFound.goClasses" : "pages.notFound.goLogin")}
						</Link>
					</Button>
				</div>

				<div className="animate-fade-up delay-3 grid w-full gap-3 pt-4 sm:grid-cols-3">
					<div className="rounded-2xl border border-border/80 bg-background/60 p-4 backdrop-blur-sm">
						<p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">01</p>
						<p className="mt-2 text-sm text-foreground">{t("pages.notFound.hintCheckUrl")}</p>
					</div>
					<div className="rounded-2xl border border-border/80 bg-background/60 p-4 backdrop-blur-sm">
						<p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">02</p>
						<p className="mt-2 text-sm text-foreground">{t("pages.notFound.hintNavigate")}</p>
					</div>
					<div className="rounded-2xl border border-border/80 bg-background/60 p-4 backdrop-blur-sm">
						<p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">03</p>
						<p className="mt-2 text-sm text-foreground">{t("pages.notFound.hintRetry")}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
