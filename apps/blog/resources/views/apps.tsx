/**
 * View for `/apps`: each shipped product as its own band — copy on one side, screenshots or
 * a product window on the other, sides alternating so the page reads as a tour rather than
 * a card grid. Renders in either language from the same structured page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, maxIs, minIs } from "@sdxc/u/size";
import { balance, leading, text, tracking } from "@sdxc/u/typography";
import { Heading, Link, LinkButton } from "@sdxc/ui";
import { FeatureBand } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { AppsPage } from "~/app/services/apps-page";

import { BlogLayout } from "~/resources/layouts/blog";
import {
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
 * The visual each app's band opens with: fanned phone captures for App Store apps, a
 * product window for the web ones.
 */
function mediaFor(app: AppsPage.App, page: AppsPage): RemixNode {
	switch (app.id) {
		case "wakaba":
			return <WakabaStage locale={page.locale} label={page.labels.stages.wakaba} />;
		case "encore":
			return <EncoreStage locale={page.locale} label={page.labels.stages.encore} />;
		case "uptime":
			return <UptimeStage />;
		case "reader":
			return <ReaderStage />;
		default:
			return null;
	}
}

/**
 * The header: the other language and the Markdown twin, then the title and intro.
 */
function Header(handle: Handle<{ page: AppsPage }>) {
	return () => {
		let { page } = handle.props;

		return (
			<header mix={[grid(), gap(6)]}>
				<div mix={[hstack({ gap: 4, justify: "end", align: "center" }), flexWrap("wrap")]}>
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

				<div mix={[vstack({ gap: 3, align: "start" }), maxIs("40rem")]}>
					<Heading level={1} mix={[m(0), text("5xl"), tracking("tight"), balance()]}>
						{page.heading}
					</Heading>
					<p mix={[m(0), text("lg"), leading("relaxed")]}>{page.intro}</p>
				</div>
			</header>
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
 * screenshot stage that flips sides every band.
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
				lean="media"
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
			>
				<main mix={[vstack({ gap: 0, align: "stretch" }), minIs(0)]}>
					<div mix={[vstack({ gap: 10, align: "stretch" }), raw({ paddingBlockEnd: "2rem" })]}>
						<Header page={page} />
					</div>
					{page.apps.map((app, index) => (
						<AppBand key={app.id} app={app} page={page} index={index} />
					))}
				</main>
			</BlogLayout>
		);
	};
}
