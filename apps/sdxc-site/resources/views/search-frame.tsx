/**
 * View for the search dialog's frame, laid out as two floating surfaces: the live search box
 * as a pill, then a card under it with a tab per kind and the top matches drawn as activity
 * rows with their matched words marked. Rendered inside whichever page's dialog asked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { opacity, rounded, transition, transitionDelay } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, shrink } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { m, minBs, p, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";

import type { SearchResults } from "~/app/services/search-results";

import {
	SEARCH_CARD_ATTRIBUTE,
	SEARCH_LISTBOX_ID,
	SEARCH_RESULTS_ID,
	SearchBox,
	searchOptionId,
} from "~/resources/components/search-box";
import { SearchResult } from "~/resources/components/search-result";
import { searchSurface, searchSurfaceMotion } from "~/resources/components/search-surface";
import { SearchTabs } from "~/resources/components/search-tabs";
import { SEARCH_DIALOG_ID } from "~/resources/components/search-trigger";
import routes from "~/routes/web";

/** The dialog's search box id, apart from the `/search` page's own box. */
export const SEARCH_DIALOG_INPUT_ID = "site-search-q";

/** What both search boxes are named and show while empty. */
export const SEARCH_LABEL = "Search guides and packages";

/**
 * What the status line says. Blank text says nothing; a count is announced but not shown,
 * since the rows and the "See all" link already show it; a message is shown as well.
 */
function statusOf(model: SearchResults.Suggestions): string {
	if (model.state === "blank") return "";
	if (model.state === "invalid") return model.message;
	if (model.total === 0) return `Nothing matches “${model.query}”.`;
	if (model.total === 1) return "1 result";
	if (model.total <= model.items.length) return `${model.total} results`;
	return `Top ${model.items.length} of ${model.total} results`;
}

/**
 * Renders the dialog body. The form is a plain `GET` to `/search`, so Enter reaches the full
 * results with or without script; "See all" shows only while more match than are listed; the
 * status line, present in every state, is the one live region.
 */
export function SearchFrameView(handle: Handle<{ model: SearchResults.Suggestions }>) {
	return () => {
		let { model } = handle.props;
		let hasRows = model.state === "results" && model.items.length > 0;
		let status = statusOf(model);
		let tabs = model.state === "results" ? model.tabs : [];

		return (
			<>
				<search mix={[searchSurface(), searchSurfaceMotion(), rounded("full"), shrink(0)]}>
					<form method="get" action={routes.search.href()}>
						<SearchBox
							id={SEARCH_DIALOG_INPUT_ID}
							label={SEARCH_LABEL}
							query={model.query}
							frameSrc={routes.searchFrame.href()}
							dialogId={SEARCH_DIALOG_ID}
							optionCount={model.state === "results" ? model.items.length : 0}
							kind={model.state === "results" ? (model.kind ?? "") : ""}
							kinds={tabs.map((tab) => tab.kind ?? "")}
						/>
					</form>
				</search>
				<div
					id={SEARCH_RESULTS_ID}
					{...(hasRows || status !== "" ? { [SEARCH_CARD_ATTRIBUTE]: "" } : {})}
					mix={
						hasRows || status !== ""
							? [
									searchSurface(),
									searchSurfaceMotion(40),
									rounded("1.75rem"),
									minBs(0),
									overflowY("auto"),
									grid(),
									gap(2),
									p(2),
								]
							: undefined
					}
				>
					<p
						role="status"
						mix={
							hasRows || status === ""
								? [visuallyHidden()]
								: [m(0), pi(3), pb(2), text("sm"), fg("neutral.muted")]
						}
					>
						{status}
					</p>
					{tabs.length > 0 ? <SearchTabs tabs={tabs} /> : null}
					{model.state === "results" && model.items.length > 0 ? (
						<>
							<ol
								id={SEARCH_LISTBOX_ID}
								// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role -- HTML allows an ordered list to take the listbox role, which keeps the rows a list of links without script.
								role="listbox"
								aria-label="Top matches"
								mix={[
									m(0),
									p(0),
									listStyle("none"),
									grid(),
									gap(1),
									transition("opacity", { duration: 150 }),
									when(`:is(#${SEARCH_RESULTS_ID}[aria-busy="true"]) &`, [
										opacity(55),
										transitionDelay("150ms"),
									]),
								]}
							>
								{model.items.map((item, index) => (
									<SearchResult key={item.href} item={item} optionId={searchOptionId(index)} />
								))}
							</ol>
							{model.total > model.items.length ? (
								<p mix={[m(0), pi(3), pb(2), text("sm")]}>
									<Link href={model.seeAll}>See all {model.total} results →</Link>
								</p>
							) : null}
						</>
					) : null}
				</div>
			</>
		);
	};
}
