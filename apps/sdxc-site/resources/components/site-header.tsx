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
import { rounded, transition, transitionBehavior } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hidden, hstack, inline, insBs, sticky, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { light, media } from "@sdxc/u/responsive";
import { bs, is, maxBs, maxIs, mi, minBs, p } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { when } from "@sdxc/u/state";
import { text, tracking, weight } from "@sdxc/u/typography";
import { Dialog, NavLink } from "@sdxc/ui";
import { isApplePlatform } from "@sdxc/user-agent/helpers";
import { Frame } from "remix/component";

import { searchFrameSrc } from "~/resources/components/search-box";
import { SearchQuickLinks } from "~/resources/components/search-quick-links";
import { SEARCH_EXIT_MS } from "~/resources/components/search-surface";
import { SEARCH_DIALOG_ID, SearchTrigger } from "~/resources/components/search-trigger";
import routes from "~/routes/web";

/** Where the collection is read and its issues are filed. */
const REPOSITORY_HREF = "https://github.com/sergiodxa/monorepo";

namespace SiteHeader {
	export interface Props {
		/** The path being read, which is what marks one destination as the current page. */
		activePath?: string;
		/**
		 * Text the search dialog opens holding, with its results already rendered; the
		 * `/search` page passes its own query so the dialog continues that search.
		 */
		searchQuery?: string;
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

				z(10),
				is("100%"),

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

				<SiteNav activePath={handle.props.activePath} searchQuery={handle.props.searchQuery} />
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
				<SearchTrigger appleKeyboard={isApplePlatform()} />
				<Dialog
					id={SEARCH_DIALOG_ID}
					aria-label="Search the documentation"
					closedby="any"
					mix={[
						p(0),
						bg("transparent"),
						rounded("none"),
						overflow("visible"),
						raw({ boxShadow: "none" }),
						transitionBehavior("allow-discrete"),
						transition("display, overlay", { duration: SEARCH_EXIT_MS }),
						light(when("&::backdrop", bg("rgb(0 0 0 / 0.12)"))),
						is("min(40rem, 100% - 2rem)"),
						maxIs("none"),
						maxBs("calc(100dvh - min(12vh, 6rem) - 1rem)"),
						raw({ marginBlock: "min(12vh, 6rem) auto" }),
					]}
				>
					<div mix={[vstack({ gap: 2 }), minBs(0)]}>
						<Frame
							name="search"
							src={searchFrameSrc(routes.searchFrame.href(), handle.props.searchQuery ?? "")}
						/>
						<SearchQuickLinks currentPath={activePath} />
					</div>
				</Dialog>

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
