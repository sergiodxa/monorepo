/**
 * View for the public `/search` page: a plain `GET` search form, then either nothing, the
 * reason a query cannot run, or a page of results whose matched words render as `<mark>`,
 * followed by a numbered pager. Works without JavaScript, as every public page here does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, listStyle, raw } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, inlineFlex, repeat } from "@sdxc/u/layout";
import { m, mbs, p, pi } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { nowrap, tabularNums, text } from "@sdxc/u/typography";
import { FieldError, Heading, Pagination } from "@sdxc/ui";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { QuietSearchInput, QuietSearchRow } from "~/resources/components/quiet-search-input";
import { SearchResult } from "~/resources/components/search-result";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * The search box, in the same quiet field the search panel uses, on a bordered surface
 * whose border turns brand while the field has focus. Enter submits it, with or without
 * script, as `?q=` with no paging parameter, so a new query starts on its first page; the
 * field carries no visible label, since the page heading names it, and an invalid query is
 * marked on the surface with its reason underneath.
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
							when("&:focus-within", border(message ? "danger" : "brand")),
						]}
					>
						<QuietSearchInput
							type="search"
							id="search-q"
							name="q"
							defaultValue={query}
							aria-label="Search articles, tutorials and the glossary"
							placeholder="Search articles, tutorials and the glossary"
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
	{ example: "remix router", meaning: "both words" },
	{ example: '"route pattern"', meaning: "the exact phrase" },
	{ example: "-legacy", meaning: "leave a word out" },
	{ example: "remix OR react", meaning: "either word" },
	{ example: "title:forms", meaning: "a word in the title" },
	{ example: 'tag:"react router"', meaning: "tutorials with a tag" },
	{ example: "kind:tutorial", meaning: "article, tutorial or glossary" },
	{ example: "lang:es", meaning: "posts in a language" },
];

/**
 * The search syntax, collapsed under the field behind a small muted summary: each piece as
 * a chip the size of the text beside its meaning, in as many columns as the width holds.
 */
function SyntaxHelp() {
	return () => (
		<details mix={[text("sm"), fg("neutral.muted")]}>
			<summary mix={[inlineFlex(), cursor("pointer"), hover(fg("neutral.emphasis"))]}>
				Search tips
			</summary>
			<dl
				mix={[
					m(0),
					mbs(3),
					grid(),
					gridTemplate({ columns: repeat("auto-fill", "minmax(15rem, 1fr)") }),
					raw({ columnGap: "1.5rem", rowGap: "0.5rem" }),
				]}
			>
				{SYNTAX.map((row) => (
					<div key={row.example} mix={[hstack({ gap: 2, align: "baseline" })]}>
						<dt>
							<code
								mix={[
									pi(1.5),
									rounded("sm"),
									bg("neutral.bg-tint-hover"),
									fg("neutral.emphasis"),
									nowrap(),
									raw({ fontSize: "inherit" }),
								]}
							>
								{row.example}
							</code>
						</dt>
						<dd mix={[m(0)]}>{row.meaning}</dd>
					</div>
				))}
			</dl>
			<p mix={[m(0), mbs(3)]}>Filters alone, like tag:remix, list the newest posts first.</p>
		</details>
	);
}

/** The numbered pager under a results page, with the current page marked for assistive tech. */
function ResultsPager(handle: Handle<{ pager: SearchViewModel.Pager }>) {
	return () => {
		let { pager } = handle.props;

		return (
			<Pagination aria-label="Search result pages" mix={[mbs(4)]}>
				<Pagination.List mix={[flexWrap("wrap")]}>
					{pager.prev ? (
						<Pagination.Item>
							<Pagination.Link href={pager.prev} rel="prev">
								Previous
							</Pagination.Link>
						</Pagination.Item>
					) : null}
					{pager.items.map((item, index) =>
						item.type === "gap" ? (
							<Pagination.Item key={`gap-${index}`}>
								<Pagination.Link aria-disabled="true">…</Pagination.Link>
							</Pagination.Item>
						) : (
							<Pagination.Item key={`page-${item.page}`}>
								<Pagination.Link
									href={item.href}
									aria-current={item.current ? "page" : undefined}
									aria-label={`Page ${item.page}`}
								>
									{item.page}
								</Pagination.Link>
							</Pagination.Item>
						),
					)}
					{pager.next ? (
						<Pagination.Item>
							<Pagination.Link href={pager.next} rel="next">
								Next
							</Pagination.Link>
						</Pagination.Item>
					) : null}
				</Pagination.List>
			</Pagination>
		);
	};
}

/**
 * Creates the search page renderer. A query page carries `noindex`: result pages are a view
 * of the posts the sitemap already lists, one per query anybody types.
 *
 * @returns A view function that renders from a search model.
 */
export function SearchView() {
	return ({ model }: { model: SearchViewModel.Model }) => (
		<BlogLayout
			title={model.state === "blank" ? "Search" : `Search: ${model.query}`}
			description="Search the articles, tutorials and glossary entries I have published."
			activePath={routes.search.href()}
			searchQuery={model.query}
			meta={model.state === "blank" ? [] : [{ name: "robots", content: "noindex" }]}
		>
			<main mix={[grid(), gap(4)]}>
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
					<p mix={[m(0), text("lg"), fg("neutral")]}>No posts match “{model.query}”.</p>
				) : null}
				{model.state === "results" && model.items.length > 0 ? (
					<section aria-label="Search results" mix={[grid(), gap(3)]}>
						<p mix={[m(0), text("sm"), fg("neutral.muted"), tabularNums()]}>
							{model.total === 1
								? "1 result"
								: `${model.from}–${model.to} of ${model.total} results`}
						</p>
						<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(4)]}>
							{model.items.map((item) => (
								<SearchResult key={item.href} item={item} />
							))}
						</ol>
						{model.pager ? <ResultsPager pager={model.pager} /> : null}
					</section>
				) : null}
			</main>
		</BlogLayout>
	);
}
