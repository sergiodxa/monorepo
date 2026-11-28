/**
 * The pieces Saltbox's pages share: a post as the classic loop draws it (title, "Posted on"
 * meta line, excerpt, "Continue reading" and tags), shaped per kind, plus the search form,
 * the type filter row and the archive-style page header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowUpRightIcon, PinIcon, TagIcon } from "@sdxc/icons";
import { iife } from "@sdxc/iife";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { balance, leading, pretty, text, tracking, weight } from "@sdxc/u/typography";
import { Badge, Button, SearchField } from "@sdxc/ui";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext, DemoBlogLayout } from "~/resources/views/demo-blogs";

import { ABOUT_PAGE, SEARCH_PAGE, TAGS_PAGE } from "~/resources/views/demo-blogs";
import { linkHost, PostBody, PostDate } from "~/resources/views/demo-blogs/parts";

/**
 * The layout a post's kind draws it with.
 *
 * @returns The kind's layout, `article` for a kind that names none.
 */
export function layoutOf(context: DemoBlogContext, post: DemoBlogPost): DemoBlogLayout {
	return context.site.kinds[post.kind]?.layout ?? "article";
}

/**
 * One post of a kind as its label reads ("Tutorial").
 *
 * @returns The kind's singular, or its key for a kind the blog does not describe.
 */
export function kindLabel(context: DemoBlogContext, post: DemoBlogPost): string {
	return context.site.kinds[post.kind]?.singular ?? post.kind;
}

/** A text link in the blog's colours: brand, underlined on hover, ringed on focus. */
export function textLink() {
	return [
		fg("brand"),
		raw({ textDecoration: "none", textUnderlineOffset: "0.2em" }),
		hover(raw({ textDecoration: "underline" })),
		focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
	];
}

/** The small uppercase sans line that labels a post's kind or a widget. */
export function eyebrow() {
	return [
		m(0),
		text("xs"),
		weight("bold"),
		tracking("wider"),
		raw({ textTransform: "uppercase", fontFamily: "var(--demo-blog-heading-font)" }),
	];
}

namespace PostProps {
	export interface Props {
		post: DemoBlogPost;
		context: DemoBlogContext;
	}
}

namespace EntryMeta {
	export interface Props extends PostProps.Props {
		/** Adds the reading time after the kind, for posts long enough to plan around. */
		minutes?: boolean;
	}
}

/** "Posted on <date> by <author> in <Type>", each part linking where a reader expects. */
export function EntryMeta(handle: Handle<EntryMeta.Props>) {
	return () => {
		let { context, minutes, post } = handle.props;
		let label = context.site.kinds[post.kind]?.label ?? post.kind;
		return (
			<p
				data-slot="entry-meta"
				mix={[
					m(0),
					text("sm"),
					fg("neutral.muted"),
					leading("snug"),
					raw({ fontFamily: "var(--ui-font-sans)" }),
				]}
			>
				Posted on{" "}
				<a href={context.href(post.path)} mix={[textLink()]}>
					<PostDate date={post.date} style="long" />
				</a>{" "}
				by{" "}
				<a href={context.href(ABOUT_PAGE)} mix={[textLink()]}>
					{context.site.author.name}
				</a>{" "}
				in{" "}
				<a href={`${context.href()}?type=${post.kind}`} mix={[textLink()]}>
					{label}
				</a>
				{minutes ? <span> · {post.minutes} min read</span> : null}
				{post.updated ? (
					<span>
						{" "}
						· Updated <PostDate date={post.updated} style="long" />
					</span>
				) : null}
			</p>
		);
	};
}

namespace TagLinks {
	export interface Props {
		tags: string[];
		context: DemoBlogContext;
	}
}

/** "Tagged" and each of a post's tags, linking to the tag's page. */
export function TagLinks(handle: Handle<TagLinks.Props>) {
	return () => {
		let { context, tags } = handle.props;
		if (tags.length === 0) return null;
		return (
			<p
				data-slot="entry-tags"
				mix={[
					m(0),
					hstack({ gap: 2, align: "center" }),
					raw({ flexWrap: "wrap", fontFamily: "var(--ui-font-sans)" }),
					text("sm"),
					fg("neutral.muted"),
				]}
			>
				<TagIcon size={14} aria-hidden="true" />
				<span>Tagged</span>
				{tags.map((tag, index) => (
					<span key={tag}>
						<a href={context.href(`${TAGS_PAGE}/${encodeURIComponent(tag)}`)} mix={[textLink()]}>
							{tag}
						</a>
						{index < tags.length - 1 ? "," : null}
					</span>
				))}
			</p>
		);
	};
}

namespace ReadMore {
	export interface Props {
		href: string;
		/** The visible prompt, before the arrow. */
		label: string;
		/** The post's title, read after the prompt by assistive technology. */
		title: string;
	}
}

/** "Continue reading →", naming the post to a screen reader so every link is distinct. */
export function ReadMore(handle: Handle<ReadMore.Props>) {
	return () => {
		let { href, label, title } = handle.props;
		return (
			<a
				href={href}
				mix={[
					textLink(),
					weight("semibold"),
					raw({ fontFamily: "var(--ui-font-sans)", fontSize: "0.9375rem" }),
				]}
			>
				{label}
				<span mix={[visuallyHidden()]}>: {title}</span> <span aria-hidden="true">→</span>
			</a>
		);
	};
}

namespace Entry {
	export interface Props extends PostProps.Props {
		/** Draws the post as the home's featured post: tinted, pinned and a size larger. */
		featured?: boolean;
	}
}

/**
 * One post as the loop draws it. Articles and tutorials show their excerpt and "Continue
 * reading"; a note shows in full; a link names where it goes; a term reads as a definition.
 */
export function Entry(handle: Handle<Entry.Props>) {
	return () => {
		let { context, featured, post } = handle.props;
		let layout = layoutOf(context, post);
		let titleHref = layout === "bookmark" && post.url ? post.url : context.href(post.path);
		let titleSize = iife(() => {
			if (layout === "note") return "1.3125rem";
			if (featured) return "clamp(1.75rem, 1.3rem + 1.6vw, 2.25rem)";
			return "clamp(1.4375rem, 1.2rem + 0.9vw, 1.75rem)";
		});

		return (
			<article
				data-slot={featured ? "featured-post" : "entry"}
				data-layout={layout}
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					featured
						? raw({
								padding: "1.5rem",
								borderRadius: "var(--ui-radius-lg)",
								backgroundColor: "var(--ui-brand-bg-tint)",
								border: "1px solid var(--ui-brand-border)",
								borderInlineStart: "4px solid var(--ui-brand-bg-solid)",
							})
						: raw({
								paddingBlock: "2.25rem",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							}),
				]}
			>
				<header mix={[vstack({ gap: 2, align: "stretch" })]}>
					<div mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
						{featured ? (
							<Badge color="brand">
								<Badge.Icon>
									<PinIcon />
								</Badge.Icon>
								<Badge.Text>Featured</Badge.Text>
							</Badge>
						) : null}
						<p mix={[eyebrow(), fg("brand")]}>
							{kindLabel(context, post)}
							{post.series ? ` · Part ${post.part} of ${post.series}` : null}
						</p>
					</div>
					<h2
						mix={[
							m(0),
							leading("tight"),
							tracking("tight"),
							balance(),
							raw({
								fontSize: titleSize,
							}),
						]}
					>
						<a
							href={titleHref}
							rel={layout === "bookmark" ? "noreferrer" : undefined}
							mix={[
								fg("neutral.emphasis"),
								raw({ textDecoration: "none" }),
								hover(fg("brand")),
								focusVisible(
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
							]}
						>
							{post.title}
							{layout === "bookmark" ? (
								<span
									mix={[
										raw({
											display: "inline-flex",
											marginInlineStart: "0.3em",
											verticalAlign: "-0.1em",
										}),
									]}
								>
									<ArrowUpRightIcon size={20} aria-label="(opens the linked site)" />
								</span>
							) : null}
						</a>
					</h2>
					<EntryMeta post={post} context={context} minutes={layout === "article"} />
				</header>
				<EntryBody post={post} context={context} />
				<TagLinks tags={post.tags} context={context} />
			</article>
		);
	};
}

/** The part of an entry its kind decides: excerpt, full note, link comment or definition. */
function EntryBody(handle: Handle<PostProps.Props>) {
	return () => {
		let { context, post } = handle.props;
		let layout = layoutOf(context, post);
		let permalink = context.href(post.path);

		if (layout === "note" && post.body !== null) {
			return <PostBody document={post.body} preset="docs" />;
		}
		if (layout === "bookmark") {
			return (
				<div mix={[vstack({ gap: 3, align: "stretch" })]}>
					<Excerpt>{post.description}</Excerpt>
					<p mix={[m(0), hstack({ gap: 4, align: "baseline" }), raw({ flexWrap: "wrap" })]}>
						{post.url ? (
							<a
								href={post.url}
								rel="noreferrer"
								mix={[
									textLink(),
									weight("semibold"),
									raw({ fontFamily: "var(--ui-font-sans)", fontSize: "0.9375rem" }),
								]}
							>
								Visit {linkHost(post.url)} <span aria-hidden="true">↗</span>
							</a>
						) : null}
						<ReadMore href={permalink} label="Why I saved it" title={post.title} />
					</p>
				</div>
			);
		}
		if (layout === "term") {
			return (
				<div mix={[vstack({ gap: 3, align: "stretch" })]}>
					<p
						mix={[
							m(0),
							p(0, 0, 0, 4),
							raw({
								borderInlineStart: "3px solid var(--ui-neutral-border-hover)",
								fontFamily: "var(--demo-blog-reading-font)",
								fontStyle: "italic",
								fontSize: "1.125rem",
								lineHeight: 1.55,
							}),
							fg("neutral.emphasis"),
						]}
					>
						{post.description}
					</p>
					<p mix={[m(0)]}>
						<ReadMore href={permalink} label="Read the full entry" title={post.title} />
					</p>
				</div>
			);
		}
		return (
			<div mix={[vstack({ gap: 3, align: "stretch" })]}>
				<Excerpt>{post.description}</Excerpt>
				<p mix={[m(0)]}>
					<ReadMore href={permalink} label="Continue reading" title={post.title} />
				</p>
			</div>
		);
	};
}

namespace Excerpt {
	export interface Props {
		children: RemixNode;
	}
}

/** A post's lead set in the reading serif, the size the loop's excerpts read at. */
export function Excerpt(handle: Handle<Excerpt.Props>) {
	return () => (
		<p
			mix={[
				m(0),
				pretty(),
				fg("neutral.emphasis"),
				raw({
					fontFamily: "var(--demo-blog-reading-font)",
					fontSize: "1.125rem",
					lineHeight: 1.65,
				}),
			]}
		>
			{handle.props.children}
		</p>
	);
}

namespace EntryList {
	export interface Props {
		posts: DemoBlogPost[];
		context: DemoBlogContext;
	}
}

/** Posts drawn one after another in the loop, each ruled off from the next. */
export function EntryList(handle: Handle<EntryList.Props>) {
	return () => {
		let { context, posts } = handle.props;
		return (
			<div data-slot="entry-list" mix={[vstack({ gap: 0, align: "stretch" })]}>
				{posts.map((post) => (
					<Entry key={post.path} post={post} context={context} />
				))}
			</div>
		);
	};
}

namespace SearchForm {
	export interface Props {
		context: DemoBlogContext;
		/** What the box starts filled with. */
		query?: string;
		/** The input's id, unique on the page, since a page can hold the widget and its own form. */
		id: string;
	}
}

/** The search box and its button, a GET form so a result page is an address to share. */
export function SearchForm(handle: Handle<SearchForm.Props>) {
	return () => {
		let { context, id, query } = handle.props;
		return (
			<form
				method="get"
				action={context.href(SEARCH_PAGE)}
				data-slot="search-form"
				mix={[hstack({ gap: 2, align: "end" })]}
			>
				<SearchField
					aria-label={`Search ${context.site.name}`}
					mix={[raw({ flex: "1 1 auto", minInlineSize: 0 })]}
				>
					<SearchField.Input id={id} name="q" defaultValue={query} placeholder="Search posts…" />
				</SearchField>
				<Button type="submit" color="brand">
					Search
				</Button>
			</form>
		);
	};
}

export namespace FilterRow {
	export interface Props {
		/** "Everything" first, then one entry per kind with posts. */
		options: Array<{ label: string; href: string; count: number; current: boolean }>;
		/** What the row narrows, for its landmark name. */
		label: string;
	}
}

/** A row of type filters with their counts, the current one marked and unlinked. */
export function FilterRow(handle: Handle<FilterRow.Props>) {
	return () => {
		let { label, options } = handle.props;
		return (
			<nav aria-label={label} data-slot="type-filter">
				<ul
					mix={[
						m(0),
						p(0),
						listStyle(),
						hstack({ gap: 1, align: "center" }),
						raw({ flexWrap: "wrap", fontFamily: "var(--ui-font-sans)" }),
						text("sm"),
					]}
				>
					{options.map((option) => (
						<li key={option.href}>
							<a
								href={option.href}
								aria-current={option.current ? "page" : undefined}
								mix={[
									hstack({ gap: 1, align: "baseline" }),
									raw({
										padding: "0.3rem 0.65rem",
										borderRadius: "var(--ui-radius-md)",
										textDecoration: "none",
										border: "1px solid transparent",
									}),
									option.current
										? [fg("brand.onSolid"), raw({ backgroundColor: "var(--ui-brand-bg-solid)" })]
										: [
												fg("neutral"),
												hover([fg("brand"), raw({ borderColor: "var(--ui-neutral-border)" })]),
											],
									focusVisible(
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
								]}
							>
								<span>{option.label}</span>
								<span mix={[raw({ opacity: 0.75, fontVariantNumeric: "tabular-nums" })]}>
									({option.count})
								</span>
							</a>
						</li>
					))}
				</ul>
			</nav>
		);
	};
}

namespace PageHeader {
	export interface Props {
		/** The small label over the title ("Category", "Tag", "Search results"). */
		label?: string;
		title: RemixNode;
		/** A sentence or two under the title. */
		description?: RemixNode;
		children?: RemixNode;
	}
}

/** The boxed header an archive-style page opens with, as classic blogs title a category. */
export function PageHeader(handle: Handle<PageHeader.Props>) {
	return () => {
		let { children, description, label, title } = handle.props;
		return (
			<header
				data-slot="page-header"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					raw({
						paddingBlockEnd: "1.5rem",
						borderBlockEnd: "3px double var(--ui-neutral-border-hover)",
					}),
				]}
			>
				{label ? <p mix={[eyebrow(), fg("brand")]}>{label}</p> : null}
				<h1
					mix={[
						m(0),
						leading("tight"),
						tracking("tight"),
						balance(),
						raw({ fontSize: "clamp(1.875rem, 1.4rem + 1.8vw, 2.5rem)" }),
						fg("neutral.emphasis"),
					]}
				>
					{title}
				</h1>
				{description ? (
					<p
						mix={[
							m(0),
							fg("neutral.muted"),
							pretty(),
							raw({
								fontFamily: "var(--demo-blog-reading-font)",
								fontSize: "1.125rem",
								lineHeight: 1.6,
							}),
						]}
					>
						{description}
					</p>
				) : null}
				{children}
			</header>
		);
	};
}
