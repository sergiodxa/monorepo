/**
 * The shell a root-level prose page composes into: the site bar, a hero band naming the
 * page, and the page's body in a band under it, both inside the frame the landing is
 * drawn in. It carries no documentation tree, because a page at the root is not a step in
 * one — a reader arrives at it from a footer link or a search result rather than a sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, m, maxIs } from "@sdxc/u/size";
import { font, leading, text, textTransform, tracking } from "@sdxc/u/typography";
import { Typeset } from "@sdxc/ui";

import Band from "~/resources/components/band";
import { DisplayHeadings, ProseHeading } from "~/resources/components/prose";
import SiteHeader from "~/resources/components/site-header";

namespace PageLayout {
	export interface Props {
		/** The short label set above the title, naming what kind of page this is. */
		eyebrow: string;
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

/** Renders the bar, the page's hero band, and its body. */
export default function PageLayout(handle: Handle<PageLayout.Props>) {
	return () => {
		let { activePath, children, description, eyebrow, lastUpdated, title } = handle.props;

		return (
			<>
				<SiteHeader activePath={activePath} />

				<main mix={[vstack({ align: "center" }), is("100%")]}>
					<Band tone="grid" spacing="hero" ruled={false}>
						<DisplayHeadings>
							<header mix={[vstack({ gap: 6, align: "start" }), maxIs("48rem")]}>
								<p
									mix={[
										m(0),
										font("mono"),
										text("xs"),
										textTransform("uppercase"),
										tracking("widest"),
										fg("brand"),
									]}
								>
									[ {eyebrow} ]
								</p>
								<ProseHeading level={1}>{title}</ProseHeading>
								<p mix={[m(0), text("lg"), leading("relaxed"), fg("neutral")]}>{description}</p>
								{lastUpdated ? (
									<p mix={[m(0), font("mono"), text("xs"), fg("neutral.muted")]}>
										Last updated {lastUpdated}
									</p>
								) : null}
							</header>
						</DisplayHeadings>
					</Band>

					<Band>
						<Typeset preset="docs" mix={[is("100%"), maxIs("48rem")]}>
							{children}
						</Typeset>
					</Band>
				</main>
			</>
		);
	};
}
