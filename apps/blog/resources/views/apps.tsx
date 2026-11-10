/**
 * View for `/apps`: a showcase of the products the author ships, each a feature card with a
 * visual preview, its name, where it runs and a short pitch — the whole card opens the app,
 * the same gallery shape as the demos on sdxc.dev. Renders in either language from the same
 * structured page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { fg, outline } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, hstack, vstack } from "@sdxc/u/layout";
import { m, maxIs, minIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { balance, leading, text, tracking } from "@sdxc/u/typography";
import { Badge, Heading, Link } from "@sdxc/ui";
import { Feature } from "@sdxc/ui/landing";

import type { AppsPage } from "~/app/services/apps-page";

import { BlogLayout } from "~/resources/layouts/blog";
import {
	EncorePreview,
	ReaderPreview,
	UptimePreview,
	WakabaPreview,
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
 * The visual each app's card opens with: a CSS miniature of the product on a shared stage
 * height, so every card in the gallery lines up.
 */
function previewFor(id: string): RemixNode {
	switch (id) {
		case "wakaba":
			return <WakabaPreview />;
		case "encore":
			return <EncorePreview />;
		case "uptime":
			return <UptimePreview />;
		case "reader":
			return <ReaderPreview />;
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

/**
 * One app's card: its preview on top, then the name as the stretched link, a platform badge
 * and the pitch, so a screen reader announces the name alone while the whole card opens it.
 */
function AppCard(handle: Handle<{ app: AppsPage.App }>) {
	return () => {
		let { app } = handle.props;

		return (
			<Feature
				mix={[
					raw({ transition: "background-color 150ms" }),
					when(
						"&:has([data-slot='app-link']:hover)",
						raw({
							backgroundColor:
								"color-mix(in oklch, var(--ui-surface-raised, Canvas), var(--ui-brand-bg-solid) 6%)",
						}),
					),
					when(
						"&:has([data-slot='app-link']:focus-visible)",
						outline({ color: "brand.ring", width: 2, offset: 2 }),
					),
				]}
			>
				{previewFor(app.id)}
				<div mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
					<Feature.Title>
						<a
							href={app.href}
							data-slot="app-link"
							mix={[
								raw({ color: "inherit", textDecoration: "none", outline: "none" }),
								when("&::after", raw({ content: '""', position: "absolute", inset: "0" })),
							]}
						>
							{app.name}
						</a>
					</Feature.Title>
					<Badge color="brand">{app.platform}</Badge>
				</div>
				<Feature.Description>
					<p mix={[m(0), fg("neutral.emphasis"), leading("snug")]}>{app.blurb}</p>
				</Feature.Description>
			</Feature>
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
				<main mix={[vstack({ gap: 10, align: "stretch" }), minIs(0)]}>
					<Header page={page} />
					<Feature.Grid columns={2}>
						{page.apps.map((app) => (
							<AppCard key={app.id} app={app} />
						))}
					</Feature.Grid>
				</main>
			</BlogLayout>
		);
	};
}
