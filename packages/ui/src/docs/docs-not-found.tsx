/**
 * The body of a docs 404, drawn inside the docs shell so the sidebar stays: the address
 * that matched nothing, the app's search pre-filled from that address, and a few places to
 * start. A reader who mistyped a slug searches for it instead of starting over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { bg, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, mergeMix, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { balance, font, pretty, text, textTransform, tracking, weight } from "@sdxc/u/typography";

import type { HeadingLevel } from "../components/heading-scope.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/**
 * Prop types for {@link DocsNotFound}.
 */
export namespace DocsNotFound {
	/** A page to start from, usually the hub's start links. */
	export interface Link {
		title: string;
		href: string;
		/** One line under the title saying what the page gets the reader. */
		description?: string;
	}

	/** Every string the 404 shows, so each app supplies them in the reader's language. */
	export interface Labels {
		/** The page title ("Page not found"). */
		title: string;
		/** One sentence under the title ("No page answers to this address. Search for it instead."). */
		body: RemixNode;
		/** Heading over the start links ("Start from one of these"). */
		linksTitle: string;
		/** Small line above the title ("404"). */
		eyebrow?: string;
	}

	/** Props accepted by {@link DocsNotFound}. */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** The address that matched nothing, shown as code so the reader spots the typo. */
		path: string;
		/** The app's search field, pre-filled with {@link searchQueryFromPath} of `path`. */
		search?: RemixNode;
		links: Link[];
		labels: Labels;
	}
}

/** File extensions a docs address may carry that name no words of the page. */
const PAGE_EXTENSION = /\.(md|mdx|html?|txt)$/i;

/**
 * The search a docs 404 pre-fills: the address's last segment, decoded, without a page
 * extension, with `-`, `_` and `+` read as spaces. A query, a hash and trailing slashes
 * are ignored, and an address with no segment gives an empty query.
 *
 * @param path The address that matched nothing, with or without an origin.
 * @returns The words to search for, or `""` when the address names none.
 * @example searchQueryFromPath("/docs/guides/web-hooks"); // "web hooks"
 * @example searchQueryFromPath("/docs/api/rate_limits.md?ref=x"); // "rate limits"
 */
export function searchQueryFromPath(path: string): string {
	let pathname = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "").split(/[?#]/)[0] ?? "";
	let segment = pathname.split("/").filter(Boolean).at(-1) ?? "";
	let decoded = segment;
	try {
		decoded = decodeURIComponent(segment.replace(/\+/g, " "));
	} catch {
		decoded = segment;
	}
	return decoded
		.replace(PAGE_EXTENSION, "")
		.replace(/[-_+]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Renders the 404 body: eyebrow, title at the ambient heading level, a sentence, the
 * missing address as code that wraps on a phone, the search slot, then the start links
 * under a heading one level deeper.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the 404's markup.
 * @example
 * <DocsNotFound
 * 	path={url.pathname}
 * 	search={<SearchField defaultValue={searchQueryFromPath(url.pathname)} />}
 * 	links={[{ title: "Quickstart", href: "/docs/quickstart" }]}
 * 	labels={{ title: "Page not found", body: "Search for it instead.", linksTitle: "Start here" }}
 * />
 */
export function DocsNotFound(handle: Handle<DocsNotFound.Props>) {
	return () => {
		let { labels, links, mix, path, search, ...rest } = handle.props;
		let level = resolveHeadingLevel(handle);
		let TitleTag = TAG_BY_LEVEL[level];
		let LinksTag = TAG_BY_LEVEL[Math.min(level + 1, 6) as HeadingLevel];

		return (
			<div
				{...rest}
				data-slot="docs-not-found"
				mix={mergeMix([vstack({ gap: 8, align: "stretch" }), raw({ minInlineSize: "0" })], mix)}
			>
				<div mix={[vstack({ gap: 3, align: "stretch" })]}>
					{labels.eyebrow ? (
						<p
							mix={[
								m(0),
								font("mono"),
								text("xs"),
								weight("medium"),
								textTransform("uppercase"),
								tracking("widest"),
								fg("brand"),
							]}
						>
							{labels.eyebrow}
						</p>
					) : null}
					<TitleTag
						data-slot="docs-not-found-title"
						mix={[
							m(0),
							text("3xl"),
							balance(),
							fg("neutral.emphasis"),
							raw({ fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.15 }),
						]}
					>
						{labels.title}
					</TitleTag>
					<p mix={[m(0), text("base"), pretty(), fg("neutral"), raw({ maxInlineSize: "65ch" })]}>
						{labels.body}
					</p>
					<p mix={[m(0)]}>
						<code
							data-slot="docs-not-found-path"
							mix={[
								raw({
									display: "inline-block",
									maxInlineSize: "100%",
									overflowWrap: "anywhere",
									paddingInline: "0.5rem",
									paddingBlock: "0.25rem",
								}),
								rounded("md"),
								bg("neutral.bg-tint"),
								font("mono"),
								text("sm"),
								fg("neutral.emphasis"),
							]}
						>
							{path}
						</code>
					</p>
				</div>

				{search ? (
					<div data-slot="docs-not-found-search" mix={[raw({ maxInlineSize: "36rem" })]}>
						{search}
					</div>
				) : null}

				{links.length > 0 ? (
					<section data-slot="docs-not-found-links" mix={[vstack({ gap: 3, align: "stretch" })]}>
						<LinksTag
							mix={[m(0), text("base"), weight("semibold"), balance(), fg("neutral.emphasis")]}
						>
							{labels.linksTitle}
						</LinksTag>
						<ul mix={[vstack({ gap: 1, align: "stretch" }), m(0), p(0), listStyle("none")]}>
							{links.map((link) => (
								<li key={link.href}>
									<a
										href={link.href}
										data-rmx-prefetch="intent"
										data-slot="docs-not-found-link"
										mix={[
											hstack({ gap: 3, align: "center", justify: "between" }),
											raw({
												minBlockSize: "2.75rem",
												paddingInline: "0.75rem",
												paddingBlock: "0.5rem",
												textDecoration: "none",
											}),
											rounded("md"),
											hover(bg("neutral.bg-tint")),
											when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
										]}
									>
										<span mix={[vstack({ gap: 0.5, align: "start" }), raw({ minInlineSize: "0" })]}>
											<span mix={[text("sm"), weight("medium"), fg("brand")]}>{link.title}</span>
											{link.description ? (
												<span mix={[text("sm"), pretty(), fg("neutral")]}>{link.description}</span>
											) : null}
										</span>
										<span mix={[hstack(), fg("neutral.muted")]}>
											<ArrowRightIcon size={14} aria-hidden="true" />
										</span>
									</a>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</div>
		);
	};
}
