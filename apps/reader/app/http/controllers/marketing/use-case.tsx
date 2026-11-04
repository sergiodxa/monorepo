/**
 * The way-of-reading page at `/for/:slug`: the queue somebody reading that way wakes up to,
 * the three features that carry it, a spotlight on the one that matters most, and their
 * questions. One template feeds every slug in `config/marketing.ts`; any other is a 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Trans } from "@sdxc/i18n/ui";
import { LinkButton } from "@sdxc/ui";
import { viewReveal } from "@sdxc/ui/animations";
import {
	AccentText,
	ClosingCta,
	FaqBand,
	Feature,
	FeatureBand,
	LandingHeader,
	LandingHero,
	LandingSection,
} from "@sdxc/ui/landing";
import { createAction } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import { isAuthenticated } from "~/app/http/middleware/auth";
import { SEO, productSchema } from "~/app/initializers/seo";
import { FEATURE_KEYS, USE_CASE_SLUGS, isSlug } from "~/config/marketing";
import { Checks, FaqColumn } from "~/resources/components/marketing/bands";
import { landingTranslate } from "~/resources/components/marketing/figures";
import { QueueView, ReaderWindow } from "~/resources/components/marketing/reader-window";
import { USE_CASES } from "~/resources/components/marketing/use-cases";
import DocumentLayout from "~/resources/layouts/document";
import MarketingLayout, { SignIn } from "~/resources/layouts/marketing";
import routes from "~/routes/web";

/** GET /for/:slug — the page for one way of reading, or the 404 document. */
export default createAction(routes.marketing.useCase, (ctx) => {
	let slug = ctx.params.slug;
	if (!isSlug(USE_CASE_SLUGS, slug)) return defaultHandler(ctx);

	let t = landingTranslate(ctx.intl, ctx.locale);
	let page = (path: string) => `landing.useCases.pages.${slug}.${path}`;
	let content = USE_CASES[slug];
	let isSignedIn = isAuthenticated();

	let faqs = (["one", "two"] as const).map((item) => ({
		key: item,
		question: t(page(`faq.${item}.q`)),
		answer: t(page(`faq.${item}.a`)),
	}));

	let path = routes.marketing.useCase.href({ slug });

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
						featureList: content.features.map((feature) =>
							t(`landing.features.cards.${FEATURE_KEYS[feature]}.title`),
						),
					}),
					SEO.schema.faq(faqs.map(({ question, answer }) => ({ question, answer }))),
				],
			}}
		>
			<MarketingLayout t={t} isSignedIn={isSignedIn}>
				<LandingHero
					entrance
					mediaPlacement="end"
					eyebrow={t(`landing.nav.useCases.${slug}`)}
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
						isSignedIn ? (
							<LinkButton href={routes.reading.index.href()} size="lg">
								{t("landing.nav.open")}
							</LinkButton>
						) : (
							<SignIn label={t("landing.hero.cta")} />
						)
					}
					media={
						<ReaderWindow t={t} title={t("nav.reading")} path="/reading" label={t(page("heroAlt"))}>
							<QueueView t={t} posts={content.posts} waiting={0} />
						</ReaderWindow>
					}
				/>

				<LandingSection ruled mix={[viewReveal()]}>
					<LandingHeader eyebrow={t("landing.useCases.capabilitiesEyebrow")}>
						{t(page("capabilitiesTitle"))}
					</LandingHeader>
					<Feature.Grid variant="list" columns={3}>
						{content.features.map((feature) => {
							let key = FEATURE_KEYS[feature];
							let href = routes.marketing.feature.href({ slug: feature });
							return (
								<Feature key={feature} href={href}>
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
				</LandingSection>

				<FeatureBand
					layout="split"
					lean="media"
					tone="tinted"
					eyebrow={t(page("spotlight.eyebrow"))}
					title={t(page("spotlight.title"))}
					description={t(page("spotlight.description"))}
					media={content.spotlight(t)}
				>
					<Checks
						items={(["one", "two", "three"] as const).map((item) =>
							t(page(`spotlight.checks.${item}`)),
						)}
					/>
				</FeatureBand>

				<FaqBand
					id="faq"
					columns={2}
					eyebrow={t("landing.faq.eyebrow")}
					title={t(page("faqTitle"))}
				>
					<FaqColumn name="use-case-faq" items={faqs.slice(0, 1)} />
					<FaqColumn name="use-case-faq" items={faqs.slice(1)} />
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
