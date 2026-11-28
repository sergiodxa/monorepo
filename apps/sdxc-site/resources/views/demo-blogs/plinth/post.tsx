/**
 * Plinth's post page, shaped by what the post is: an article or tutorial with a display
 * headline, an outline rail and its series; a note; a link that leads out; a glossary term
 * set as a definition. Every post ends on its neighbours and the posts related to it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowUpRightIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { leading, text, weight } from "@sdxc/u/typography";
import { Avatar, Breadcrumbs, LinkButton } from "@sdxc/ui";
import { DocsPager, TableOfContents } from "@sdxc/ui/docs";

import type { DemoBlogContext, DemoBlogPostView } from "~/resources/views/demo-blogs";

import { TAGS_PAGE } from "~/resources/views/demo-blogs";
import { linkHost, PostBody, PostDate } from "~/resources/views/demo-blogs/parts";
import {
	Container,
	HEAVY_RULE,
	IndexList,
	inlineLink,
	Module,
	monoLabel,
	RAIL_QUERY,
	RailList,
	SubscribeBlock,
	TypeCode,
} from "~/resources/views/demo-blogs/plinth/parts";

/** The column a post's prose reads in, about 70 characters of the reading face. */
const ARTICLE_MEASURE = "44rem";

namespace PostPage {
	export interface Props {
		view: DemoBlogPostView;
		context: DemoBlogContext;
	}
}

/**
 * One post: a breadcrumb, the header for its kind, then the prose beside a rail holding its
 * outline from {@link RAIL_QUERY}; below that width the outline folds into a sticky bar.
 */
export function PostPage(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post, toc } = view.article;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		let outline = layout === "article" && toc.length >= 2;
		let terms = context.posts.filter(
			(other) => other.kind === post.kind && other.path !== post.path,
		);

		return (
			<Container block="2rem 5rem">
				<Breadcrumbs aria-label="Breadcrumb" mix={[raw({ marginBlockEnd: "1.5rem" })]}>
					<Breadcrumbs.List>
						<Breadcrumbs.Item>
							<Breadcrumbs.Link href={context.href()}>Index</Breadcrumbs.Link>
						</Breadcrumbs.Item>
						<Breadcrumbs.Item>
							<Breadcrumbs.Link href={`${context.href()}?type=${post.kind}`}>
								{context.site.kinds[post.kind]?.label ?? post.kind}
							</Breadcrumbs.Link>
						</Breadcrumbs.Item>
					</Breadcrumbs.List>
				</Breadcrumbs>

				<PostHeader view={view} context={context} />

				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "3rem",
							[`@media ${RAIL_QUERY}`]: {
								gridTemplateColumns: `minmax(0, ${ARTICLE_MEASURE}) minmax(14rem, 18rem)`,
								justifyContent: "space-between",
								gap: "4rem",
							},
						}),
					]}
				>
					<article
						data-slot="plinth-post"
						data-layout={layout}
						aria-label={post.title}
						mix={[vstack({ gap: 8, align: "stretch" }), raw({ minInlineSize: 0 })]}
					>
						{view.series.length > 0 ? <SeriesBox view={view} context={context} /> : null}
						{outline ? (
							<div
								mix={[
									raw({
										position: "sticky",
										insetBlockStart: 0,
										zIndex: 2,
										marginInline: "-1rem",
										backgroundColor: "var(--ui-bg)",
										borderBlock: "1px solid var(--ui-neutral-border)",
										[`@media ${RAIL_QUERY}`]: { display: "none" },
									}),
								]}
							>
								<TableOfContents items={toc} label="Contents" layout="bar" />
							</div>
						) : null}
						<PostBody document={view.article.document} />
						<PostFooter view={view} context={context} />
					</article>

					<aside
						aria-label="About this post"
						data-slot="plinth-post-rail"
						mix={[
							vstack({ gap: 8, align: "stretch" }),
							raw({
								[`@media ${RAIL_QUERY}`]: {
									position: "sticky",
									insetBlockStart: "2rem",
									alignSelf: "start",
								},
							}),
						]}
					>
						{outline ? (
							<div
								data-slot="plinth-outline"
								mix={[
									raw({
										display: "none",
										borderBlockStart: HEAVY_RULE,
										paddingBlockStart: "0.75rem",
										[`@media ${RAIL_QUERY}`]: { display: "block" },
									}),
								]}
							>
								<TableOfContents items={toc} label="On this page" />
							</div>
						) : null}
						{layout === "term" && terms.length > 0 ? (
							<Module title="More terms">
								<RailList posts={terms} context={context} />
							</Module>
						) : null}
					</aside>
				</div>
			</Container>
		);
	};
}

/** The post's title block, shaped by its kind: a definition for a term, a way out for a link. */
function PostHeader(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let kind = context.site.kinds[post.kind];
		let layout = kind?.layout ?? "article";
		let size =
			layout === "article"
				? "clamp(2.5rem, 1.5rem + 4.4vw, 5.5rem)"
				: "clamp(2rem, 1.4rem + 2.6vw, 3.75rem)";
		return (
			<header
				data-slot="plinth-post-header"
				mix={[
					vstack({ gap: 5, align: "stretch" }),
					raw({ paddingBlockEnd: "2rem", marginBlockEnd: "2.5rem", borderBlockEnd: HEAVY_RULE }),
				]}
			>
				<p
					mix={[
						m(0),
						hstack({ gap: 3, align: "center" }),
						raw({ flexWrap: "wrap" }),
						monoLabel(),
						fg("neutral.muted"),
					]}
				>
					<TypeCode kind={post.kind} href={`${context.href()}?type=${post.kind}`} />
					<PostDate date={post.date} style="long" />
					{post.updated === undefined ? null : (
						<span>
							Updated <PostDate date={post.updated} />
						</span>
					)}
					{layout === "term" ? null : <span>{post.minutes} min read</span>}
				</p>
				<h1
					mix={[
						m(0),
						raw({ fontSize: size, maxInlineSize: "20ch" }),
						leading(0.98),
						fg("neutral.emphasis"),
					]}
				>
					{post.title}
				</h1>
				{layout === "term" ? (
					<p
						data-slot="plinth-definition"
						mix={[
							m(0),
							raw({
								maxInlineSize: "46rem",
								padding: "1.25rem 1.5rem",
								fontSize: "clamp(1.125rem, 1rem + 0.6vw, 1.5rem)",
								backgroundColor: "var(--ui-color-brand-400)",
								color: "var(--ui-color-neutral-950)",
							}),
							leading("snug"),
							weight("medium"),
						]}
					>
						{post.description}
					</p>
				) : (
					<p
						mix={[
							m(0),
							raw({
								maxInlineSize: "42rem",
								fontSize: "clamp(1.0625rem, 1rem + 0.4vw, 1.3125rem)",
							}),
							leading("relaxed"),
							fg("neutral"),
						]}
					>
						{post.description}
					</p>
				)}
				{layout === "bookmark" && post.url !== undefined ? (
					<div mix={[hstack({ gap: 3, align: "center" }), raw({ flexWrap: "wrap" })]}>
						<LinkButton href={post.url} rel="noreferrer" color="brand" data-slot="plinth-visit">
							Visit {linkHost(post.url)}
							<ArrowUpRightIcon size={16} aria-hidden="true" />
						</LinkButton>
						<span mix={[monoLabel(), fg("neutral.muted"), raw({ overflowWrap: "anywhere" })]}>
							{post.url}
						</span>
					</div>
				) : null}
			</header>
		);
	};
}

/**
 * A series' place and parts, ahead of the prose: which part this is, every part in order with
 * this one marked, and the next part as the one link a reader most likely wants.
 */
function SeriesBox(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let index = view.series.findIndex((part) => part.path === post.path);
		let next = view.series[index + 1];
		return (
			<nav
				aria-label={`${post.series} series`}
				data-slot="plinth-series-box"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					p(5),
					raw({ border: "2px solid var(--ui-neutral-fg-emphasis)" }),
				]}
			>
				<p mix={[m(0), monoLabel(), fg("brand"), weight("bold")]}>
					Series · Part {index + 1} of {view.series.length}
				</p>
				<p
					mix={[
						m(0),
						raw({ fontFamily: "var(--demo-blog-heading-font)", fontSize: "1.5rem" }),
						weight(800),
						leading("tight"),
						fg("neutral.emphasis"),
					]}
				>
					{post.series}
				</p>
				<RailList posts={view.series} context={context} numbered current={post.path} />
				{next === undefined ? (
					<p mix={[m(0), text("sm"), fg("neutral.muted")]}>This is the last part.</p>
				) : (
					<a href={context.href(next.path)} mix={[inlineLink(), weight("semibold")]}>
						Next: part {index + 2} →
					</a>
				)}
			</nav>
		);
	};
}

/** The end of a post: its topics, the author, the one sign-up, its neighbours and related rows. */
function PostFooter(handle: Handle<PostPage.Props>) {
	return () => {
		let { context, view } = handle.props;
		let { post } = view.article;
		let layout = context.site.kinds[post.kind]?.layout ?? "article";
		let { author } = context.site;
		return (
			<footer mix={[vstack({ gap: 8, align: "stretch" })]}>
				<ul
					aria-label="Topics"
					mix={[
						m(0),
						p(0),
						listStyle("none"),
						hstack({ gap: 2, align: "center" }),
						raw({ flexWrap: "wrap" }),
					]}
				>
					{post.tags.map((tag) => (
						<li key={tag}>
							<a
								href={context.href(`${TAGS_PAGE}/${tag}`)}
								mix={[
									raw({
										display: "inline-block",
										paddingInline: "0.625rem",
										paddingBlock: "0.25rem",
										border: "1.5px solid var(--ui-neutral-fg-emphasis)",
										textDecoration: "none",
									}),
									monoLabel(),
									fg("neutral.emphasis"),
								]}
							>
								{tag}
							</a>
						</li>
					))}
				</ul>
				{layout === "article" ? (
					<div
						data-slot="plinth-author"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "auto minmax(0, 1fr)",
								gap: "1rem",
								paddingBlockStart: "1.5rem",
								borderBlockStart: HEAVY_RULE,
							}),
						]}
					>
						<Avatar size="lg">
							<Avatar.Fallback>{author.initials}</Avatar.Fallback>
						</Avatar>
						<div mix={[vstack({ gap: 1, align: "stretch" })]}>
							<p mix={[m(0), weight("bold"), fg("neutral.emphasis")]}>{author.name}</p>
							<p mix={[m(0), text("sm"), fg("neutral"), leading("relaxed")]}>{author.bio}</p>
						</div>
					</div>
				) : null}
				{layout === "article" ? <SubscribeBlock context={context} /> : null}
				<DocsPager
					previous={
						view.older
							? {
									title: view.older.title,
									href: context.href(view.older.path),
									section: context.site.kinds[view.older.kind]?.singular,
								}
							: null
					}
					next={
						view.newer
							? {
									title: view.newer.title,
									href: context.href(view.newer.path),
									section: context.site.kinds[view.newer.kind]?.singular,
								}
							: null
					}
					labels={{ nav: "More entries", previous: "Older", next: "Newer" }}
				/>
				{view.related.length > 0 ? (
					<section
						aria-labelledby="plinth-read-next"
						data-slot="plinth-read-next"
						mix={[vstack({ gap: 3, align: "stretch" })]}
					>
						<h2
							id="plinth-read-next"
							mix={[m(0), raw({ fontSize: "1.5rem" }), fg("neutral.emphasis")]}
						>
							Read next
						</h2>
						<IndexList posts={view.related} context={context} years={false} />
					</section>
				) : null}
			</footer>
		);
	};
}
