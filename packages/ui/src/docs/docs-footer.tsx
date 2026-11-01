/**
 * The compact footer closing a docs page inside the content and rail columns: the page's own
 * closing pieces (a byline, feedback, an edit link) over one row of legal and site links, so
 * the docked sidebar keeps running to the viewport's foot beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode, Props as TagProps } from "remix/component";

import { borderEdge, fg } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { flex, flexWrap, gap, items, justify, vstack } from "@sdxc/u/layout";
import { m, minIs, p, pbe, pbs } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

/**
 * Prop types for {@link DocsFooter}.
 */
export namespace DocsFooter {
	/** One destination in the footer's link row; a `SiteFooter.Link` fits as is. */
	export interface Link {
		label: RemixNode;
		href: string;
	}

	/** Props accepted by {@link DocsFooter}. */
	export interface Props extends Omit<TagProps<"footer">, "children"> {
		/** The page's closing pieces, stacked above the link row: a byline, feedback, an edit link. */
		children?: RemixNode;
		/** The copyright or legal line opening the link row, such as "© 2026 Acme". */
		legal?: RemixNode;
		/** Legal and site links, in the order they read. */
		links?: Link[];
		/** Accessible name of the links' navigation landmark, such as "Site". */
		linksLabel?: string;
	}
}

/**
 * Renders the closing pieces, then the legal line and the links on one row that wraps on a
 * narrow screen. Pass it as `DocsLayout`'s `footer`, which confines it to the article and rail.
 *
 * @param handle Runtime handle carrying the footer's props.
 * @returns The render function producing the footer's markup.
 * @example
 * <DocsFooter legal="© 2026 Acme" links={[{ label: "Privacy", href: "/privacy" }]} linksLabel="Site"><AuthorNote /></DocsFooter>
 */
export function DocsFooter(handle: Handle<DocsFooter.Props>) {
	return () => {
		let { children, legal, links = [], linksLabel, mix, ...rest } = handle.props;
		let hasMeta = legal !== undefined || links.length > 0;

		return (
			<footer
				{...rest}
				data-slot="docs-footer"
				mix={mergeMix(
					[
						vstack({ gap: 6, align: "stretch" }),
						minIs(0),
						pbs("2rem"),
						pbe("2.5rem"),
						borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
						text("sm"),
						fg("neutral.muted"),
					],
					mix,
				)}
			>
				{children ? (
					<div data-slot="docs-footer-content" mix={[vstack({ gap: 4, align: "stretch" })]}>
						{children}
					</div>
				) : null}
				{hasMeta ? (
					<div
						data-slot="docs-footer-meta"
						mix={[
							flex(),
							flexWrap("wrap"),
							items("center"),
							justify("between"),
							gap(2, 6),
							when("& p", m(0)),
						]}
					>
						{legal === undefined ? null : <p>{legal}</p>}
						{links.length > 0 ? (
							<nav aria-label={linksLabel}>
								<ul
									mix={[
										flex(),
										flexWrap("wrap"),
										gap(2, 5),
										m(0),
										p(0),
										raw({ listStyle: "none" }),
									]}
								>
									{links.map((link) => (
										<li key={link.href}>
											<a
												href={link.href}
												mix={[fg("neutral.muted"), hover(fg("neutral.emphasis"))]}
											>
												{link.label}
											</a>
										</li>
									))}
								</ul>
							</nav>
						) : null}
					</div>
				) : null}
			</footer>
		);
	};
}
