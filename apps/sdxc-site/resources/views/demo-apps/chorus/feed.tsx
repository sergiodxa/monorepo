/**
 * The pieces every Chorus list screen shares: the column's title row with its back link, the
 * equal-width tabs under it, and a feed that draws posts with their reposts, threads and
 * quotes resolved for the visitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ArrowLeftIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { Person } from "~/resources/views/demo-apps/chorus/data";
import type { PostView, VisitorState } from "~/resources/views/demo-apps/chorus/state";

import { POSTS, findPerson } from "~/resources/views/demo-apps/chorus/data";
import { FeedKeys } from "~/resources/views/demo-apps/chorus/feed-keys";
import { PostCard } from "~/resources/views/demo-apps/chorus/post";
import { lookupPost, viewPost } from "~/resources/views/demo-apps/chorus/state";

/** One post in a feed, with how it sits among its neighbours. */
export interface FeedItem {
	post: PostView;
	repostedBy?: Person;
	threadNext?: boolean;
	threadPrev?: boolean;
	replyingTo?: Person;
	threadLink?: boolean;
	arrived?: boolean;
}

/**
 * A post by id as the visitor sees it.
 *
 * @param id The post's id.
 * @param state The visitor's state.
 * @returns The viewed post, or `undefined` for an id nothing has.
 */
export function postById(id: string, state: VisitorState): PostView | undefined {
	let post = lookupPost(id, state);
	return post ? viewPost(post, state) : undefined;
}

/**
 * Whether a post's author continued it in a reply of their own, which a timeline marks with
 * "Show this thread".
 *
 * @param post The post.
 */
export function continuesAsThread(post: PostView): boolean {
	return POSTS.some(
		(candidate) => candidate.replyTo === post.id && candidate.author === post.author,
	);
}

/**
 * The person a reply answers, for "Replying to @handle" away from the thread.
 *
 * @param post The reply.
 * @param state The visitor's state.
 */
export function repliedPerson(post: PostView, state: VisitorState): Person | undefined {
	if (!post.replyTo) return undefined;
	let parent = lookupPost(post.replyTo, state);
	return parent ? findPerson(parent.author) : undefined;
}

namespace Feed {
	export interface Props {
		items: FeedItem[];
		state: VisitorState;
		now: number;
		/** The page path the posts' forms return to, landing back on the post's own row. */
		returnTo: string;
		/** Names the list for assistive tech, such as "Your timeline". */
		label: string;
	}
}

/**
 * Draws a list of posts, each with its quote looked up and its forms returning to its row;
 * with script, `j`/`k` walk the posts and Enter opens one.
 */
export function Feed(handle: Handle<Feed.Props>) {
	return () => {
		let { items, label, now, returnTo, state } = handle.props;
		return (
			<section aria-label={label} data-slot="chorus-feed">
				<FeedKeys />
				{items.map((item) => (
					<PostCard
						post={item.post}
						quoted={item.post.quote ? postById(item.post.quote, state) : undefined}
						repostedBy={item.repostedBy}
						threadNext={item.threadNext}
						threadPrev={item.threadPrev}
						replyingTo={item.replyingTo}
						threadLink={item.threadLink}
						arrived={item.arrived}
						returnTo={returnTo}
						now={now}
					/>
				))}
			</section>
		);
	};
}

namespace TitleBar {
	export interface Props {
		title: string;
		/** A second line, such as a post count. */
		subtitle?: string;
		/** Where the back arrow leads; no arrow when omitted. */
		back?: string;
		/** Controls at the row's end. */
		actions?: RemixNode;
	}
}

/** The column's title row: an optional back arrow, the screen's `h1` and a quiet second line. */
export function TitleBar(handle: Handle<TitleBar.Props>) {
	return () => {
		let { actions, back, subtitle, title } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "1.25rem",
						minBlockSize: "3.25rem",
						paddingInline: back ? "0.5rem 1rem" : "1rem",
					}),
				]}
			>
				{back ? (
					<a
						href={back}
						aria-label="Back"
						data-rmx-prefetch="intent"
						mix={[
							raw({
								display: "inline-grid",
								placeItems: "center",
								inlineSize: "2.5rem",
								blockSize: "2.5rem",
								flexShrink: "0",
								borderRadius: "999px",
								color: "inherit",
							}),
							when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
						]}
					>
						<ArrowLeftIcon size={20} aria-hidden="true" />
					</a>
				) : null}
				<div
					mix={[
						raw({
							display: "grid",
							minInlineSize: "0",
							gridTemplateColumns: "minmax(0, 1fr)",
							flex: "1 1 auto",
						}),
					]}
				>
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "1.25rem",
								fontWeight: "800",
								lineHeight: "1.5rem",
								letterSpacing: "-0.01em",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}),
						]}
					>
						{title}
					</h1>
					{subtitle ? (
						<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{subtitle}
						</span>
					) : null}
				</div>
				{actions}
			</div>
		);
	};
}

namespace FeedTabs {
	export interface Props {
		/** The landmark's name, such as "Timelines". */
		label: string;
		tabs: Array<{ label: string; href: string; current: boolean }>;
	}
}

/**
 * Equal-width tabs that are links, each its own address; the current one wears a short
 * brand bar under its label, as wide as the label.
 */
export function FeedTabs(handle: Handle<FeedTabs.Props>) {
	return () => {
		let { label, tabs } = handle.props;
		return (
			<nav aria-label={label}>
				<ul
					mix={[
						raw({
							display: "grid",
							gridAutoFlow: "column",
							gridAutoColumns: "minmax(0, 1fr)",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
					]}
				>
					{tabs.map((tab) => (
						<li>
							<a
								href={tab.href}
								aria-current={tab.current ? "page" : undefined}
								data-rmx-prefetch="intent"
								mix={[
									raw({
										display: "flex",
										justifyContent: "center",
										blockSize: "3.25rem",
										color: "var(--ui-neutral-fg-muted)",
										fontSize: "0.9375rem",
										fontWeight: "500",
										textDecoration: "none",
										transition: "background-color 120ms",
									}),
									when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
									),
									when(
										"&[aria-current='page']",
										raw({ color: "var(--ui-neutral-fg-emphasis)", fontWeight: "700" }),
									),
									motionReduce(raw({ transition: "none" })),
								]}
							>
								<span
									mix={[
										raw({
											position: "relative",
											display: "inline-flex",
											alignItems: "center",
											whiteSpace: "nowrap",
										}),
										when(
											"[aria-current='page'] > &::after",
											raw({
												content: '""',
												position: "absolute",
												insetInline: "0",
												insetBlockEnd: "0",
												blockSize: "4px",
												borderRadius: "999px",
												backgroundColor: "var(--ui-brand-bg-solid)",
											}),
										),
									]}
								>
									{tab.label}
								</span>
							</a>
						</li>
					))}
				</ul>
			</nav>
		);
	};
}

/** A quiet line at the foot of a feed, saying there is nothing more below. */
export function FeedEnd(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<p
			mix={[
				raw({
					margin: "0",
					padding: "2rem 1rem 3rem",
					textAlign: "center",
					fontSize: "0.9375rem",
					color: "var(--ui-neutral-fg-muted)",
				}),
			]}
		>
			{handle.props.children}
		</p>
	);
}
