/**
 * `/vs/:slug` controller. Renders the comparison page for the slug found in
 * `resources/content/marketing.ts`'s `comparisons` record, extending the generic
 * marketing page shape with a comparison table plus the optional honest-take,
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { CheckIcon, TriangleAlertIcon } from "@sdxc/icons";
import { bg, border, fg, linearGradient } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { flex, flexWrap, gap, inlineFlex, items, justify, shrink, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { m, maxIs, mbs, p } from "@sdxc/u/size";
import { font, fontSize, leading, textAlign, weight } from "@sdxc/u/typography";
import { Heading, MarketingSection, Table } from "@sdxc/ui";
import {
	AccentText,
	CheckList,
	CheckRow,
	ClosingCta,
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
import MarketingCard from "~/resources/components/marketing/card";
import FaqAccordion from "~/resources/components/marketing/faq-accordion";
import SectionHeader from "~/resources/components/marketing/section-header";
import { comparisons } from "~/resources/content/marketing";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import NotFoundView from "~/resources/views/not-found";
import routes from "~/routes/web";

/**
 * Narrower measure for prose-shaped comparison sections (honest take, "perfect
 * for" banner, cost table) so a single column of argument stays readable.
 */
function narrowParts() {
	return { container: [maxIs("896px")] };
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
					eyebrow={badge}
					eyebrowVariant="pill"
					title={
						<>
							{title} <AccentText>{highlight}</AccentText>
						</>
					}
					description={description}
					actions={
						<AuthCta
							isSignedIn={isSignedIn}
							startLabel={chrome.startLabel}
							dashboardLabel={chrome.dashboardLabel}
						/>
					}
					below={
						<CheckList orientation="horizontal">
							{highlights.map((item) => (
								<CheckRow key={item}>{item}</CheckRow>
							))}
						</CheckList>
					}
				/>

				<MarketingSection>
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
				</MarketingSection>

				<FeatureBand
					layout="grid"
					columns={3}
					tone="tinted"
					title={t("landing.comparison.whyTeamsSwitchTitle")}
				>
					{features.map((feature) => (
						<MarketingCard
							key={feature.title}
							title={feature.title}
							description={feature.description}
						/>
					))}
				</FeatureBand>

				{honestTake && honestTake.length > 0 ? (
					<MarketingSection parts={narrowParts()}>
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
									<TriangleAlertIcon size={24} strokeWidth={1.5} mix={[shrink(0), fg("warning")]} />
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
					</MarketingSection>
				) : null}

				{perfectFor ? (
					<MarketingSection tone="tinted" parts={narrowParts()}>
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
							<Heading level={2} size="chapter" mix={[m(0), fg("brand.onSolid")]}>
								{perfectFor.title}
							</Heading>

							<p mix={[m(0, "auto"), mbs(4), maxIs("672px"), fontSize("lg"), leading(1.625)]}>
								{perfectFor.description}
							</p>

							{perfectFor.highlights.length > 0 ? (
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
							) : null}
						</div>
					</MarketingSection>
				) : null}

				{pricingScenarios && pricingScenarios.length > 0 ? (
					<MarketingSection parts={narrowParts()}>
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
					</MarketingSection>
				) : null}

				<FeatureBand
					layout="steps"
					tone="tinted"
					title={t("landing.comparison.gettingStartedTitle")}
				>
					{steps.map((step) => (
						<StepList.Item key={step.title} title={step.title}>
							{step.description}
						</StepList.Item>
					))}
				</FeatureBand>

				<FaqBand columns={1} eyebrow={t("landing.faq.badge")} title={t("landing.faq.title")}>
					<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
				</FaqBand>

				<ClosingCta
					tone="plain"
					title={t("landing.comparison.finalCtaTitle")}
					description={t("landing.finalCta.body")}
					mix={[
						bg({
							image: linearGradient(
								"to right",
								"var(--ui-brand-bg-solid)",
								"var(--ui-brand-bg-solid-hover)",
							),
						}),
						fg("brand.onSolid"),
					]}
					parts={{
						title: [fg("brand.onSolid")],
						description: [fg("brand.onSolid")],
					}}
					actions={
						<AuthCta
							isSignedIn={isSignedIn}
							startLabel={chrome.startLabel}
							dashboardLabel={chrome.dashboardLabel}
							color="neutral"
						/>
					}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
