/**
 * The site's top-level destinations, as a bar for the landing page and as a bare row
 * the documentation shell drops into its own header. Both surfaces offer the same
 * three places, so a reader who learns the header on one keeps it on the other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, borderEdge, fg } from "@sdxc/u/color";
import { hidden, hstack, inline, insBs, sticky } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, maxIs, mi, p } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { text, tracking, weight } from "@sdxc/u/typography";
import { NavLink } from "@sdxc/ui";
import { isApplePlatform } from "@sdxc/user-agent/helpers";

import { SearchPalette } from "~/resources/components/search-palette";
import routes from "~/routes/web";

/** Where the collection is read and its issues are filed. */
const REPOSITORY_HREF = "https://github.com/sergiodxa/monorepo";

namespace SiteHeader {
	export interface Props {
		/** The path being read, which is what marks one destination as the current page. */
		activePath?: string;
	}

	export interface NavProps extends Props {}
}

/** Renders the wordmark and the destinations, as the bar a page hangs under. */
export default function SiteHeader(handle: Handle<SiteHeader.Props>) {
	return () => (
		<header
			mix={[
				sticky(),
				insBs(0),
				/* The bar holds the viewport, so it has to paint over the page passing under it. */
				z(10),
				is("100%"),
				/* The documentation shell's header is this tall too, so the bar holds still between them. */
				bs("4rem"),
				bg(),
				borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
			]}
		>
			<div
				mix={[
					hstack({ gap: 4, align: "center", justify: "between" }),
					is("100%"),
					bs("100%"),
					/* The bar lines up with the frame the landing bands are drawn in. */
					maxIs("76rem"),
					mi("auto"),
					p(0, 5),
					media("(min-width: 48rem)", p(0, 12)),
				]}
			>
				<a
					href={routes.home.href()}
					mix={[fg("neutral.emphasis"), text("lg"), weight("semibold"), tracking("tight")]}
				>
					sdxc
				</a>

				<SiteNav activePath={handle.props.activePath} />
			</div>
		</header>
	);
}

/** Renders the destinations alone, for a shell that already draws its own bar. */
export function SiteNav(handle: Handle<SiteHeader.NavProps>) {
	return () => {
		let { activePath = "" } = handle.props;
		let docsPath = routes.docs.index.href();
		let apiPath = routes.api.index.href();
		let utilitiesPath = routes.api.show.href({ name: "u" });
		let componentsPath = routes.api.show.href({ name: "ui" });

		/** Each catalogue sits under `/api`, so the broader link yields to the narrower ones. */
		let onUtilities = isWithin(activePath, utilitiesPath);
		let onComponents = isWithin(activePath, componentsPath);
		let onDocs = isWithin(activePath, docsPath);
		let onApi = isWithin(activePath, apiPath) && !onUtilities && !onComponents;

		return (
			<div mix={[hstack({ gap: 3, align: "center" })]}>
				{/* Sixty packages and a large README corpus are unusable without this, from any page. */}
				<SearchPalette
					appleKeyboard={isApplePlatform()}
					indexHref={routes.searchIndex.href()}
					fallbacks={[
						{ label: "All guides", href: docsPath },
						{ label: "All packages", href: apiPath },
					]}
				/>

				<nav
					aria-label="Site"
					mix={[
						hstack({ gap: 4, align: "center" }),
						text("sm"),
						media("(min-width: 30rem)", [hstack({ gap: 6, align: "center" }), text("base")]),
					]}
				>
					<NavLink href={docsPath} aria-current={onDocs ? "page" : undefined}>
						Docs
					</NavLink>
					<NavLink href={apiPath} aria-current={onApi ? "page" : undefined}>
						API
					</NavLink>
					<NavLink href={utilitiesPath} aria-current={onUtilities ? "page" : undefined}>
						U
					</NavLink>
					<NavLink href={componentsPath} aria-current={onComponents ? "page" : undefined}>
						UI
					</NavLink>
					{/* A phone has no room for all six; the footer links the source on every page. */}
					<span mix={[hidden(), media("(min-width: 30rem)", inline())]}>
						<NavLink href={REPOSITORY_HREF} rel="noreferrer">
							GitHub
						</NavLink>
					</span>
				</nav>
			</div>
		);
	};
}

/**
 * Whether a path is the destination or a page beneath it. A segment boundary is what
 * keeps `/api/ui` from counting as a page under `/api/u`.
 */
function isWithin(path: string, destination: string): boolean {
	return path === destination || path.startsWith(`${destination}/`);
}
