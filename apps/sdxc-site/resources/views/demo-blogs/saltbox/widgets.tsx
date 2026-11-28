/**
 * Saltbox's sidebar widgets: search, the author, recent posts, categories with counts, a
 * tag cloud sized by use, archives by month and the ways to subscribe. Each is a titled
 * section, so the sidebar reads as a list of landmarks a reader can skip between.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { MailIcon, RssIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { listStyle, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
import { Avatar, LinkButton } from "@sdxc/ui";

import type { DemoBlogContext } from "~/resources/views/demo-blogs";

import { countKinds, countTags } from "~/app/services/demo-blogs";
import {
	ABOUT_PAGE,
	ARCHIVE_PAGE,
	FEED_PAGE,
	SUBSCRIBE_PAGE,
	TAGS_PAGE,
} from "~/resources/views/demo-blogs";
import { PostDate } from "~/resources/views/demo-blogs/parts";
import { eyebrow, SearchForm, textLink } from "~/resources/views/demo-blogs/saltbox/parts";

/** How many posts the Recent posts widget lists. */
const RECENT_COUNT = 5;

/** The smallest and largest a tag reads in the cloud, in rem, for the least and most used. */
const CLOUD_SIZES = [0.8125, 1.375] as const;

namespace Widget {
	export interface Props {
		title: string;
		/** The `data-slot` a case study's shot points at. */
		slot: string;
		children: RemixNode;
	}
}

/** One sidebar widget: a ruled uppercase title over its content. */
export function Widget(handle: Handle<Widget.Props>) {
	return () => {
		let { children, slot, title } = handle.props;
		let id = `widget-${slot}`;
		return (
			<section aria-labelledby={id} data-slot={slot} mix={[vstack({ gap: 3, align: "stretch" })]}>
				<h2
					id={id}
					mix={[
						eyebrow(),
						fg("neutral.emphasis"),
						raw({
							paddingBlockStart: "0.625rem",
							borderBlockStart: "3px solid var(--ui-brand-bg-solid)",
							letterSpacing: "0.08em",
						}),
					]}
				>
					{title}
				</h2>
				{children}
			</section>
		);
	};
}

namespace ContextProps {
	export interface Props {
		context: DemoBlogContext;
	}
}

/** The sidebar most pages show, every widget in the order a classic blog stacks them. */
export function StandardSidebar(handle: Handle<ContextProps.Props>) {
	return () => {
		let { context } = handle.props;
		return (
			<>
				<SearchWidget context={context} />
				<AboutWidget context={context} />
				<RecentWidget context={context} />
				<CategoriesWidget context={context} />
				<TagCloudWidget context={context} />
				<ArchivesWidget context={context} />
				<SubscribeWidget context={context} />
			</>
		);
	};
}

/** The search box. */
export function SearchWidget(handle: Handle<ContextProps.Props>) {
	return () => (
		<Widget title="Search" slot="search-widget">
			<SearchForm context={handle.props.context} id="sidebar-search" />
		</Widget>
	);
}

/** The author's portrait, name, role and bio, linking on to the about page. */
export function AboutWidget(handle: Handle<ContextProps.Props>) {
	return () => {
		let { href, site } = handle.props.context;
		return (
			<Widget title="About the author" slot="about-widget">
				<div mix={[hstack({ gap: 3, align: "center" })]}>
					<Avatar size="lg">
						<Avatar.Fallback>{site.author.initials}</Avatar.Fallback>
					</Avatar>
					<div mix={[vstack({ gap: 0, align: "start" })]}>
						<p mix={[m(0), weight("bold"), fg("neutral.emphasis")]}>{site.author.name}</p>
						<p mix={[m(0), text("sm"), fg("neutral.muted"), leading("snug")]}>{site.author.role}</p>
					</div>
				</div>
				<p
					mix={[
						m(0),
						fg("neutral"),
						raw({
							fontFamily: "var(--demo-blog-reading-font)",
							fontSize: "0.96875rem",
							lineHeight: 1.6,
						}),
					]}
				>
					{site.author.bio}
				</p>
				<p mix={[m(0), text("sm")]}>
					<a href={href(ABOUT_PAGE)} mix={[textLink(), weight("semibold")]}>
						More about me <span aria-hidden="true">→</span>
					</a>
				</p>
			</Widget>
		);
	};
}

/** The newest posts by title and date. */
export function RecentWidget(handle: Handle<ContextProps.Props>) {
	return () => {
		let { href, posts } = handle.props.context;
		return (
			<Widget title="Recent posts" slot="recent-widget">
				<ul mix={[m(0), p(0), listStyle(), vstack({ gap: 3, align: "stretch" })]}>
					{posts.slice(0, RECENT_COUNT).map((post) => (
						<li key={post.path} mix={[vstack({ gap: 0, align: "stretch" })]}>
							<a href={href(post.path)} mix={[textLink(), leading("snug"), weight("medium")]}>
								{post.title}
							</a>
							<span mix={[text("xs"), fg("neutral.muted")]}>
								<PostDate date={post.date} style="long" />
							</span>
						</li>
					))}
				</ul>
			</Widget>
		);
	};
}

/** Every kind with its post count, each narrowing the home feed with `?type=`. */
export function CategoriesWidget(handle: Handle<ContextProps.Props>) {
	return () => {
		let { context } = handle.props;
		return (
			<Widget title="Categories" slot="categories-widget">
				<ul mix={[m(0), p(0), listStyle(), vstack({ gap: 0, align: "stretch" })]}>
					{countKinds(context.site, context.posts).map((entry) => (
						<li
							key={entry.kind}
							mix={[raw({ borderBlockEnd: "1px dotted var(--ui-neutral-border-hover)" })]}
						>
							<a
								href={`${context.href()}?type=${entry.kind}`}
								mix={[
									hstack({ gap: 2, align: "baseline", justify: "between" }),
									raw({ paddingBlock: "0.45rem", textDecoration: "none" }),
									fg("neutral.emphasis"),
									hover(fg("brand")),
								]}
							>
								<span>{context.site.kinds[entry.kind]?.label ?? entry.kind}</span>
								<span
									mix={[
										text("sm"),
										fg("neutral.muted"),
										raw({ fontVariantNumeric: "tabular-nums" }),
									]}
								>
									{entry.count}
								</span>
							</a>
						</li>
					))}
				</ul>
			</Widget>
		);
	};
}

/** Every tag, larger the more posts carry it, with the count spelled out for screen readers. */
export function TagCloudWidget(handle: Handle<ContextProps.Props>) {
	return () => {
		let { context } = handle.props;
		let tags = countTags(context.posts).sort((a, b) => a.tag.localeCompare(b.tag));
		return (
			<Widget title="Tags" slot="tag-cloud">
				<TagCloud tags={tags} context={context} />
				<p mix={[m(0), text("sm")]}>
					<a href={context.href(TAGS_PAGE)} mix={[textLink()]}>
						All topics <span aria-hidden="true">→</span>
					</a>
				</p>
			</Widget>
		);
	};
}

namespace TagCloud {
	export interface Props extends ContextProps.Props {
		tags: Array<{ tag: string; count: number }>;
		/** Scales every size up, for the topics page where the cloud is the page. @default 1 */
		scale?: number;
	}
}

/** Tags in a wrapping row, each sized between the cloud's bounds by how many posts carry it. */
export function TagCloud(handle: Handle<TagCloud.Props>) {
	return () => {
		let { context, scale = 1, tags } = handle.props;
		let counts = tags.map((entry) => entry.count);
		let least = Math.min(...counts);
		let most = Math.max(...counts);
		let [small, large] = CLOUD_SIZES;
		let size = (count: number) =>
			most === least
				? (small + large) / 2
				: small + ((count - least) / (most - least)) * (large - small);
		return (
			<ul
				mix={[
					m(0),
					p(0),
					listStyle(),
					hstack({ gap: 3, align: "baseline" }),
					raw({ flexWrap: "wrap", rowGap: "0.25rem", lineHeight: 1.3 }),
				]}
			>
				{tags.map((entry) => (
					<li key={entry.tag}>
						<a
							href={context.href(`${TAGS_PAGE}/${encodeURIComponent(entry.tag)}`)}
							mix={[textLink(), raw({ fontSize: `${(size(entry.count) * scale).toFixed(3)}rem` })]}
						>
							{entry.tag}
							<span mix={[visuallyHidden()]}>
								{" "}
								({entry.count} {entry.count === 1 ? "post" : "posts"})
							</span>
						</a>
					</li>
				))}
			</ul>
		);
	};
}

/**
 * Every month with posts, newest first, with its count. Each links to that month's heading
 * on the archive page, which names it with the same `YYYY-MM` fragment.
 */
export function ArchivesWidget(handle: Handle<ContextProps.Props>) {
	return () => {
		let { href, posts } = handle.props.context;
		let months = new Map<string, number>();
		for (let post of posts) {
			let month = post.date.slice(0, 7);
			months.set(month, (months.get(month) ?? 0) + 1);
		}
		return (
			<Widget title="Archives" slot="archives-widget">
				<ul mix={[m(0), p(0), listStyle(), vstack({ gap: 1, align: "stretch" })]}>
					{[...months].map(([month, count]) => (
						<li key={month}>
							<a href={`${href(ARCHIVE_PAGE)}#${month}`} mix={[textLink()]}>
								{monthName(month)}
							</a>{" "}
							<span mix={[text("sm"), fg("neutral.muted")]}>({count})</span>
						</li>
					))}
				</ul>
			</Widget>
		);
	};
}

/**
 * Names a `YYYY-MM` month as a reader says it, read in UTC so no time zone moves it.
 *
 * @example monthName("2026-11") // "November 2026"
 */
export function monthName(month: string): string {
	return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

/** The newsletter and the RSS feed, the two ways to hear about new posts. */
export function SubscribeWidget(handle: Handle<ContextProps.Props>) {
	return () => {
		let { href } = handle.props.context;
		return (
			<Widget title="Subscribe" slot="subscribe-widget">
				<p mix={[m(0), fg("neutral"), text("sm"), leading("relaxed")]}>
					One email a month with everything new, or every post as it goes out in your feed reader.
				</p>
				<div mix={[hstack({ gap: 2, align: "center" }), raw({ flexWrap: "wrap" })]}>
					<LinkButton href={href(SUBSCRIBE_PAGE)} color="brand" size="sm">
						<MailIcon size={16} aria-hidden="true" />
						By email
					</LinkButton>
					<LinkButton href={href(FEED_PAGE)} variant="outline" size="sm">
						<RssIcon size={16} aria-hidden="true" />
						RSS feed
					</LinkButton>
				</div>
			</Widget>
		);
	};
}
