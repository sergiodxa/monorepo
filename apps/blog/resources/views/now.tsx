/**
 * View for the now page: the heading with when it was last updated and where the author
 * lives, then one short section per area of focus, ending in a note on what a now page is
 * with the link to nownownow.com. Renders in either language from the same structure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle } from "remix/component";

import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, maxIs, minIs, p, pb, pbs, pi } from "@sdxc/u/size";
import { balance, leading, text, tracking, weight } from "@sdxc/u/typography";
import { Heading, Link } from "@sdxc/ui";

import type { NowPage } from "~/app/services/now-page";

import { nowUpdatedLabel } from "~/app/services/now-page";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/** Types used by the now page renderer. */
export namespace NowView {
	/** Data required to render the page. */
	export interface Model {
		page: NowPage;
	}
}

/**
 * The header: the language switcher and Markdown link, the heading, the update line a
 * returning reader checks first, and the intro.
 */
function Header(handle: Handle<{ page: NowPage }>) {
	return () => {
		let { page } = handle.props;

		return (
			<header mix={[grid(), gap(6)]}>
				<div mix={[hstack({ gap: 4, justify: "end", align: "center" }), flexWrap("wrap")]}>
					<Link
						href={`${routes.now.href()}?lang=${page.otherLanguage.locale}`}
						hreflang={page.otherLanguage.locale}
						lang={page.otherLanguage.locale}
						mix={[text("sm")]}
					>
						{page.otherLanguage.label}
					</Link>
					<Link href={`${routes.nowMarkdown.href()}?lang=${page.locale}`} mix={[text("sm")]}>
						{page.labels.viewMarkdown}
					</Link>
				</div>

				<div mix={[grid(), gap(3)]}>
					<Heading level={1} mix={[m(0), text("5xl"), tracking("tight"), balance()]}>
						{page.heading}
					</Heading>
					<p mix={[m(0), hstack({ gap: 2, align: "center" }), flexWrap("wrap"), text("sm")]}>
						<span
							mix={[
								pb(1),
								pi(3),
								rounded("full"),
								bg("brand.tint"),
								fg("brand.emphasis"),
								weight("medium"),
							]}
						>
							{page.labels.updated} <time datetime={page.updatedAt}>{nowUpdatedLabel(page)}</time>
						</span>
						<span mix={[fg("neutral.muted")]}>
							{page.labels.location} {page.location}
						</span>
					</p>
					<p mix={[m(0), text("xl"), fg("neutral.muted"), leading("relaxed"), maxIs("60ch")]}>
						{page.intro}
					</p>
				</div>
			</header>
		);
	};
}

/**
 * One area of focus: its title beside its items on a wide screen and above them on a
 * phone. Each anchors on its `id`, so a link can point at one part.
 */
function Section(handle: Handle<{ section: NowPage.Section }>) {
	return () => {
		let { section } = handle.props;

		return (
			<section
				aria-labelledby={section.id}
				mix={[
					grid(),
					gap(4),
					minIs(0),
					pbs(6),
					borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
					at("md", gridTemplate({ columns: "12rem minmax(0, 1fr)" })),
					at("md", gap(8)),
				]}
			>
				<Heading level={2} id={section.id} mix={[m(0), text("xl")]}>
					{section.title}
				</Heading>
				<ul mix={[m(0), p(0), grid(), gap(5), raw({ listStyle: "none" })]}>
					{section.items.map((item) => (
						<li key={item.title} mix={[vstack({ gap: 1 }), minIs(0)]}>
							{item.href ? (
								<Link href={item.href} mix={[weight("semibold"), text("lg")]}>
									{item.title}
								</Link>
							) : (
								<span mix={[weight("semibold"), text("lg")]}>{item.title}</span>
							)}
							<p mix={[m(0), leading("relaxed"), maxIs("65ch")]}>{item.text}</p>
						</li>
					))}
				</ul>
			</section>
		);
	};
}

/** The note on what a now page is, ending in the link to nownownow.com. */
function Explainer(handle: Handle<{ explainer: NowPage.Explainer }>) {
	return () => {
		let { explainer } = handle.props;

		return (
			<aside
				aria-labelledby="what-is-this"
				mix={[
					grid(),
					gap(2),
					p(5),
					rounded("xl"),
					border({ width: 1, color: "neutral" }),
					bg("neutral.bg-tint-hover"),
				]}
			>
				<Heading level={2} id="what-is-this" mix={[m(0), text("lg")]}>
					{explainer.title}
				</Heading>
				<p mix={[m(0), leading("relaxed"), fg("neutral.muted")]}>
					{explainer.text} <Link href={explainer.href}>{explainer.linkLabel}</Link>.
				</p>
			</aside>
		);
	};
}

/**
 * The page.
 *
 * @returns View function rendering the now page in its language.
 */
export function NowView() {
	return ({ model, assets }: { model: NowView.Model; assets: DocumentAssets }) => {
		let { page } = model;

		return (
			<BlogLayout
				assets={assets}
				locale={page.locale}
				title={page.title}
				description={page.description}
			>
				<main mix={[grid(), gap(10), minIs(0)]}>
					<Header page={page} />
					{page.sections.map((section) => (
						<Section key={section.id} section={section} />
					))}
					<Explainer explainer={page.explainer} />
				</main>
			</BlogLayout>
		);
	};
}
