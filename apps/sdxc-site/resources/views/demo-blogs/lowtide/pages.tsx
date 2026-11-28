/**
 * Low Tide's pages, drawn as a logbook: one column, every kind of post in one stream with
 * its kind in the margin, and each post's page shaped by what it is. Every view the blog's
 * controller builds is drawn here inside the blog's frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowUpRightIcon, RssIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { balance, font, leading, text, textDecoration, tracking, weight } from "@sdxc/u/typography";
import { Breadcrumbs, LinkButton, SearchField, Typeset } from "@sdxc/ui";
import { Callout, DocsPager, TableOfContents } from "@sdxc/ui/docs";

import type {
	DemoBlogFeedView,
	DemoBlogPostView,
	DemoBlogContext,
	DemoBlogView,
} from "~/resources/views/demo-blogs";

import { countKinds, groupByYear, searchPosts } from "~/app/services/demo-blogs";
import { FEED_PAGE, SEARCH_PAGE, SUBSCRIBE_PAGE, TAGS_PAGE } from "~/resources/views/demo-blogs";
import { DemoBlogShell } from "~/resources/views/demo-blogs/lowtide/frame";
import {
	Column,
	GUTTER_QUERY,
	HostChip,
	headingFont,
	kindLabel,
	labelStyle,
	Pager,
	Portrait,
	quietLink,
	Stream,
	TagLinks,
	titleLink,
	TypeFilter,
} from "~/resources/views/demo-blogs/lowtide/parts";
import {
	formatPostDate,
	NewsletterForm,
	PostBody,
	PostDate,
} from "~/resources/views/demo-blogs/parts";

/** The column an article's prose reads in, a little narrower than the stream. */
const ARTICLE_MEASURE = "42rem";

/** The width from which an article's outline moves into a rail beside it. */
const RAIL_QUERY = "(min-width: 72rem)";

namespace LowTidePage {
	export interface Props {
		view: DemoBlogView;
		context: DemoBlogContext;
	}
}

/** Draws whichever page the controller asked for, inside the blog's frame. */
export function LowTidePage(handle: Handle<LowTidePage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let current = iife(() => {
			if (view.view === "feed" && view.type !== null) return `?type=${view.type}`;
			if (view.view === "post") return `?type=${view.article.post.kind}`;
			if (view.view === "archive") return "archive";
			if (view.view === "about") return "about";
			return undefined;
		});
		return (
			<DemoBlogShell site={context.site} slug={context.slug} current={current}>
				<PageBody view={view} context={context} />
			</DemoBlogShell>
		);
	};
}

/** Picks the page for the view. */
function PageBody(handle: Handle<LowTidePage.Props>) {
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
				return <SearchPage view={view} context={context} />;
			case "about":
				return <AboutPage context={context} />;
			case "subscribe":
				return <SubscribePage sent={view.sent} context={context} />;
			case "not-found":
				return <NotFoundPage path={view.path} context={context} />;
		}
	};
}

namespace PageTitle {
	export interface Props {
		eyebrow?: RemixNode;
		title: RemixNode;
		lead?: RemixNode;
		children?: RemixNode;
	}
}

/** A page's heading block: an optional eyebrow, the serif title and its lead. */
function PageTitle(handle: Handle<PageTitle.Props>) {
	return () => {
		let { children, eyebrow, lead, title } = handle.props;
		return (
			<header mix={[vstack({ gap: 3, align: "stretch" }), raw({ paddingBlockEnd: "1.5rem" })]}>
				{eyebrow ? <p mix={[labelStyle()]}>{eyebrow}</p> : null}
				<h1
					mix={[
						m(0),
						raw({ fontSize: "clamp(2rem, 1.4rem + 2.4vw, 2.75rem)" }),
						leading("tight"),
						tracking("tight"),
						balance(),
						fg("neutral.emphasis"),
					]}
				>
					{title}
				</h1>
				{lead ? (
					<p
						mix={[
							m(0),
							raw({ fontSize: "1.125rem", maxInlineSize: "40rem" }),
							leading("relaxed"),
							fg("neutral"),
						]}
					>
						{lead}
					</p>
				) : null}
				{children}
			</header>
		);
	};
}

namespace FeedPage {
	export interface Props {
		view: DemoBlogFeedView;
		context: DemoBlogContext;
	}
}

/**
 * The blog's front page: who writes it, the type filter, the featured article on the first
 * unfiltered page, then every post in one stream by month, paged back in time.
 */
function FeedPage(handle: Handle<FeedPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { posts, site } = context;
		let kind = view.type === null ? null : site.kinds[view.type];
		let first = posts.at(-1)?.date.slice(0, 4);
		let feed =
			view.featured === null
				? view.feed
				: view.feed.filter((post) => post.path !== view.featured?.path);

		return (
			<Column>
				<header mix={[vstack({ gap: 4, align: "stretch" }), raw({ paddingBlockEnd: "1.25rem" })]}>
					{kind ? (
						<PageTitle eyebrow="Filtered feed" title={kind.label} lead={kind.description} />
					) : (
						<div mix={[hstack({ gap: 3, align: "start" })]}>
							<Portrait initials={site.author.initials} size={2.75} />
							<p mix={[m(0), leading("relaxed"), fg("neutral"), raw({ maxInlineSize: "38rem" })]}>
								<a
									href={context.href("about")}
									mix={[quietLink(), fg("neutral.emphasis"), weight("semibold")]}
								>
									{site.author.name}
								</a>{" "}
								writes about HTTP, caching and the edge. {posts.length} posts since {first}: long
								articles, tutorials, short notes, links worth reading and a glossary, all in one
								log.
							</p>
						</div>
					)}
					<TypeFilter
						context={context}
						current={view.type}
						counts={countKinds(site, posts)}
						total={posts.length}
						href={(type) => (type === null ? context.href() : `${context.href()}?type=${type}`)}
					/>
				</header>

				{view.featured ? <Featured context={context} view={view} /> : null}

				<Stream posts={feed} context={context} />
				<Pager page={view.page} pageCount={view.pageCount} pageHref={view.pageHref} />
				<SubscribeStrip context={context} />
			</Column>
		);
	};
}

/** The featured article, pinned above the log in a ruled box. */
function Featured(handle: Handle<FeedPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let post = view.featured;
		if (post === null) return null;
		return (
			<article
				data-slot="featured-post"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					raw({
						padding: "1.5rem",
						marginBlockEnd: "1.5rem",
						borderRadius: "var(--ui-radius-lg)",
						border: "1px solid var(--ui-brand-border)",
						background:
							"linear-gradient(180deg, var(--ui-brand-bg-tint), color-mix(in oklch, var(--ui-brand-bg-tint) 30%, var(--ui-bg)))",
					}),
					media("(min-width: 40rem)", raw({ padding: "2rem" })),
				]}
			>
				<p mix={[labelStyle()]}>Featured {kindLabel(context, post).toLowerCase()}</p>
				<h2
					mix={[
						m(0),
						raw({ fontSize: "clamp(1.625rem, 1.2rem + 1.6vw, 2.125rem)" }),
						leading("tight"),
						tracking("tight"),
						balance(),
					]}
				>
					<a href={context.href(post.path)} mix={[titleLink()]}>
						{post.title}
					</a>
				</h2>
				<p
					mix={[
						m(0),
						raw({ fontSize: "1.0625rem", fontFamily: "var(--demo-blog-reading-font)" }),
						leading("relaxed"),
						fg("neutral"),
					]}
				>
					{post.description}
				</p>
				<p
					mix={[
						m(0),
						hstack({ gap: 3, align: "center" }),
						raw({ flexWrap: "wrap" }),
						text("sm"),
						fg("neutral.muted"),
					]}
				>
					<PostDate date={post.date} style="long" />
					<span>{post.minutes} min read</span>
					<TagLinks tags={post.tags} context={context} />
				</p>
			</article>
		);
	};
}

namespace SubscribeStrip {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The newsletter and the feed, offered once the reader reaches the end of a page of the log. */
function SubscribeStrip(handle: Handle<SubscribeStrip.Props>) {
	return () => {
		let { context } = handle.props;
		return (
			<aside
				aria-labelledby="subscribe-strip"
				data-slot="subscribe-strip"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					raw({
						marginBlockStart: "1.5rem",
						paddingBlock: "1.5rem",
						borderBlock: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				<h2 id="subscribe-strip" mix={[m(0), raw({ fontSize: "1.25rem" })]}>
					One email a month, everything in it
				</h2>
				<p mix={[m(0), fg("neutral"), leading("relaxed")]}>
					Every article, tutorial, note and link from the month, in one letter. Or follow the{" "}
					<a href={context.href(FEED_PAGE)} mix={[quietLink()]}>
						RSS feed
					</a>
					, which has the same posts the day they go out.
				</p>
				<NewsletterForm action={context.href(SUBSCRIBE_PAGE)} />
			</aside>
		);
	};
}

namespace PostPage {
	export interface Props {
		view: DemoBlogPostView;
		context: DemoBlogContext;
	}
}

/**
 * One post. An article or tutorial gets the full reading layout with its outline; a note, a
 * link and a glossary term get the shorter page their kind needs. Every one ends on what to
 * read next.
 */
function PostPage(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		let kind = context.site.kinds[post.kind];

		return (
			<div
				mix={[
					raw({
						inlineSize: "100%",
						maxInlineSize: "76rem",
						marginInline: "auto",
						paddingInline: "1rem",
						paddingBlock: "1.5rem 4rem",
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						columnGap: "4rem",
					}),
					media(
						RAIL_QUERY,
						raw({
							gridTemplateColumns: `minmax(0, 1fr) minmax(0, ${ARTICLE_MEASURE}) minmax(12rem, 1fr)`,
						}),
					),
				]}
			>
				<article
					data-slot="post"
					data-layout={layout}
					mix={[
						vstack({ gap: 6, align: "stretch" }),
						raw({ inlineSize: "100%", maxInlineSize: ARTICLE_MEASURE, marginInline: "auto" }),
						media(RAIL_QUERY, raw({ gridColumn: "2", marginInline: 0 })),
					]}
				>
					<Breadcrumbs aria-label="Breadcrumb">
						<Breadcrumbs.List>
							<Breadcrumbs.Item>
								<Breadcrumbs.Link href={context.href()}>{context.site.name}</Breadcrumbs.Link>
							</Breadcrumbs.Item>
							<Breadcrumbs.Item>
								<Breadcrumbs.Link href={`${context.href()}?type=${post.kind}`}>
									{kind?.label ?? post.kind}
								</Breadcrumbs.Link>
							</Breadcrumbs.Item>
						</Breadcrumbs.List>
					</Breadcrumbs>

					<PostHeader view={view} context={context} />

					{view.series.length > 0 ? <SeriesBox view={view} context={context} /> : null}

					{layout === "article" && view.article.toc.length >= 2 ? (
						<div
							mix={[
								raw({
									position: "sticky",
									insetBlockStart: 0,
									zIndex: 2,
									marginInline: "-1rem",
									backgroundColor: "var(--ui-bg)",
									borderBlock: "1px solid var(--ui-neutral-border)",
								}),
								media(RAIL_QUERY, raw({ display: "none" })),
							]}
						>
							<TableOfContents items={view.article.toc} label="On this page" layout="bar" />
						</div>
					) : null}

					<PostBody document={view.article.document} />

					<footer mix={[vstack({ gap: 6, align: "stretch" })]}>
						{post.tags.length > 0 ? (
							<p
								mix={[
									m(0),
									hstack({ gap: 2, align: "baseline" }),
									raw({ flexWrap: "wrap" }),
									text("sm"),
									fg("neutral.muted"),
								]}
							>
								Filed under <TagLinks tags={post.tags} context={context} />
							</p>
						) : null}
						{layout === "article" ? <AuthorCard context={context} /> : null}
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
							labels={{ nav: "More posts", previous: "Older", next: "Newer" }}
						/>
						{view.related.length > 0 ? (
							<section
								aria-labelledby="related"
								data-slot="related-posts"
								mix={[vstack({ gap: 2, align: "stretch" })]}
							>
								<h2 id="related" mix={[m(0), raw({ fontSize: "1.25rem" })]}>
									Read next
								</h2>
								<Stream posts={view.related} context={context} months={false} />
							</section>
						) : null}
					</footer>
				</article>

				{layout === "article" && view.article.toc.length >= 2 ? (
					<aside
						data-slot="post-rail"
						mix={[
							raw({ display: "none" }),
							media(
								RAIL_QUERY,
								raw({
									display: "block",
									gridColumn: "3",
									position: "sticky",
									insetBlockStart: "2rem",
									alignSelf: "start",
									paddingBlockStart: "9rem",
								}),
							),
						]}
					>
						<TableOfContents items={view.article.toc} label="On this page" />
					</aside>
				) : null}
			</div>
		);
	};
}

/** The post's title block, shaped by its kind: a byline for an article, a destination for a link. */
function PostHeader(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		let author = context.site.author;

		return (
			<header mix={[vstack({ gap: 4, align: "stretch" })]}>
				<p mix={[labelStyle()]}>{kindLabel(context, post)}</p>
				<h1
					mix={[
						m(0),
						raw({
							fontSize:
								layout === "note"
									? "clamp(1.625rem, 1.3rem + 1.2vw, 2rem)"
									: "clamp(2rem, 1.3rem + 2.8vw, 3rem)",
						}),
						leading("tight"),
						tracking("tight"),
						balance(),
						fg("neutral.emphasis"),
					]}
				>
					{post.title}
				</h1>
				{layout === "note" ? null : (
					<p
						mix={[
							m(0),
							raw({ fontSize: "1.1875rem", fontFamily: "var(--demo-blog-reading-font)" }),
							leading("relaxed"),
							fg("neutral"),
						]}
					>
						{post.description}
					</p>
				)}
				{layout === "bookmark" && post.url ? (
					<div mix={[hstack({ gap: 3, align: "center" }), raw({ flexWrap: "wrap" })]}>
						<LinkButton href={post.url} rel="noreferrer" color="brand">
							Read it on the original site
							<ArrowUpRightIcon size={16} aria-hidden="true" />
						</LinkButton>
						<HostChip url={post.url} />
					</div>
				) : null}
				<div mix={[hstack({ gap: 3, align: "center" }), text("sm"), fg("neutral.muted")]}>
					<Portrait initials={author.initials} size={2.25} />
					<p mix={[m(0), vstack({ gap: 0, align: "start" })]}>
						<a
							href={context.href("about")}
							mix={[
								quietLink(),
								fg("neutral.emphasis"),
								weight("medium"),
								raw({ textDecoration: "none" }),
							]}
						>
							{author.name}
						</a>
						<span mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
							<PostDate date={post.date} style="long" />
							{layout === "article" ? <span>· {post.minutes} min read</span> : null}
							{post.updated ? <span>· Updated {formatPostDate(post.updated)}</span> : null}
						</span>
					</p>
				</div>
			</header>
		);
	};
}

/** The series a post belongs to, every part listed and this one marked. */
function SeriesBox(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		return (
			<nav
				aria-labelledby="series-title"
				data-slot="series-box"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					p(4),
					raw({
						borderRadius: "var(--ui-radius-lg)",
						border: "1px solid var(--ui-neutral-border)",
						backgroundColor: "var(--ui-neutral-bg-tint)",
					}),
				]}
			>
				<p id="series-title" mix={[m(0), text("sm"), fg("neutral.muted")]}>
					Part {post.part} of {view.series.length} in{" "}
					<span mix={[fg("neutral.emphasis"), weight("semibold")]}>{post.series}</span>
				</p>
				<ol mix={[m(0), p(0), listStyle("none"), vstack({ gap: 1, align: "stretch" })]}>
					{view.series.map((part) => {
						let here = part.path === post.path;
						return (
							<li key={part.path} mix={[hstack({ gap: 3, align: "baseline" })]}>
								<span mix={[font("mono"), text("sm"), here ? fg("brand") : fg("neutral.muted")]}>
									{part.part}.
								</span>
								{here ? (
									<span aria-current="page" mix={[fg("neutral.emphasis"), weight("semibold")]}>
										{part.title.replace(`${post.series}: `, "")}
									</span>
								) : (
									<a href={context.href(part.path)} mix={[quietLink()]}>
										{part.title.replace(`${post.series}: `, "")}
									</a>
								)}
							</li>
						);
					})}
				</ol>
			</nav>
		);
	};
}

namespace AuthorCard {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** Who wrote the article and how to get the next one, at its end. */
function AuthorCard(handle: Handle<AuthorCard.Props>) {
	return () => {
		let { context } = handle.props;
		let author = context.site.author;
		return (
			<aside
				aria-label="About the author"
				data-slot="author-card"
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					raw({ paddingBlock: "1.5rem", borderBlock: "1px solid var(--ui-neutral-border)" }),
				]}
			>
				<div mix={[hstack({ gap: 4, align: "start" })]}>
					<Portrait initials={author.initials} size={3.5} />
					<div mix={[vstack({ gap: 1, align: "start" })]}>
						<p mix={[m(0), headingFont(), raw({ fontSize: "1.125rem" }), fg("neutral.emphasis")]}>
							{author.name}
						</p>
						<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{author.role}</p>
						<p mix={[m(0), raw({ marginBlockStart: "0.5rem" }), leading("relaxed"), fg("neutral")]}>
							{author.bio}
						</p>
					</div>
				</div>
				<NewsletterForm action={context.href(SUBSCRIBE_PAGE)} label="Get the monthly letter" />
			</aside>
		);
	};
}

namespace ArchivePage {
	export interface Props {
		posts: DemoBlogContext["posts"];
		type: string | null;
		context: DemoBlogContext;
	}
}

/** Every post by year, one dense line each, so the whole log fits in a few screens. */
function ArchivePage(handle: Handle<ArchivePage.Props>) {
	return () => {
		let { context, posts, type } = handle.props;
		let years = groupByYear(posts);
		return (
			<Column>
				<PageTitle
					title="Archive"
					lead={`${posts.length} posts, newest first. Narrow it to one kind, or jump to a year.`}
				>
					<TypeFilter
						context={context}
						current={type}
						counts={countKinds(context.site, context.posts)}
						total={context.posts.length}
						href={(kind) =>
							kind === null ? context.href("archive") : `${context.href("archive")}?type=${kind}`
						}
					/>
					<nav aria-label="Years" mix={[hstack({ gap: 3, align: "center" }), text("sm")]}>
						{years.map((group) => (
							<a key={group.year} href={`#year-${group.year}`} mix={[quietLink(), font("mono")]}>
								{group.year}
							</a>
						))}
					</nav>
				</PageTitle>
				{years.map((group) => (
					<section
						key={group.year}
						aria-labelledby={`year-${group.year}`}
						mix={[raw({ paddingBlockStart: "1rem" })]}
					>
						<h2
							id={`year-${group.year}`}
							mix={[
								m(0),
								hstack({ gap: 3, align: "baseline" }),
								raw({
									fontSize: "1.5rem",
									paddingBlock: "0.5rem",
									borderBlockEnd: "1px solid var(--ui-neutral-border-strong)",
									scrollMarginBlockStart: "1rem",
								}),
							]}
						>
							{group.year}
							<span mix={[font("mono"), text("sm"), fg("neutral.muted"), weight("normal")]}>
								{group.posts.length} posts
							</span>
						</h2>
						<ol data-slot="archive-list" mix={[m(0), p(0), listStyle("none")]}>
							{group.posts.map((post) => (
								<li
									key={post.path}
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "4.5rem minmax(0, 1fr)",
											columnGap: "1rem",
											rowGap: "0.125rem",
											paddingBlock: "0.625rem",
											borderBlockEnd: "1px solid var(--ui-neutral-border)",
										}),
										media(GUTTER_QUERY, raw({ gridTemplateColumns: "4.5rem 6rem minmax(0, 1fr)" })),
									]}
								>
									<span
										mix={[
											font("mono"),
											text("sm"),
											fg("neutral.muted"),
											raw({ paddingBlockStart: "0.15rem" }),
										]}
									>
										<PostDate date={post.date} style="day" />
									</span>
									<span
										mix={[
											labelStyle(),
											raw({ paddingBlockStart: "0.3rem", gridColumn: "2", gridRow: "2" }),
											media(GUTTER_QUERY, raw({ gridColumn: "2", gridRow: "1" })),
										]}
									>
										{kindLabel(context, post)}
									</span>
									<a
										href={context.href(post.path)}
										mix={[
											titleLink(),
											headingFont(),
											raw({ fontSize: "1.0625rem", gridColumn: "2", gridRow: "1" }),
											media(GUTTER_QUERY, raw({ gridColumn: "3" })),
										]}
									>
										{post.title}
									</a>
								</li>
							))}
						</ol>
					</section>
				))}
			</Column>
		);
	};
}

namespace TagsPage {
	export interface Props {
		tags: Array<{ tag: string; count: number }>;
		context: DemoBlogContext;
	}
}

/** Every topic with what it covers and how many posts it holds, the most written about first. */
function TagsPage(handle: Handle<TagsPage.Props>) {
	return () => {
		let { context, tags } = handle.props;
		return (
			<Column>
				<PageTitle
					title="Topics"
					lead="What Low Tide keeps coming back to, the most written about first."
				/>
				<ul data-slot="topic-list" mix={[m(0), p(0), listStyle("none")]}>
					{tags.map(({ count, tag }) => (
						<li
							key={tag}
							mix={[
								vstack({ gap: 1, align: "stretch" }),
								raw({ paddingBlock: "1rem", borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
							]}
						>
							<p mix={[m(0), hstack({ gap: 3, align: "baseline" })]}>
								<a
									href={context.href(`${TAGS_PAGE}/${tag}`)}
									mix={[titleLink(), headingFont(), raw({ fontSize: "1.25rem" })]}
								>
									#{tag}
								</a>
								<span mix={[font("mono"), text("sm"), fg("neutral.muted")]}>{count} posts</span>
							</p>
							{context.site.tags[tag] ? (
								<p mix={[m(0), fg("neutral")]}>{context.site.tags[tag]}</p>
							) : null}
						</li>
					))}
				</ul>
			</Column>
		);
	};
}

namespace TagPage {
	export interface Props {
		tag: string;
		posts: DemoBlogContext["posts"];
		context: DemoBlogContext;
	}
}

/** One topic's posts of every kind, in the same log as the front page. */
function TagPage(handle: Handle<TagPage.Props>) {
	return () => {
		let { context, posts, tag } = handle.props;
		let counts = countKinds(context.site, posts)
			.map(
				(entry) =>
					`${entry.count} ${(context.site.kinds[entry.kind]?.label ?? entry.kind).toLowerCase()}`,
			)
			.join(", ");
		return (
			<Column>
				<PageTitle
					eyebrow={
						<a href={context.href(TAGS_PAGE)} mix={[fg("inherit"), textDecoration("none")]}>
							Topic
						</a>
					}
					title={`#${tag}`}
					lead={context.site.tags[tag]}
				>
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>{counts}</p>
				</PageTitle>
				<Stream posts={posts} context={context} />
			</Column>
		);
	};
}

namespace SearchPage {
	export interface Props {
		view: Extract<DemoBlogView, { view: "search" }>;
		context: DemoBlogContext;
	}
}

/** Search over every post, its results in the log's own rows and narrowed by kind. */
function SearchPage(handle: Handle<SearchPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let blank = view.query.trim() === "";
		let searchHref = (kind: string | null) => {
			let params = new URLSearchParams({ q: view.query });
			if (kind !== null) params.set("type", kind);
			return `${context.href(SEARCH_PAGE)}?${params}`;
		};
		return (
			<Column>
				<PageTitle title="Search">
					<SearchForm context={context} query={view.query} />
				</PageTitle>
				{blank ? (
					<p mix={[m(0), fg("neutral")]}>
						Search every article, tutorial, note, link and glossary entry by any word in it.
					</p>
				) : (
					<div data-slot="search-results" mix={[vstack({ gap: 4, align: "stretch" })]}>
						<TypeFilter
							context={context}
							current={view.type}
							counts={countKinds(context.site, view.matches)}
							total={view.matches.length}
							href={searchHref}
						/>
						<p role="status" mix={[m(0), text("sm"), fg("neutral.muted")]}>
							{view.results.length === 0
								? `Nothing matches “${view.query.trim()}”. Try a shorter word, or browse the topics.`
								: `${view.results.length} ${view.results.length === 1 ? "post matches" : "posts match"} “${view.query.trim()}”.`}
						</p>
						<Stream posts={view.results} context={context} months={false} />
					</div>
				)}
			</Column>
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
				role="search"
				mix={[hstack({ gap: 2, align: "center" })]}
			>
				<SearchField mix={[raw({ flex: "1 1 auto" })]}>
					<SearchField.Input
						name="q"
						defaultValue={query}
						placeholder="Search Low Tide"
						aria-label="Search Low Tide"
					/>
				</SearchField>
				<LinkButton href={context.href(TAGS_PAGE)} variant="ghost">
					Topics
				</LinkButton>
			</form>
		);
	};
}

namespace AboutPage {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** Who writes the blog, in their own words, with where else to find them. */
function AboutPage(handle: Handle<AboutPage.Props>) {
	return () => {
		let { context } = handle.props;
		let { author } = context.site;
		return (
			<Column measure={ARTICLE_MEASURE}>
				<header mix={[vstack({ gap: 4, align: "start" }), raw({ paddingBlockEnd: "2rem" })]}>
					<Portrait initials={author.initials} size={5} />
					<h1
						mix={[
							m(0),
							raw({ fontSize: "clamp(2rem, 1.4rem + 2.4vw, 2.75rem)" }),
							leading("tight"),
							fg("neutral.emphasis"),
						]}
					>
						Hi, I'm {author.name.split(" ")[0]}
					</h1>
					<p mix={[m(0), fg("neutral.muted")]}>{author.role}</p>
				</header>
				<Typeset
					preset="reading"
					mix={[m(0), raw({ fontFamily: "var(--demo-blog-reading-font)" })]}
				>
					{context.site.about()}
				</Typeset>
				<ul
					mix={[
						m(0),
						p(0),
						listStyle("none"),
						hstack({ gap: 4, align: "center" }),
						raw({ flexWrap: "wrap", paddingBlockStart: "2rem" }),
					]}
				>
					{author.links.map((link) => (
						<li key={link.href}>
							<a href={link.href} rel="me noreferrer" mix={[quietLink()]}>
								{link.label}
							</a>
						</li>
					))}
					<li>
						<a
							href={context.href(FEED_PAGE)}
							mix={[quietLink(), hstack({ gap: 1, align: "center" })]}
						>
							<RssIcon size={14} aria-hidden="true" /> RSS
						</a>
					</li>
				</ul>
			</Column>
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
			<Column measure={ARTICLE_MEASURE}>
				<PageTitle
					eyebrow="Newsletter"
					title="Low Tide, monthly"
					lead="One email at the start of each month with everything published in the last: articles, tutorials, notes and links, each with a line on why it matters. No tracking pixels, and one click to leave."
				/>
				{sent ? (
					<Callout kind="tip" label="Almost there" data-slot="subscribe-confirmation">
						Check your inbox for a confirmation link. Nothing was sent, since Low Tide is a demo,
						but this is where a real sign-up lands.
					</Callout>
				) : (
					<NewsletterForm action={context.href(SUBSCRIBE_PAGE)} />
				)}
				<p mix={[m(0), raw({ paddingBlockStart: "1.5rem" }), fg("neutral")]}>
					Prefer a feed reader?{" "}
					<a href={context.href(FEED_PAGE)} mix={[quietLink()]}>
						Subscribe to the RSS feed
					</a>
					.
				</p>
			</Column>
		);
	};
}

namespace NotFoundPage {
	export interface Props {
		path: string;
		context: DemoBlogContext;
	}
}

/**
 * A missing address: what was asked for, a search box filled with the words in it, and the
 * posts those words match, or the latest posts when nothing does.
 */
function NotFoundPage(handle: Handle<NotFoundPage.Props>) {
	return () => {
		let { context, path } = handle.props;
		let guess = (path.split("/").filter(Boolean).at(-1) ?? "").replace(/[-_]+/g, " ");
		let matches = searchPosts(context.posts, guess).slice(0, 4);
		return (
			<Column>
				<PageTitle
					eyebrow="404"
					title="Nothing washed up here"
					lead="This address has no post. It may have moved, or the link has a typo."
				>
					<p
						mix={[
							m(0),
							font("mono"),
							text("sm"),
							fg("neutral.muted"),
							raw({ overflowWrap: "anywhere" }),
						]}
					>
						{path}
					</p>
					<SearchForm context={context} query={matches.length > 0 ? guess : undefined} />
				</PageTitle>
				<h2 mix={[m(0), raw({ fontSize: "1.25rem", paddingBlockStart: "1rem" })]}>
					{matches.length > 0 ? "Maybe you meant" : "The latest instead"}
				</h2>
				<Stream
					posts={matches.length > 0 ? matches : context.posts.slice(0, 4)}
					context={context}
					months={false}
				/>
				<p mix={[m(0), raw({ paddingBlockStart: "1.5rem" })]}>
					<a href={context.href()} mix={[quietLink()]}>
						Back to the log
					</a>
				</p>
			</Column>
		);
	};
}
