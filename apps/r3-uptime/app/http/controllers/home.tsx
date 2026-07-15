/**
 * Home controller. Renders the public marketing homepage — hero, trust indicators,
 * feature and use-case grids, a static pricing explanation, and an FAQ accordion —
 * inside the shared `MarketingLayout` chrome. It exists as the top-of-funnel entry
 * point for anonymous visitors, and as the redirect target for unauthenticated
 * `requireUser` guards (signed-in viewers see a "Go to dashboard" call to action
 * instead of a sign-in form).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CheckIcon } from "@pkg/lucide-remix";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import { getViewer } from "~/app/http/middleware/auth";
import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout from "~/resources/layouts/marketing";
import { fontMono } from "~/resources/theme";
import routes from "~/routes/web";

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	600: "oklch(0.52 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
};

/** Primary (brand) scale shades used on this page, hue 142. */
const primary = {
	50: "oklch(0.98 0.02 142)",
	200: "oklch(0.92 0.08 142)",
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
	700: "oklch(0.5 0.14 142)",
	800: "oklch(0.42 0.12 142)",
	950: "oklch(0.24 0.06 142)",
};

/** GET / — the public marketing homepage. */
export default createAction(routes.home, async (ctx) => {
	let isSignedIn = getViewer() !== null;

	let TRUST_INDICATORS = [
		{ value: "99.9%", label: ctx.i18next.t("landing.trustIndicators.uptimeSla") },
		{ value: "9", label: ctx.i18next.t("landing.trustIndicators.globalRegions") },
		{ value: "365", label: ctx.i18next.t("landing.trustIndicators.daysDataRetention") },
		{ value: "<1s", label: ctx.i18next.t("landing.trustIndicators.alertLatency") },
	];

	let FEATURE_LINKS = [
		{
			title: ctx.i18next.t("landing.features.list.first.title"),
			description: ctx.i18next.t("landing.features.list.first.description"),
			slug: "monitors",
		},
		{
			title: ctx.i18next.t("landing.features.list.second.title"),
			description: ctx.i18next.t("landing.features.list.second.description"),
			slug: "alerts",
		},
		{
			title: ctx.i18next.t("landing.features.list.fourth.title"),
			description: ctx.i18next.t("landing.features.list.fourth.description"),
			slug: "status-pages",
		},
		{
			title: ctx.i18next.t("landing.features.list.fifth.title"),
			description: ctx.i18next.t("landing.features.list.fifth.description"),
			slug: "ssl",
		},
		{
			title: ctx.i18next.t("landing.features.list.sixth.title"),
			description: ctx.i18next.t("landing.features.list.sixth.description"),
			slug: "dns",
		},
		{
			title: ctx.i18next.t("landing.features.list.seventh.title"),
			description: ctx.i18next.t("landing.features.list.seventh.description"),
			slug: "integrations",
		},
	];

	let COMPLETE_FEATURES = [
		{
			title: ctx.i18next.t("landing.completeFeatureSet.list.maintenanceWindows.title"),
			description: ctx.i18next.t("landing.completeFeatureSet.list.maintenanceWindows.description"),
		},
		{
			title: ctx.i18next.t("landing.completeFeatureSet.list.contentMonitoring.title"),
			description: ctx.i18next.t("landing.completeFeatureSet.list.contentMonitoring.description"),
		},
		{
			title: ctx.i18next.t("landing.completeFeatureSet.list.recoveryAlerts.title"),
			description: ctx.i18next.t("landing.completeFeatureSet.list.recoveryAlerts.description"),
		},
		{
			title: ctx.i18next.t("landing.completeFeatureSet.list.apiAccess.title"),
			description: ctx.i18next.t("landing.completeFeatureSet.list.apiAccess.description"),
		},
		{
			title: ctx.i18next.t("landing.completeFeatureSet.list.alertCooldowns.title"),
			description: ctx.i18next.t("landing.completeFeatureSet.list.alertCooldowns.description"),
		},
		{
			title: ctx.i18next.t("landing.completeFeatureSet.list.customHeaders.title"),
			description: ctx.i18next.t("landing.completeFeatureSet.list.customHeaders.description"),
		},
		{
			title: ctx.i18next.t("landing.completeFeatureSet.list.cronMonitoring.title"),
			description: ctx.i18next.t("landing.completeFeatureSet.list.cronMonitoring.description"),
		},
	];

	let USE_CASE_LINKS = [
		{
			title: ctx.i18next.t("landing.useCases.list.websiteMonitoring.title"),
			description: ctx.i18next.t("landing.useCases.list.websiteMonitoring.description"),
			slug: "website-monitoring",
		},
		{
			title: ctx.i18next.t("landing.useCases.list.apiMonitoring.title"),
			description: ctx.i18next.t("landing.useCases.list.apiMonitoring.description"),
			slug: "api-monitoring",
		},
		{
			title: ctx.i18next.t("landing.useCases.list.saas.title"),
			description: ctx.i18next.t("landing.useCases.list.saas.description"),
			slug: "saas",
		},
		{
			title: ctx.i18next.t("landing.useCases.list.microservices.title"),
			description: ctx.i18next.t("landing.useCases.list.microservices.description"),
			slug: "microservices",
		},
		{
			title: ctx.i18next.t("landing.useCases.list.healthChecks.title"),
			description: ctx.i18next.t("landing.useCases.list.healthChecks.description"),
			slug: "healthcheck",
		},
		{
			title: ctx.i18next.t("landing.useCases.list.ecommerce.title"),
			description: ctx.i18next.t("landing.useCases.list.ecommerce.description"),
			slug: "ecommerce",
		},
	];

	let AUDIENCE_LINKS = [
		{ label: ctx.i18next.t("landing.useCases.audiences.indieHackers"), slug: "indie-hackers" },
		{ label: ctx.i18next.t("landing.useCases.audiences.soloDevelopers"), slug: "solo-devs" },
		{ label: ctx.i18next.t("landing.useCases.audiences.startups"), slug: "startups" },
		{ label: ctx.i18next.t("landing.useCases.audiences.agencies"), slug: "agencies" },
		{ label: ctx.i18next.t("landing.useCases.audiences.enterprises"), slug: "enterprises" },
		{ label: ctx.i18next.t("landing.useCases.audiences.devops"), slug: "devops" },
	];

	let FAQS = [
		{
			question: ctx.i18next.t("landing.faq.list.first.q"),
			answer: ctx.i18next.t("landing.faq.list.first.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.second.q"),
			answer: ctx.i18next.t("landing.faq.list.second.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.third.q"),
			answer: ctx.i18next.t("landing.faq.list.third.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.fourth.q"),
			answer: ctx.i18next.t("landing.faq.list.fourth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.fifth.q"),
			answer: ctx.i18next.t("landing.faq.list.fifth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.sixth.q"),
			answer: ctx.i18next.t("landing.faq.list.sixth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.seventh.q"),
			answer: ctx.i18next.t("landing.faq.list.seventh.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.eighth.q"),
			answer: ctx.i18next.t("landing.faq.list.eighth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.ninth.q"),
			answer: ctx.i18next.t("landing.faq.list.ninth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.tenth.q"),
			answer: ctx.i18next.t("landing.faq.list.tenth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.eleventh.q"),
			answer: ctx.i18next.t("landing.faq.list.eleventh.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.thirteenth.q"),
			answer: ctx.i18next.t("landing.faq.list.thirteenth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.fifteenth.q"),
			answer: ctx.i18next.t("landing.faq.list.fifteenth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.sixteenth.q"),
			answer: ctx.i18next.t("landing.faq.list.sixteenth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.seventeenth.q"),
			answer: ctx.i18next.t("landing.faq.list.seventeenth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.eighteenth.q"),
			answer: ctx.i18next.t("landing.faq.list.eighteenth.a"),
		},
		{
			question: ctx.i18next.t("landing.faq.list.nineteenth.q"),
			answer: ctx.i18next.t("landing.faq.list.nineteenth.a"),
		},
	];

	return ctx.render(
		<DocumentLayout title="Uptime — Simple & reliable uptime monitoring for developers">
			<MarketingLayout isSignedIn={isSignedIn}>
				<section
					mix={[
						css({
							padding: "64px 0",
							textAlign: "center",
							background: `linear-gradient(to bottom, ${primary[50]}, #ffffff)`,
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": {
								background: `linear-gradient(to bottom, oklch(0.24 0.06 142 / 0.2), ${neutral[950]})`,
							},
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<span
							mix={[
								css({
									display: "inline-flex",
									alignItems: "center",
									padding: "2px 10px",
									borderRadius: 999,
									fontSize: "0.75rem",
									fontWeight: 600,
									border: `1px solid ${primary[200]}`,
									background: primary[50],
									color: primary[600],
									marginBottom: 16,
									"@media (prefers-color-scheme: dark)": {
										borderColor: primary[800],
										background: primary[950],
										color: primary[400],
									},
								}),
							]}
						>
							{ctx.i18next.t("landing.hero.pill")}
						</span>
						<h1
							mix={[
								css({
									fontSize: "2.25rem",
									fontWeight: 700,
									lineHeight: 1,
									letterSpacing: "-0.025em",
									margin: "0 auto 16px",
									maxWidth: 760,
									color: neutral[900],
									"@media (min-width: 640px)": { fontSize: "3rem" },
									"@media (min-width: 1024px)": { fontSize: "3.75rem" },
									"@media (prefers-color-scheme: dark)": { color: neutral[50] },
								}),
							]}
						>
							Monitor your services{" "}
							<span
								mix={[
									css({
										color: primary[600],
										"@media (prefers-color-scheme: dark)": { color: primary[400] },
									}),
								]}
							>
								with confidence
							</span>
						</h1>
						<p
							mix={[
								css({
									fontSize: "1.125rem",
									color: neutral[600],
									margin: "0 auto 24px",
									maxWidth: 576,
									lineHeight: 1.625,
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{ctx.i18next.t("landing.hero.description")}
						</p>

						<div
							mix={[
								css({
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: 16,
									marginTop: 32,
									"@media (min-width: 640px)": { flexDirection: "row", justifyContent: "center" },
								}),
							]}
						>
							<AuthCta
								isSignedIn={isSignedIn}
								dashboardLabel={ctx.i18next.t("landing.hero.cta.in")}
							/>
							<a
								href="#pricing"
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										padding: "12px 24px",
										borderRadius: 8,
										border: `1px solid ${neutral[300]}`,
										background: "#ffffff",
										color: neutral[700],
										fontFamily: "inherit",
										fontSize: "1rem",
										fontWeight: 600,
										cursor: "pointer",
										textDecoration: "none",
										boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
										"&:hover": {
											background: neutral[50],
											boxShadow:
												"0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
										},
										"@media (prefers-color-scheme: dark)": {
											borderColor: neutral[700],
											background: neutral[900],
											color: neutral[300],
											"&:hover": { background: neutral[800] },
										},
									}),
								]}
							>
								{ctx.i18next.t("landing.hero.cta.pricing")}
							</a>
						</div>

						<div
							mix={[
								css({
									display: "flex",
									flexWrap: "wrap",
									justifyContent: "center",
									gap: "8px 24px",
									marginTop: 32,
								}),
							]}
						>
							<span
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										fontSize: "0.875rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								<CheckIcon size={16} />
								{ctx.i18next.t("landing.hero.trustIndicators.freeToStart")}
							</span>
							<span
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										fontSize: "0.875rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								<CheckIcon size={16} />
								{ctx.i18next.t("landing.hero.trustIndicators.payForAutomation")}
							</span>
							<span
								mix={[
									css({
										display: "inline-flex",
										alignItems: "center",
										gap: 6,
										fontSize: "0.875rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								<CheckIcon size={16} />
								{ctx.i18next.t("landing.hero.trustIndicators.cancelAnytime")}
							</span>
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							background: neutral[50],
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": { background: "oklch(0.24 0.005 145 / 0.5)" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "repeat(2, 1fr)",
									textAlign: "center",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(4, 1fr)" },
								}),
							]}
						>
							{TRUST_INDICATORS.map((stat) => (
								<div key={stat.label}>
									<div
										mix={[
											css({
												fontSize: "1.875rem",
												fontWeight: 700,
												lineHeight: "2.25rem",
												fontFamily: fontMono,
												color: neutral[900],
												"@media (prefers-color-scheme: dark)": { color: neutral[50] },
											}),
										]}
									>
										{stat.value}
									</div>
									<div
										mix={[
											css({
												fontSize: "0.875rem",
												color: neutral[600],
												"@media (prefers-color-scheme: dark)": { color: neutral[400] },
											}),
										]}
									>
										{stat.label}
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				<section
					id="features"
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.features.badge")}
							title={ctx.i18next.t("landing.features.title")}
							description={ctx.i18next.t("landing.features.description")}
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							{FEATURE_LINKS.map((feature) => (
								<MarketingCard
									key={feature.slug}
									href={routes.marketing.feature.href({ slug: feature.slug })}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							background: neutral[50],
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": { background: "oklch(0.24 0.005 145 / 0.5)" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.completeFeatureSet.badge")}
							title={ctx.i18next.t("landing.completeFeatureSet.title")}
							description={ctx.i18next.t("landing.completeFeatureSet.description")}
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							{COMPLETE_FEATURES.map((feature) => (
								<MarketingCard
									key={feature.title}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				<section
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.useCases.badge")}
							title={ctx.i18next.t("landing.useCases.title")}
							description={ctx.i18next.t("landing.useCases.description")}
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							{USE_CASE_LINKS.map((useCase) => (
								<MarketingCard
									key={useCase.slug}
									href={routes.marketing.useCase.href({ slug: useCase.slug })}
									title={useCase.title}
									description={useCase.description}
								/>
							))}
						</div>

						<div
							mix={[
								css({
									padding: 20,
									borderRadius: 12,
									border: `1px solid ${neutral[200]}`,
									background: "#ffffff",
									marginTop: 24,
									textAlign: "center",
									"@media (prefers-color-scheme: dark)": {
										borderColor: neutral[800],
										background: neutral[900],
									},
								}),
							]}
						>
							<p
								mix={[
									css({
										fontSize: "1.25rem",
										fontWeight: 600,
										lineHeight: "1.75rem",
										margin: "0 0 6px",
										color: neutral[900],
										"@media (prefers-color-scheme: dark)": { color: neutral[50] },
									}),
								]}
							>
								{ctx.i18next.t("landing.useCases.tailoredFor")}
							</p>
							<div
								mix={[
									css({
										display: "flex",
										flexWrap: "wrap",
										justifyContent: "center",
										gap: "8px 24px",
										marginTop: 32,
									}),
								]}
							>
								{AUDIENCE_LINKS.map((audience) => (
									<a
										key={audience.slug}
										href={routes.marketing.audience.href({ slug: audience.slug })}
										mix={[
											css({
												fontSize: "0.875rem",
												color: neutral[600],
												textDecoration: "none",
												"&:hover": { color: primary[600] },
												"@media (prefers-color-scheme: dark)": {
													color: neutral[400],
													"&:hover": { color: primary[400] },
												},
											}),
										]}
									>
										{audience.label}
									</a>
								))}
							</div>
						</div>
					</div>
				</section>

				<section
					id="pricing"
					mix={[
						css({
							padding: "64px 0",
							background: neutral[50],
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
							"@media (prefers-color-scheme: dark)": { background: "oklch(0.24 0.005 145 / 0.5)" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.pricing.badge")}
							title={ctx.i18next.t("landing.pricing.title")}
							description={ctx.i18next.t("landing.pricing.description")}
						/>

						<div
							mix={[
								css({
									display: "grid",
									gap: 32,
									gridTemplateColumns: "1fr",
									"@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, 1fr)" },
									"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								}),
							]}
						>
							<MarketingCard
								title={ctx.i18next.t("landing.pricing.howItWorks.list.first.title")}
								description={ctx.i18next.t("landing.pricing.howItWorks.list.first.description")}
							/>
							<MarketingCard
								title={ctx.i18next.t("landing.pricing.howItWorks.list.second.title")}
								description={ctx.i18next.t("landing.pricing.howItWorks.list.second.description")}
							/>
							<MarketingCard
								title={ctx.i18next.t("landing.pricing.howItWorks.list.third.title")}
								description={ctx.i18next.t("landing.pricing.howItWorks.list.third.description")}
							/>
						</div>
					</div>
				</section>

				<section
					id="faq"
					mix={[
						css({
							padding: "64px 0",
							"@media (min-width: 640px)": { padding: "96px 0" },
							"@media (min-width: 1024px)": { padding: "128px 0" },
						}),
					]}
				>
					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								padding: "0 16px",
								"@media (min-width: 640px)": { padding: "0 24px" },
								"@media (min-width: 1024px)": { padding: "0 32px" },
							}),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.faq.badge")}
							title={ctx.i18next.t("landing.faq.title")}
							description={ctx.i18next.t("landing.faq.description")}
						/>

						<FaqAccordion name="faq" items={FAQS} />
					</div>
				</section>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
