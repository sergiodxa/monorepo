/**
 * The shell a root-level prose page composes into: the site bar above it, and the page's
 * own heading and body in a single column under it. It carries no documentation tree,
 * because a page at the root is not a step in one — a reader arrives at it from a footer
 * link or a search result rather than from a sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, p } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";

import SiteHeader from "~/resources/components/site-header";

namespace PageLayout {
	export interface Props {
		/** The heading the page opens with. */
		title: string;
		/** The sentence under it, which is also the page's own meta description. */
		description: string;
		/** When the policy on this page last changed, where the page records one. */
		lastUpdated?: string;
		/** The path being read, which is what marks one destination as the current page. */
		activePath: string;
		/** The page's body, already rendered from its markdown. */
		children: RemixNode;
	}
}

/** Renders the bar and the page under it. */
export default function PageLayout(handle: Handle<PageLayout.Props>) {
	return () => {
		let { activePath, children, description, lastUpdated, title } = handle.props;

		return (
			<>
				<SiteHeader activePath={activePath} />

				<main mix={[vstack({ align: "center" }), is("100%")]}>
					<article
						mix={[
							is("100%"),
							maxIs("48rem"),
							p(10, 5, 16, 5),
							media("(min-width: 48rem)", p(16, 8, 20, 8)),
						]}
					>
						<header mix={[vstack({ gap: 3 })]}>
							<h1 mix={[m(0), text("4xl"), weight("bold"), tracking("tight")]}>{title}</h1>
							<p mix={[m(0), text("lg"), fg("neutral")]}>{description}</p>
							{lastUpdated ? (
								<p mix={[m(0), text("sm"), fg("neutral.muted")]}>Last updated {lastUpdated}</p>
							) : null}
						</header>

						<Typeset preset="docs" mix={[m("2.5rem", 0, 0, 0)]}>
							{children}
						</Typeset>
					</article>
				</main>
			</>
		);
	};
}
