/**
 * Understory's ways to browse besides the feed: the archive by year, the topic index as hub
 * cards, one topic's page as a garden of its own, and search with type filters over its
 * matches. Every filter is a link or a GET form, so each view has an address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { leading, pretty, text } from "@sdxc/u/typography";
import { Button, SearchField } from "@sdxc/ui";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext } from "~/resources/views/demo-blogs";

import { countKinds, groupByYear } from "~/app/services/demo-blogs";
import { ARCHIVE_PAGE, SEARCH_PAGE, TAGS_PAGE } from "~/resources/views/demo-blogs";
import {
	CardGrid,
	FilterChips,
	GardenCard,
	kindHue,
	labelFace,
	PageIntro,
	PostRows,
	quietLink,
	SectionTitle,
	tinted,
	Wrap,
} from "~/resources/views/demo-blogs/understory/parts";

/**
 * Type chips over a list of posts with counts, each linking to the same page narrowed to it.
 *
 * @param base The page's address without `?type=`, which each chip extends.
 * @param extra Query already on the page that every chip keeps, such as `q=sync`.
 */
function typeChips(
	context: DemoBlogContext,
	posts: DemoBlogPost[],
	type: string | null,
	base: string,
	extra = "",
): FilterChips.Chip[] {
	let join = (query: string) => (query === "" ? base : `${base}?${query}`);
	let prefix = extra === "" ? "" : `${extra}&`;
	return [
		{ label: "Everything", href: join(extra), count: posts.length, current: type === null },
		...countKinds(context.site, posts).map(({ count, kind }) => ({
			label: context.site.kinds[kind]?.label ?? kind,
			href: join(`${prefix}type=${kind}`),
			count,
			current: type === kind,
			hue: kindHue(kind),
		})),
	];
}

namespace ArchivePage {
	export interface Props {
		context: DemoBlogContext;
		posts: DemoBlogPost[];
		type: string | null;
	}
}

/** Every post of the type filter, one ruled list per year, newest year first. */
export function ArchivePage(handle: Handle<ArchivePage.Props>) {
	return () => {
		let { context, posts, type } = handle.props;
		let kind = type === null ? undefined : context.site.kinds[type];
		return (
			<Wrap max="56rem">
				<PageIntro
					eyebrow="Archive"
					title={
						kind === undefined
							? "Every post, by year"
							: `Every ${kind.singular.toLowerCase()}, by year`
					}
					lead={`${posts.length} posts planted since the garden began. The feed shows them as cards; this page lists them all on one page.`}
				>
					<FilterChips
						label="Filter the archive by type"
						slot="understory-archive-filter"
						chips={typeChips(context, context.posts, type, context.href(ARCHIVE_PAGE))}
					/>
				</PageIntro>
				{groupByYear(posts).map((group) => (
					<section
						aria-labelledby={`year-${group.year}`}
						data-slot="understory-year"
						mix={[vstack({ gap: 2, align: "stretch" })]}
					>
						<SectionTitle id={`year-${group.year}`} note={`${group.posts.length} posts`}>
							{group.year}
						</SectionTitle>
						<PostRows context={context} posts={group.posts} />
					</section>
				))}
			</Wrap>
		);
	};
}

namespace TagsPage {
	export interface Props {
		context: DemoBlogContext;
		tags: Array<{ tag: string; count: number }>;
	}
}

/** Every topic as a hub card: what it collects, how much, and its three newest posts. */
export function TagsPage(handle: Handle<TagsPage.Props>) {
	return () => {
		let { context, tags } = handle.props;
		return (
			<Wrap>
				<PageIntro
					eyebrow="Topics"
					title="Wander by topic"
					lead="Topics cut across every kind of post, so each one gathers essays, tutorials, notes, links and terms in one place."
				/>
				<CardGrid slot="understory-topics" min="19rem">
					{tags.map(({ count, tag }) => {
						let recent = context.posts.filter((post) => post.tags.includes(tag)).slice(0, 3);
						return (
							<section mix={[tinted(140), p(5), vstack({ gap: 3, align: "stretch" })]}>
								<h2 mix={[m(0), text("2xl"), leading("tight")]}>
									<a
										href={context.href(`${TAGS_PAGE}/${tag}`)}
										mix={[quietLink(), fg("neutral.emphasis")]}
									>
										#{tag}
									</a>
								</h2>
								<p mix={[m(0), ...labelFace(), fg("neutral.muted")]}>{count} posts</p>
								{context.site.tags[tag] !== undefined ? (
									<p mix={[m(0), pretty(), raw({ fontFamily: "var(--demo-blog-reading-font)" })]}>
										{context.site.tags[tag]}
									</p>
								) : null}
								<ul
									mix={[
										m(0),
										p(0),
										listStyle("none"),
										vstack({ gap: 1, align: "stretch" }),
										text("sm"),
									]}
								>
									{recent.map((post) => (
										<li mix={[hstack({ gap: 2, align: "baseline" })]}>
											<span
												aria-hidden="true"
												mix={[
													raw({
														flex: "none",
														inlineSize: "0.5rem",
														blockSize: "0.5rem",
														borderRadius: "999px",
														backgroundColor: `oklch(0.62 0.1 ${kindHue(post.kind)})`,
													}),
												]}
											/>
											<a href={context.href(post.path)} mix={[quietLink(), fg("neutral.emphasis")]}>
												{post.title}
											</a>
										</li>
									))}
								</ul>
							</section>
						);
					})}
				</CardGrid>
			</Wrap>
		);
	};
}

namespace TagPage {
	export interface Props {
		context: DemoBlogContext;
		tag: string;
		posts: DemoBlogPost[];
	}
}

/** One topic's own garden: its description, its kinds counted, and every post as a card. */
export function TagPage(handle: Handle<TagPage.Props>) {
	return () => {
		let { context, posts, tag } = handle.props;
		let kinds = countKinds(context.site, posts)
			.map(
				({ count, kind }) => `${count} ${(context.site.kinds[kind]?.label ?? kind).toLowerCase()}`,
			)
			.join(", ");
		return (
			<Wrap>
				<PageIntro
					eyebrow="Topic"
					title={`#${tag}`}
					lead={context.site.tags[tag] ?? `Every post filed under ${tag}.`}
				>
					<p mix={[m(0), ...labelFace(), fg("neutral.muted")]}>
						{posts.length} posts: {kinds}.{" "}
						<a href={context.href(TAGS_PAGE)} mix={[quietLink(), fg("brand")]}>
							All topics
						</a>
					</p>
				</PageIntro>
				<CardGrid slot="understory-tag-garden">
					{posts.map((post) => (
						<GardenCard context={context} post={post} />
					))}
				</CardGrid>
			</Wrap>
		);
	};
}

namespace SearchPage {
	export interface Props {
		context: DemoBlogContext;
		query: string;
		type: string | null;
		matches: DemoBlogPost[];
		results: DemoBlogPost[];
	}
}

/** Search: a GET form, type chips counted over every match, and the results as cards. */
export function SearchPage(handle: Handle<SearchPage.Props>) {
	return () => {
		let { context, matches, query, results, type } = handle.props;
		let trimmed = query.trim();
		return (
			<Wrap>
				<PageIntro
					eyebrow="Search"
					title={trimmed === "" ? "Search the garden" : `Results for “${trimmed}”`}
					lead={
						trimmed === ""
							? "Every word you type must appear in a post's title, lead, topics or text."
							: `${results.length} of ${matches.length} matches${type === null ? "" : ` are ${(context.site.kinds[type]?.label ?? type).toLowerCase()}`}.`
					}
				>
					<SearchForm context={context} query={query} type={type} />
				</PageIntro>
				{trimmed !== "" && matches.length > 0 ? (
					<FilterChips
						label="Filter results by type"
						slot="understory-search-filter"
						chips={typeChips(
							context,
							matches,
							type,
							context.href(SEARCH_PAGE),
							`q=${encodeURIComponent(trimmed)}`,
						)}
					/>
				) : null}
				{trimmed !== "" && results.length === 0 ? (
					<p mix={[m(0), fg("neutral.muted"), text("lg")]}>
						Nothing grows under that name yet. Try fewer words, or{" "}
						<a href={context.href(TAGS_PAGE)} mix={[quietLink(), fg("brand")]}>
							wander by topic
						</a>
						.
					</p>
				) : null}
				{results.length > 0 ? (
					<CardGrid slot="understory-results">
						{results.map((post) => (
							<GardenCard context={context} post={post} />
						))}
					</CardGrid>
				) : null}
			</Wrap>
		);
	};
}

namespace SearchForm {
	export interface Props {
		context: DemoBlogContext;
		query?: string;
		/** A type filter the search keeps when submitted again. */
		type?: string | null;
	}
}

/** The search box as a GET form to the search page, so a search is an address. */
export function SearchForm(handle: Handle<SearchForm.Props>) {
	return () => {
		let { context, query = "", type = null } = handle.props;
		return (
			<form
				method="get"
				action={context.href(SEARCH_PAGE)}
				data-slot="understory-search-form"
				mix={[
					hstack({ gap: 2, align: "end" }),
					raw({ inlineSize: "100%", maxInlineSize: "34rem" }),
				]}
			>
				<SearchField aria-label={`Search ${context.site.name}`} mix={[raw({ flex: "1 1 auto" })]}>
					<SearchField.Input name="q" defaultValue={query} placeholder="crdt, clocks, opfs…" />
				</SearchField>
				{type !== null ? <input type="hidden" name="type" value={type} /> : null}
				<Button type="submit" color="brand">
					Search
				</Button>
			</form>
		);
	};
}
