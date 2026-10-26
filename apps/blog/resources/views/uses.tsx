/**
 * View for `/uses`: a header with the title, intro and when the list was last reviewed, a
 * row of links to each section, then each section's items as cards with a name, a link and a
 * line on why. Renders in either language from the same structured page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, repeat, vstack } from "@sdxc/u/layout";
import { m, maxIs, minIs, p } from "@sdxc/u/size";
import { balance, leading, text, tracking, weight } from "@sdxc/u/typography";
import { Badge, Heading, Link } from "@sdxc/ui";

import type { UsesPage } from "~/app/services/uses";

import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Types used by the `/uses` renderer.
 */
export namespace UsesView {
	/** Data required to render the page. */
	export interface Model {
		page: UsesPage;
	}
}

/** The page's URL in `locale`, which a shared link keeps regardless of the reader's browser. */
function usesHref(locale: string): string {
	return `${routes.uses.href()}?lang=${locale}`;
}

/**
 * The header: the other language and the Markdown twin, then the title, intro and the month
 * the list was last reviewed, and a row of links to each section.
 */
function Header(handle: Handle<{ page: UsesPage }>) {
	return () => {
		let { page } = handle.props;

		return (
			<header mix={[grid(), gap(6)]}>
				<div mix={[hstack({ gap: 4, justify: "end", align: "center" }), flexWrap("wrap")]}>
					<Link
						href={usesHref(page.otherLanguage.locale)}
						hreflang={page.otherLanguage.locale}
						lang={page.otherLanguage.locale}
						mix={[text("sm")]}
					>
						{page.otherLanguage.label}
					</Link>
					<Link href={`${routes.usesMarkdown.href()}?lang=${page.locale}`} mix={[text("sm")]}>
						{page.labels.viewMarkdown}
					</Link>
				</div>

				<div mix={[grid(), gap(3)]}>
					<Heading level={1} mix={[m(0), text("5xl"), tracking("tight"), balance()]}>
						{page.title}
					</Heading>
					<p mix={[m(0), text("lg"), leading("relaxed"), maxIs("65ch")]}>{page.intro}</p>
					<div>
						<Badge variant="secondary">
							{page.labels.updated}: {page.updated}
						</Badge>
					</div>
				</div>

				<nav aria-label={page.labels.contents}>
					<ul
						mix={[
							m(0),
							p(0),
							hstack({ gap: 2, align: "center" }),
							flexWrap("wrap"),
							raw({ listStyle: "none" }),
						]}
					>
						{page.sections.map((section) => (
							<li key={section.id}>
								<Badge variant="outline">
									<Link href={`#${section.id}`}>{section.title}</Link>
								</Badge>
							</li>
						))}
					</ul>
				</nav>
			</header>
		);
	};
}

/** One item as a card: its name, linked when it has somewhere to point, and why it’s used. */
function ItemCard(handle: Handle<{ item: UsesPage.Item }>) {
	return () => {
		let { item } = handle.props;

		return (
			<li
				mix={[
					vstack({ gap: 1 }),
					p(4),
					rounded("lg"),
					border({ width: 1, color: "neutral" }),
					bg("neutral.bg-tint-hover"),
					minIs(0),
				]}
			>
				{item.href ? (
					<Link href={item.href} mix={[weight("semibold")]}>
						{item.name}
					</Link>
				) : (
					<span mix={[weight("semibold")]}>{item.name}</span>
				)}
				<span mix={[text("sm"), fg("neutral.muted"), leading("relaxed")]}>{item.note}</span>
			</li>
		);
	};
}

/**
 * A section: a heading the page's outline lists, an optional note, and its items in a grid
 * that drops to one column on a phone. Each anchors on its `id`, so a link can point at one.
 */
function Section(handle: Handle<{ section: UsesPage.Section }>) {
	return () => {
		let { section } = handle.props;

		return (
			<section aria-labelledby={section.id} mix={[grid(), gap(4), minIs(0)]}>
				<div mix={[grid(), gap(1)]}>
					<Heading level={2} id={section.id} mix={[m(0), text("2xl")]}>
						{section.title}
					</Heading>
					{section.note ? <p mix={[m(0), fg("neutral.muted")]}>{section.note}</p> : null}
				</div>
				<ul
					mix={[
						m(0),
						p(0),
						grid(),
						gap(3),
						gridTemplate({ columns: repeat("auto-fill", "minmax(min(100%, 16rem), 1fr)") }),
						raw({ listStyle: "none" }),
					]}
				>
					{section.items.map((item) => (
						<ItemCard key={item.name} item={item} />
					))}
				</ul>
			</section>
		);
	};
}

/**
 * The page.
 *
 * @returns View function rendering `/uses` in the page's language.
 */
export function UsesView() {
	return ({ model, assets }: { model: UsesView.Model; assets: DocumentAssets }) => {
		let { page } = model;

		return (
			<BlogLayout
				assets={assets}
				locale={page.locale}
				title={page.title}
				description={page.description}
			>
				<main mix={[grid(), gap(12), minIs(0)]}>
					<Header page={page} />
					{page.sections.map((section) => (
						<Section key={section.id} section={section} />
					))}
				</main>
			</BlogLayout>
		);
	};
}
