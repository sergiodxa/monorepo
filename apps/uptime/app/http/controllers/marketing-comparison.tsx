/**
 * `/vs/:slug` controller. Renders the comparison page for the slug found in
 * `resources/content/marketing.ts`'s `comparisons` record: the head-to-head table, the
 * reasons to switch, the honest take, the cost comparison and the other comparisons.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { ArrowRightIcon, Icon, TriangleAlertIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flexWrap, gap, hstack, inlineFlex, items, justify, vstack } from "@sdxc/u/layout";
import { mbs } from "@sdxc/u/size";
import { font, text, textAlign, weight } from "@sdxc/u/typography";
import { Feature, LinkButton, MarketingHeader, MarketingSection, Table } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	CheckList,
	CheckRow,
	FaqBand,
	FeatureBand,
	LandingHero,
	StepList,
} from "@sdxc/ui/patterns";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { MarketingContent } from "~/resources/content/marketing";

import { getViewer } from "~/app/http/middleware/auth";
import { getSoftwareApplicationSchema, SEO } from "~/app/initializers/seo";
import { monthlyCostForUsage } from "~/config/pricing";
import AuthCta from "~/resources/components/marketing/auth-cta";
import ClosingBand from "~/resources/components/marketing/closing-band";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import { comparisons } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

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
 * What we charge for a cost-comparison row: computed from `config/pricing.ts`
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
function savingsFor(row: MarketingContent.PricingScenario, locale: string, t: Translate): string {
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
 * Column count that fills every row of a grid of `count` cells: three when it divides
 * evenly, otherwise two, so a list of two or four never strands a cell on its last row.
 */
function columnsFor(count: number): Feature.Columns {
	return count % 3 === 0 ? 3 : 2;
}

/** GET /vs/:slug — a competitor comparison marketing page. */
export default createAction(routes.marketing.comparison, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.intl.t);
	let t = ctx.intl.t;

	let content = comparisons[slug];
	if (!content) {
		let props = {
			title: t("notFound.title"),
			description: t("notFound.description"),
		};
		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={props.title}>
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

	let scenarios = pricingScenarios ?? [];

	/** Every other comparison, in the record's order, so a visitor can move between them. */
	let OTHER_COMPARISONS = Object.values(comparisons)
		.filter((page) => page.slug !== slug)
		.map((page) => ({
			href: routes.marketing.comparison.href({ slug: page.slug }),
			label: page.competitor,
		}));

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
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
				<LandingHero
					tone="tinted"
					align="center"
					entrance
					eyebrow={badge}
					eyebrowVariant="pill"
					title={
						<>
							{title} <AccentText>{highlight}</AccentText>
						</>
					}
					description={description}
					actions={
						<div mix={[vstack({ gap: 6, align: "center" })]}>
							<div mix={[inlineFlex(), flexWrap(), items("center"), justify("center"), gap(3)]}>
								<AuthCta
									isSignedIn={isSignedIn}
									startLabel={chrome.startLabel}
									dashboardLabel={chrome.dashboardLabel}
									icon={<ArrowRightIcon size={20} strokeWidth={1.5} aria-hidden="true" />}
								/>
								{scenarios.length > 0 ? (
									<LinkButton href="#pricing" color="neutral" variant="outline" size="lg">
										{t("landing.comparison.costLink")}
									</LinkButton>
								) : null}
							</div>
							<CheckList orientation="horizontal" mix={[justify("center")]}>
								{highlights.map((item) => (
									<CheckRow key={item}>{item}</CheckRow>
								))}
							</CheckList>
						</div>
					}
				/>

				<MarketingSection id="compare" mix={[viewReveal()]}>
					<MarketingHeader description={summary} align="center">
						{t("landing.comparison.tableTitle", { competitor })}
					</MarketingHeader>

					<Table.Container>
						<Table aria-label={t("landing.comparison.tableLabel", { competitor })}>
							<Table.Header>
								<Table.Row>
									<Table.Column>{t("landing.comparison.tableCategoryHeader")}</Table.Column>
									<Table.Column>{t("landing.comparison.tableProductHeader")}</Table.Column>
									<Table.Column>{competitor}</Table.Column>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{rows.map((row) => (
									<Table.Row key={row.label}>
										<Table.Cell mix={[weight(500), fg("neutral.emphasis")]}>{row.label}</Table.Cell>
										<Table.Cell mix={[weight(600), fg("brand")]}>{row.us}</Table.Cell>
										<Table.Cell mix={[fg("neutral")]}>{row.them}</Table.Cell>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					</Table.Container>
				</MarketingSection>

				<MarketingSection tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader align="center">
						{t("landing.comparison.whyTeamsSwitchTitle")}
					</MarketingHeader>
					<Feature.Grid columns={columnsFor(features.length)}>
						{features.map((feature) => (
							<Feature key={feature.title}>
								{feature.icon ? (
									<Feature.Icon tone="brand">
										<Icon name={feature.icon} size={20} strokeWidth={1.5} aria-hidden="true" />
									</Feature.Icon>
								) : null}
								<Feature.Title>{feature.title}</Feature.Title>
								<Feature.Description>{feature.description}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				{honestTake && honestTake.length > 0 ? (
					<MarketingSection mix={[viewReveal()]}>
						<MarketingHeader
							eyebrow={t("landing.comparison.honestTake.badge")}
							description={t("landing.comparison.honestTake.description", { competitor })}
							align="center"
						>
							{t("landing.comparison.honestTake.title", { competitor })}
						</MarketingHeader>
						<Feature.Grid variant="list" columns={columnsFor(honestTake.length)}>
							{honestTake.map((item) => (
								<Feature key={item.title}>
									<Feature.Icon>
										<TriangleAlertIcon
											size={20}
											strokeWidth={1.5}
											aria-hidden="true"
											mix={[fg("warning")]}
										/>
									</Feature.Icon>
									<Feature.Title>{item.title}</Feature.Title>
									<Feature.Description>{item.description}</Feature.Description>
								</Feature>
							))}
						</Feature.Grid>
					</MarketingSection>
				) : null}

				{perfectFor ? (
					<MarketingSection tone="tinted" inset spacing="compact" mix={[viewReveal()]}>
						<MarketingHeader description={perfectFor.description} align="center">
							{perfectFor.title}
						</MarketingHeader>
						{perfectFor.highlights.length > 0 ? (
							<CheckList orientation="horizontal" mix={[justify("center")]}>
								{perfectFor.highlights.map((item) => (
									<CheckRow key={item}>{item}</CheckRow>
								))}
							</CheckList>
						) : null}
					</MarketingSection>
				) : null}

				{scenarios.length > 0 ? (
					<MarketingSection id="pricing" mix={[viewReveal()]}>
						<MarketingHeader
							eyebrow={t("landing.comparison.pricing.badge")}
							description={t("landing.comparison.pricing.description")}
							align="center"
						>
							{t("landing.comparison.pricing.title")}
						</MarketingHeader>

						<Table.Container>
							<Table aria-label={t("landing.comparison.pricing.tableLabel", { competitor })}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{t("landing.comparison.pricing.scenarioHeader")}</Table.Column>
										<Table.Column>{competitor}</Table.Column>
										<Table.Column>{t("landing.comparison.tableProductHeader")}</Table.Column>
										<Table.Column>{t("landing.comparison.pricing.savingsHeader")}</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{scenarios.map((row) => (
										<Table.Row key={row.scenario}>
											<Table.Cell mix={[weight(500), fg("neutral.emphasis")]}>
												{row.scenario}
											</Table.Cell>
											<Table.Cell mix={[font("mono"), text("sm"), fg("neutral")]}>
												{row.theirCost}
											</Table.Cell>
											<Table.Cell mix={[font("mono"), text("sm"), weight(600), fg("brand")]}>
												{ourCostFor(row, ctx.locale)}
											</Table.Cell>
											<Table.Cell mix={[font("mono"), text("sm"), weight(600), fg("success")]}>
												{savingsFor(row, ctx.locale, t)}
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>

						<p mix={[mbs(6), textAlign("center"), text("sm"), fg("neutral.muted")]}>
							{t("landing.comparison.pricing.footnote", { competitor })}
						</p>
					</MarketingSection>
				) : null}

				<FeatureBand
					layout="steps"
					tone="tinted"
					title={t("landing.comparison.gettingStartedTitle")}
					mix={[viewReveal()]}
				>
					{steps.map((step) => (
						<StepList.Item key={step.title} title={step.title}>
							{step.description}
						</StepList.Item>
					))}
				</FeatureBand>

				<FaqBand
					columns={1}
					eyebrow={t("landing.faq.badge")}
					title={t("landing.faq.title")}
					mix={[viewReveal()]}
				>
					<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
				</FaqBand>

				<MarketingSection spacing="compact" mix={[viewReveal()]}>
					<div mix={[vstack({ gap: 4, align: "center" })]}>
						<p mix={[text("sm"), textAlign("center")]}>{t("landing.comparison.othersTitle")}</p>
						<div mix={[hstack({ gap: 3 }), flexWrap(), justify("center")]}>
							{OTHER_COMPARISONS.map((other) => (
								<LinkButton
									key={other.href}
									href={other.href}
									prefetch="intent"
									color="neutral"
									variant="surface"
								>
									{other.label}
								</LinkButton>
							))}
						</div>
					</div>
				</MarketingSection>

				<ClosingBand
					id="start"
					isSignedIn={isSignedIn}
					title={t("landing.comparison.finalCtaTitle")}
					description={t("landing.finalCta.body")}
					startLabel={chrome.startLabel}
					dashboardLabel={chrome.dashboardLabel}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
