/**
 * Saltbox's pages, drawn as a classic two-column blog: the home loop with a featured post
 * and older/newer paging, each post with its breadcrumb, author box and neighbours, and the
 * archive, topics, search, about, subscribe and not-found pages around them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowUpRightIcon, RssIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { balance, leading, pretty, text, tracking, weight } from "@sdxc/u/typography";
import { Avatar, Breadcrumbs, LinkButton, Pagination, Typeset } from "@sdxc/ui";
import { Callout, DocsPager, TableOfContents } from "@sdxc/ui/docs";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type {
	DemoBlogContext,
	DemoBlogFeedView,
	DemoBlogPostView,
	DemoBlogView,
} from "~/resources/views/demo-blogs";

import { countKinds, countTags, groupByYear } from "~/app/services/demo-blogs";
import {
	ABOUT_PAGE,
	ARCHIVE_PAGE,
	FEED_PAGE,
	SEARCH_PAGE,
	SUBSCRIBE_PAGE,
	TAGS_PAGE,
} from "~/resources/views/demo-blogs";
import { linkHost, NewsletterForm, PostBody, PostDate } from "~/resources/views/demo-blogs/parts";
import {
	REPLY_EMAIL,
	SaltboxShell,
	TWO_COLUMN_QUERY,
} from "~/resources/views/demo-blogs/saltbox/frame";
import {
	Entry,
	EntryList,
	EntryMeta,
	eyebrow,
	FilterRow,
	kindLabel,
	layoutOf,
	PageHeader,
	SearchForm,
	TagLinks,
	textLink,
} from "~/resources/views/demo-blogs/saltbox/parts";
import {
	AboutWidget,
	monthName,
	SearchWidget,
	TagCloud,
} from "~/resources/views/demo-blogs/saltbox/widgets";

namespace SaltboxPage {
	export interface Props {
		view: DemoBlogView;
		context: DemoBlogContext;
	}
}

/** Draws whichever page the controller asked for. */
export function SaltboxPage(handle: Handle<SaltboxPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		if (view.view === "feed") return <FeedPage view={view} context={context} />;
		if (view.view === "post") return <PostPage view={view} context={context} />;
		if (view.view === "archive") {
			return <ArchivePage posts={view.posts} type={view.type} context={context} />;
		}
		if (view.view === "tags") return <TagsPage tags={view.tags} context={context} />;
		if (view.view === "tag") return <TagPage tag={view.tag} posts={view.posts} context={context} />;
		if (view.view === "search") {
			return (
				<SearchPage
					query={view.query}
					type={view.type}
					matches={view.matches}
					results={view.results}
					context={context}
				/>
			);
		}
		if (view.view === "about") return <AboutPage context={context} />;
		if (view.view === "subscribe") return <SubscribePage sent={view.sent} context={context} />;
		return <NotFoundPage path={view.path} context={context} />;
	};
}

/**
 * The filter options over a list of posts: everything, then each kind with posts.
 *
 * @param base The address the list lives at, which each option adds `type=` to.
 * @param joiner `?` when `base` carries no query yet, `&` when it does.
 */
function filterOptions(
	context: DemoBlogContext,
	posts: DemoBlogPost[],
	type: string | null,
	base: string,
	joiner: "?" | "&",
): FilterRow.Props["options"] {
	return [
		{ label: "Everything", href: base, count: posts.length, current: type === null },
		...countKinds(context.site, posts).map((entry) => ({
			label: context.site.kinds[entry.kind]?.label ?? entry.kind,
			href: `${base}${joiner}type=${entry.kind}`,
			count: entry.count,
			current: type === entry.kind,
		})),
	];
}

namespace FeedPage {
	export interface Props {
		view: DemoBlogFeedView;
		context: DemoBlogContext;
	}
}

/**
 * The home loop. A type filter narrows it into a category page with its own header; the
 * first unfiltered page leads with the featured post, which the loop below then skips.
 */
function FeedPage(handle: Handle<FeedPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { featured } = view;
		let kind = view.type === null ? null : context.site.kinds[view.type];
		let options = filterOptions(context, context.posts, view.type, context.href(), "?");
		let loop =
			featured === null ? view.feed : view.feed.filter((post) => post.path !== featured.path);
		let filter = <FilterRow options={options} label="Filter posts by type" />;

		return (
			<SaltboxShell context={context} current={view.type === null ? "" : `?type=${view.type}`}>
				<div mix={[vstack({ gap: 6, align: "stretch" })]}>
					{kind ? (
						<PageHeader label="Category" title={kind.label} description={kind.description}>
							{filter}
						</PageHeader>
					) : (
						<div mix={[vstack({ gap: 4, align: "stretch" })]}>
							<h1 mix={[m(0), visuallyHidden()]}>{context.site.name}: latest posts</h1>
							{filter}
						</div>
					)}
					{featured ? <Entry post={featured} context={context} featured /> : null}
					<EntryList posts={loop} context={context} />
					<Paging view={view} />
				</div>
			</SaltboxShell>
		);
	};
}

namespace Paging {
	export interface Props {
		view: DemoBlogFeedView;
	}
}

/** "← Older posts" and "Newer posts →" either side of where the reader is in the loop. */
function Paging(handle: Handle<Paging.Props>) {
	return () => {
		let { page, pageCount, pageHref } = handle.props.view;
		if (pageCount <= 1) return null;
		return (
			<Pagination
				aria-label="Posts"
				data-slot="paging"
				mix={[raw({ paddingBlockStart: "0.5rem" })]}
			>
				<Pagination.List
					mix={[
						raw({
							inlineSize: "100%",
							justifyContent: "space-between",
							flexWrap: "wrap",
							gap: "0.75rem",
						}),
					]}
				>
					<Pagination.Item>
						{page < pageCount ? (
							<Pagination.Link
								href={pageHref(page + 1)}
								rel="next"
								prefetch="intent"
								mix={[pagerLink()]}
							>
								<span aria-hidden="true">←</span> Older posts
							</Pagination.Link>
						) : null}
					</Pagination.Item>
					<Pagination.Item mix={[text("sm"), fg("neutral.muted")]}>
						Page {page} of {pageCount}
					</Pagination.Item>
					<Pagination.Item>
						{page > 1 ? (
							<Pagination.Link href={pageHref(page - 1)} rel="prev" mix={[pagerLink()]}>
								Newer posts <span aria-hidden="true">→</span>
							</Pagination.Link>
						) : null}
					</Pagination.Item>
				</Pagination.List>
			</Pagination>
		);
	};
}

/** The paging links, wide enough for words rather than page numbers. */
function pagerLink() {
	return [
		raw({
			paddingInline: "1rem",
			gap: "0.4rem",
			border: "1px solid var(--ui-neutral-border)",
			fontWeight: 600,
		}),
		fg("brand"),
	];
}

namespace PostPage {
	export interface Props {
		view: DemoBlogPostView;
		context: DemoBlogContext;
	}
}

/**
 * One post's page. The body is framed by its breadcrumb and entry header above, and by its
 * tags, the author box, the previous and next posts, related posts and a reply-by-email
 * note below. A long article puts its outline in the sidebar, or above the body on phones.
 */
function PostPage(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let layout = layoutOf(context, post);
		let kind = context.site.kinds[post.kind];
		let outlined = layout === "article" && view.article.toc.length >= 2;

		return (
			<SaltboxShell
				context={context}
				current={`?type=${post.kind}`}
				sidebar={outlined ? <OutlineSidebar view={view} context={context} /> : undefined}
			>
				<article data-slot="post" data-layout={layout} mix={[vstack({ gap: 7, align: "stretch" })]}>
					<Breadcrumbs aria-label="Breadcrumb">
						<Breadcrumbs.List mix={[raw({ flexWrap: "wrap" })]}>
							<Breadcrumbs.Item>
								<Breadcrumbs.Link href={context.href()}>Home</Breadcrumbs.Link>
							</Breadcrumbs.Item>
							<Breadcrumbs.Item>
								<Breadcrumbs.Link href={`${context.href()}?type=${post.kind}`}>
									{kind?.label ?? post.kind}
								</Breadcrumbs.Link>
							</Breadcrumbs.Item>
							<Breadcrumbs.Item>
								<Breadcrumbs.Link href={context.href(post.path)} aria-current="page">
									{post.title}
								</Breadcrumbs.Link>
							</Breadcrumbs.Item>
						</Breadcrumbs.List>
					</Breadcrumbs>

					<PostHeader view={view} context={context} />

					{view.series.length > 0 ? <SeriesBox view={view} context={context} /> : null}

					{outlined ? (
						<div
							mix={[
								raw({
									position: "sticky",
									insetBlockStart: "4rem",
									zIndex: 2,
									backgroundColor: "var(--ui-bg)",
									borderBlock: "1px solid var(--ui-neutral-border)",
								}),
								media(TWO_COLUMN_QUERY, raw({ display: "none" })),
							]}
						>
							<TableOfContents items={view.article.toc} label="In this article" layout="bar" />
						</div>
					) : null}

					<PostLead view={view} context={context} />

					<PostBody document={view.article.document} />

					<footer
						data-slot="entry-footer"
						mix={[
							vstack({ gap: 2, align: "stretch" }),
							raw({ paddingBlock: "1rem", borderBlock: "1px solid var(--ui-neutral-border)" }),
						]}
					>
						<TagLinks tags={post.tags} context={context} />
						<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
							Filed in{" "}
							<a href={`${context.href()}?type=${post.kind}`} mix={[textLink()]}>
								{kind?.label ?? post.kind}
							</a>
							. Bookmark the{" "}
							<a href={context.href(post.path)} mix={[textLink()]}>
								permalink
							</a>
							.
						</p>
					</footer>

					<AuthorBox context={context} />

					<DocsPager
						previous={
							view.older
								? {
										title: view.older.title,
										href: context.href(view.older.path),
										section: kindLabel(context, view.older),
									}
								: null
						}
						next={
							view.newer
								? {
										title: view.newer.title,
										href: context.href(view.newer.path),
										section: kindLabel(context, view.newer),
									}
								: null
						}
						section={kind?.singular}
						labels={{ nav: "Post navigation", previous: "Previous post", next: "Next post" }}
					/>

					{view.related.length > 0 ? <RelatedPosts posts={view.related} context={context} /> : null}

					<CommentsClosed title={post.title} />
				</article>
			</SaltboxShell>
		);
	};
}

/** The post's kind, title and "Posted on" line. */
function PostHeader(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let layout = layoutOf(context, post);
		return (
			<header mix={[vstack({ gap: 3, align: "stretch" })]}>
				<p mix={[eyebrow(), fg("brand")]}>{kindLabel(context, post)}</p>
				<h1
					mix={[
						m(0),
						leading("tight"),
						tracking("tight"),
						balance(),
						fg("neutral.emphasis"),
						raw({
							fontSize:
								layout === "note"
									? "clamp(1.75rem, 1.4rem + 1.2vw, 2.125rem)"
									: "clamp(2rem, 1.4rem + 2.4vw, 2.875rem)",
						}),
					]}
				>
					{post.title}
				</h1>
				<EntryMeta post={post} context={context} minutes={layout === "article"} />
			</header>
		);
	};
}

/**
 * What a post says before its body, by kind: an article's standfirst, a link's destination
 * card, a term's definition. A note goes straight to its body.
 */
function PostLead(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let layout = layoutOf(context, post);

		if (layout === "bookmark" && post.url) {
			return (
				<div
					data-slot="link-card"
					mix={[
						vstack({ gap: 3, align: "start" }),
						raw({
							padding: "1.25rem",
							borderRadius: "var(--ui-radius-lg)",
							border: "1px solid var(--ui-neutral-border)",
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
						}),
					]}
				>
					<p mix={[eyebrow(), fg("neutral.muted")]}>Link to {linkHost(post.url)}</p>
					<p
						mix={[
							m(0),
							fg("neutral.emphasis"),
							raw({
								fontFamily: "var(--demo-blog-reading-font)",
								fontSize: "1.125rem",
								lineHeight: 1.6,
							}),
						]}
					>
						{post.description}
					</p>
					<LinkButton href={post.url} rel="noreferrer" color="brand">
						Visit {linkHost(post.url)}
						<ArrowUpRightIcon size={16} aria-hidden="true" />
					</LinkButton>
				</div>
			);
		}
		if (layout === "term") {
			return (
				<div
					data-slot="definition"
					mix={[
						vstack({ gap: 2, align: "stretch" }),
						raw({
							paddingInlineStart: "1.25rem",
							borderInlineStart: "4px solid var(--ui-brand-bg-solid)",
						}),
					]}
				>
					<p mix={[eyebrow(), fg("neutral.muted")]}>Definition</p>
					<p
						mix={[
							m(0),
							pretty(),
							fg("neutral.emphasis"),
							raw({
								fontFamily: "var(--demo-blog-reading-font)",
								fontStyle: "italic",
								fontSize: "1.3125rem",
								lineHeight: 1.5,
							}),
						]}
					>
						{post.description}
					</p>
				</div>
			);
		}
		if (layout === "note") return null;
		return (
			<p
				mix={[
					m(0),
					pretty(),
					fg("neutral"),
					raw({
						fontFamily: "var(--demo-blog-reading-font)",
						fontSize: "1.25rem",
						lineHeight: 1.55,
					}),
				]}
			>
				{post.description}
			</p>
		);
	};
}

/** Where a tutorial sits in its series: "Part n of m", every part in order, and what's next. */
function SeriesBox(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let index = view.series.findIndex((part) => part.path === post.path);
		let next = view.series[index + 1];
		return (
			<aside
				aria-label={`${post.series} series`}
				data-slot="series-box"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					raw({
						padding: "1.25rem 1.25rem 1.25rem 1.5rem",
						borderRadius: "var(--ui-radius-lg)",
						backgroundColor: "var(--ui-brand-bg-tint)",
						border: "1px solid var(--ui-brand-border)",
					}),
				]}
			>
				<p mix={[m(0), text("sm"), fg("neutral")]}>
					This post is part {index + 1} of {view.series.length} in{" "}
					<strong mix={[fg("neutral.emphasis")]}>{post.series}</strong>.
				</p>
				<ol
					mix={[m(0), raw({ paddingInlineStart: "1.25rem" }), vstack({ gap: 1, align: "stretch" })]}
				>
					{view.series.map((part) => (
						<li key={part.path}>
							{part.path === post.path ? (
								<span aria-current="page" mix={[weight("bold"), fg("neutral.emphasis")]}>
									{shortTitle(part)}
								</span>
							) : (
								<a href={context.href(part.path)} mix={[textLink()]}>
									{shortTitle(part)}
								</a>
							)}
						</li>
					))}
				</ol>
				{next ? (
					<p mix={[m(0), text("sm"), weight("semibold")]}>
						<a href={context.href(next.path)} mix={[textLink()]}>
							Next in the series: {shortTitle(next)} <span aria-hidden="true">→</span>
						</a>
					</p>
				) : null}
			</aside>
		);
	};
}

/**
 * A series part's title without the series name it opens with, since the box already names it.
 *
 * @example shortTitle({ title: "Self-hosting a Go service: Caddy in front", ... }) // "Caddy in front"
 */
function shortTitle(post: DemoBlogPost): string {
	let prefix = `${post.series}: `;
	let rest = post.title.startsWith(prefix) ? post.title.slice(prefix.length) : post.title;
	return `${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
}

/** The sidebar of a long article: search, the author, and the outline, which sticks while read. */
function OutlineSidebar(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		return (
			<>
				<SearchWidget context={context} />
				<AboutWidget context={context} />
				<div
					data-slot="post-outline"
					mix={[
						raw({ display: "none" }),
						media(
							TWO_COLUMN_QUERY,
							raw({
								display: "block",
								position: "sticky",
								insetBlockStart: "5.5rem",
								paddingBlockStart: "0.625rem",
								borderBlockStart: "3px solid var(--ui-brand-bg-solid)",
							}),
						),
					]}
				>
					<TableOfContents items={view.article.toc} label="In this article" />
				</div>
			</>
		);
	};
}

namespace ContextProps {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The author box under every post: portrait, name, bio and where to read more. */
function AuthorBox(handle: Handle<ContextProps.Props>) {
	return () => {
		let { href, site } = handle.props.context;
		return (
			<section
				aria-labelledby="author-box-title"
				data-slot="author-box"
				mix={[
					hstack({ gap: 4, align: "start" }),
					raw({
						padding: "1.25rem",
						borderRadius: "var(--ui-radius-lg)",
						backgroundColor: "var(--ui-neutral-bg-tint-hover)",
					}),
				]}
			>
				<Avatar size="lg" mix={[raw({ flex: "none" })]}>
					<Avatar.Fallback>{site.author.initials}</Avatar.Fallback>
				</Avatar>
				<div mix={[vstack({ gap: 2, align: "stretch" }), raw({ minInlineSize: 0 })]}>
					<h2
						id="author-box-title"
						mix={[m(0), raw({ fontSize: "1.0625rem" }), fg("neutral.emphasis")]}
					>
						About {site.author.name}
					</h2>
					<p
						mix={[
							m(0),
							fg("neutral"),
							raw({
								fontFamily: "var(--demo-blog-reading-font)",
								fontSize: "1rem",
								lineHeight: 1.6,
							}),
						]}
					>
						{site.author.bio}
					</p>
					<p
						mix={[
							m(0),
							hstack({ gap: 4, align: "baseline" }),
							raw({ flexWrap: "wrap" }),
							text("sm"),
						]}
					>
						<a href={href(ARCHIVE_PAGE)} mix={[textLink(), weight("semibold")]}>
							View all posts by {site.author.name.split(" ")[0]} <span aria-hidden="true">→</span>
						</a>
						<a href={href(ABOUT_PAGE)} mix={[textLink()]}>
							About this blog
						</a>
					</p>
				</div>
			</section>
		);
	};
}

namespace RelatedPosts {
	export interface Props extends ContextProps.Props {
		posts: DemoBlogPost[];
	}
}

/** Up to three posts sharing tags with this one, side by side on wide screens. */
function RelatedPosts(handle: Handle<RelatedPosts.Props>) {
	return () => {
		let { context, posts } = handle.props;
		return (
			<section
				aria-labelledby="related-title"
				data-slot="related-posts"
				mix={[vstack({ gap: 4, align: "stretch" })]}
			>
				<h2 id="related-title" mix={[m(0), raw({ fontSize: "1.25rem" }), fg("neutral.emphasis")]}>
					Related posts
				</h2>
				<ul
					mix={[
						m(0),
						p(0),
						listStyle(),
						raw({
							display: "grid",
							gap: "1rem",
							gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
						}),
					]}
				>
					{posts.map((post) => (
						<li
							key={post.path}
							mix={[
								vstack({ gap: 2, align: "stretch" }),
								raw({
									paddingBlockStart: "0.75rem",
									borderBlockStart: "2px solid var(--ui-neutral-border)",
								}),
							]}
						>
							<p mix={[eyebrow(), fg("brand")]}>{kindLabel(context, post)}</p>
							<a
								href={context.href(post.path)}
								mix={[
									leading("snug"),
									weight("semibold"),
									fg("neutral.emphasis"),
									raw({ textDecoration: "none", fontFamily: "var(--demo-blog-heading-font)" }),
									hover(fg("brand")),
								]}
							>
								{post.title}
							</a>
							<span mix={[text("xs"), fg("neutral.muted")]}>
								<PostDate date={post.date} style="long" />
							</span>
						</li>
					))}
				</ul>
			</section>
		);
	};
}

namespace CommentsClosed {
	export interface Props {
		title: string;
	}
}

/** Where a comment form would be: comments are closed, and a reply goes by email instead. */
function CommentsClosed(handle: Handle<CommentsClosed.Props>) {
	return () => {
		let subject = encodeURIComponent(`Re: ${handle.props.title}`);
		return (
			<section
				aria-labelledby="comments-title"
				data-slot="comments-closed"
				mix={[
					vstack({ gap: 2, align: "stretch" }),
					raw({
						padding: "1.25rem",
						border: "1px dashed var(--ui-neutral-border-hover)",
						borderRadius: "var(--ui-radius-lg)",
					}),
				]}
			>
				<h2
					id="comments-title"
					mix={[m(0), raw({ fontSize: "1.0625rem" }), fg("neutral.emphasis")]}
				>
					Comments are closed
				</h2>
				<p mix={[m(0), fg("neutral"), leading("relaxed")]}>
					Have a correction or a question?{" "}
					<a
						href={`mailto:${REPLY_EMAIL}?subject=${subject}`}
						mix={[textLink(), weight("semibold")]}
					>
						Reply by email
					</a>{" "}
					and I'll answer, and fix the post if I got something wrong.
				</p>
			</section>
		);
	};
}

namespace ArchivePage {
	export interface Props extends ContextProps.Props {
		posts: DemoBlogPost[];
		type: string | null;
	}
}

/**
 * Every post by year and month, newest first, narrowed by type. Each month heading carries
 * its `YYYY-MM` id, which the sidebar's Archives widget links to.
 */
function ArchivePage(handle: Handle<ArchivePage.Props>) {
	return () => {
		let { context, posts, type } = handle.props;
		let options = filterOptions(context, context.posts, type, context.href(ARCHIVE_PAGE), "?");
		let label =
			type === null ? "posts" : (context.site.kinds[type]?.label.toLowerCase() ?? "posts");
		return (
			<SaltboxShell context={context} current={ARCHIVE_PAGE}>
				<div mix={[vstack({ gap: 8, align: "stretch" })]}>
					<PageHeader
						title="Archives"
						description={`${posts.length} ${label}, newest first, by the month they went out.`}
					>
						<FilterRow options={options} label="Filter the archive by type" />
					</PageHeader>
					<div data-slot="archive-list" mix={[vstack({ gap: 8, align: "stretch" })]}>
						{groupByYear(posts).map((group) => (
							<section
								key={group.year}
								aria-labelledby={`year-${group.year}`}
								mix={[vstack({ gap: 4, align: "stretch" })]}
							>
								<h2
									id={`year-${group.year}`}
									mix={[
										m(0),
										hstack({ gap: 2, align: "baseline" }),
										raw({ fontSize: "1.75rem" }),
										fg("neutral.emphasis"),
									]}
								>
									{group.year}
									<span mix={[text("sm"), weight("normal"), fg("neutral.muted")]}>
										{group.posts.length} {group.posts.length === 1 ? "post" : "posts"}
									</span>
								</h2>
								{groupByMonth(group.posts).map((month) => (
									<div key={month.month} mix={[vstack({ gap: 2, align: "stretch" })]}>
										<h3
											id={month.month}
											mix={[
												eyebrow(),
												fg("brand"),
												raw({
													scrollMarginTop: "5rem",
													paddingBlockEnd: "0.375rem",
													borderBlockEnd: "1px solid var(--ui-neutral-border)",
												}),
											]}
										>
											{monthName(month.month)}
										</h3>
										<ul mix={[m(0), p(0), listStyle(), vstack({ gap: 0, align: "stretch" })]}>
											{month.posts.map((post) => (
												<li
													key={post.path}
													mix={[
														raw({
															display: "grid",
															gridTemplateColumns: "4rem minmax(0, 1fr)",
															columnGap: "1rem",
															rowGap: "0.125rem",
															paddingBlock: "0.5rem",
															alignItems: "baseline",
														}),
														media(
															"(min-width: 40rem)",
															raw({ gridTemplateColumns: "4rem minmax(0, 1fr) 6rem" }),
														),
													]}
												>
													<span
														mix={[
															text("sm"),
															fg("neutral.muted"),
															raw({ fontVariantNumeric: "tabular-nums" }),
														]}
													>
														<PostDate date={post.date} style="day" />
													</span>
													<a
														href={context.href(post.path)}
														mix={[
															fg("neutral.emphasis"),
															leading("snug"),
															raw({
																textDecoration: "none",
																fontFamily: "var(--demo-blog-reading-font)",
																fontSize: "1.0625rem",
															}),
															hover(fg("brand")),
														]}
													>
														{post.title}
													</a>
													<span
														mix={[
															eyebrow(),
															fg("neutral.muted"),
															raw({ gridColumn: "2" }),
															media(
																"(min-width: 40rem)",
																raw({ gridColumn: "3", textAlign: "end" }),
															),
														]}
													>
														{kindLabel(context, post)}
													</span>
												</li>
											))}
										</ul>
									</div>
								))}
							</section>
						))}
					</div>
				</div>
			</SaltboxShell>
		);
	};
}

/**
 * Posts grouped by the month they went out, in the order given.
 *
 * @param posts Posts newest first, which each group keeps.
 */
function groupByMonth(posts: DemoBlogPost[]): Array<{ month: string; posts: DemoBlogPost[] }> {
	let months: Array<{ month: string; posts: DemoBlogPost[] }> = [];
	for (let post of posts) {
		let month = post.date.slice(0, 7);
		let group = months.at(-1);
		if (group?.month === month) group.posts.push(post);
		else months.push({ month, posts: [post] });
	}
	return months;
}

namespace TagsPage {
	export interface Props extends ContextProps.Props {
		tags: Array<{ tag: string; count: number }>;
	}
}

/** Every tag as a large cloud, then each one with what it collects and how many posts. */
function TagsPage(handle: Handle<TagsPage.Props>) {
	return () => {
		let { context, tags } = handle.props;
		let alphabetical = [...tags].sort((a, b) => a.tag.localeCompare(b.tag));
		return (
			<SaltboxShell context={context}>
				<div mix={[vstack({ gap: 8, align: "stretch" })]}>
					<PageHeader
						title="Topics"
						description={`${tags.length} tags across ${context.posts.length} posts. The bigger the word, the more I have written about it.`}
					/>
					<div data-slot="topics-cloud">
						<TagCloud tags={alphabetical} context={context} scale={1.5} />
					</div>
					<dl mix={[m(0), vstack({ gap: 0, align: "stretch" })]}>
						{tags.map((entry) => (
							<div
								key={entry.tag}
								mix={[
									vstack({ gap: 1, align: "stretch" }),
									raw({
										paddingBlock: "1rem",
										borderBlockEnd: "1px solid var(--ui-neutral-border)",
									}),
								]}
							>
								<dt mix={[hstack({ gap: 2, align: "baseline" })]}>
									<a
										href={context.href(`${TAGS_PAGE}/${encodeURIComponent(entry.tag)}`)}
										mix={[textLink(), weight("bold"), raw({ fontSize: "1.125rem" })]}
									>
										{entry.tag}
									</a>
									<span mix={[text("sm"), fg("neutral.muted")]}>
										{entry.count} {entry.count === 1 ? "post" : "posts"}
									</span>
								</dt>
								{context.site.tags[entry.tag] ? (
									<dd
										mix={[
											m(0),
											fg("neutral"),
											raw({ fontFamily: "var(--demo-blog-reading-font)", lineHeight: 1.6 }),
										]}
									>
										{context.site.tags[entry.tag]}
									</dd>
								) : null}
							</div>
						))}
					</dl>
				</div>
			</SaltboxShell>
		);
	};
}

namespace TagPage {
	export interface Props extends ContextProps.Props {
		tag: string;
		posts: DemoBlogPost[];
	}
}

/** One tag's posts in the loop, under a header naming the tag and what it collects. */
function TagPage(handle: Handle<TagPage.Props>) {
	return () => {
		let { context, posts, tag } = handle.props;
		return (
			<SaltboxShell context={context}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader label="Tag" title={tag} description={context.site.tags[tag]}>
						<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
							{posts.length} {posts.length === 1 ? "post" : "posts"} ·{" "}
							<a href={context.href(TAGS_PAGE)} mix={[textLink()]}>
								All topics
							</a>
						</p>
					</PageHeader>
					<EntryList posts={posts} context={context} />
				</div>
			</SaltboxShell>
		);
	};
}

namespace SearchPage {
	export interface Props extends ContextProps.Props {
		query: string;
		type: string | null;
		matches: DemoBlogPost[];
		results: DemoBlogPost[];
	}
}

/** Results for `?q=` in the loop, a type filter counted over every match, and a way on when none. */
function SearchPage(handle: Handle<SearchPage.Props>) {
	return () => {
		let { context, matches, query, results, type } = handle.props;
		let trimmed = query.trim();
		let base = `${context.href(SEARCH_PAGE)}?q=${encodeURIComponent(trimmed)}`;
		let options = filterOptions(context, matches, type, base, "&");
		return (
			<SaltboxShell context={context}>
				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<PageHeader
						label={trimmed === "" ? undefined : "Search results"}
						title={trimmed === "" ? "Search" : `“${trimmed}”`}
						description={
							trimmed === ""
								? "Search every post by its title, summary, tags and text."
								: `${results.length} ${results.length === 1 ? "post matches" : "posts match"} every word.`
						}
					>
						<SearchForm context={context} id="search-page-query" query={trimmed} />
						{matches.length > 0 ? (
							<FilterRow options={options} label="Filter results by type" />
						) : null}
					</PageHeader>
					{results.length > 0 ? (
						<div data-slot="search-results">
							<EntryList posts={results} context={context} />
						</div>
					) : (
						<NothingFound query={trimmed} context={context} />
					)}
				</div>
			</SaltboxShell>
		);
	};
}

namespace NothingFound {
	export interface Props extends ContextProps.Props {
		query: string;
	}
}

/** What a search with no results offers instead: a hint and the topics to browse. */
function NothingFound(handle: Handle<NothingFound.Props>) {
	return () => {
		let { context, query } = handle.props;
		let counts = countTags(context.posts).sort((a, b) => a.tag.localeCompare(b.tag));
		return (
			<div
				data-slot="nothing-found"
				mix={[vstack({ gap: 4, align: "stretch" }), raw({ paddingBlock: "1.5rem" })]}
			>
				<p
					mix={[
						m(0),
						fg("neutral"),
						raw({ fontFamily: "var(--demo-blog-reading-font)", fontSize: "1.125rem" }),
					]}
				>
					{query === ""
						? "Type a word or two above, or browse by topic:"
						: "Nothing matched every word. Try fewer or broader words, or browse by topic:"}
				</p>
				<TagCloud tags={counts} context={context} scale={1.2} />
			</div>
		);
	};
}

/** The about page: the author's portrait and role, their prose, and where to find them. */
function AboutPage(handle: Handle<ContextProps.Props>) {
	return () => {
		let { context } = handle.props;
		let { author } = context.site;
		return (
			<SaltboxShell context={context} current={ABOUT_PAGE}>
				<article data-slot="about" mix={[vstack({ gap: 7, align: "stretch" })]}>
					<PageHeader title={`About ${context.site.name}`}>
						<div mix={[hstack({ gap: 3, align: "center" })]}>
							<Avatar size="lg">
								<Avatar.Fallback>{author.initials}</Avatar.Fallback>
							</Avatar>
							<div mix={[vstack({ gap: 0, align: "start" })]}>
								<p mix={[m(0), weight("bold"), fg("neutral.emphasis")]}>{author.name}</p>
								<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{author.role}</p>
							</div>
						</div>
					</PageHeader>
					<Typeset
						preset="reading"
						mix={[m(0), raw({ fontFamily: "var(--demo-blog-reading-font)" })]}
					>
						{context.site.about()}
					</Typeset>
					<section aria-labelledby="elsewhere" mix={[vstack({ gap: 2, align: "stretch" })]}>
						<h2 id="elsewhere" mix={[m(0), raw({ fontSize: "1.125rem" })]}>
							Elsewhere
						</h2>
						<ul
							mix={[
								m(0),
								p(0),
								listStyle(),
								hstack({ gap: 4, align: "center" }),
								raw({ flexWrap: "wrap" }),
							]}
						>
							{author.links.map((link) => (
								<li key={link.href}>
									<a href={link.href} rel="noreferrer me" mix={[textLink()]}>
										{link.label}
									</a>
								</li>
							))}
							<li>
								<a href={`mailto:${REPLY_EMAIL}`} mix={[textLink()]}>
									Email
								</a>
							</li>
							<li>
								<a href={context.href(FEED_PAGE)} mix={[textLink()]}>
									RSS feed
								</a>
							</li>
						</ul>
					</section>
				</article>
			</SaltboxShell>
		);
	};
}

namespace SubscribePage {
	export interface Props extends ContextProps.Props {
		sent: boolean;
	}
}

/** The newsletter sign-up, its confirmation once posted, and the feed for readers who prefer one. */
function SubscribePage(handle: Handle<SubscribePage.Props>) {
	return () => {
		let { context, sent } = handle.props;
		return (
			<SaltboxShell context={context}>
				<div data-slot="subscribe" mix={[vstack({ gap: 7, align: "stretch" })]}>
					<PageHeader
						title="Subscribe"
						description="One plain-text email at the start of each month, with everything I published in the last one. No tracking pixels, and one click to leave."
					/>
					{sent ? (
						<Callout kind="tip" label="Almost there" data-slot="subscribe-confirmation">
							Check your inbox for a confirmation link. Nothing was sent, since Saltbox is a demo,
							but this is where a real sign-up lands.
						</Callout>
					) : (
						<NewsletterForm action={context.href(SUBSCRIBE_PAGE)} />
					)}
					<section
						aria-labelledby="feed-title"
						mix={[
							vstack({ gap: 3, align: "start" }),
							raw({
								paddingBlockStart: "1.5rem",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<h2 id="feed-title" mix={[m(0), raw({ fontSize: "1.25rem" })]}>
							Prefer a feed reader?
						</h2>
						<p
							mix={[
								m(0),
								fg("neutral"),
								raw({ fontFamily: "var(--demo-blog-reading-font)", fontSize: "1.0625rem" }),
							]}
						>
							Every post goes out in the RSS feed the moment it is published, notes and links
							included.
						</p>
						<LinkButton href={context.href(FEED_PAGE)} variant="outline">
							<RssIcon size={16} aria-hidden="true" />
							Subscribe by RSS
						</LinkButton>
					</section>
				</div>
			</SaltboxShell>
		);
	};
}

namespace NotFoundPage {
	export interface Props extends ContextProps.Props {
		path: string;
	}
}

/**
 * The 404: the address that missed, a search box filled from its last segment, and the
 * latest posts to start from instead.
 */
function NotFoundPage(handle: Handle<NotFoundPage.Props>) {
	return () => {
		let { context, path } = handle.props;
		let guess = decodeURIComponent(path.split("/").filter(Boolean).at(-1) ?? "").replace(
			/[-_]+/g,
			" ",
		);
		return (
			<SaltboxShell context={context}>
				<div data-slot="not-found" mix={[vstack({ gap: 7, align: "stretch" })]}>
					<PageHeader
						label="Error 404"
						title="That page can't be found"
						description={
							<>
								Nothing lives at{" "}
								<code mix={[raw({ fontSize: "0.9em", overflowWrap: "anywhere" })]}>{path}</code>. It
								may have moved, or the address has a typo. Try a search:
							</>
						}
					>
						<SearchForm context={context} id="not-found-query" query={guess} />
					</PageHeader>
					<section aria-labelledby="start-here" mix={[vstack({ gap: 3, align: "stretch" })]}>
						<h2 id="start-here" mix={[m(0), raw({ fontSize: "1.25rem" })]}>
							Or start with something recent
						</h2>
						<RecentList posts={context.posts.slice(0, 5)} context={context} />
						<p mix={[m(0), text("sm")]}>
							<a href={context.href(ARCHIVE_PAGE)} mix={[textLink(), weight("semibold")]}>
								Browse the archives <span aria-hidden="true">→</span>
							</a>
						</p>
					</section>
				</div>
			</SaltboxShell>
		);
	};
}

namespace RecentList {
	export interface Props extends ContextProps.Props {
		posts: DemoBlogPost[];
	}
}

/** Posts as a short list of title, kind and date. */
function RecentList(handle: Handle<RecentList.Props>) {
	return () => {
		let { context, posts } = handle.props;
		return (
			<ul mix={[m(0), p(0), listStyle(), vstack({ gap: 0, align: "stretch" })]}>
				{posts.map((post) => (
					<li
						key={post.path}
						mix={[
							vstack({ gap: 1, align: "stretch" }),
							raw({
								paddingBlock: "0.75rem",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<a
							href={context.href(post.path)}
							mix={[
								textLink(),
								weight("semibold"),
								raw({ fontFamily: "var(--demo-blog-heading-font)" }),
							]}
						>
							{post.title}
						</a>
						<span mix={[text("xs"), fg("neutral.muted")]}>
							{kindLabel(context, post)} · <PostDate date={post.date} style="long" />
						</span>
					</li>
				))}
			</ul>
		);
	};
}
