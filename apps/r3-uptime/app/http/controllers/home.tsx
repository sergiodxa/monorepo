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

import { Trans } from "@pkg/i18n/ui";
import { CheckIcon } from "@pkg/lucide-remix";
import { LinkButton } from "@pkg/r3-ui";
import { bg, border, fg, linearGradient } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import {
	flex,
	flexRow,
	flexWrap,
	gap,
	grid,
	gridTemplate,
	inlineFlex,
	items,
	justify,
	vstack,
} from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { m, maxIs, mbe, mbs, p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { color } from "@pkg/u/tokens";
import {
	font,
	fontSize,
	leading,
	textAlign,
	textDecoration,
	tracking,
	weight,
} from "@pkg/u/typography";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** GET / — the public marketing homepage. */
export default createAction(routes.home, async (ctx) => {
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);

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
		<DocumentLayout title={ctx.i18next.t("landing.meta.title")}>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<section
					mix={[
						p("64px", "0"),
						textAlign("center"),
						bg({ image: linearGradient("to bottom", color("brand.tint"), "#ffffff") }),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
						media(
							"(prefers-color-scheme: dark)",
							bg({
								image: linearGradient(
									"to bottom",
									"oklch(0.24 0.06 142 / 0.2)",
									color("neutral.tint"),
								),
							}),
						),
					]}
				>
					<div
						mix={[
							maxIs("1152px"),
							m("0", "auto"),
							p("0", "16px"),
							media("(min-width: 640px)", p("0", "24px")),
							media("(min-width: 1024px)", p("0", "32px")),
						]}
					>
						<span
							mix={[
								inlineFlex(),
								items("center"),
								p("2px", "10px"),
								rounded("999px"),
								fontSize("0.75rem"),
								weight(600),
								border({ color: "brand", width: 1 }),
								bg("brand.tint"),
								fg("brand"),
								mbe("16px"),
								media("(prefers-color-scheme: dark)", [
									border("brand"),
									bg("brand.tint"),
									fg("brand"),
								]),
							]}
						>
							{ctx.i18next.t("landing.hero.pill")}
						</span>
						<h1
							mix={[
								fontSize("2.25rem"),
								weight(700),
								leading(1),
								tracking("tight"),
								m("0", "auto", "16px", "auto"),
								maxIs("760px"),
								fg("neutral.emphasis"),
								media("(min-width: 640px)", fontSize("3rem")),
								media("(min-width: 1024px)", fontSize("3.75rem")),
								media("(prefers-color-scheme: dark)", fg("neutral.emphasis")),
							]}
						>
							<Trans
								i18n={ctx.i18next}
								i18nKey="landing.hero.title"
								components={{
									strong: (
										<span mix={[fg("brand"), media("(prefers-color-scheme: dark)", fg("brand"))]} />
									),
								}}
							/>
						</h1>
						<p
							mix={[
								fontSize("1.125rem"),
								fg("neutral"),
								m("0", "auto", "24px", "auto"),
								maxIs("576px"),
								leading(1.625),
								media("(prefers-color-scheme: dark)", fg("neutral")),
							]}
						>
							{ctx.i18next.t("landing.hero.description")}
						</p>

						<div
							mix={[
								vstack({ gap: "16px", align: "center" }),
								mbs("32px"),
								media("(min-width: 640px)", [flexRow(), justify("center")]),
							]}
						>
							<AuthCta
								isSignedIn={isSignedIn}
								dashboardLabel={ctx.i18next.t("landing.hero.cta.in")}
								startLabel={ctx.i18next.t("landing.hero.cta.out")}
							/>
							<LinkButton href="#pricing" color="neutral" variant="outline" size="lg">
								{ctx.i18next.t("landing.hero.cta.pricing")}
							</LinkButton>
						</div>

						<div
							mix={[flex(), flexWrap("wrap"), justify("center"), gap("8px", "24px"), mbs("32px")]}
						>
							<span
								mix={[
									inlineFlex(),
									items("center"),
									gap("6px"),
									fontSize("0.875rem"),
									fg("neutral.muted"),
									media("(prefers-color-scheme: dark)", fg("neutral.muted")),
								]}
							>
								<CheckIcon size={16} />
								{ctx.i18next.t("landing.hero.trustIndicators.freeToStart")}
							</span>
							<span
								mix={[
									inlineFlex(),
									items("center"),
									gap("6px"),
									fontSize("0.875rem"),
									fg("neutral.muted"),
									media("(prefers-color-scheme: dark)", fg("neutral.muted")),
								]}
							>
								<CheckIcon size={16} />
								{ctx.i18next.t("landing.hero.trustIndicators.payForAutomation")}
							</span>
							<span
								mix={[
									inlineFlex(),
									items("center"),
									gap("6px"),
									fontSize("0.875rem"),
									fg("neutral.muted"),
									media("(prefers-color-scheme: dark)", fg("neutral.muted")),
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
						p("64px", "0"),
						bg("neutral.tint"),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
						media("(prefers-color-scheme: dark)", bg("oklch(0.24 0.005 145 / 0.5)")),
					]}
				>
					<div
						mix={[
							maxIs("1152px"),
							m("0", "auto"),
							p("0", "16px"),
							media("(min-width: 640px)", p("0", "24px")),
							media("(min-width: 1024px)", p("0", "32px")),
						]}
					>
						<div
							mix={[
								grid(),
								gap("32px"),
								gridTemplate({ columns: "repeat(2, 1fr)" }),
								textAlign("center"),
								media("(min-width: 768px)", gridTemplate({ columns: "repeat(4, 1fr)" })),
							]}
						>
							{TRUST_INDICATORS.map((stat) => (
								<div key={stat.label}>
									<div
										mix={[
											fontSize("1.875rem"),
											weight(700),
											leading("2.25rem"),
											font("mono"),
											fg("neutral.emphasis"),
											media("(prefers-color-scheme: dark)", fg("neutral.emphasis")),
										]}
									>
										{stat.value}
									</div>
									<div
										mix={[
											fontSize("0.875rem"),
											fg("neutral"),
											media("(prefers-color-scheme: dark)", fg("neutral")),
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
						p("64px", "0"),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
					]}
				>
					<div
						mix={[
							maxIs("1152px"),
							m("0", "auto"),
							p("0", "16px"),
							media("(min-width: 640px)", p("0", "24px")),
							media("(min-width: 1024px)", p("0", "32px")),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.features.badge")}
							title={ctx.i18next.t("landing.features.title")}
							description={ctx.i18next.t("landing.features.description")}
						/>

						<div
							mix={[
								grid(),
								gap("32px"),
								gridTemplate({ columns: "1fr" }),
								media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
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
						p("64px", "0"),
						bg("neutral.tint"),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
						media("(prefers-color-scheme: dark)", bg("oklch(0.24 0.005 145 / 0.5)")),
					]}
				>
					<div
						mix={[
							maxIs("1152px"),
							m("0", "auto"),
							p("0", "16px"),
							media("(min-width: 640px)", p("0", "24px")),
							media("(min-width: 1024px)", p("0", "32px")),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.completeFeatureSet.badge")}
							title={ctx.i18next.t("landing.completeFeatureSet.title")}
							description={ctx.i18next.t("landing.completeFeatureSet.description")}
						/>

						<div
							mix={[
								grid(),
								gap("32px"),
								gridTemplate({ columns: "1fr" }),
								media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
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
						p("64px", "0"),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
					]}
				>
					<div
						mix={[
							maxIs("1152px"),
							m("0", "auto"),
							p("0", "16px"),
							media("(min-width: 640px)", p("0", "24px")),
							media("(min-width: 1024px)", p("0", "32px")),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.useCases.badge")}
							title={ctx.i18next.t("landing.useCases.title")}
							description={ctx.i18next.t("landing.useCases.description")}
						/>

						<div
							mix={[
								grid(),
								gap("32px"),
								gridTemplate({ columns: "1fr" }),
								media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
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
								p("20px"),
								rounded("12px"),
								border({ color: "neutral", width: 1 }),
								raw({ backgroundColor: "#ffffff" }),
								mbs("24px"),
								textAlign("center"),
								media("(prefers-color-scheme: dark)", [border("neutral"), bg("neutral.tint")]),
							]}
						>
							<p
								mix={[
									fontSize("1.25rem"),
									weight(600),
									leading("1.75rem"),
									m("0", "0", "6px", "0"),
									fg("neutral.emphasis"),
									media("(prefers-color-scheme: dark)", fg("neutral.emphasis")),
								]}
							>
								{ctx.i18next.t("landing.useCases.tailoredFor")}
							</p>
							<div
								mix={[flex(), flexWrap("wrap"), justify("center"), gap("8px", "24px"), mbs("32px")]}
							>
								{AUDIENCE_LINKS.map((audience) => (
									<a
										key={audience.slug}
										href={routes.marketing.audience.href({ slug: audience.slug })}
										mix={[
											fontSize("0.875rem"),
											fg("neutral"),
											textDecoration("none"),
											hover(fg("brand")),
											media("(prefers-color-scheme: dark)", [fg("neutral"), hover(fg("brand"))]),
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
						p("64px", "0"),
						bg("neutral.tint"),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
						media("(prefers-color-scheme: dark)", bg("oklch(0.24 0.005 145 / 0.5)")),
					]}
				>
					<div
						mix={[
							maxIs("1152px"),
							m("0", "auto"),
							p("0", "16px"),
							media("(min-width: 640px)", p("0", "24px")),
							media("(min-width: 1024px)", p("0", "32px")),
						]}
					>
						<SectionHeader
							badge={ctx.i18next.t("landing.pricing.badge")}
							title={ctx.i18next.t("landing.pricing.title")}
							description={ctx.i18next.t("landing.pricing.description")}
						/>

						<div
							mix={[
								grid(),
								gap("32px"),
								gridTemplate({ columns: "1fr" }),
								media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
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
						p("64px", "0"),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
					]}
				>
					<div
						mix={[
							maxIs("1152px"),
							m("0", "auto"),
							p("0", "16px"),
							media("(min-width: 640px)", p("0", "24px")),
							media("(min-width: 1024px)", p("0", "32px")),
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
