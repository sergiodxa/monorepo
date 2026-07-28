/**
 * `/vs/:slug` controller. Looks up the slug in `resources/content/marketing.ts`'s
 * `comparisons` record and renders the generic marketing page shape (hero, features,
 * how it works, FAQ, final CTA) extended with a head-to-head comparison table against
 * the named competitor; an unknown slug renders the same 404 the router's
 * `defaultHandler` uses. One controller covers all 10 comparison pages instead of one
 * file per page — see the content module's docblock for why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CheckIcon } from "@pkg/lucide-remix";
import { Table } from "@pkg/r3-ui";
import { bg, border, fg, linearGradient } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { counterReset } from "@pkg/u/general";
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
import { fontSize, leading, textAlign, tracking, weight } from "@pkg/u/typography";
import * as s from "remix/data-schema";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
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

/** Neutral (silver) scale shades used on this page, hue 250. */
const neutral = {
	50: "oklch(0.98 0.004 250)",
	200: "oklch(0.91 0.008 250)",
	400: "oklch(0.73 0.013 250)",
	500: "oklch(0.62 0.014 250)",
	600: "oklch(0.52 0.014 250)",
	800: "oklch(0.32 0.01 250)",
	900: "oklch(0.24 0.008 250)",
	950: "oklch(0.16 0.006 250)",
};

/** Primary (emerald brand) scale shades used on this page, hue 162. */
const primary = {
	50: "oklch(0.98 0.02 162)",
	200: "oklch(0.92 0.08 162)",
	400: "oklch(0.78 0.16 162)",
	600: "oklch(0.6 0.128 162)",
	700: "oklch(0.5 0.107 162)",
	800: "oklch(0.42 0.09 162)",
	950: "oklch(0.24 0.051 162)",
};

/** GET /vs/:slug — a competitor comparison marketing page. */
export default createAction(routes.marketing.comparison, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let isSignedIn = getViewer() !== null;
	let chrome = buildMarketingChrome(ctx.i18next.t);

	let content = comparisons[slug];
	if (!content) {
		let props = {
			title: ctx.i18next.t("notFound.title"),
			description: ctx.i18next.t("notFound.description"),
		};
		return ctx.render(
			<DocumentLayout title={props.title}>
				<NotFoundView {...props} goBackHomeLabel={ctx.i18next.t("notFound.goBackHome")} />
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
		steps,
		faqs,
	} = content;

	return ctx.render(
		<DocumentLayout title={`${content.metaTitle}`}>
			<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
				<section
					mix={[
						p("64px", "0"),
						textAlign("center"),
						bg({ image: linearGradient("to bottom", primary[50], "#ffffff") }),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
						media(
							"(prefers-color-scheme: dark)",
							bg({
								image: linearGradient("to bottom", "oklch(0.24 0.051 162 / 0.2)", neutral[950]),
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
								border({ color: primary[200], width: 1 }),
								bg(primary[50]),
								fg(primary[600]),
								mbe("16px"),
								media("(prefers-color-scheme: dark)", [
									border(primary[800]),
									bg(primary[950]),
									fg(primary[400]),
								]),
							]}
						>
							{badge}
						</span>
						<h1
							mix={[
								fontSize("2.25rem"),
								weight(700),
								leading(1),
								tracking("tight"),
								m("0", "auto", "16px", "auto"),
								maxIs("760px"),
								fg(neutral[900]),
								media("(min-width: 640px)", fontSize("3rem")),
								media("(min-width: 1024px)", fontSize("3.75rem")),
								media("(prefers-color-scheme: dark)", fg(neutral[50])),
							]}
						>
							{title}{" "}
							<span
								mix={[fg(primary[600]), media("(prefers-color-scheme: dark)", fg(primary[400]))]}
							>
								{highlight}
							</span>
						</h1>
						<p
							mix={[
								fontSize("1.125rem"),
								fg(neutral[600]),
								m("0", "auto", "24px", "auto"),
								maxIs("576px"),
								leading(1.625),
								media("(prefers-color-scheme: dark)", fg(neutral[400])),
							]}
						>
							{description}
						</p>

						<div
							mix={[flex(), flexWrap("wrap"), justify("center"), gap("8px", "24px"), mbs("32px")]}
						>
							{highlights.map((item) => (
								<span
									key={item}
									mix={[
										inlineFlex(),
										items("center"),
										gap("6px"),
										fontSize("0.875rem"),
										fg(neutral[500]),
										media("(prefers-color-scheme: dark)", fg(neutral[400])),
									]}
								>
									<CheckIcon size={16} />
									{item}
								</span>
							))}
						</div>

						<div
							mix={[
								vstack({ gap: "16px", align: "center" }),
								mbs("32px"),
								media("(min-width: 640px)", [flexRow(), justify("center")]),
							]}
						>
							<AuthCta
								isSignedIn={isSignedIn}
								startLabel={chrome.startLabel}
								dashboardLabel={chrome.dashboardLabel}
							/>
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
						<SectionHeader title={`Uptime vs ${competitor}`} description={summary} />

						<Table.Container>
							<Table aria-label={`Uptime vs ${competitor}`}>
								<Table.Header>
									<Table.Row>
										<Table.Column>
											{ctx.i18next.t("landing.comparison.tableCategoryHeader")}
										</Table.Column>
										<Table.Column align="center">
											{ctx.i18next.t("landing.comparison.tableProductHeader")}
										</Table.Column>
										<Table.Column align="center">{competitor}</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{rows.map((row) => (
										<Table.Row key={row.label}>
											<Table.Cell>{row.label}</Table.Cell>
											<Table.Cell align="center">{row.us}</Table.Cell>
											<Table.Cell align="center">{row.them}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					</div>
				</section>

				<section
					mix={[
						p("64px", "0"),
						bg(neutral[50]),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
						media("(prefers-color-scheme: dark)", bg("oklch(0.24 0.008 250 / 0.5)")),
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
						<SectionHeader title={ctx.i18next.t("landing.comparison.whyTeamsSwitchTitle")} />

						<div
							mix={[
								grid(),
								gap("32px"),
								gridTemplate({ columns: "1fr" }),
								media("(min-width: 768px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
							]}
						>
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
						<SectionHeader title={ctx.i18next.t("landing.comparison.gettingStartedTitle")} />

						<div
							mix={[
								grid(),
								gap("24px"),
								[gridTemplate({ columns: "1fr" }), counterReset("marketing-step")],
								media("(min-width: 640px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
								media("(min-width: 1024px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
							]}
						>
							{steps.map((step) => (
								<MarketingStep key={step.title} title={step.title} description={step.description} />
							))}
						</div>
					</div>
				</section>

				<section
					mix={[
						p("64px", "0"),
						bg(neutral[50]),
						media("(min-width: 640px)", p("96px", "0")),
						media("(min-width: 1024px)", p("128px", "0")),
						media("(prefers-color-scheme: dark)", bg("oklch(0.24 0.008 250 / 0.5)")),
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
						/>

						<FaqAccordion items={faqs.map((faq) => ({ ...faq }))} />
					</div>
				</section>

				<section
					mix={[
						p("56px", "0"),
						textAlign("center"),
						bg({ image: linearGradient("to right", primary[600], primary[700]) }),
						fg("#ffffff"),
					]}
				>
					<h2>{ctx.i18next.t("landing.comparison.finalCtaTitle")}</h2>
					<p>{ctx.i18next.t("landing.finalCta.body")}</p>

					<div
						mix={[
							vstack({ gap: "16px", align: "center" }),
							mbs("32px"),
							media("(min-width: 640px)", [flexRow(), justify("center")]),
						]}
					>
						<AuthCta
							isSignedIn={isSignedIn}
							startLabel={chrome.startLabel}
							dashboardLabel={chrome.dashboardLabel}
						/>
					</div>
				</section>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
