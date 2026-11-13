/**
 * A post as Chorus draws it: the author, the text, then whatever it carries (pictures, a
 * link card, a quoted post or a poll), and the row of reply, repost, like, views, save and
 * share. The whole card opens the post; every control inside it keeps its own job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BookmarkIcon,
	ChartNoAxesColumnIcon,
	CheckIcon,
	HeartIcon,
	MessageCircleIcon,
	QuoteIcon,
	Repeat2Icon,
	SendIcon,
	ShareIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { dark, media, motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { Button, Menu } from "@sdxc/ui";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import { Frame } from "remix/component";

import type { PaletteScale } from "~/resources/components/demo-theme";
import type { Person } from "~/resources/views/demo-apps/chorus/data";
import type { PostView } from "~/resources/views/demo-apps/chorus/state";

import { demoThemeTokens } from "~/resources/components/demo-theme";
import { CopyLink } from "~/resources/views/demo-apps/chorus/copy-link";
import { ME, actionHref, href, pollFrame } from "~/resources/views/demo-apps/chorus/data";
import {
	PersonAvatar,
	RichText,
	SceneArt,
	compact,
	fullDate,
	shortAge,
} from "~/resources/views/demo-apps/chorus/parts";
import { ageOf } from "~/resources/views/demo-apps/chorus/state";

/** Builds a palette scale around one hue, for the colour a pressed reaction takes. */
function accentScale(hue: number, chroma: number): PaletteScale {
	let lightness = [0.97, 0.94, 0.885, 0.81, 0.72, 0.645, 0.57, 0.49, 0.41, 0.33, 0.25];
	let weight = [0.1, 0.2, 0.4, 0.6, 0.85, 1, 1, 0.9, 0.75, 0.6, 0.45];
	return lightness.map(
		(step, index) => `oklch(${step} ${(chroma * (weight[index] ?? 1)).toFixed(3)} ${hue})`,
	) as unknown as PaletteScale;
}

/** A like's rose, a repost's green and a save's coral, each a scale of its own. */
const ACCENTS = {
	like: accentScale(5, 0.2),
	repost: accentScale(152, 0.15),
	reply: accentScale(235, 0.13),
	save: accentScale(32, 0.18),
} as const;

/**
 * Scopes one reaction's colour: a pressed control and the hover of a resting one take the
 * accent, while a resting control's icon and count sit back in muted grey. Dark mode reads
 * the palette steps on every element, so the overrides there name steps rather than roles.
 */
function accent(kind: keyof typeof ACCENTS) {
	return [
		raw({
			...demoThemeTokens({ brand: ACCENTS[kind] }),
			"--ui-neutral-bg-tint-hover": "var(--ui-color-brand-50)",
			"--ui-neutral-fg-emphasis": "var(--ui-neutral-fg-muted)",
			display: "inline-flex",
			position: "relative",
			zIndex: "1",
		}),
		when(
			"& :is(form, a):hover",
			raw({ "--ui-neutral-fg-emphasis": "var(--ui-brand-fg)", color: "var(--ui-brand-fg)" }),
		),
		dark([
			raw({
				"--ui-color-neutral-900": "color-mix(in oklch, var(--ui-color-brand-900) 55%, transparent)",
				"--ui-color-neutral-100": "var(--ui-color-neutral-400)",
			}),
			when("& :is(form, a):hover", raw({ "--ui-color-neutral-100": "var(--ui-color-brand-400)" })),
		]),
	];
}

/**
 * The icon and count a reaction shows: a zero count keeps its slot so the row stays aligned,
 * and `-1` drops the slot for a control that never counts, such as save.
 */
function Reaction(handle: Handle<{ icon: RemixNode; count: number; large?: boolean }>) {
	return () => {
		let { count, icon, large } = handle.props;
		return (
			<span
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.375rem",
						fontSize: "0.8125rem",
						fontVariantNumeric: "tabular-nums",
						"@media (min-width: 30rem)": { minInlineSize: large || count < 0 ? "auto" : "2rem" },
						"& > svg": { flexShrink: "0" },
					}),
				]}
			>
				{icon}
				{count < 0 ? null : <span>{count > 0 ? compact(count) : ""}</span>}
			</span>
		);
	};
}

namespace PostActions {
	export interface Props {
		post: PostView;
		/** The page and fragment a no-script post returns to. */
		returnTo: string;
		/** The focal post's row: bigger icons, counts printed above instead. */
		large?: boolean;
	}
}

/**
 * The action row. Reply opens the composer on the post; repost, like and save flip at once
 * and post in the background, each with both counts in the markup so the number moves with
 * the press; share opens a menu. Without script each toggle is a form that comes back here.
 */
export function PostActions(handle: Handle<PostActions.Props>) {
	return () => {
		let { large = false, post, returnTo } = handle.props;
		let size = large ? 22 : 18;
		let fields = (intent: string) => ({ intent, return: returnTo });
		let toggle = (
			kind: "like" | "repost" | "save",
			on: boolean,
			count: number,
			labels: { label: string; pressed: string; failed: string },
			icon: (filled: boolean) => RemixNode,
		) => {
			let base = count - Number(on);
			let counted = !large && kind !== "save";
			return (
				<span mix={[accent(kind)]}>
					<OptimisticToggle
						action={actionHref(`post/${post.id}`)}
						name="on"
						pressed={on}
						fields={fields(kind)}
						labels={labels}
						pressedContent={
							<Reaction icon={icon(true)} count={counted ? base + 1 : -1} large={large} />
						}
						unpressedContent={
							<Reaction icon={icon(false)} count={counted ? base : -1} large={large} />
						}
					/>
				</span>
			);
		};

		return (
			<div
				role="group"
				aria-label="Post actions"
				data-slot="post-actions"
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: "0",
						marginInlineStart: "-0.5rem",
						marginBlockStart: large ? "0" : "0.375rem",
						maxInlineSize: large ? "none" : "32rem",
						"& button": { paddingInline: "0.375rem" },
					}),
				]}
			>
				<span mix={[accent("reply")]}>
					<a
						href={href(`compose?reply=${post.id}`)}
						data-compose=""
						aria-label={`Reply${post.replies > 0 ? ` (${post.replies} replies)` : ""}`}
						title="Reply"
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								blockSize: "2rem",
								paddingInline: "0.375rem",
								borderRadius: "999px",
								color: "var(--ui-neutral-fg-emphasis)",
								textDecoration: "none",
								transition: "background-color 120ms",
							}),
							when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
							),
							motionReduce(raw({ transition: "none" })),
						]}
					>
						<Reaction
							icon={<MessageCircleIcon size={size} aria-hidden="true" />}
							count={large ? 0 : post.replies}
							large={large}
						/>
					</a>
				</span>
				{toggle(
					"repost",
					post.reposted,
					post.reposts,
					{ label: "Repost", pressed: "Undo repost", failed: "Couldn't repost" },
					() => (
						<Repeat2Icon size={size} aria-hidden="true" />
					),
				)}
				{toggle(
					"like",
					post.liked,
					post.likes,
					{ label: "Like", pressed: "Unlike", failed: "Couldn't like" },
					(filled) => (
						<HeartIcon size={size} aria-hidden="true" fill={filled ? "currentColor" : "none"} />
					),
				)}
				{large ? null : (
					<span
						title={`${post.views.toLocaleString("en")} views`}
						mix={[
							raw({
								display: "inline-flex",
								paddingInline: "0.5rem",
								color: "var(--ui-neutral-fg-muted)",
								"@media (max-width: 29.99rem)": { display: "none" },
							}),
						]}
					>
						<span
							mix={[
								raw({
									position: "absolute",
									inlineSize: "1px",
									overflow: "hidden",
									clip: "rect(0 0 0 0)",
								}),
							]}
						>
							{post.views.toLocaleString("en")} views
						</span>
						<span aria-hidden="true">
							<Reaction icon={<ChartNoAxesColumnIcon size={size} />} count={post.views} />
						</span>
					</span>
				)}
				<span mix={[raw({ display: "inline-flex", alignItems: "center" })]}>
					{toggle(
						"save",
						post.saved,
						0,
						{ label: "Save", pressed: "Remove from saved", failed: "Couldn't save" },
						(filled) => (
							<BookmarkIcon
								size={size}
								aria-hidden="true"
								fill={filled ? "currentColor" : "none"}
							/>
						),
					)}
					<ShareMenu post={post} size={size} />
				</span>
			</div>
		);
	};
}

/** Share: copy the link, quote the post, or send it in a message, from a native popover menu. */
function ShareMenu(handle: Handle<{ post: PostView; size: number }>) {
	return () => {
		let { post, size } = handle.props;
		let id = `share-${post.id}`;
		return (
			<span mix={[accent("reply")]}>
				<Button
					type="button"
					variant="ghost"
					color="neutral"
					size="sm"
					commandfor={id}
					command="toggle-popover"
					aria-label="Share"
					title="Share"
				>
					<ShareIcon size={size} aria-hidden="true" />
				</Button>
				<Menu id={id} placement="bottom-end" aria-label="Share post">
					<CopyLink
						path={href(`post/${post.id}`)}
						menu={id}
						labels={{ copy: "Copy link", copied: "Link copied" }}
					/>
					<Menu.Item href={href(`compose?quote=${post.id}`)} data-compose="">
						<QuoteIcon size={16} aria-hidden="true" />
						Quote post
					</Menu.Item>
					<Menu.Item href={href(`messages?share=${post.id}`)}>
						<SendIcon size={16} aria-hidden="true" />
						Send in a message
					</Menu.Item>
				</Menu>
			</span>
		);
	};
}

/** A person's name and handle, the name linking to their profile; long ones truncate. */
export function Byline(handle: Handle<{ person: Person; children?: RemixNode }>) {
	return () => {
		let { children, person } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "baseline",
						gap: "0.25rem",
						minInlineSize: "0",
						whiteSpace: "nowrap",
						fontSize: "0.9375rem",
						lineHeight: "1.25rem",
					}),
				]}
			>
				<a
					href={href(`u/${person.handle}`)}
					data-rmx-prefetch="intent"
					mix={[
						raw({
							position: "relative",
							zIndex: "1",
							overflow: "hidden",
							textOverflow: "ellipsis",
							fontWeight: "700",
							color: "var(--ui-neutral-fg-emphasis)",
							textDecoration: "none",
						}),
						when("&:hover", raw({ textDecoration: "underline" })),
					]}
				>
					{person.name}
				</a>
				<span
					mix={[
						raw({
							overflow: "hidden",
							textOverflow: "ellipsis",
							color: "var(--ui-neutral-fg-muted)",
							flexShrink: "1",
							minInlineSize: "2rem",
						}),
					]}
				>
					@{person.handle}
				</span>
				{children}
			</div>
		);
	};
}

/** The pictures a post carries, one wide or two side by side, cropped to 16:9 together. */
export function Pictures(handle: Handle<{ post: PostView }>) {
	return () => {
		let pictures = handle.props.post.pictures ?? [];
		if (pictures.length === 0) return null;
		return (
			<div
				data-slot="post-pictures"
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: `repeat(${pictures.length}, minmax(0, 1fr))`,
						gap: "2px",
						aspectRatio: "16 / 9",
						marginBlockStart: "0.75rem",
						overflow: "hidden",
						borderRadius: "1rem",
						border: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				{pictures.map((picture) => (
					<div role="img" aria-label={picture.alt} mix={[raw({ minInlineSize: "0" })]}>
						<SceneArt scene={picture.scene} />
					</div>
				))}
			</div>
		);
	};
}

/** A link's preview: its image, site, title and summary, the whole card the link. */
function LinkPreview(handle: Handle<{ post: PostView }>) {
	return () => {
		let link = handle.props.post.link;
		if (!link) return null;
		return (
			<a
				href={link.url}
				rel="noopener"
				mix={[
					raw({
						position: "relative",
						zIndex: "1",
						display: "block",
						marginBlockStart: "0.75rem",
						overflow: "hidden",
						borderRadius: "1rem",
						border: "1px solid var(--ui-neutral-border)",
						color: "inherit",
						textDecoration: "none",
						transition: "background-color 120ms",
					}),
					when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				<div
					mix={[
						raw({ aspectRatio: "1.91 / 1", borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
					]}
				>
					<SceneArt scene={link.scene} />
				</div>
				<div
					mix={[raw({ display: "grid", gap: "0.125rem", padding: "0.625rem 0.875rem 0.75rem" })]}
				>
					<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
						{link.domain}
					</span>
					<span mix={[raw({ fontWeight: "600", lineHeight: "1.3" })]}>{link.title}</span>
					<span
						mix={[
							raw({
								fontSize: "0.875rem",
								lineHeight: "1.35",
								color: "var(--ui-neutral-fg-muted)",
								display: "-webkit-box",
								WebkitLineClamp: "2",
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
							}),
						]}
					>
						{link.description}
					</span>
				</div>
			</a>
		);
	};
}

/** A quoted post, small: author, time and text, the whole box opening it. */
export function QuotedPost(handle: Handle<{ quoted: PostView; now: number }>) {
	return () => {
		let { now, quoted } = handle.props;
		return (
			<a
				href={href(`post/${quoted.id}`)}
				data-rmx-prefetch="intent"
				aria-label={`Quoted post by ${quoted.person.name}`}
				mix={[
					raw({
						position: "relative",
						zIndex: "1",
						display: "grid",
						gap: "0.25rem",
						marginBlockStart: "0.75rem",
						padding: "0.75rem",
						borderRadius: "1rem",
						border: "1px solid var(--ui-neutral-border)",
						color: "inherit",
						textDecoration: "none",
						transition: "background-color 120ms",
					}),
					when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.375rem",
							minInlineSize: "0",
							whiteSpace: "nowrap",
							fontSize: "0.9375rem",
						}),
					]}
				>
					<PersonAvatar person={quoted.person} size={1.25} />
					<span mix={[raw({ fontWeight: "700", overflow: "hidden", textOverflow: "ellipsis" })]}>
						{quoted.person.name}
					</span>
					<span
						mix={[
							raw({
								color: "var(--ui-neutral-fg-muted)",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}),
						]}
					>
						@{quoted.person.handle} · {shortAge(ageOf(quoted, now), quoted.at)}
					</span>
				</span>
				<span
					mix={[
						raw({
							fontSize: "0.9375rem",
							lineHeight: "1.4",
							display: "-webkit-box",
							WebkitLineClamp: "4",
							WebkitBoxOrient: "vertical",
							overflow: "hidden",
						}),
					]}
				>
					{quoted.text.replaceAll("`", "")}
				</span>
			</a>
		);
	};
}

namespace PollView {
	export interface Props {
		post: PostView;
		/** The page the poll sits on, which a vote posts to and, without script, returns to. */
		returnTo: string;
	}
}

/**
 * A post's poll in its own frame, loaded with the page it sits on: a vote reloads only this
 * frame, so the bars grow in place while the timeline, its scroll and the shell stay put.
 */
export function PollFrame(handle: Handle<PollView.Props>) {
	return () => {
		let { post, returnTo } = handle.props;
		if (!post.poll) return null;
		return <Frame name={pollFrame(post.id)} src={href(returnTo)} />;
	};
}

/**
 * A poll: open and unvoted, each option is a submit button; voted or ended, each shows its
 * share as a bar with the visitor's pick marked. The bars grow in once, unless motion is
 * reduced.
 */
export function PollView(handle: Handle<PollView.Props>) {
	return () => {
		let { post, returnTo } = handle.props;
		let poll = post.poll;
		if (!poll) return null;
		let total = poll.votes.reduce((sum, count) => sum + count, 0);
		let ended = poll.endsIn === undefined;
		let footer = `${total.toLocaleString("en")} votes · ${poll.endsIn ?? "Final results"}`;
		let showResults = ended || post.voted !== undefined;
		let leader = Math.max(...poll.votes);

		if (!showResults) {
			return (
				<form
					method="post"
					action={href(returnTo)}
					data-rmx-target={pollFrame(post.id)}
					data-rmx-reset-scroll="manual"
					data-rmx-reset-focus="manual"
					mix={[
						raw({
							position: "relative",
							zIndex: "1",
							display: "grid",
							gap: "0.5rem",
							marginBlockStart: "0.75rem",
						}),
					]}
				>
					<input type="hidden" name="intent" value="vote" />
					<input type="hidden" name="post" value={post.id} />
					{poll.options.map((option, index) => (
						<button
							type="submit"
							name="option"
							value={String(index)}
							mix={[
								raw({
									minBlockSize: "2.5rem",
									paddingInline: "1rem",
									borderRadius: "999px",
									border: "1px solid var(--ui-brand-border-strong)",
									background: "transparent",
									color: "var(--ui-brand-fg)",
									font: "inherit",
									fontWeight: "650",
									cursor: "pointer",
									transition: "background-color 120ms",
								}),
								when("&:hover", raw({ backgroundColor: "var(--ui-brand-bg-tint)" })),
								when(
									"&:focus-visible",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
								motionReduce(raw({ transition: "none" })),
							]}
						>
							{option}
						</button>
					))}
					<p
						mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						{footer}
					</p>
				</form>
			);
		}

		return (
			<div mix={[raw({ display: "grid", gap: "0.375rem", marginBlockStart: "0.75rem" })]}>
				<ul
					mix={[
						raw({ display: "grid", gap: "0.375rem", margin: "0", padding: "0", listStyle: "none" }),
					]}
				>
					{poll.options.map((option, index) => {
						let share = total === 0 ? 0 : Math.round(((poll.votes[index] ?? 0) / total) * 100);
						let mine = post.voted === index;
						let leading = (poll.votes[index] ?? 0) === leader;
						return (
							<li
								style={`--chorus-share: ${share}%`}
								data-leading={leading ? "" : undefined}
								mix={[
									raw({
										position: "relative",
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: "0.75rem",
										minBlockSize: "2rem",
										paddingInline: "0.75rem",
										borderRadius: "0.5rem",
										overflow: "hidden",
										isolation: "isolate",
										"&::before": {
											content: '""',
											position: "absolute",
											inset: "0 auto 0 0",
											zIndex: "-1",
											inlineSize: "var(--chorus-share)",
											borderRadius: "0.5rem",
											backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
											animation: "chorus-poll-grow 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
										},
										"@keyframes chorus-poll-grow": {
											from: { inlineSize: "0" },
										},
									}),
									when(
										"&[data-leading]::before",
										raw({ backgroundColor: "var(--ui-brand-bg-tint-pressed)" }),
									),
									when("&[data-leading]", raw({ fontWeight: "700" })),
									motionReduce(when("&::before", raw({ animation: "none" }))),
								]}
							>
								<span
									mix={[
										raw({
											display: "inline-flex",
											alignItems: "center",
											gap: "0.375rem",
											minInlineSize: "0",
										}),
									]}
								>
									{option}
									{mine ? (
										<CheckIcon
											size={16}
											aria-label="Your vote"
											mix={[raw({ color: "var(--ui-brand-fg)" })]}
										/>
									) : null}
								</span>
								<span mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>{share}%</span>
							</li>
						);
					})}
				</ul>
				<p mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
					{footer}
				</p>
			</div>
		);
	};
}

namespace PostCard {
	export interface Props {
		post: PostView;
		/** The quoted post, already viewed for the visitor. */
		quoted?: PostView;
		/** The person whose repost brought it here; Noor reads "You reposted". */
		repostedBy?: Person;
		/** A thread continues below: the avatar's line runs on and the card drops its rule. */
		threadNext?: boolean;
		/** It continues a thread above: a line meets the avatar from the card before. */
		threadPrev?: boolean;
		/** Names the post replied to, for a reply shown away from its thread. */
		replyingTo?: Person;
		/** Offers "Show this thread" under a post its author continued. */
		threadLink?: boolean;
		/** Marks a post that just arrived, which fades in once. */
		arrived?: boolean;
		returnTo: string;
		/** The real clock, which the visitor's own posts read their age against. */
		now: number;
	}
}

/**
 * One post in a list. The time links to the post and stretches over the card, so the card
 * opens the post on a press anywhere that is not another control.
 */
export function PostCard(handle: Handle<PostCard.Props>) {
	return () => {
		let {
			arrived,
			now,
			post,
			quoted,
			replyingTo,
			repostedBy,
			returnTo,
			threadLink,
			threadNext,
			threadPrev,
		} = handle.props;
		let age = ageOf(post, now);

		return (
			<article
				id={`post-${post.id}`}
				data-post={post.id}
				data-arrived={arrived ? "" : undefined}
				aria-label={`${post.person.name}: ${post.text.slice(0, 80)}`}
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "2.5rem minmax(0, 1fr)",
						columnGap: "0.75rem",
						padding: "0.75rem 1rem 0.5rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
						transition: "background-color 120ms",
						scrollMarginBlockStart: "7rem",
						"@keyframes chorus-arrive": {
							from: {
								backgroundColor: "var(--ui-brand-bg-tint)",
								translate: "0 -0.5rem",
								opacity: "0",
							},
						},
					}),
					when("&[data-thread-next]", raw({ borderBlockEnd: "0" })),
					media(
						"(hover: hover)",
						when(
							"&:hover",
							raw({
								backgroundColor:
									"color-mix(in oklch, var(--ui-neutral-bg-tint-hover) 45%, transparent)",
							}),
						),
					),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
					),
					when(
						"&:has(> div > div > a[data-post-link]:focus-visible)",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
					),
					when(
						"&[data-arrived]",
						raw({
							animation: "chorus-arrive 700ms ease-out both",
						}),
					),
					motionReduce(raw({ transition: "none", animation: "none" })),
				]}
				data-thread-next={threadNext ? "" : undefined}
			>
				{repostedBy ? (
					<div
						mix={[
							raw({
								gridColumn: "1 / -1",
								display: "grid",
								gridTemplateColumns: "2.5rem minmax(0, 1fr)",
								columnGap: "0.75rem",
								marginBlockEnd: "0.25rem",
								fontSize: "0.8125rem",
								fontWeight: "650",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<span mix={[raw({ display: "flex", justifyContent: "flex-end" })]}>
							<Repeat2Icon size={16} aria-hidden="true" />
						</span>
						<a
							href={href(`u/${repostedBy.handle}`)}
							mix={[
								raw({
									position: "relative",
									zIndex: "1",
									color: "inherit",
									textDecoration: "none",
								}),
								when("&:hover", raw({ textDecoration: "underline" })),
							]}
						>
							{repostedBy.handle === ME.handle ? "You reposted" : `${repostedBy.name} reposted`}
						</a>
					</div>
				) : null}
				<div
					mix={[
						raw({
							position: "relative",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "0.25rem",
						}),
						threadPrev
							? raw({
									"&::before": {
										content: '""',
										position: "absolute",
										insetBlockStart: "-0.75rem",
										blockSize: "0.5rem",
										inlineSize: "2px",
										backgroundColor: "var(--ui-neutral-border-hover, var(--ui-neutral-border))",
									},
								})
							: raw({}),
						threadNext
							? raw({
									"&::after": {
										content: '""',
										flex: "1 1 auto",
										inlineSize: "2px",
										marginBlockEnd: "-0.5rem",
										backgroundColor: "var(--ui-neutral-border-hover, var(--ui-neutral-border))",
									},
								})
							: raw({}),
					]}
				>
					<a
						href={href(`u/${post.person.handle}`)}
						tabIndex={-1}
						aria-hidden="true"
						mix={[
							raw({
								position: "relative",
								zIndex: "1",
								display: "inline-flex",
								borderRadius: "999px",
							}),
						]}
					>
						<PersonAvatar person={post.person} />
					</a>
				</div>
				<div
					mix={[
						raw({ minInlineSize: "0", display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }),
					]}
				>
					<div
						mix={[
							raw({ display: "flex", alignItems: "baseline", gap: "0.25rem", minInlineSize: "0" }),
						]}
					>
						<Byline person={post.person}>
							<span aria-hidden="true" mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
								·
							</span>
							<a
								href={href(`post/${post.id}`)}
								data-post-link=""
								data-rmx-prefetch="intent"
								title={fullDate(post.at)}
								mix={[
									raw({
										flexShrink: "0",
										color: "var(--ui-neutral-fg-muted)",
										textDecoration: "none",
										outline: "none",
										"&::after": { content: '""', position: "absolute", inset: "0" },
									}),
									when("&:hover", raw({ textDecoration: "underline" })),
								]}
							>
								<time datetime={post.at}>{shortAge(age, post.at)}</time>
							</a>
						</Byline>
					</div>
					{replyingTo ? (
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							Replying to{" "}
							<a
								href={href(`u/${replyingTo.handle}`)}
								mix={[
									raw({
										position: "relative",
										zIndex: "1",
										color: "var(--ui-brand-fg)",
										textDecoration: "none",
									}),
								]}
							>
								@{replyingTo.handle}
							</a>
						</p>
					) : null}
					<p
						mix={[
							raw({
								margin: "0.125rem 0 0",
								fontSize: "0.9375rem",
								lineHeight: "1.45",
								whiteSpace: "pre-wrap",
								overflowWrap: "anywhere",
								textWrap: "pretty",
							}),
						]}
					>
						<RichText text={post.text} />
					</p>
					<Pictures post={post} />
					<LinkPreview post={post} />
					{quoted ? <QuotedPost quoted={quoted} now={now} /> : null}
					<PollFrame post={post} returnTo={returnTo} />
					<PostActions post={post} returnTo={returnTo} />
					{threadLink ? (
						<a
							href={href(`post/${post.id}`)}
							mix={[
								raw({
									position: "relative",
									zIndex: "1",
									justifySelf: "start",
									paddingBlock: "0.25rem 0.5rem",
									fontSize: "0.9375rem",
									color: "var(--ui-brand-fg)",
									textDecoration: "none",
								}),
								when("&:hover", raw({ textDecoration: "underline" })),
							]}
						>
							Show this thread
						</a>
					) : null}
				</div>
			</article>
		);
	};
}

namespace FocalPost {
	export interface Props {
		post: PostView;
		quoted?: PostView;
		threadPrev?: boolean;
		returnTo: string;
		now: number;
	}
}

/**
 * The post a detail page is about: larger text, the full date and views, the reaction
 * counts spelled out, then the action row at full size.
 */
export function FocalPost(handle: Handle<FocalPost.Props>) {
	return () => {
		let { now, post, quoted, returnTo, threadPrev } = handle.props;
		let counts = [
			{ count: post.reposts, label: "Reposts" },
			{ count: post.likes, label: "Likes" },
			{ count: post.replies, label: "Replies" },
		].filter((entry) => entry.count > 0);

		return (
			<article
				id={`post-${post.id}`}
				data-post={post.id}
				data-focal=""
				aria-labelledby={`post-${post.id}-text`}
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gap: "0.75rem",
						padding: "0.75rem 1rem 0",
						scrollMarginBlockStart: "4rem",
					}),
					threadPrev
						? raw({
								"&::before": {
									content: '""',
									position: "absolute",
									insetBlockStart: "0",
									insetInlineStart: "calc(1rem + 1.25rem - 1px)",
									blockSize: "0.5rem",
									inlineSize: "2px",
									backgroundColor: "var(--ui-neutral-border)",
								},
							})
						: raw({}),
				]}
			>
				<div
					mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem", minInlineSize: "0" })]}
				>
					<a href={href(`u/${post.person.handle}`)} tabIndex={-1} aria-hidden="true">
						<PersonAvatar person={post.person} />
					</a>
					<div
						mix={[
							raw({ display: "grid", minInlineSize: "0", gridTemplateColumns: "minmax(0, 1fr)" }),
						]}
					>
						<a
							href={href(`u/${post.person.handle}`)}
							mix={[
								raw({
									fontWeight: "700",
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "none",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}),
								when("&:hover", raw({ textDecoration: "underline" })),
							]}
						>
							{post.person.name}
						</a>
						<span mix={[raw({ fontSize: "0.9375rem", color: "var(--ui-neutral-fg-muted)" })]}>
							@{post.person.handle}
						</span>
					</div>
				</div>
				<p
					id={`post-${post.id}-text`}
					mix={[
						raw({
							margin: "0",
							fontSize: "1.0625rem",
							lineHeight: "1.5",
							whiteSpace: "pre-wrap",
							overflowWrap: "anywhere",
							textWrap: "pretty",
							"@media (min-width: 40rem)": { fontSize: "1.1875rem" },
						}),
					]}
				>
					<RichText text={post.text} />
				</p>
				<div>
					<Pictures post={post} />
					<LinkPreview post={post} />
					{quoted ? <QuotedPost quoted={quoted} now={now} /> : null}
					<PollFrame post={post} returnTo={returnTo} />
				</div>
				<p mix={[raw({ margin: "0", fontSize: "0.9375rem", color: "var(--ui-neutral-fg-muted)" })]}>
					<time datetime={post.at}>{fullDate(post.at)}</time>
					{post.views > 0 ? (
						<>
							{" · "}
							<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
								{compact(post.views)}
							</strong>{" "}
							views
						</>
					) : null}
				</p>
				{counts.length > 0 ? (
					<p
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.25rem 1.25rem",
								margin: "0",
								paddingBlock: "0.75rem",
								borderBlock: "1px solid var(--ui-neutral-border)",
								fontSize: "0.9375rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{counts.map((entry) => (
							<span>
								<strong
									mix={[
										raw({
											color: "var(--ui-neutral-fg-emphasis)",
											fontVariantNumeric: "tabular-nums",
										}),
									]}
								>
									{entry.count.toLocaleString("en")}
								</strong>{" "}
								{entry.label}
							</span>
						))}
					</p>
				) : null}
				<div
					mix={[
						raw({ paddingBlock: "0.25rem", borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
					]}
				>
					<PostActions post={post} returnTo={returnTo} large />
				</div>
			</article>
		);
	};
}
