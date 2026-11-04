/**
 * The comparison page at `/vs/:slug`: an honest table against one other reader, the reasons
 * to switch, where the other reader is the better choice, and how a list moves across with
 * OPML. Each table holds only rows confirmed on the other product's own pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Trans } from "@sdxc/i18n/ui";
import { TriangleAlertIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { weight } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import { Table } from "@sdxc/ui/app";
import {
	AccentText,
	ClosingCta,
	FaqBand,
	Feature,
	FeatureBand,
	LandingHeader,
	LandingHero,
	LandingSection,
	StepList,
} from "@sdxc/ui/landing";
import { createAction } from "remix/router";

import type { ComparisonSlug } from "~/config/marketing";

import defaultHandler from "~/app/http/controllers/default-handler";
import { isAuthenticated } from "~/app/http/middleware/auth";
import { SEO, productSchema } from "~/app/initializers/seo";
import { TIER_LIMITS } from "~/app/services/entitlement";
import { COMPARISON_SLUGS, isSlug } from "~/config/marketing";
import { FaqColumn } from "~/resources/components/marketing/bands";
import { landingTranslate } from "~/resources/components/marketing/figures";
import { DataScene } from "~/resources/components/marketing/scenes";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { SignIn } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** A row the table can hold; each competitor lists the ones its own pages confirm. */
type RowKey =
	| "freePlan"
	| "history"
	| "filters"
	| "fullText"
	| "search"
	| "agents"
	| "export"
	| "apps"
	| "newsletters"
	| "ai"
	| "hosting";

/**
 * The rows each comparison holds. A fact the other product's pages did not confirm has no
 * row, so the table never guesses on anybody's behalf.
 */
const COMPARISON_ROWS: Record<ComparisonSlug, readonly RowKey[]> = {
	feedly: ["freePlan", "filters", "agents", "export", "apps", "newsletters", "ai"],
	inoreader: ["freePlan", "filters", "fullText", "search", "agents", "apps", "newsletters", "ai"],
	feedbin: ["freePlan", "history", "agents", "apps", "newsletters", "ai", "hosting"],
	newsblur: ["freePlan", "fullText", "search", "agents", "apps", "ai", "hosting"],
};

/** GET /vs/:slug — the comparison with one other reader, or the 404 document. */
export default createAction(routes.marketing.comparison, (ctx) => {
	let slug = ctx.params.slug;
	if (!isSlug(COMPARISON_SLUGS, slug)) return defaultHandler(ctx);

	let t = landingTranslate(ctx.intl, ctx.locale);
	let page = (path: string) => `landing.compare.pages.${slug}.${path}`;
	let competitor = t(`landing.nav.compare.${slug}`);
	let isSignedIn = isAuthenticated();
	let count = (value: number) => value.toLocaleString(ctx.locale);

	/** Figures the reader's own cells quote, read from the limits each plan enforces. */
	let figures = {
		feeds: count(TIER_LIMITS.free.feeds),
		posts: count(TIER_LIMITS.free.posts),
		rules: count(TIER_LIMITS.paid.rules),
		days: count(TIER_LIMITS.free.searchWindowDays ?? 0),
	};

	let rows = COMPARISON_ROWS[slug].map((row) => ({
		label: t(`landing.compare.rows.${row}`),
		us: t(`landing.compare.reader.${row}`, figures),
		them: t(page(`rows.${row}`)),
	}));

	let faqs = (["one", "two"] as const).map((item) => ({
		key: item,
		question: t(page(`faq.${item}.q`)),
		answer: t(page(`faq.${item}.a`)),
	}));

	let path = routes.marketing.comparison.href({ slug });

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t(page("meta.title"))}
			description={t(page("meta.description"))}
			locale={ctx.locale}
			seo={{
				canonical: SEO.canonical(path),
				schema: [
					productSchema({
						name: t(page("meta.title")),
						description: t(page("meta.description")),
						url: path,
						featureList: (["one", "two", "three"] as const).map((item) =>
							t(page(`reasons.${item}.title`)),
						),
					}),
					SEO.schema.faq(faqs.map(({ question, answer }) => ({ question, answer }))),
				],
			}}
		>
			<MarketingLayout t={t} isSignedIn={isSignedIn}>
				<LandingHero
					entrance
					align="center"
					eyebrow={t("landing.compare.eyebrow", { competitor })}
					eyebrowVariant="mono"
					title={
						<Trans
							intl={ctx.intl}
							i18nKey={page("title")}
							components={{ strong: <AccentText>{""}</AccentText> }}
						/>
					}
					description={t(page("description"))}
					actions={
						<>
							{isSignedIn ? (
								<LinkButton href={routes.reading.index.href()} size="lg">
									{t("landing.nav.open")}
								</LinkButton>
							) : (
								<SignIn label={t("landing.compare.cta")} />
							)}
							<LinkButton href="#table" variant="surface" size="lg">
								{t("landing.compare.tableLink")}
							</LinkButton>
						</>
					}
				/>

				<LandingSection id="table" ruled mix={[viewReveal()]}>
					<LandingHeader
						eyebrow={t("landing.compare.tableEyebrow")}
						description={t("landing.compare.checked")}
					>
						{t(page("tableTitle"))}
					</LandingHeader>
					<Table.Container>
						<Table aria-label={t("landing.compare.tableLabel", { competitor })}>
							<Table.Header>
								<Table.Row>
									<Table.Column>{t("landing.compare.column")}</Table.Column>
									<Table.Column>{t("app.name")}</Table.Column>
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
				</LandingSection>

				<LandingSection mix={[viewReveal()]}>
					<LandingHeader eyebrow={t("landing.compare.reasonsEyebrow")}>
						{t(page("reasonsTitle"))}
					</LandingHeader>
					<Feature.Grid variant="list" columns={3}>
						{(["one", "two", "three"] as const).map((item) => (
							<Feature key={item}>
								<Feature.Title>{t(page(`reasons.${item}.title`))}</Feature.Title>
								<Feature.Description>{t(page(`reasons.${item}.description`))}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</LandingSection>

				<LandingSection tone="tinted" inset mix={[viewReveal()]}>
					<LandingHeader eyebrow={t("landing.compare.winsEyebrow")}>
						{t("landing.compare.winsTitle", { competitor })}
					</LandingHeader>
					<Feature.Grid variant="list" columns={3}>
						{(["one", "two", "three"] as const).map((item) => (
							<Feature key={item}>
								<Feature.Icon>
									<span mix={[raw({ display: "inline-flex", color: "var(--ui-warning-fg)" })]}>
										<TriangleAlertIcon size={20} strokeWidth={1.5} aria-hidden="true" />
									</span>
								</Feature.Icon>
								<Feature.Title>{t(page(`wins.${item}.title`))}</Feature.Title>
								<Feature.Description>{t(page(`wins.${item}.description`))}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</LandingSection>

				<FeatureBand
					layout="split"
					lean="media"
					eyebrow={t("landing.compare.switchEyebrow")}
					title={t("landing.compare.switchTitle", { competitor })}
					media={<DataScene t={t} framed={false} />}
				>
					<StepList variant="timeline">
						{(["export", "import", "read"] as const).map((step) => (
							<StepList.Item
								key={step}
								title={t(`landing.compare.switch.${step}.title`, { competitor })}
							>
								{t(`landing.compare.switch.${step}.description`, { competitor })}
							</StepList.Item>
						))}
					</StepList>
				</FeatureBand>

				<FaqBand
					id="faq"
					columns={2}
					eyebrow={t("landing.faq.eyebrow")}
					title={t("landing.compare.faqTitle", { competitor })}
				>
					<FaqColumn name="compare-faq" items={faqs.slice(0, 1)} />
					<FaqColumn name="compare-faq" items={faqs.slice(1)} />
				</FaqBand>

				<LandingSection spacing="compact">
					<div
						mix={[raw({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" })]}
					>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
							{t("landing.compare.others")}
						</span>
						{COMPARISON_SLUGS.filter((other) => other !== slug).map((other) => (
							<LinkButton
								key={other}
								href={routes.marketing.comparison.href({ slug: other })}
								variant="surface"
								size="sm"
							>
								{t(`landing.nav.compare.${other}`)}
							</LinkButton>
						))}
					</div>
				</LandingSection>

				<ClosingCta
					tone="brand"
					inset
					title={t("landing.compare.closing", { competitor })}
					description={t("landing.closing.description")}
					actions={<SignIn label={t("landing.compare.cta")} />}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
