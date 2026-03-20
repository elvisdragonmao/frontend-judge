import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, LogIn, Sparkles } from "@/lib/icons";
import { useAuth } from "@/stores/auth";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function HomePage() {
	const { isAuthenticated } = useAuth();
	const { t } = useTranslation();

	const features = [
		{
			title: t("pages.home.featureUploadTitle"),
			desc: t("pages.home.featureUploadDesc")
		},
		{
			title: t("pages.home.featureScreenshotTitle"),
			desc: t("pages.home.featureScreenshotDesc")
		},
		{
			title: t("pages.home.featureScoreTitle"),
			desc: t("pages.home.featureScoreDesc")
		}
	];

	return (
		<div className="relative">
			<PageTitle title={t("pages.home.title")} />
			<div className="pointer-events-none absolute left-1/2 top-[-260px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary)_26%,transparent),transparent_70%)] blur-2xl" />

			<section className="mx-auto flex max-w-5xl flex-col items-center gap-6 py-20 text-center">
				<div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm">
					<Sparkles className="size-3.5" />
					{t("pages.home.heroTag")}
				</div>
				<h1 className="animate-fade-up delay-1">
					<img src="/emjudge.svg" alt="emjudge" className="mx-auto mb-4 h-12" />
				</h1>
				<p className="animate-fade-up delay-2 max-w-2xl text-base text-muted-foreground sm:text-lg">{t("pages.home.heroDescription")}</p>
				<div className="animate-fade-up delay-3 flex flex-wrap items-center justify-center gap-3">
					{isAuthenticated ? (
						<Button asChild>
							<Link to="/classes">
								<BookOpen />
								{t("pages.home.enterClasses")}
							</Link>
						</Button>
					) : (
						<Button asChild>
							<Link to="/login">
								<LogIn />
								{t("pages.home.login")}
							</Link>
						</Button>
					)}
					<Button variant="outline" asChild>
						<Link to="/classes">
							<ArrowRight />
							{t("pages.home.browseClasses")}
						</Link>
					</Button>
				</div>
			</section>

			<section className="mx-auto grid max-w-5xl gap-4 pb-16 md:grid-cols-3">
				{features.map(item => (
					<div key={item.title} className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform duration-300">
						<h3 className="text-lg font-semibold">{item.title}</h3>
						<p className="mt-2 text-sm text-muted-foreground">{item.desc}</p>
						<div className="mt-6 h-1 w-12 rounded-full bg-gradient-to-r from-ctp-teal/80 to-ctp-lavender/80 opacity-80" />
					</div>
				))}
			</section>

			<section className="mx-auto max-w-5xl pb-12">
				<div className="rounded-3xl border border-border bg-card px-6 py-8 text-left shadow-sm md:flex md:items-center md:justify-between">
					<div className="max-w-lg">
						<h2 className="text-2xl font-semibold">{t("pages.home.ctaTitle")}</h2>
						<p className="mt-3 text-sm text-muted-foreground">{t("pages.home.ctaDescription")}</p>
					</div>
					<div className="mt-4 flex gap-3 md:mt-0">
						<Button variant="secondary" asChild>
							<Link to="/classes">
								<BookOpen />
								{t("pages.home.ctaPrimary")}
							</Link>
						</Button>
						<Button variant="ghost" asChild>
							<Link to="/login">
								<LogIn />
								{t("pages.home.ctaSecondary")}
							</Link>
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
