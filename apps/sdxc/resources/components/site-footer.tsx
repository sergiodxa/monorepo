/**
 * The bar every page ends on: where the argument for these packages is made, where
 * the applications built on them are listed, where the source is read, and who funds
 * the work. It closes the document, so it repeats no navigation the header already
 * offers and instead points at the pages a reader reaches once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { borderEdge, fg } from "@sdxc/u/color";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { NavLink } from "@sdxc/ui";

import type { Sponsor } from "~/app/services/sponsors";

import Sponsors from "~/resources/components/sponsors";
import routes from "~/routes/web";

/** Where the collection is read and its issues are filed. */
const REPOSITORY_HREF = "https://github.com/sergiodxa/monorepo";

/** The author's own site, which is where the writing about this work lives. */
const AUTHOR_HREF = "https://sergiodxa.com";

namespace SiteFooter {
	export interface Props {
		/** The people to name, empty while the list is unknown. */
		sponsors: Sponsor[];
	}
}

/** Renders the closing bar. */
export default function SiteFooter(handle: Handle<SiteFooter.Props>) {
	return () => (
		<footer
			mix={[
				vstack({ align: "center" }),
				is("100%"),
				borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
			]}
		>
			<div
				mix={[
					vstack({ gap: 8 }),
					is("100%"),
					maxIs("80rem"),
					p(10, 5),
					media("(min-width: 48rem)", p(12, 8)),
				]}
			>
				<Sponsors sponsors={handle.props.sponsors} />

				<nav
					aria-label="Elsewhere on this site"
					mix={[hstack({ gap: 5, align: "center" }), flexWrap(), text("sm")]}
				>
					<NavLink href={routes.philosophy.href()}>Philosophy</NavLink>
					<NavLink href={routes.showcase.href()}>Showcase</NavLink>
					<NavLink href={routes.docs.changelog.href()}>Changelog</NavLink>
					<NavLink href={routes.maintenance.href()}>Maintenance</NavLink>
					<NavLink href={routes.security.href()}>Security</NavLink>
					<NavLink href={REPOSITORY_HREF} rel="noreferrer">
						Source
					</NavLink>
				</nav>

				<p mix={[m(0), text("sm"), fg("neutral")]}>
					MIT licensed, and written by{" "}
					<a href={AUTHOR_HREF} mix={[fg("brand")]}>
						Sergio Xalambrí
					</a>
					.
				</p>
			</div>
		</footer>
	);
}
