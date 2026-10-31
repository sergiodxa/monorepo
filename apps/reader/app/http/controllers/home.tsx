/**
 * Home controller for `/`. It shows a visitor the reader at work — the queue, a post read in
 * place, a feed's own page — and argues each claim with the product doing it, and sends a
 * signed-in reader straight to their queue. It is also where `requireUser` redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { Trans } from "@sdxc/i18n/ui";
import { EyeOffIcon, FileClockIcon, LinkIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Feature, LinkButton, MarketingHeader, MarketingSection, StatStrip } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	ClosingCta,
	FaqBand,
	FeatureBand,
	LandingHero,
	SegmentedStage,
} from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import { isAuthenticated } from "~/app/http/middleware/auth";
import { TIER_LIMITS } from "~/app/services/entitlement";
import { HISTORY_ENTRY_LIMIT } from "~/app/services/history";
import { COMPARISON_SLUGS, FEATURE_KEYS, USE_CASE_SLUGS } from "~/config/marketing";
import { POLL_FLOOR_MS } from "~/database/feed-schema";
import { Checks, FaqColumn, MoreLink } from "~/resources/components/marketing/bands";
import { FEATURE_CARD_SCENES } from "~/resources/components/marketing/feature-scenes";
import { landingTranslate } from "~/resources/components/marketing/figures";
import PlansTable from "~/resources/components/marketing/plans-table";
import {
	ArticleView,
	FeedView,
	QueueView,
	ReaderWindow,
} from "~/resources/components/marketing/reader-window";
import RefreshDiagram from "~/resources/components/marketing/refresh-diagram";
import { FiltersScene, formatInterval } from "~/resources/components/marketing/scenes";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { SignIn } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** The features the home's card grid links to; freshness and filters have bands of their own. */
const CARD_FEATURES = [
	"articles",
	"search",
	"notifications",
	"organize",
	"your-data",
	"agents",
] as const;

/** The FAQ's questions, in the order a visitor asks them. */
const FAQ_KEYS = ["anyFeed", "free", "over", "apps", "move", "privacy"] as const;

/** The privacy band's three facts, each a rule the app's code enforces. */
const PRIVACY_FACTS = [
	{ key: "logs", icon: <EyeOffIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
	{ key: "links", icon: <LinkIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
	{ key: "retention", icon: <FileClockIcon size={20} strokeWidth={1.5} aria-hidden="true" /> },
] as const;

/**
 * GET / — the landing page for a visitor, or a redirect to the queue for a signed-in
 * reader, since the landing has nothing to tell somebody who already reads here.
 */
export default createAction(routes.home, (ctx) => {
	if (isAuthenticated()) {
		return redirect(routes.reading.index.href(), { status: redirect.Status.SeeOther });
	}

	let t = landingTranslate(ctx.intl, ctx.locale);
	let count = (value: number) => value.toLocaleString(ctx.locale);

	/**
	 * Every figure is read from the code that enforces it: the Free plan's feed and post
	 * caps, the busiest feed's fetch interval, and the history a new follow walks.
	 */
	let figures = [
		{ value: count(TIER_LIMITS.free.feeds), label: t("landing.figures.feeds") },
		{ value: count(TIER_LIMITS.free.posts), label: t("landing.figures.posts") },
		{ value: formatInterval(POLL_FLOOR_MS), label: t("landing.figures.interval") },
		{ value: count(HISTORY_ENTRY_LIMIT), label: t("landing.figures.history") },
	];

	let faqs = FAQ_KEYS.map((key) => ({
		key,
		question: t(`landing.faq.${key}.q`),
		answer: t(`landing.faq.${key}.a`),
	}));
	let half = Math.ceil(faqs.length / 2);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t("landing.meta.title")}
			description={t("landing.meta.description")}
			locale={ctx.locale}
		>
			<MarketingLayout t={t} isSignedIn={false}>
				<LandingHero
					entrance
					mediaPlacement="below"
					eyebrow={t("landing.hero.eyebrow")}
					eyebrowVariant="mono"
					title={
						<Trans
							intl={ctx.intl}
							i18nKey="landing.hero.title"
							components={{ strong: <AccentText>{""}</AccentText> }}
						/>
					}
					description={t("landing.hero.description")}
					actions={
						<div mix={[raw({ display: "grid", gap: "1.25rem", justifyItems: "start" })]}>
							<div mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.75rem" })]}>
								<SignIn label={t("landing.hero.cta")} />
								<LinkButton href="#how" variant="surface" size="lg">
									{t("landing.hero.secondary")}
								</LinkButton>
							</div>
							<Checks
								horizontal
								items={[
									t("landing.hero.checks.anyFeed"),
									t("landing.hero.checks.opml"),
									t("landing.hero.checks.free"),
								]}
							/>
						</div>
					}
					media={
						<SegmentedStage
							name="reader-hero-views"
							aria-label={t("landing.hero.views.label")}
							align="start"
						>
							<SegmentedStage.Item
								value="queue"
								label={t("landing.hero.views.queue")}
								defaultChecked
							>
								<ReaderWindow
									t={t}
									title={t("nav.reading")}
									path="/reading"
									label={t("landing.hero.views.queueAlt")}
								>
									<QueueView t={t} />
								</ReaderWindow>
							</SegmentedStage.Item>
							<SegmentedStage.Item value="article" label={t("landing.hero.views.article")}>
								<ReaderWindow
									t={t}
									title="Field Notes"
									path="/reading/field-notes/walking-the-same-route"
									label={t("landing.hero.views.articleAlt")}
									active="saved"
								>
									<ArticleView t={t} />
								</ReaderWindow>
							</SegmentedStage.Item>
							<SegmentedStage.Item value="feed" label={t("landing.hero.views.feed")}>
								<ReaderWindow
									t={t}
									title="Harbor Daily"
									path="/reading/harbor-daily"
									label={t("landing.hero.views.feedAlt")}
									active="feed"
								>
									<FeedView t={t} />
								</ReaderWindow>
							</SegmentedStage.Item>
						</SegmentedStage>
					}
				/>

				<MarketingSection spacing="compact" ruled mix={[viewReveal()]}>
					<StatStrip size="display" variant="gap" align="center">
						{figures.map((item) => (
							<StatStrip.Item key={item.label} label={item.label}>
								{item.value}
							</StatStrip.Item>
						))}
					</StatStrip>
				</MarketingSection>

				<FeatureBand
					id="how"
					layout="split"
					lean="media"
					eyebrow={t("landing.freshness.eyebrow")}
					title={t("landing.freshness.title")}
					description={
						<Trans
							intl={ctx.intl}
							i18nKey="landing.freshness.description"
							components={{ strong: <strong>{""}</strong> }}
						/>
					}
					media={<RefreshDiagram t={t} />}
				>
					<Checks
						items={[
							t("landing.freshness.checks.rate"),
							t("landing.freshness.checks.push"),
							t("landing.freshness.checks.history"),
						]}
					/>
					<MoreLink
						href={routes.marketing.feature.href({ slug: "freshness" })}
						label={t("landing.freshness.more")}
					/>
				</FeatureBand>

				<FeatureBand
					layout="split"
					lean="media"
					eyebrow={t("landing.filters.eyebrow")}
					title={t("landing.filters.title")}
					description={
						<Trans
							intl={ctx.intl}
							i18nKey="landing.filters.description"
							components={{ strong: <strong>{""}</strong> }}
						/>
					}
					media={<FiltersScene t={t} framed={false} />}
				>
					<Checks
						items={[
							t("landing.filters.checks.actions"),
							t("landing.filters.checks.preview"),
							t("landing.filters.checks.forward"),
						]}
					/>
					<MoreLink
						href={routes.marketing.feature.href({ slug: "filters" })}
						label={t("landing.filters.more")}
					/>
				</FeatureBand>

				<MarketingSection id="features" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.features.eyebrow")}
						description={t("landing.features.description")}
						layout="split"
					>
						{t("landing.features.title")}
					</MarketingHeader>
					<Feature.Grid columns={3}>
						{CARD_FEATURES.map((slug) => {
							let key = FEATURE_KEYS[slug];
							let href = routes.marketing.feature.href({ slug });
							let Scene = FEATURE_CARD_SCENES[slug];
							return (
								<Feature key={slug} href={href}>
									<Feature.Media>
										<Scene t={t} />
									</Feature.Media>
									<Feature.Title>{t(`landing.features.cards.${key}.title`)}</Feature.Title>
									<Feature.Description>
										{t(`landing.features.cards.${key}.description`)}
									</Feature.Description>
									<Feature.Action>
										<Feature.Link href={href} data-rmx-prefetch="intent">
											{t("landing.features.more")}
										</Feature.Link>
									</Feature.Action>
								</Feature>
							);
						})}
					</Feature.Grid>
				</MarketingSection>

				<MarketingSection tone="inverse" inset mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.privacy.eyebrow")}
						description={t("landing.privacy.description")}
						align="center"
					>
						{t("landing.privacy.title")}
					</MarketingHeader>
					<Feature.Grid variant="list" columns={3}>
						{PRIVACY_FACTS.map((fact) => (
							<Feature key={fact.key}>
								<Feature.Icon>{fact.icon}</Feature.Icon>
								<Feature.Title>{t(`landing.privacy.facts.${fact.key}.title`)}</Feature.Title>
								<Feature.Description>
									{t(`landing.privacy.facts.${fact.key}.description`)}
								</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<MarketingSection id="plans" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.plans.eyebrow")}
						description={t("landing.plans.description")}
					>
						{t("landing.plans.title")}
					</MarketingHeader>
					<PlansTable t={t} locale={ctx.locale} />
					<div mix={[raw({ marginBlockStart: "1.5rem" })]}>
						<Checks
							horizontal
							items={[t("landing.plans.notes.grace"), t("landing.plans.notes.nothingDeleted")]}
						/>
					</div>
				</MarketingSection>

				<MarketingSection tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader
						eyebrow={t("landing.useCases.eyebrow")}
						description={t("landing.useCases.description")}
						layout="split"
					>
						{t("landing.useCases.title")}
					</MarketingHeader>
					<Feature.Grid variant="list" columns={2}>
						{USE_CASE_SLUGS.map((slug) => {
							let href = routes.marketing.useCase.href({ slug });
							return (
								<Feature key={slug} href={href}>
									<Feature.Title>{t(`landing.useCases.cards.${slug}.title`)}</Feature.Title>
									<Feature.Description>
										{t(`landing.useCases.cards.${slug}.description`)}
									</Feature.Description>
									<Feature.Action>
										<Feature.Link href={href} data-rmx-prefetch="intent">
											{t(`landing.nav.useCases.${slug}`)}
										</Feature.Link>
									</Feature.Action>
								</Feature>
							);
						})}
					</Feature.Grid>
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								alignItems: "center",
								gap: "0.75rem",
								marginBlockStart: "2.5rem",
							}),
						]}
					>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
							{t("landing.useCases.compare")}
						</span>
						{COMPARISON_SLUGS.map((slug) => (
							<LinkButton
								key={slug}
								href={routes.marketing.comparison.href({ slug })}
								variant="surface"
								size="sm"
							>
								{t(`landing.nav.compare.${slug}`)}
							</LinkButton>
						))}
					</div>
				</MarketingSection>

				<FaqBand
					id="faq"
					columns={2}
					eyebrow={t("landing.faq.eyebrow")}
					title={t("landing.faq.title")}
				>
					{[faqs.slice(0, half), faqs.slice(half)].map((column, index) => (
						<FaqColumn key={index} name="reader-faq" items={column} />
					))}
				</FaqBand>

				<ClosingCta
					tone="brand"
					inset
					title={t("landing.closing.title")}
					description={t("landing.closing.description")}
					actions={<SignIn label={t("landing.hero.cta")} />}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
