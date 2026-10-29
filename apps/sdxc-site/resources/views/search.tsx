/**
 * View for the `/search` page: a plain `GET` search form, then either nothing, the reason a
 * query cannot run, or a page of matches whose matched words render as `<mark>`, followed by a
 * numbered pager. It works without script, which is what the header's trigger links to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle } from "remix/component";

import { ChevronRightIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded, shadow, transition } from "@sdxc/u/effects";
import { cursor, listStyle, raw } from "@sdxc/u/general";
import {
	contents,
	gap,
	grid,
	gridTemplate,
	hidden,
	inlineFlex,
	items,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, mbs, p, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { rotate } from "@sdxc/u/transform";
import { font, nowrap, tabularNums, text } from "@sdxc/u/typography";
import { FieldError, Heading } from "@sdxc/ui";

import type { SearchResults } from "~/app/services/search-results";

import Band from "~/resources/components/band";
import { QuietSearchInput, QuietSearchRow } from "~/resources/components/quiet-search-input";
import { ResultsPager } from "~/resources/components/results-pager";
import { SearchResult } from "~/resources/components/search-result";
import SiteHeader from "~/resources/components/site-header";
import DocumentLayout from "~/resources/layouts/document";
import { SEARCH_LABEL } from "~/resources/views/search-frame";
import routes from "~/routes/web";

/**
 * The search box: the dialog's quiet field, unlabelled since the heading names the page, on a
 * surface that darkens its border and lifts while focused. Enter submits `?q=` with no paging
 * parameter, so a new query starts on its first page; an invalid one turns the border red.
 */
function SearchForm(handle: Handle<{ query: string; message?: string }>) {
	return () => {
		let { query, message } = handle.props;

		return (
			<search>
				<form method="get" action={routes.search.href()}>
					<QuietSearchRow
						mix={[
							pi(4),
							rounded("lg"),
							border({ width: 1, color: message ? "danger" : "neutral" }),
							bg("neutral.tint"),
							transition("border-color, box-shadow"),
							when("&:focus-within", [border(message ? "danger" : "neutral.strong"), shadow("sm")]),
						]}
					>
						<QuietSearchInput
							type="search"
							id="search-q"
							name="q"
							defaultValue={query}
							aria-label={SEARCH_LABEL}
							placeholder={SEARCH_LABEL}
							enterkeyhint="search"
							autofocus={query === ""}
							aria-invalid={message ? "true" : undefined}
							aria-describedby={message ? "search-q-error" : undefined}
						/>
					</QuietSearchRow>
					{message ? (
						<FieldError id="search-q-error" mix={[mbs(2)]}>
							{message}
						</FieldError>
					) : null}
				</form>
			</search>
		);
	};
}

/** What each piece of the search syntax does, as the tips list it. */
const SYNTAX: ReadonlyArray<{ example: string; meaning: string }> = [
	{ example: "data table", meaning: "both words" },
	{ example: '"route pattern"', meaning: "the exact phrase" },
	{ example: "-legacy", meaning: "leave a word out" },
	{ example: "cookie OR session", meaning: "either word" },
	{ example: "kind:guide", meaning: "guide, api, u or ui" },
	{ example: "-kind:api", meaning: "leave a kind out" },
];

/**
 * A piece of search syntax as typed: monospace a step smaller than the text around it, which
 * evens out the face's larger x-height, on a subtle tint that adds width but no height.
 */
function SyntaxChip(handle: Handle<{ children: string }>) {
	return () => (
		<code
			mix={[
				font("mono"),
				pi(1),
				rounded("sm"),
				bg("neutral.bg-tint-hover"),
				fg("neutral.emphasis"),
				nowrap(),
				raw({ fontSize: "0.85em", lineHeight: "inherit" }),
			]}
		>
			{handle.props.children}
		</code>
	);
}

/**
 * The search syntax, collapsed under the field behind a small muted summary with a chevron
 * that turns when open: one tip a row, the chips in a column as wide as the widest of them
 * and the meanings beside it, stacked under their chip on the narrowest screens.
 */
function SyntaxHelp() {
	return () => (
		<details mix={[text("sm"), fg("neutral.muted")]}>
			<summary
				mix={[
					inlineFlex(),
					items("center"),
					gap(1),
					cursor("pointer"),
					listStyle("none"),
					rounded("sm"),
					when("&::-webkit-details-marker", hidden()),
					hover(fg("neutral.emphasis")),
				]}
			>
				<ChevronRightIcon
					size="1em"
					mix={[
						shrink(0),
						transition("transform"),
						when(":is(details[open]) > summary > &", rotate(90)),
						media("(prefers-reduced-motion: reduce)", raw({ transition: "none" })),
					]}
				/>
				Search tips
			</summary>
			<dl
				mix={[
					m(0),
					mbs(3),
					grid(),
					gridTemplate({ columns: "max-content minmax(0, 1fr)" }),
					items("baseline"),
					raw({ columnGap: "1rem", rowGap: "0.5rem" }),
					media("(max-width: 22rem)", [
						gridTemplate({ columns: "minmax(0, 1fr)" }),
						raw({ rowGap: "0.25rem" }),
					]),
				]}
			>
				{SYNTAX.map((row) => (
					<div key={row.example} mix={[contents()]}>
						<dt>
							<SyntaxChip>{row.example}</SyntaxChip>
						</dt>
						<dd mix={[m(0)]}>{row.meaning}</dd>
					</div>
				))}
			</dl>
		</details>
	);
}

/**
 * Renders the search page. A query page carries `noindex` through its controller: result
 * pages are a view of the pages the sitemap already lists, one per query anybody types.
 */
export function SearchView(
	handle: Handle<{ model: SearchResults.Model; assets: DocumentAssets; canonical: string }>,
) {
	return () => {
		let { assets, canonical, model } = handle.props;

		return (
			<DocumentLayout
				assets={assets}
				title={model.state === "blank" ? "Search — sdxc" : `Search: ${model.query} — sdxc`}
				description="Search every guide and package reference on sdxc."
				canonical={canonical}
			>
				<SiteHeader activePath={routes.search.href()} searchQuery={model.query} />

				<main mix={[vstack({ align: "center" }), is("100%")]}>
					<Band>
						<div mix={[grid(), gap(4), is("100%"), maxIs("48rem")]}>
							<Heading level={1} mix={[text("3xl")]}>
								Search
							</Heading>
							<div mix={[grid(), gap(3)]}>
								<SearchForm
									query={model.query}
									message={model.state === "invalid" ? model.message : undefined}
								/>
								<SyntaxHelp />
							</div>
							{model.state === "results" && model.items.length === 0 ? (
								<p mix={[m(0), text("lg"), fg("neutral")]}>Nothing matches “{model.query}”.</p>
							) : null}
							{model.state === "results" && model.items.length > 0 ? (
								<section aria-label="Search results" mix={[grid(), gap(3)]}>
									<p mix={[m(0), text("sm"), fg("neutral.muted"), tabularNums()]}>
										{model.total === 1
											? "1 result"
											: `${model.from}–${model.to} of ${model.total} results`}
									</p>
									<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(1)]}>
										{model.items.map((item) => (
											<SearchResult key={item.href} item={item} />
										))}
									</ol>
									{model.pager ? (
										<ResultsPager label="Search result pages" pager={model.pager} />
									) : null}
								</section>
							) : null}
						</div>
					</Band>
				</main>
			</DocumentLayout>
		);
	};
}
