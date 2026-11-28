/**
 * Plinth's pages, drawn as an editorial index: a featured story in a signal block, then every
 * post as a table-like row ruled by year, with highlights, series and topics in a side rail.
 * Every view the blog's controller builds is drawn here, inside the blog's frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { leading, text, textDecoration, weight } from "@sdxc/u/typography";
import { Avatar, Button, Label, SearchField, Typeset } from "@sdxc/ui";
import { Callout } from "@sdxc/ui/docs";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext, DemoBlogFeedView, DemoBlogView } from "~/resources/views/demo-blogs";

import { countKinds, countTags, groupByYear, listSeries } from "~/app/services/demo-blogs";
import {
	ABOUT_PAGE,
	ARCHIVE_PAGE,
	FEED_PAGE,
	SEARCH_PAGE,
	SUBSCRIBE_PAGE,
	TAGS_PAGE,
} from "~/resources/views/demo-blogs";
import { NewsletterForm, PostDate } from "~/resources/views/demo-blogs/parts";
import { PlinthShell } from "~/resources/views/demo-blogs/plinth/frame";
import {
	Container,
	focusRing,
	IndexList,
	inlineLink,
	KindFilter,
	Masthead,
	Module,
	monoLabel,
	Pager,
	RAIL_QUERY,
	RailList,
	SubscribeBlock,
	TopicLinks,
} from "~/resources/views/demo-blogs/plinth/parts";
import { PostPage } from "~/resources/views/demo-blogs/plinth/post";

/** The column prose pages read in: about, subscribe and the 404. */
const PROSE_MEASURE = "48rem";

namespace PlinthPage {
	export interface Props {
		view: DemoBlogView;
		context: DemoBlogContext;
	}
}

/** Draws whichever page the controller asked for, inside the blog's frame. */
export function PlinthPage(handle: Handle<PlinthPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let current = iife(() => {
			if (view.view === "feed") return "index" as const;
			if (view.view === "archive") return "archive" as const;
			if (view.view === "tags" || view.view === "tag") return "tags" as const;
			if (view.view === "about") return "about" as const;
			return undefined;
		});
		return (
			<PlinthShell context={context} current={current}>
				<PageBody view={view} context={context} />
			</PlinthShell>
		);
	};
}

/** Picks the page for the view. */
function PageBody(handle: Handle<PlinthPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		switch (view.view) {
			case "feed":
				return <FeedPage view={view} context={context} />;
			case "post":
				return <PostPage view={view} context={context} />;
			case "archive":
				return <ArchivePage posts={view.posts} type={view.type} context={context} />;
			case "tags":
				return <TagsPage tags={view.tags} context={context} />;
			case "tag":
				return <TagPage tag={view.tag} posts={view.posts} context={context} />;
			case "search":
				return (
					<SearchPage
						query={view.query}
						type={view.type}
						matches={view.matches}
						results={view.results}
						context={context}
					/>
				);
			case "about":
				return <AboutPage context={context} />;
			case "subscribe":
				return <SubscribePage sent={view.sent} context={context} />;
			case "not-found":
				return <NotFoundPage path={view.path} context={context} />;
		}
	};
}

namespace FeedPage {
	export interface Props {
		view: DemoBlogFeedView;
		context: DemoBlogContext;
	}
}

/**
 * The index: on its first unfiltered page an intro line and the featured story, otherwise a
 * masthead naming the filter; then the type filter, the rows and the pager beside the rail.
 */
function FeedPage(handle: Handle<FeedPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { href, posts, site } = context;
		let kind = view.type === null ? null : site.kinds[view.type];
		return (
			<Container>
				{view.featured === null ? (
					<Masthead
						eyebrow={view.page > 1 ? `Index · page ${view.page} of ${view.pageCount}` : "Index"}
						title={kind?.label ?? "Everything"}
						lead={kind?.description ?? "Every post on Plinth, newest first."}
					/>
				) : (
					<>
						<Intro context={context} />
						<Featured post={view.featured} context={context} />
					</>
				)}
				<WithRail
					main={
						<div mix={[vstack({ gap: 6, align: "stretch" })]}>
							<KindFilter
								context={context}
								current={view.type}
								counts={countKinds(site, posts)}
								total={posts.length}
								href={(type) => (type === null ? href() : `${href()}?type=${type}`)}
							/>
							<IndexList posts={view.feed} context={context} />
							<Pager page={view.page} pageCount={view.pageCount} pageHref={view.pageHref} />
						</div>
					}
					rail={<FeedRail context={context} featured={view.featured} />}
				/>
			</Container>
		);
	};
}

namespace WithRail {
	export interface Props {
		main: RemixNode;
		rail: RemixNode;
	}
}

/** The index beside its side rail from {@link RAIL_QUERY}; the rail follows the index below it. */
function WithRail(handle: Handle<WithRail.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr)",
					gap: "3.5rem",
					[`@media ${RAIL_QUERY}`]: { gridTemplateColumns: "minmax(0, 1fr) 18rem", gap: "4rem" },
				}),
			]}
		>
			<div mix={[raw({ minInlineSize: 0 })]}>{handle.props.main}</div>
			<aside aria-label="More ways in" mix={[vstack({ gap: 8, align: "stretch" })]}>
				{handle.props.rail}
			</aside>
		</div>
	);
}

namespace Intro {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The index's first line: what the blog is about at display size, and who writes it. */
function Intro(handle: Handle<Intro.Props>) {
	return () => {
		let { href, site } = handle.props.context;
		return (
			<header
				data-slot="plinth-intro"
				mix={[vstack({ gap: 4, align: "stretch" }), raw({ paddingBlockEnd: "2rem" })]}
			>
				<h1
					mix={[
						m(0),
						raw({ fontSize: "clamp(2rem, 1.3rem + 3.4vw, 4.25rem)", maxInlineSize: "20ch" }),
						leading(1),
						fg("neutral.emphasis"),
					]}
				>
					CSS, type and the systems <span mix={[fg("brand")]}>that hold them up.</span>
				</h1>
				<p mix={[m(0), text("base"), fg("neutral"), raw({ maxInlineSize: "40rem" })]}>
					{site.author.bio}{" "}
					<a href={href(ABOUT_PAGE)} mix={[inlineLink()]}>
						More about {site.author.name.split(" ")[0]}
					</a>
				</p>
			</header>
		);
	};
}

namespace Featured {
	export interface Props {
		post: DemoBlogPost;
		context: DemoBlogContext;
	}
}

/**
 * The featured story as a signal block: ink type on vermilion in both schemes, its title at
 * display size beside its lead and the facts a reader picks by.
 */
function Featured(handle: Handle<Featured.Props>) {
	return () => {
		let { context, post } = handle.props;
		let label = context.site.kinds[post.kind]?.singular ?? post.kind;
		return (
			<article
				data-slot="plinth-featured"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						gap: "1.5rem 3rem",
						padding: "1.5rem",
						marginBlockEnd: "3.5rem",
						backgroundColor: "var(--ui-color-brand-400)",
						color: "var(--ui-color-neutral-950)",
						"--ui-brand-ring": "var(--ui-color-neutral-950)",
						"@media (min-width: 56rem)": {
							gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
							padding: "2.5rem",
							alignItems: "end",
						},
					}),
				]}
			>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<p mix={[m(0), monoLabel(), weight("bold")]}>
						Featured · {label} · <PostDate date={post.date} />
					</p>
					<h2
						mix={[
							m(0),
							raw({ fontSize: "clamp(2.25rem, 1.3rem + 4vw, 5rem)", color: "inherit" }),
							leading(0.95),
						]}
					>
						<a
							href={context.href(post.path)}
							mix={[
								raw({ color: "inherit", textDecoration: "none" }),
								hover(
									raw({
										textDecoration: "underline",
										textDecorationThickness: "0.06em",
										textUnderlineOffset: "0.1em",
									}),
								),
								focusRing(),
							]}
						>
							{post.title}
						</a>
					</h2>
				</div>
				<div mix={[vstack({ gap: 4, align: "start" })]}>
					<p mix={[m(0), raw({ fontSize: "1.125rem" }), leading("relaxed")]}>{post.description}</p>
					<p mix={[m(0), monoLabel()]}>
						{post.minutes} min read · {post.tags.join(", ")}
					</p>
					<a
						href={context.href(post.path)}
						aria-label={`Read ${post.title}`}
						mix={[
							hstack({ gap: 2, align: "center" }),
							raw({
								paddingInline: "1rem",
								paddingBlock: "0.625rem",
								backgroundColor: "var(--ui-color-neutral-950)",
								color: "var(--ui-color-neutral-50)",
								textDecoration: "none",
							}),
							weight("bold"),
							hover(raw({ backgroundColor: "var(--ui-color-neutral-800)" })),
							focusRing(),
						]}
					>
						Read the {label.toLowerCase()}
						<ArrowRightIcon size={16} aria-hidden="true" />
					</a>
				</div>
			</article>
		);
	};
}

namespace FeedRail {
	export interface Props {
		context: DemoBlogContext;
		/** The story the page leads with, left out of the highlights it already tops. */
		featured: DemoBlogPost | null;
	}
}

/** The side rail: hand-picked highlights, every series in order, and the topics with counts. */
function FeedRail(handle: Handle<FeedRail.Props>) {
	return () => {
		let { context, featured } = handle.props;
		let highlights = context.posts.filter(
			(post) => post.featured === true && post.path !== featured?.path,
		);
		let names = [...new Set(context.posts.flatMap((post) => post.series ?? []))];
		return (
			<>
				{highlights.length > 0 ? (
					<Module title="Highlights" slot="plinth-highlights">
						<RailList posts={highlights} context={context} />
					</Module>
				) : null}
				{names.map((name) => (
					<Module key={name} title="Series" slot="plinth-series">
						<SeriesSummary name={name} context={context} />
					</Module>
				))}
				<Module title="Topics" slot="plinth-topics-module">
					<TopicLinks context={context} tags={countTags(context.posts)} />
				</Module>
			</>
		);
	};
}

namespace SeriesSummary {
	export interface Props {
		name: string;
		context: DemoBlogContext;
	}
}

/** One series in the rail: its name, its length and every part, numbered. */
function SeriesSummary(handle: Handle<SeriesSummary.Props>) {
	return () => {
		let { context, name } = handle.props;
		let parts = listSeries(context.posts, name);
		return (
			<div
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					p(4),
					raw({ border: "2px solid var(--ui-neutral-fg-emphasis)" }),
				]}
			>
				<p mix={[m(0), monoLabel(), fg("neutral.muted")]}>{parts.length} parts</p>
				<p
					mix={[
						m(0),
						raw({ fontFamily: "var(--demo-blog-heading-font)", fontSize: "1.375rem" }),
						weight(800),
						leading("tight"),
						fg("neutral.emphasis"),
					]}
				>
					{name}
				</p>
				<RailList posts={parts} context={context} numbered />
			</div>
		);
	};
}

namespace ArchivePage {
	export interface Props {
		posts: DemoBlogPost[];
		type: string | null;
		context: DemoBlogContext;
	}
}

/** Everything, grouped by year with counts, under a chart of entries per year and the type filter. */
function ArchivePage(handle: Handle<ArchivePage.Props>) {
	return () => {
		let { context, posts, type } = handle.props;
		let { href, site } = context;
		let kind = type === null ? null : site.kinds[type];
		let years = groupByYear(context.posts);
		let most = Math.max(...years.map((year) => year.posts.length));
		let first = context.posts.at(-1)?.date.slice(0, 4) ?? "";
		return (
			<Container>
				<Masthead
					eyebrow="Archive"
					title={
						kind === null || kind === undefined
							? "Everything"
							: `Every ${kind.singular.toLowerCase()}`
					}
					lead={`${posts.length} ${posts.length === 1 ? "entry" : "entries"} since ${first}, by year. Notes open in place; everything else links to its page.`}
				>
					<dl
						data-slot="plinth-archive-stats"
						mix={[m(0), vstack({ gap: 2, align: "stretch" }), raw({ maxInlineSize: "32rem" })]}
					>
						{years.map((year) => (
							<div
								key={year.year}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "3.5rem minmax(0, 1fr) 2.5rem",
										gap: "0.75rem",
										alignItems: "center",
									}),
								]}
							>
								<dt mix={[monoLabel(), weight("bold"), fg("neutral.emphasis")]}>{year.year}</dt>
								<dd mix={[m(0)]}>
									<span
										aria-hidden="true"
										mix={[
											raw({
												display: "block",
												blockSize: "0.875rem",
												inlineSize: `${(year.posts.length / most) * 100}%`,
												backgroundColor: "var(--ui-brand-fg)",
											}),
										]}
									/>
								</dd>
								<dd mix={[m(0), monoLabel(), fg("neutral.muted"), raw({ textAlign: "end" })]}>
									{year.posts.length}
								</dd>
							</div>
						))}
					</dl>
				</Masthead>
				<div mix={[vstack({ gap: 8, align: "stretch" })]}>
					<KindFilter
						context={context}
						current={type}
						counts={countKinds(site, context.posts)}
						total={context.posts.length}
						href={(next) =>
							next === null ? href(ARCHIVE_PAGE) : `${href(ARCHIVE_PAGE)}?type=${next}`
						}
					/>
					<IndexList posts={posts} context={context} />
				</div>
			</Container>
		);
	};
}

namespace TagsPage {
	export interface Props {
		tags: Array<{ tag: string; count: number }>;
		context: DemoBlogContext;
	}
}

/** Every topic as a ruled row: its name at display size, what it covers and how many posts. */
function TagsPage(handle: Handle<TagsPage.Props>) {
	return () => {
		let { context, tags } = handle.props;
		return (
			<Container>
				<Masthead
					eyebrow="Topics"
					title="What Plinth is about"
					lead={`${tags.length} topics, the most written about first.`}
				/>
				<ol data-slot="plinth-topics" mix={[m(0), p(0), listStyle("none")]}>
					{tags.map((entry, index) => (
						<li
							key={entry.tag}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "2.5rem minmax(0, 1fr) auto",
									gridTemplateAreas: '"rank name count" ". about about"',
									gap: "0.25rem 1rem",
									alignItems: "baseline",
									paddingBlock: "1.25rem",
									borderBlockEnd: "1px solid var(--ui-neutral-border)",
									"@media (min-width: 48rem)": {
										gridTemplateColumns: "3rem 16rem minmax(0, 1fr) auto",
										gridTemplateAreas: '"rank name about count"',
									},
								}),
							]}
						>
							<span mix={[raw({ gridArea: "rank" }), monoLabel(), fg("brand"), weight("bold")]}>
								{String(index + 1).padStart(2, "0")}
							</span>
							<a
								href={context.href(`${TAGS_PAGE}/${entry.tag}`)}
								mix={[
									raw({
										gridArea: "name",
										fontFamily: "var(--demo-blog-heading-font)",
										fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem)",
										letterSpacing: "-0.02em",
										textDecoration: "none",
									}),
									weight(800),
									leading(1.1),
									fg("neutral.emphasis"),
									hover(fg("brand")),
									focusRing(),
								]}
							>
								{entry.tag}
							</a>
							<span mix={[raw({ gridArea: "about" }), fg("neutral")]}>
								{context.site.tags[entry.tag] ?? ""}
							</span>
							<span mix={[raw({ gridArea: "count" }), monoLabel(), fg("neutral.muted")]}>
								{entry.count} {entry.count === 1 ? "entry" : "entries"}
							</span>
						</li>
					))}
				</ol>
			</Container>
		);
	};
}

namespace TagPage {
	export interface Props {
		tag: string;
		posts: DemoBlogPost[];
		context: DemoBlogContext;
	}
}

/** One topic's posts as the index, with what the topic covers and the way back to every topic. */
function TagPage(handle: Handle<TagPage.Props>) {
	return () => {
		let { context, posts, tag } = handle.props;
		return (
			<Container>
				<Masthead
					eyebrow={`Topic · ${posts.length} ${posts.length === 1 ? "entry" : "entries"}`}
					title={tag}
					lead={context.site.tags[tag]}
				>
					<a
						href={context.href(TAGS_PAGE)}
						mix={[inlineLink(), text("sm"), raw({ alignSelf: "start" })]}
					>
						Every topic
					</a>
				</Masthead>
				<IndexList posts={posts} context={context} />
			</Container>
		);
	};
}

namespace SearchForm {
	export interface Props {
		context: DemoBlogContext;
		query?: string;
	}
}

/** The search box, a plain GET form so a result page is an address a reader can share. */
function SearchForm(handle: Handle<SearchForm.Props>) {
	return () => {
		let { context, query } = handle.props;
		return (
			<form
				method="get"
				action={context.href(SEARCH_PAGE)}
				data-slot="plinth-search-form"
				mix={[
					raw({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "end",
						gap: "0.5rem",
						maxInlineSize: "40rem",
					}),
				]}
			>
				<SearchField mix={[raw({ flex: "1 1 16rem" })]}>
					<Label htmlFor="plinth-search">Search the index</Label>
					<SearchField.Control>
						<SearchField.Input
							id="plinth-search"
							name="q"
							defaultValue={query}
							placeholder="clamp, tokens, dark mode…"
						/>
					</SearchField.Control>
				</SearchField>
				<Button type="submit" color="neutral">
					Search
				</Button>
			</form>
		);
	};
}

namespace SearchPage {
	export interface Props {
		query: string;
		type: string | null;
		matches: DemoBlogPost[];
		results: DemoBlogPost[];
		context: DemoBlogContext;
	}
}

/** The search page: the form, the type filter counted over the matches, and the matching rows. */
function SearchPage(handle: Handle<SearchPage.Props>) {
	return () => {
		let { context, matches, query, results, type } = handle.props;
		let text = query.trim();
		let base = `${context.href(SEARCH_PAGE)}?q=${encodeURIComponent(text)}`;
		return (
			<Container>
				<Masthead
					eyebrow="Search"
					title={text === "" ? "Search Plinth" : `“${text}”`}
					lead={
						text === ""
							? "Every word you type has to appear in a post's title, lead, topics or text."
							: `${matches.length} ${matches.length === 1 ? "entry matches" : "entries match"} every word.`
					}
				>
					<SearchForm context={context} query={query} />
				</Masthead>
				{iife(() => {
					if (text === "") {
						return (
							<Module title="Or browse by topic">
								<TopicLinks context={context} tags={countTags(context.posts)} />
							</Module>
						);
					}
					if (matches.length === 0) {
						return (
							<div mix={[vstack({ gap: 6, align: "stretch" })]}>
								<p mix={[m(0), fg("neutral"), raw({ fontSize: "1.125rem" })]}>
									Nothing on Plinth matches all of those words. Try fewer words, or one of the
									topics.
								</p>
								<TopicLinks context={context} tags={countTags(context.posts)} />
							</div>
						);
					}
					return (
						<div data-slot="plinth-search-results" mix={[vstack({ gap: 6, align: "stretch" })]}>
							<KindFilter
								context={context}
								current={type}
								counts={countKinds(context.site, matches)}
								total={matches.length}
								href={(next) => (next === null ? base : `${base}&type=${next}`)}
							/>
							<IndexList posts={results} context={context} years={false} />
						</div>
					);
				})}
			</Container>
		);
	};
}

namespace AboutPage {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** Who writes the blog, in their own words, with where else to find them and the newsletter. */
function AboutPage(handle: Handle<AboutPage.Props>) {
	return () => {
		let { context } = handle.props;
		let { author } = context.site;
		return (
			<Container measure={PROSE_MEASURE}>
				<Masthead eyebrow="About" title={author.name} lead={author.role}>
					<div mix={[hstack({ gap: 3, align: "center" }), raw({ flexWrap: "wrap" })]}>
						<Avatar size="lg">
							<Avatar.Fallback>{author.initials}</Avatar.Fallback>
						</Avatar>
						<ul mix={[m(0), p(0), listStyle("none"), hstack({ gap: 4, align: "center" })]}>
							{author.links.map((link) => (
								<li key={link.href}>
									<a href={link.href} rel="me noreferrer" mix={[inlineLink()]}>
										{link.label}
									</a>
								</li>
							))}
						</ul>
					</div>
				</Masthead>
				<Typeset
					preset="reading"
					data-slot="plinth-about"
					mix={[raw({ fontFamily: "var(--demo-blog-reading-font, inherit)" })]}
				>
					{context.site.about()}
				</Typeset>
				<SubscribeBlock context={context} />
			</Container>
		);
	};
}

namespace SubscribePage {
	export interface Props {
		sent: boolean;
		context: DemoBlogContext;
	}
}

/** The newsletter's page: what a reader gets, the form, and the confirmation it lands on. */
function SubscribePage(handle: Handle<SubscribePage.Props>) {
	return () => {
		let { context, sent } = handle.props;
		return (
			<Container measure={PROSE_MEASURE}>
				<Masthead
					eyebrow="Newsletter"
					title="Plinth, every other Sunday"
					lead="One email every two weeks with everything published since the last: articles, tutorials, notes and links, each with a line on why it is there. No tracking pixels, one click to leave."
				/>
				<div data-slot="plinth-subscribe" mix={[vstack({ gap: 6, align: "stretch" })]}>
					{sent ? (
						<Callout kind="tip" label="Almost there" data-slot="plinth-subscribe-confirmation">
							Check your inbox for a confirmation link. Nothing was sent, since Plinth is a demo,
							but this is where a real sign-up lands.
						</Callout>
					) : (
						<NewsletterForm action={context.href(SUBSCRIBE_PAGE)} submitLabel="Subscribe" />
					)}
					<p mix={[m(0), fg("neutral")]}>
						Prefer a feed reader?{" "}
						<a href={context.href(FEED_PAGE)} mix={[inlineLink()]}>
							Subscribe to the RSS feed
						</a>
						, or browse the{" "}
						<a href={context.href(ARCHIVE_PAGE)} mix={[inlineLink()]}>
							archive
						</a>{" "}
						first.
					</p>
				</div>
			</Container>
		);
	};
}

namespace NotFoundPage {
	export interface Props {
		path: string;
		context: DemoBlogContext;
	}
}

/** The 404: the address that missed, a search box, and the latest entries to start from. */
function NotFoundPage(handle: Handle<NotFoundPage.Props>) {
	return () => {
		let { context, path } = handle.props;
		let guess = decodeURIComponent(path.split("/").at(-1) ?? "").replaceAll("-", " ");
		return (
			<Container measure={PROSE_MEASURE}>
				<div data-slot="plinth-not-found" mix={[vstack({ gap: 6, align: "stretch" })]}>
					<p
						aria-hidden="true"
						mix={[
							m(0),
							raw({
								alignSelf: "start",
								paddingInline: "1rem",
								fontFamily: "var(--demo-blog-heading-font)",
								fontSize: "clamp(5rem, 3rem + 10vw, 10rem)",
								backgroundColor: "var(--ui-color-brand-400)",
								color: "var(--ui-color-neutral-950)",
							}),
							weight(800),
							leading(1),
						]}
					>
						404
					</p>
					<h1
						mix={[
							m(0),
							raw({ fontSize: "clamp(2rem, 1.5rem + 2vw, 3rem)" }),
							fg("neutral.emphasis"),
						]}
					>
						Nothing stands on this plinth
					</h1>
					<p mix={[m(0), fg("neutral"), raw({ overflowWrap: "anywhere" })]}>
						There is no page at <code>{path}</code>. It may have moved, or the address may be
						mistyped. Search for it, or start from the latest entries.
					</p>
					<SearchForm context={context} query={guess} />
					<Module title="Latest entries">
						<IndexList posts={context.posts.slice(0, 5)} context={context} years={false} />
					</Module>
					<p mix={[m(0)]}>
						<a href={context.href()} mix={[inlineLink()]}>
							Back to the index
						</a>{" "}
						<span mix={[fg("neutral.muted")]}>·</span>{" "}
						<a href={context.href(ARCHIVE_PAGE)} mix={[inlineLink(), textDecoration("underline")]}>
							Every entry by year
						</a>
					</p>
				</div>
			</Container>
		);
	};
}
