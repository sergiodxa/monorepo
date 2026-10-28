/**
 * Home controller for `/`. It explains what the reader is to a visitor who has not signed
 * in, and sends a signed-in one straight to their queue — the landing copy has nothing to
 * say to somebody who already has an account. It is also where `requireUser` redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { EyeOffIcon, GlobeIcon, ListOrderedIcon } from "@sdxc/icons";
import { Button, Feature, HeadingScope } from "@sdxc/ui";
import {
	CheckList,
	CheckRow,
	ClosingCta,
	FeatureBand,
	LandingHero,
	ProductFrame,
} from "@sdxc/ui/patterns";
import { createAction } from "remix/router";

import { isAuthenticated } from "~/app/http/middleware/auth";
import DocumentLayout from "~/resources/layouts/document";
import LandingQueuePreview from "~/resources/views/landing-queue-preview";
import routes from "~/routes/web";

/** The landing page's three selling points, in the order they are rendered. */
const FEATURE_KEYS = ["queue", "private", "openWeb"] as const;

/** Short hero check-row keys, same claims as the feature band titles. */
const HERO_CHECK_KEYS = ["queue", "private", "openWeb"] as const;

/** Glyph each feature cell shows in its icon well. */
const FEATURE_ICONS = {
	queue: <ListOrderedIcon size={18} strokeWidth={1.5} aria-hidden="true" />,
	private: <EyeOffIcon size={18} strokeWidth={1.5} aria-hidden="true" />,
	openWeb: <GlobeIcon size={18} strokeWidth={1.5} aria-hidden="true" />,
} as const;

/** Keys for the illustrative queue rows inside the hero product frame. */
const PREVIEW_ROW_KEYS = ["one", "two", "three", "four"] as const;

/**
 * GET / — the landing page for a visitor, or a redirect to the queue for a signed-in
 * reader. The sign-in form is a `POST` because starting the flow writes the login
 * transaction into the session, and it stays a document navigation because the provider
 */
export default createAction(routes.home, (ctx) => {
	if (isAuthenticated()) {
		return redirect(routes.reading.index.href(), { status: redirect.Status.SeeOther });
	}

	let t = ctx.intl.t.bind(ctx.intl);

	let signIn = (
		<form method="post" action={routes.auth.action.href()} data-rmx-document="">
			<Button type="submit" size="lg">
				{t("landing.hero.cta")}
			</Button>
		</form>
	);

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={t("landing.meta.title")}
			description={t("landing.meta.description")}
			locale={ctx.locale}
		>
			<main>
				<LandingHero
					tone="tinted"
					mediaPlacement="end"
					eyebrow={t("landing.hero.eyebrow")}
					eyebrowVariant="mono"
					title={t("landing.hero.title")}
					description={t("landing.hero.description")}
					actions={signIn}
					below={
						<CheckList orientation="horizontal">
							{HERO_CHECK_KEYS.map((key) => (
								<CheckRow key={key}>{t(`landing.hero.checks.${key}`)}</CheckRow>
							))}
						</CheckList>
					}
					media={
						<ProductFrame
							lights
							title={t("landing.hero.frame.title")}
							url={t("landing.hero.frame.url")}
						>
							<LandingQueuePreview
								label={t("landing.hero.media.alt")}
								chrome={t("landing.hero.media.chrome")}
								rows={PREVIEW_ROW_KEYS.map((key) => ({
									read: key === "three" || key === "four",
									title: t(`landing.hero.media.rows.${key}.title`),
									source: t(`landing.hero.media.rows.${key}.source`),
									time: t(`landing.hero.media.rows.${key}.time`),
								}))}
							/>
						</ProductFrame>
					}
				/>

				<FeatureBand
					layout="grid"
					columns={3}
					eyebrow={t("landing.features.badge")}
					eyebrowVariant="mono"
					title={t("landing.features.title")}
					description={t("landing.features.description")}
				>
					{FEATURE_KEYS.map((key) => (
						<HeadingScope key={key} level={3}>
							<Feature>
								<Feature.Icon>{FEATURE_ICONS[key]}</Feature.Icon>
								<Feature.Title>{t(`landing.features.${key}.title`)}</Feature.Title>
								<Feature.Description>
									{t(`landing.features.${key}.description`)}
								</Feature.Description>
							</Feature>
						</HeadingScope>
					))}
				</FeatureBand>

				<ClosingCta
					tone="tinted"
					title={t("landing.closing.title")}
					description={t("landing.closing.description")}
					actions={
						<form method="post" action={routes.auth.action.href()} data-rmx-document="">
							<Button type="submit" size="lg">
								{t("landing.closing.cta")}
							</Button>
						</form>
					}
				/>
			</main>
		</DocumentLayout>,
	);
});
