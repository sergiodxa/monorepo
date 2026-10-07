/**
 * View for the public `/search` page: a plain `GET` search form, then either nothing, the
 * reason a query cannot run, or a page of results whose matched words render as `<mark>`,
 * followed by a numbered pager. Works without JavaScript, as every public page here does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { formatParts, parseDate } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { flexWrap, gap, grid, gridTemplate, hstack, items } from "@sdxc/u/layout";
import { m, maxIs, mbs, p } from "@sdxc/u/size";
import { nowrap, tabularNums, text, weight } from "@sdxc/u/typography";
import { Badge, Button, FieldError, Heading, Label, Link, Pagination, SearchField } from "@sdxc/ui";

import type { SearchViewModel } from "~/app/http/view-models/search";

import { Highlighted } from "~/resources/components/highlighted";
import { BlogLayout } from "~/resources/layouts/blog";
import routes from "~/routes/web";

/**
 * Formats a publish instant for a result row, read on the UTC calendar so the day shown is
 * the same wherever the page renders.
 *
 * @returns A short English date, or an empty string when the value cannot be read.
 */
function formatDate(value: string) {
	let parsed = parseDate(value);
	if (isFailure(parsed)) return "";
	return formatParts(parsed.data, {
		locale: "en",
		timeZone: "UTC",
		month: "short",
		day: "2-digit",
		year: "numeric",
	})
		.map((part) => part.value)
		.join("");
}

/**
 * The search box. The browser submits it as `?q=` with no paging parameter, so a new query
 * always starts on its first page; an invalid query is marked on the field with its reason.
 */
function SearchForm(handle: Handle<{ query: string; message?: string }>) {
	return () => {
		let { query, message } = handle.props;

		return (
			<form method="get" action={routes.search.href()}>
				<SearchField>
					<Label htmlFor="search-q">Search articles, tutorials and the glossary</Label>
					<div mix={[grid(), gridTemplate({ columns: "1fr auto" }), gap(2), items("center")]}>
						<SearchField.Input
							id="search-q"
							name="q"
							defaultValue={query}
							placeholder="Remix, SQLite, OAuth…"
							color={message ? "danger" : undefined}
							aria-invalid={message ? "true" : undefined}
							aria-describedby={message ? "search-q-error" : undefined}
						/>
						<Button type="submit" color="brand">
							Search
						</Button>
					</div>
					{message ? <FieldError id="search-q-error">{message}</FieldError> : null}
				</SearchField>
			</form>
		);
	};
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

/** One result: its type and date, the highlighted title linking to it, and the excerpt. */
function ResultRow(handle: Handle<{ item: SearchViewModel.Item }>) {
	return () => {
		let { item } = handle.props;

		return (
			<li
				mix={[
					grid(),
					gap(2),
					p(4),
					rounded("lg"),
					bg("neutral.tint"),
					border({ width: 1, color: "neutral" }),
				]}
			>
				<div mix={[hstack({ gap: 2, align: "center" }), text("sm"), fg("neutral.muted")]}>
					<Badge color="neutral" variant="secondary">
						{item.kind}
					</Badge>
					{item.publishedAt ? (
						<time datetime={item.publishedAt} mix={[nowrap(), tabularNums()]}>
							{formatDate(item.publishedAt)}
						</time>
					) : null}
				</div>
				<p mix={[m(0), text("xl"), weight("bold"), fg("neutral.emphasis")]}>
					<Link href={item.href}>
						<Highlighted segments={item.title} />
					</Link>
				</p>
				{item.excerpt ? (
					<p mix={[m(0), text("base"), fg("neutral")]}>
						{item.excerpt.truncatedStart ? "… " : null}
						<Highlighted segments={item.excerpt.segments} />
						{item.excerpt.truncatedEnd ? " …" : null}
					</p>
				) : null}
			</li>
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
			meta={model.state === "blank" ? [] : [{ name: "robots", content: "noindex" }]}
		>
			<main mix={[grid(), gap(4)]}>
				<Heading level={1} mix={[text("3xl")]}>
					Search
				</Heading>
				<SearchForm
					query={model.query}
					message={model.state === "invalid" ? model.message : undefined}
				/>
				{model.state === "blank" ? (
					<p mix={[m(0), maxIs("52ch"), text("lg"), fg("neutral")]}>
						Type a few words to find posts by their title, tags or text. Quote a phrase to match it
						exactly, and put a minus before a word to leave it out.
					</p>
				) : null}
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
						<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(3)]}>
							{model.items.map((item) => (
								<ResultRow key={item.href} item={item} />
							))}
						</ol>
						{model.pager ? <ResultsPager pager={model.pager} /> : null}
					</section>
				) : null}
			</main>
		</BlogLayout>
	);
}
