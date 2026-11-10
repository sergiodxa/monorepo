/**
 * View for `/apps`: a landing-style hero, then each shipped product as its own band — copy
 * on one side, screenshots or a product window on the other, sides alternating so the page
 * reads as a tour. Renders in either language from the same structured page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { ArrowDownIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { minIs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Link, LinkButton } from "@sdxc/ui";
import { AccentText, FeatureBand, LandingHero } from "@sdxc/ui/landing";
import { landingContainer, landingCtaChrome } from "@sdxc/ui/styles";

import type { AppsPage } from "~/app/services/apps-page";

import { BlogLayout } from "~/resources/layouts/blog";
import {
	AppsHeroStage,
	EncoreStage,
	ReaderStage,
	UptimeStage,
	WakabaStage,
} from "~/resources/views/apps-previews";
import routes from "~/routes/web";

/**
 * Types used by the `/apps` renderer.
 */
export namespace AppsView {
	/** Data required to render the page. */
	export interface Model {
		page: AppsPage;
	}
}

/** The page's URL in `locale`, which a shared link keeps regardless of the reader's browser. */
function appsHref(locale: string): string {
	return `${routes.apps.href()}?lang=${locale}`;
}

/**
 * Puts the media column on the inline start once the split is two columns, so every other
 * band can flip sides without a second Split layout.
 */
function mediaStart() {
	return [at("lg", "ui-landing-split", raw({ order: -1 }))];
}

/**
 * Draws `heading` with `accent` wrapped in AccentText when that word appears in it.
 */
function accentTitle(heading: string, accent: string): RemixNode {
	let index = heading.indexOf(accent);
	if (index < 0) return heading;
	return (
		<>
			{heading.slice(0, index)}
			<AccentText>{accent}</AccentText>
			{heading.slice(index + accent.length)}
		</>
	);
}

/**
 * The visual each app's band opens with: fanned phone captures for App Store apps, a
 * product window for the web ones.
 */
function mediaFor(app: AppsPage.App, page: AppsPage): RemixNode {
	switch (app.id) {
		case "wakaba":
			return (
				<WakabaStage
					locale={page.locale}
					label={page.labels.stages.wakaba}
					pauseLabel={page.labels.pause}
				/>
			);
		case "encore":
			return (
				<EncoreStage
					locale={page.locale}
					label={page.labels.stages.encore}
					pauseLabel={page.labels.pause}
				/>
			);
		case "uptime":
			return <UptimeStage pauseLabel={page.labels.pause} />;
		case "reader":
			return <ReaderStage pauseLabel={page.labels.pause} />;
		default:
			return null;
	}
}

/**
 * The page hero: language and Markdown links, then a landing hero with the title, pitch,
 * a scroll CTA and a fan of product screens.
 */
function Hero(handle: Handle<{ page: AppsPage }>) {
	return () => {
		let { page } = handle.props;
		let browseHref = `#${page.apps[0]?.id ?? "wakaba"}`;

		return (
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<div
					mix={[
						landingContainer(),
						hstack({ gap: 4, justify: "end", align: "center" }),
						flexWrap("wrap"),
					]}
				>
					<Link
						href={appsHref(page.otherLanguage.locale)}
						hreflang={page.otherLanguage.locale}
						lang={page.otherLanguage.locale}
						mix={[text("sm")]}
					>
						{page.otherLanguage.label}
					</Link>
					<Link href={`${routes.appsMarkdown.href()}?lang=${page.locale}`} mix={[text("sm")]}>
						{page.labels.viewMarkdown}
					</Link>
				</div>
				<LandingHero
					id="top"
					tone="tinted"
					align="center"
					entrance
					mediaPlacement="below"
					eyebrow={page.eyebrow}
					eyebrowVariant="quiet"
					title={accentTitle(page.heading, page.accent)}
					description={page.intro}
					actions={
						<span
							mix={[
								hstack({ gap: 3, align: "center", justify: "center" }),
								raw({ flexWrap: "wrap" }),
							]}
						>
							<LinkButton href={browseHref} variant="solid" mix={[landingCtaChrome()]}>
								{page.browseCta}
								<ArrowDownIcon size={16} aria-hidden="true" />
							</LinkButton>
						</span>
					}
					media={
						<AppsHeroStage
							locale={page.locale}
							label={page.labels.stages.hero}
							pauseLabel={page.labels.pause}
						/>
					}
				/>
			</div>
		);
	};
}

namespace AppBand {
	export interface Props {
		app: AppsPage.App;
		page: AppsPage;
		/** Zero-based index in the showcase, used to alternate media side and tone. */
		index: number;
	}
}

/**
 * One app as a split band: platform as eyebrow, name as title, pitch and checks beside a
 * screenshot stage that flips sides every band. When media leads via `order`, lean flips
 * too so the first auto-placed track stays the wider one.
 *
 * @returns The render function producing the band.
 */
function AppBand(handle: Handle<AppBand.Props>) {
	return () => {
		let { app, index, page } = handle.props;
		let mediaOnStart = index % 2 === 1;

		return (
			<FeatureBand
				id={app.id}
				layout="split"
				lean={mediaOnStart ? "copy" : "media"}
				tone={index % 2 === 0 ? "plain" : "tinted"}
				eyebrow={app.platform}
				eyebrowVariant="quiet"
				title={app.name}
				description={app.blurb}
				media={mediaFor(app, page)}
				parts={mediaOnStart ? { media: mediaStart() } : undefined}
			>
				<ul>
					{app.highlights.map((highlight) => (
						<li key={highlight}>{highlight}</li>
					))}
				</ul>
				<span mix={[hstack({ gap: 3, align: "center" }), flexWrap("wrap")]}>
					<LinkButton href={app.href} variant="solid" mix={[landingCtaChrome()]}>
						{app.cta}
					</LinkButton>
				</span>
			</FeatureBand>
		);
	};
}

/**
 * The page.
 *
 * @returns View function rendering `/apps` in the page's language.
 */
export function AppsView() {
	return ({ model, assets }: { model: AppsView.Model; assets: DocumentAssets }) => {
		let { page } = model;

		return (
			<BlogLayout
				assets={assets}
				locale={page.locale}
				title={page.title}
				description={page.description}
				activePath={routes.apps.href()}
				wide
			>
				<main mix={[vstack({ gap: 0, align: "stretch" }), minIs(0)]}>
					<Hero page={page} />
					{page.apps.map((app, index) => (
						<AppBand key={app.id} app={app} page={page} index={index} />
					))}
				</main>
			</BlogLayout>
		);
	};
}
