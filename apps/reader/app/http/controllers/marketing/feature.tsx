/**
 * The feature page at `/features/:slug`: one capability argued in full — the product window
 * it lives in, the facts behind it, the steps beside a second screen, and the questions it
 * raises. One template feeds every slug in `config/marketing.ts`; any other slug is a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Trans } from "@sdxc/i18n/ui";
import { Feature, LinkButton, MarketingHeader, MarketingSection } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	ClosingCta,
	FaqBand,
	FeatureBand,
	LandingHero,
	StepList,
} from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import { isAuthenticated } from "~/app/http/middleware/auth";
import { FEATURE_KEYS, FEATURE_SLUGS, isSlug } from "~/config/marketing";
import { FaqColumn } from "~/resources/components/marketing/bands";
import {
	FEATURE_CARD_SCENES,
	FEATURE_HEROES,
	FEATURE_STEP_VISUALS,
} from "~/resources/components/marketing/feature-scenes";
import { landingTranslate } from "~/resources/components/marketing/figures";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { SignIn } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** Every feature page carries three facts, three steps and three questions. */
const TRIPLE = ["one", "two", "three"] as const;

/** How many other features the page offers at its foot, one row of cards. */
const RELATED_COUNT = 3;

/** GET /features/:slug — the feature's page, or the 404 document for a slug nobody wrote. */
export default createAction(routes.marketing.feature, (ctx) => {
	let slug = ctx.params.slug;
	if (!isSlug(FEATURE_SLUGS, slug)) return defaultHandler(ctx);

	let t = landingTranslate(ctx.intl, ctx.locale);
	let key = FEATURE_KEYS[slug];
	let page = (path: string) => `landing.features.pages.${key}.${path}`;
	let isSignedIn = isAuthenticated();

	/** The features after this one in menu order, wrapping, so every page links onward. */
	let index = FEATURE_SLUGS.indexOf(slug);
	let related = Array.from(
		{ length: RELATED_COUNT },
		(_, offset) => FEATURE_SLUGS[(index + offset + 1) % FEATURE_SLUGS.length] ?? slug,
	);

	let faqs = TRIPLE.map((item) => ({
		key: item,
		question: t(page(`faq.${item}.q`)),
		answer: t(page(`faq.${item}.a`)),
	}));

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t(page("meta.title"))}
			description={t(page("meta.description"))}
			locale={ctx.locale}
		>
			<MarketingLayout t={t} isSignedIn={isSignedIn}>
				<LandingHero
					entrance
					mediaPlacement="end"
					eyebrow={t(`landing.nav.features.${key}`)}
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
								<SignIn label={t("landing.hero.cta")} />
							)}
							<LinkButton href={`${routes.home.href()}#plans`} variant="surface" size="lg">
								{t("landing.features.plansLink")}
							</LinkButton>
						</>
					}
					note={t(page("plan"))}
					media={FEATURE_HEROES[slug](t)}
				/>

				<MarketingSection ruled mix={[viewReveal()]}>
					<MarketingHeader eyebrow={t("landing.features.factsEyebrow")}>
						{t(page("factsTitle"))}
					</MarketingHeader>
					<Feature.Grid variant="list" columns={3}>
						{TRIPLE.map((item) => (
							<Feature key={item}>
								<Feature.Title>{t(page(`facts.${item}.title`))}</Feature.Title>
								<Feature.Description>{t(page(`facts.${item}.description`))}</Feature.Description>
							</Feature>
						))}
					</Feature.Grid>
				</MarketingSection>

				<FeatureBand
					id="how-it-works"
					layout="split"
					lean="media"
					eyebrow={t("landing.features.stepsEyebrow")}
					title={t(page("stepsTitle"))}
					media={FEATURE_STEP_VISUALS[slug](t)}
				>
					<StepList variant="timeline">
						{TRIPLE.map((item) => (
							<StepList.Item key={item} title={t(page(`steps.${item}.title`))}>
								{t(page(`steps.${item}.description`))}
							</StepList.Item>
						))}
					</StepList>
				</FeatureBand>

				<MarketingSection tone="tinted" mix={[viewReveal()]}>
					<MarketingHeader eyebrow={t("landing.features.eyebrow")}>
						{t("landing.features.relatedTitle")}
					</MarketingHeader>
					<Feature.Grid columns={3}>
						{related.map((other) => {
							let otherKey = FEATURE_KEYS[other];
							let href = routes.marketing.feature.href({ slug: other });
							let Scene = FEATURE_CARD_SCENES[other];
							return (
								<Feature key={other} href={href}>
									<Feature.Media>
										<Scene t={t} />
									</Feature.Media>
									<Feature.Title>{t(`landing.features.cards.${otherKey}.title`)}</Feature.Title>
									<Feature.Description>
										{t(`landing.features.cards.${otherKey}.description`)}
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

				<FaqBand
					id="faq"
					columns={2}
					eyebrow={t("landing.faq.eyebrow")}
					title={t(page("faqTitle"))}
				>
					<FaqColumn name="feature-faq" items={faqs.slice(0, 2)} />
					<FaqColumn name="feature-faq" items={faqs.slice(2)} />
				</FaqBand>

				<ClosingCta
					tone="brand"
					inset
					title={t(page("closing"))}
					description={t("landing.closing.description")}
					actions={<SignIn label={t("landing.hero.cta")} />}
				/>
			</MarketingLayout>
		</DocumentLayout>,
	);
});
