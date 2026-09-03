/**
 * `/vs/:slug` controller. Renders the comparison page for the slug found in
 * `resources/content/marketing.ts`'s `comparisons` record, extending the
 * generic marketing page shape with a comparison table plus the optional
 * honest-take, "perfect for", and cost-table sections a competitor's record
 * supplies. An unknown slug renders the standard 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";

import { CheckIcon, TriangleAlertIcon } from "@sdxc/icons";
import { bg, border, fg, linearGradient } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { counterReset } from "@sdxc/u/general";
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
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { dark, media } from "@sdxc/u/responsive";
import { m, maxIs, mbe, mbs, mi, p, pb, pi } from "@sdxc/u/size";
import { font, fontSize, leading, textAlign, tracking, weight } from "@sdxc/u/typography";
import { Heading, Table } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { MarketingContent } from "~/resources/content/marketing";

import { getViewer } from "~/app/http/middleware/auth";
import { monthlyCostForUsage } from "~/app/lib/pricing";
import { getSoftwareApplicationSchema, SEO } from "~/app/lib/seo";
import AuthCta from "~/resources/components/marketing/auth-cta";
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import MarketingStep from "~/resources/components/marketing/step";
import { comparisons } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/**
 * Vertical section padding shared by every full-width section: 64px, growing to
 * 96px at ≥640px and 128px at ≥1024px.
 */
function sectionPadding() {
	return [pb(16), media("(min-width: 640px)", pb(24)), media("(min-width: 1024px)", pb(32))];
}

/**
 * Centered content wrapper shared by the full-width sections: capped at 1152px,
 * horizontally centered, with 16/24/32px side padding by breakpoint.
 */
function marketingContainer() {
	return [
		maxIs("1152px"),
		mi("auto"),
		pi(4),
		media("(min-width: 640px)", pi(6)),
		media("(min-width: 1024px)", pi(8)),
	];
}

/**
 * Narrower variant of {@link marketingContainer} for the prose-shaped sections
 * (honest take, "perfect for" banner, cost table), which read as a single
 * column of argument and would stretch past a comfortable measure at 1152px.
 */
function narrowContainer() {
	return [
		maxIs("896px"),
		mi("auto"),
		pi(4),
		media("(min-width: 640px)", pi(6)),
		media("(min-width: 1024px)", pi(8)),
	];
}

/**
 * The one/two/three-column ladder every grid on this page shares. `css()`
 * layers each mixin's class by first appearance in the document, so sharing
 * one ladder keeps every grid's media rules in matching ascending order.
 */
function responsiveGrid() {
	return [
		gridTemplate({ columns: "1fr" }),
		media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
		media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
	];
}

/**
 * Background for the alternating sections: one palette step off the page's own
 * `--ui-neutral-bg-tint` body color, since the semantic `bg("neutral.tint")`
 * token resolves to that same body color and would hide the alternation.
 */
function tintedSection() {
	return [bg("color.neutral.100"), dark(bg("color.neutral.900"))];
}

/** Formats a monthly USD price in `locale`, keeping cents only when there are any. */
function formatMonthlyUsd(locale: string, amount: number): string {
	return amount.toLocaleString(locale, {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	});
}

/**
 * What we charge for a cost-comparison row: computed from `app/lib/pricing.ts`
 * using the row's own `usage`, so every table tracks the live pricing model.
 * Falls back to the row's authored `ourCost` for seat-priced scenarios.
 */
function ourCostFor(row: MarketingContent.PricingScenario, locale: string): string {
	if (row.usage) return `${formatMonthlyUsd(locale, monthlyCostForUsage(row.usage).totalUsd)}/mo`;
	return row.ourCost ?? "—";
}

/**
 * What the row wins on: the yearly difference when the competitor's price is one
 * subtractable number and we come out cheaper, otherwise the row's own note. Never
 * both — a row claiming a saving and a qualitative win at once reads as padding.
 */
function savingsFor(row: MarketingContent.PricingScenario, locale: string, t: TFunction): string {
	if (row.usage && row.theirCostUsd !== undefined) {
		let yearly = (row.theirCostUsd - monthlyCostForUsage(row.usage).totalUsd) * 12;
		if (yearly > 0) {
			return t("landing.comparison.pricing.savingsPerYear", {
				amount: formatMonthlyUsd(locale, Math.round(yearly)),
			});
		}
	}

	return row.savingsNote ?? "";
}

/**
 * The CTA button row: stacked and centered below 640px, side-by-side and centered
 * at ≥640px.
 */
function ctaRow() {
	return [
		vstack({ gap: 4, align: "center" }),
		mbs(8),
		media("(min-width: 640px)", [flexRow(), justify("center")]),
	];
}

/** GET /vs/:slug — a competitor comparison marketing page. */
export default createAction(routes.marketing.comparison, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);
	let t = ctx.i18next.t;

	let content = comparisons[slug];
	if (!content) {
		let props = {
			title: t("notFound.title"),
			description: t("notFound.description"),
		};
		return ctx.render(
			<DocumentLayout title={props.title}>
				<NotFoundView {...props} goBackHomeLabel={t("notFound.goBackHome")} />
			</DocumentLayout>,
			{ status: 404 },
		);
	}

	let {
		badge,
		title,
		highlight,
		description,
		highlights,
		competitor,
		summary,
		rows,
		features,
		honestTake,
		perfectFor,
		pricingScenarios,
		steps,
		faqs,
	} = content;

	return ctx.render(
		<DocumentLayout
			title={content.metaTitle}
			locale={ctx.locale}
			seo={{
				description: content.metaDescription,
				canonical: SEO.canonical(ctx.url),
				schema: [
					getSoftwareApplicationSchema({
						name: t("landing.comparison.tableProductHeader"),
						description: content.metaDescription,
						featureList: features.map((feature) => feature.title),
					}),
					SEO.schema.faq(faqs),
				],
			}}
		>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<section
					mix={[
						...sectionPadding(),
						textAlign("center"),
						bg({
							image: linearGradient(
								"to bottom",
								"var(--ui-brand-bg-tint)",
								"var(--ui-neutral-bg-tint)",
							),
						}),
					]}
				>
					<div mix={[...marketingContainer()]}>
						<span
							mix={[
								inlineFlex(),
								items("center"),
								p("2px", "10px"),
								rounded("999px"),
								fontSize("xs"),
								weight(600),
								border({ color: "brand", width: 1 }),
								bg("brand.tint"),
								fg("brand"),
								mbe(4),
							]}
						>
							{badge}
						</span>

						<Heading
							level={1}
							mix={[
								fontSize("4xl"),
								weight(700),
								leading(1.1),
								tracking("tight"),
								m(0, "auto", 4, "auto"),
								maxIs("760px"),
								media("(min-width: 640px)", fontSize("5xl")),
								media("(min-width: 1024px)", fontSize("6xl")),
							]}
						>
							{title} <span mix={[fg("brand")]}>{highlight}</span>
						</Heading>

						<p
							mix={[
								m(0, "auto", 6, "auto"),
								maxIs("576px"),
								fontSize("lg"),
								leading(1.625),
								fg("neutral"),
							]}
						>
							{description}
						</p>

						<div mix={[flex(), flexWrap("wrap"), justify("center"), gap(2, 6), mbs(8)]}>
							{highlights.map((item) => (
								<span
									key={item}
									mix={[
										inlineFlex(),
										items("center"),
										gap("6px"),
										fontSize("sm"),
										fg("neutral.muted"),
									]}
								>
									<CheckIcon size={16} strokeWidth={2} mix={[fg("success")]} />
									{item}
								</span>
							))}
						</div>

						<div mix={[...ctaRow()]}>
							<AuthCta
								isSignedIn={isSignedIn}
								startLabel={chrome.startLabel}
								dashboardLabel={chrome.dashboardLabel}
							/>
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader
							title={t("landing.comparison.tableLabel", { competitor })}
							description={summary}
						/>

						<Table.Container>
							<Table aria-label={t("landing.comparison.tableLabel", { competitor })}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{t("landing.comparison.tableCategoryHeader")}</Table.Column>
										<Table.Column align="center">
											{t("landing.comparison.tableProductHeader")}
										</Table.Column>
										<Table.Column align="center">{competitor}</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{rows.map((row) => (
										<Table.Row key={row.label}>
											<Table.Cell mix={[weight(500)]}>{row.label}</Table.Cell>
											<Table.Cell mix={[textAlign("center"), weight(600), fg("brand")]}>
												{row.us}
											</Table.Cell>
											<Table.Cell mix={[textAlign("center"), fg("neutral")]}>{row.them}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					</div>
				</section>

				<section mix={[...sectionPadding(), ...tintedSection()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader title={t("landing.comparison.whyTeamsSwitchTitle")} />

						<div mix={[grid(), gap(8), ...responsiveGrid()]}>
							{features.map((feature) => (
								<MarketingCard
									key={feature.title}
									title={feature.title}
									description={feature.description}
								/>
							))}
						</div>
					</div>
				</section>

				{honestTake && honestTake.length > 0 && (
					<section mix={[...sectionPadding()]}>
						<div mix={[...narrowContainer()]}>
							<SectionHeader
								badge={t("landing.comparison.honestTake.badge")}
								title={t("landing.comparison.honestTake.title", { competitor })}
								description={t("landing.comparison.honestTake.description", { competitor })}
							/>

							<div mix={[vstack({ gap: 6 })]}>
								{honestTake.map((item) => (
									<div
										key={item.title}
										mix={[
											flex(),
											gap(4),
											p(6),
											rounded("xl"),
											border({ color: "warning", width: 1 }),
											bg("warning.tint"),
										]}
									>
										<TriangleAlertIcon
											size={24}
											strokeWidth={1.5}
											mix={[shrink(0), fg("warning")]}
										/>
										<div>
											<Heading
												level={3}
												mix={[m(0), fontSize("base"), weight(600), fg("neutral.emphasis")]}
											>
												{item.title}
											</Heading>
											<p mix={[m(0), mbs(2), leading(1.625), fg("neutral")]}>{item.description}</p>
										</div>
									</div>
								))}
							</div>
						</div>
					</section>
				)}

				{perfectFor && (
					<section mix={[...sectionPadding(), ...tintedSection()]}>
						<div mix={[...narrowContainer()]}>
							<div
								mix={[
									overflow("hidden"),
									rounded("xl"),
									shadow("xl"),
									p(8),
									textAlign("center"),
									bg({
										image: linearGradient(
											"to bottom right",
											"var(--ui-brand-bg-solid)",
											"var(--ui-brand-bg-solid-hover)",
										),
									}),
									fg("brand.onSolid"),
									media("(min-width: 640px)", p(12)),
								]}
							>
								<Heading
									level={2}
									mix={[
										m(0),
										fontSize("2xl"),
										weight(700),
										tracking("tight"),
										fg("brand.onSolid"),
										media("(min-width: 640px)", fontSize("3xl")),
									]}
								>
									{perfectFor.title}
								</Heading>

								<p mix={[m(0, "auto"), mbs(4), maxIs("672px"), fontSize("lg"), leading(1.625)]}>
									{perfectFor.description}
								</p>

								{perfectFor.highlights.length > 0 && (
									<div mix={[flex(), flexWrap("wrap"), justify("center"), gap(4), mbs(8)]}>
										{perfectFor.highlights.map((item) => (
											<span
												key={item}
												mix={[
													inlineFlex(),
													items("center"),
													gap(2),
													p(2, 4),
													rounded("999px"),
													bg("color-mix(in oklab, currentColor 15%, transparent)"),
													fontSize("sm"),
												]}
											>
												<CheckIcon size={16} strokeWidth={2} />
												{item}
											</span>
										))}
									</div>
								)}
							</div>
						</div>
					</section>
				)}

				{pricingScenarios && pricingScenarios.length > 0 && (
					<section mix={[...sectionPadding()]}>
						<div mix={[...narrowContainer()]}>
							<SectionHeader
								badge={t("landing.comparison.pricing.badge")}
								title={t("landing.comparison.pricing.title")}
								description={t("landing.comparison.pricing.description")}
							/>

							<Table.Container>
								<Table aria-label={t("landing.comparison.pricing.tableLabel", { competitor })}>
									<Table.Header>
										<Table.Row>
											<Table.Column>{t("landing.comparison.pricing.scenarioHeader")}</Table.Column>
											<Table.Column align="center">{competitor}</Table.Column>
											<Table.Column align="center">
												{t("landing.comparison.tableProductHeader")}
											</Table.Column>
											<Table.Column align="center">
												{t("landing.comparison.pricing.savingsHeader")}
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{pricingScenarios.map((row) => (
											<Table.Row key={row.scenario}>
												<Table.Cell mix={[weight(500)]}>{row.scenario}</Table.Cell>
												<Table.Cell
													mix={[textAlign("center"), font("mono"), fontSize("sm"), fg("neutral")]}
												>
													{row.theirCost}
												</Table.Cell>
												<Table.Cell
													mix={[
														textAlign("center"),
														font("mono"),
														fontSize("sm"),
														weight(600),
														fg("brand"),
													]}
												>
													{ourCostFor(row, ctx.locale)}
												</Table.Cell>
												<Table.Cell
													mix={[
														textAlign("center"),
														font("mono"),
														fontSize("sm"),
														weight(600),
														fg("success"),
													]}
												>
													{savingsFor(row, ctx.locale, t)}
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table>
							</Table.Container>

							<p mix={[m(0), mbs(6), textAlign("center"), fontSize("sm"), fg("neutral.muted")]}>
								{t("landing.comparison.pricing.footnote", { competitor })}
							</p>
						</div>
					</section>
				)}

				<section mix={[...sectionPadding(), ...tintedSection()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader title={t("landing.comparison.gettingStartedTitle")} />

						<div mix={[grid(), gap(6), counterReset("marketing-step"), ...responsiveGrid()]}>
							{steps.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section mix={[...sectionPadding()]}>
					<div mix={[...marketingContainer()]}>
						<SectionHeader badge={t("landing.faq.badge")} title={t("landing.faq.title")} />

						<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
					</div>
				</section>

				<section
					mix={[
						pb(14),
						textAlign("center"),
						bg({
							image: linearGradient(
								"to right",
								"var(--ui-brand-bg-solid)",
								"var(--ui-brand-bg-solid-hover)",
							),
						}),
						fg("brand.onSolid"),
					]}
				>
					<div mix={[...marketingContainer()]}>
						<Heading
							level={2}
							mix={[m(0), fontSize("3xl"), weight(700), tracking("tight"), fg("brand.onSolid")]}
						>
							{t("landing.comparison.finalCtaTitle")}
						</Heading>
						<p mix={[m(0, "auto"), mbs(4), maxIs("576px"), fontSize("lg"), leading(1.625)]}>
							{t("landing.finalCta.body")}
						</p>

						<div mix={[...ctaRow()]}>
							<AuthCta
								isSignedIn={isSignedIn}
								startLabel={chrome.startLabel}
								dashboardLabel={chrome.dashboardLabel}
								color="neutral"
							/>
						</div>
					</div>
				</section>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
