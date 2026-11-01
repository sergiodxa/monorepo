/**
 * The pages every docs demo shares beside its own: the hub at its root, the search page its
 * header submits to, and the 404 that searches for the address a reader mistyped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { pretty, text, weight } from "@sdxc/u/typography";
import { Highlight, SearchField } from "@sdxc/ui";
import { DocsHub, DocsNotFound, flattenDocsTree } from "@sdxc/ui/docs";

import type { DemoDocsResult } from "~/app/services/demo-docs-search";
import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { SEARCH_PAGE } from "~/resources/views/demo-docs/shell";

namespace SearchBox {
	export interface Props {
		site: DemoDocsSite;
		slug: string;
		query?: string;
		/** Puts the caret in the box, on the page whose whole job is searching. */
		autofocus?: boolean;
	}
}

/** The site's search as a plain form, so it works before any script has loaded. */
function SearchBox(handle: Handle<SearchBox.Props>) {
	return () => {
		let { autofocus, query, site, slug } = handle.props;
		return (
			<form method="get" action={demoDocsHref(slug)(SEARCH_PAGE)} role="search">
				<SearchField>
					<SearchField.Input
						name="q"
						defaultValue={query}
						autofocus={autofocus}
						placeholder={`Search ${site.name} docs`}
						aria-label={`Search ${site.name} docs`}
					/>
				</SearchField>
			</form>
		);
	};
}

namespace DemoDocsHome {
	export interface Props {
		site: DemoDocsSite;
		slug: string;
	}
}

/** The hub: what the docs cover, where a newcomer starts, and every section by topic. */
export function DemoDocsHome(handle: Handle<DemoDocsHome.Props>) {
	return () => {
		let { site, slug } = handle.props;
		return (
			<DocsHub
				{...site.hub}
				search={<SearchBox site={site} slug={slug} />}
				labels={{
					start: "Start here",
					sections: "Browse by topic",
					topics: "Popular topics",
					popular: "Popular pages",
				}}
				formatCount={(count) => (count === 1 ? "1 page" : `${count} pages`)}
			/>
		);
	};
}

namespace DemoDocsSearch {
	export interface Props {
		site: DemoDocsSite;
		slug: string;
		query: string;
		results: DemoDocsResult[];
	}
}

/**
 * The search page: the box holding the query, then each matching page with the words that
 * matched marked. With no query it lists every section's pages, so the page still routes a
 * reader who arrived from the header's search link on a phone.
 */
export function DemoDocsSearch(handle: Handle<DemoDocsSearch.Props>) {
	return () => {
		let { query, results, site, slug } = handle.props;
		let trimmed = query.trim();
		let heading = (() => {
			if (trimmed === "") return `Search the ${site.name} docs`;
			if (results.length === 0) return `No results for “${trimmed}”`;
			return `${results.length === 1 ? "1 result" : `${results.length} results`} for “${trimmed}”`;
		})();

		return (
			<div mix={[vstack({ gap: 8, align: "stretch" })]}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<h1
						aria-live="polite"
						mix={[
							m(0),
							text("3xl"),
							fg("neutral.emphasis"),
							raw({ fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.15 }),
						]}
					>
						{heading}
					</h1>
					<div mix={[raw({ maxInlineSize: "36rem" })]}>
						<SearchBox site={site} slug={slug} query={query} autofocus />
					</div>
				</div>

				{trimmed !== "" && results.length === 0 ? (
					<p mix={[m(0), pretty(), fg("neutral")]}>
						Try a shorter word, or a word from a page’s title. Every page is also listed in the
						menu.
					</p>
				) : null}

				{results.length > 0 ? (
					<ul mix={[m(0), p(0), listStyle("none"), vstack({ gap: 1, align: "stretch" })]}>
						{results.map((result) => (
							<li key={result.href}>
								<a href={result.href} mix={[resultRow()]}>
									<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
										<Highlight segments={result.titleSegments} />
									</span>
									<span mix={[text("sm"), pretty(), fg("neutral")]}>
										<Highlight segments={result.excerpt} />
									</span>
								</a>
							</li>
						))}
					</ul>
				) : null}

				{trimmed === "" ? <AllPages site={site} /> : null}
			</div>
		);
	};
}

/** A result's whole row as one link, tinted on hover. */
function resultRow() {
	return [
		vstack({ gap: 1, align: "stretch" }),
		raw({
			padding: "0.75rem",
			marginInline: "-0.75rem",
			borderRadius: "0.5rem",
			textDecoration: "none",
		}),
		hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint)" })),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" })),
	];
}

/** Every page by section, for the search page before a query. */
function AllPages(handle: Handle<{ site: DemoDocsSite }>) {
	return () => {
		let pages = flattenDocsTree(handle.props.site.tree);
		let sections = [...new Set(pages.map((page) => page.section))];
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gap: "2rem",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))",
					}),
				]}
			>
				{sections.map((section) => (
					<section key={section} mix={[vstack({ gap: 2, align: "stretch" })]}>
						<h2 mix={[m(0), text("sm"), weight("semibold"), fg("neutral.emphasis")]}>{section}</h2>
						<ul mix={[m(0), p(0), listStyle("none"), vstack({ gap: 1, align: "stretch" })]}>
							{pages
								.filter((page) => page.section === section)
								.map((page) => (
									<li key={page.href}>
										<a
											href={page.href}
											mix={[
												hstack({ gap: 2, align: "center" }),
												raw({ textDecoration: "none", paddingBlock: "0.25rem" }),
												text("sm"),
												fg("neutral"),
												hover(fg("brand")),
											]}
										>
											<ArrowRightIcon size={14} aria-hidden="true" />
											{page.title}
										</a>
									</li>
								))}
						</ul>
					</section>
				))}
			</div>
		);
	};
}

namespace DemoDocsMissing {
	export interface Props {
		site: DemoDocsSite;
		slug: string;
		/** The address that matched no page. */
		path: string;
		/** What the address reads as, which pre-fills the search box. */
		query: string;
	}
}

/** The 404: the address that missed, the search pre-filled from it, and the hub's start links. */
export function DemoDocsMissing(handle: Handle<DemoDocsMissing.Props>) {
	return () => {
		let { path, query, site, slug } = handle.props;
		return (
			<DocsNotFound
				path={path}
				search={<SearchBox site={site} slug={slug} query={query} />}
				links={site.hub.start.map((item) => ({
					title: item.title,
					href: item.href,
					description: item.description,
				}))}
				labels={{
					eyebrow: "404",
					title: "This page isn’t here",
					body: "No page answers to this address. It may have moved; search for it, or start from one of these.",
					linksTitle: "Start from one of these",
				}}
			/>
		);
	};
}
