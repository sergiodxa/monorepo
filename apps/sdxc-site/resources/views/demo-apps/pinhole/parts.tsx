/**
 * The pieces every Pinhole screen is built from: a person's name and avatar, a post's media
 * with its swipeable photos, the like, save and follow toggles that flip at once and post in
 * the background, the share sheet, the comment line and form, and the photo grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BadgeCheckIcon,
	BookmarkIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FilmIcon,
	HeartIcon,
	LayersIcon,
	MessageCircleIcon,
	SendIcon,
} from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import { CopyButton } from "@sdxc/ui/docs/copy-button";
import { StoryRing } from "@sdxc/ui/video/story-ring";

import { SITE_URL } from "~/config/constants";

import type { Comment, Person, Post, Reel } from "./data";
import type { VisitorState } from "./state";

import { PersonAvatar, PhotoArt } from "./art";
import { CarouselSync } from "./carousel-sync";
import { actionHref, compact, findPerson, href, shortAge, storyOf } from "./data";
import { isLiked, isSaved, likeCount } from "./state";

/** A visually hidden span, for words a screen reader needs and the eye does not. */
export function srOnly() {
	return raw({
		position: "absolute",
		inlineSize: "1px",
		blockSize: "1px",
		overflow: "hidden",
		clipPath: "inset(50%)",
		whiteSpace: "nowrap",
	});
}

/** A plain link that keeps its text's colour and underlines on hover. */
export function quietLink() {
	return [
		raw({ color: "inherit", textDecoration: "none" }),
		when("&:hover", raw({ textDecoration: "underline" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px", borderRadius: "2px" }),
		),
	];
}

/** A person's handle as a bold link to their profile, with the badge a verified account carries. */
export function HandleLink(handle: Handle<{ person: Person }>) {
	return () => {
		let { person } = handle.props;
		return (
			<a
				href={href(`u/${person.handle}`)}
				data-rmx-prefetch="intent"
				mix={[
					quietLink(),
					raw({
						display: "inline-flex",
						alignItems: "center",
						gap: "0.25rem",
						fontWeight: "650",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				{person.handle}
				{person.verified ? (
					<BadgeCheckIcon
						size={14}
						aria-label="Verified"
						mix={[raw({ color: "var(--ui-color-brand-500)", flexShrink: "0" })]}
					/>
				) : null}
			</a>
		);
	};
}

namespace Face {
	export interface Props {
		person: Person;
		/** The avatar's side in rem. Default: `2.25`. */
		size?: number;
		/** Rings the avatar and links it to the person's story when they posted one today. */
		withStory?: boolean;
		/** Whether the visitor has watched that story. */
		seen?: boolean;
	}
}

/**
 * A person's avatar, in a story ring linking to their story when they have one, so a feed's
 * headers lead into stories the way the tray does.
 */
export function Face(handle: Handle<Face.Props>) {
	return () => {
		let { person, seen, size = 2.25, withStory = true } = handle.props;
		let story = withStory ? storyOf(person.handle) : undefined;
		if (story === undefined) {
			return (
				<a
					href={href(`u/${person.handle}`)}
					aria-hidden="true"
					tabindex={-1}
					mix={[raw({ display: "inline-flex", borderRadius: "999px" })]}
				>
					<PersonAvatar person={person} size={size} />
				</a>
			);
		}
		return (
			<a
				href={href(`stories/${person.handle}/1`)}
				aria-label={`${person.name}'s story`}
				mix={[
					raw({ display: "inline-flex", borderRadius: "999px" }),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
				]}
			>
				<StoryRing seen={seen ?? story.seen} size={size + 0.5}>
					<PersonAvatar person={person} size={size} />
				</StoryRing>
			</a>
		);
	};
}

/** The media box's proportions: 4:5 or square in a frame, and whatever its box gives when filling. */
function frameRatio(post: Post, fit: "frame" | "fill"): string {
	if (fit === "fill") return "auto";
	return post.frame === "portrait" ? "4 / 5" : "1";
}

namespace Media {
	export interface Props {
		post: Post;
		/** The id prefix the slides and dots take, unique on the page. */
		id: string;
		/** `fill` stretches the media to its box, beside the comments on a wide post page. */
		fit?: "frame" | "fill";
	}
}

/**
 * A post's photographs: one, or several on a horizontal snap track with arrows on a pointer
 * screen, dots and an `n / N` count; a double tap likes the post with a burst over the photo.
 */
export function Media(handle: Handle<Media.Props>) {
	return () => {
		let { fit = "frame", id, post } = handle.props;
		let many = post.photos.length > 1;
		return (
			<div
				data-pinhole-media=""
				mix={[
					raw({
						position: "relative",
						overflow: "hidden",
						backgroundColor: "var(--ui-neutral-bg-tint)",
						aspectRatio: frameRatio(post, fit),
						blockSize: fit === "fill" ? "100%" : "auto",
						"&:hover [data-carousel-step]:not([disabled])": { opacity: "1" },
					}),
				]}
			>
				<div
					data-carousel-viewport=""
					role={many ? "group" : undefined}
					aria-roledescription={many ? "carousel" : undefined}
					aria-label={many ? `${post.photos.length} photos` : undefined}
					tabindex={many ? 0 : undefined}
					mix={[
						raw({
							display: "flex",
							blockSize: "100%",
							marginInlineEnd: "-1px",
							overflowX: many ? "auto" : "hidden",
							overflowY: "hidden",
							scrollSnapType: "x mandatory",
							overscrollBehaviorX: "contain",
							scrollbarWidth: "none",
							"&::-webkit-scrollbar": { display: "none" },
						}),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
						),
					]}
				>
					{post.photos.map((photo, index) => (
						<div
							id={`${id}-photo-${index + 1}`}
							data-carousel-slide=""
							role={many ? "group" : undefined}
							aria-roledescription={many ? "slide" : undefined}
							aria-label={many ? `${index + 1} of ${post.photos.length}` : undefined}
							mix={[
								raw({
									position: "relative",
									flex: "0 0 100%",
									blockSize: "100%",
									scrollSnapAlign: "start",
									scrollSnapStop: "always",
								}),
							]}
						>
							<PhotoArt photo={photo} />
						</div>
					))}
				</div>
				{many ? (
					<>
						<span
							data-carousel-count=""
							aria-hidden="true"
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "0.75rem",
									insetInlineEnd: "0.75rem",
									paddingBlock: "0.25rem",
									paddingInline: "0.5rem",
									borderRadius: "999px",
									backgroundColor: "rgb(20 16 12 / 0.6)",
									color: "oklch(0.98 0.01 80)",
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.75rem",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							1 / {post.photos.length}
						</span>
						<CarouselStep direction={-1} />
						<CarouselStep direction={1} />
						<div
							aria-hidden="true"
							mix={[
								raw({
									position: "absolute",
									insetBlockEnd: "0.625rem",
									insetInline: "0",
									display: "flex",
									justifyContent: "center",
									gap: "0.3125rem",
									pointerEvents: "none",
								}),
							]}
						>
							{post.photos.map((_, index) => (
								<span
									data-carousel-dot=""
									data-current={index === 0 ? "" : undefined}
									mix={[
										raw({
											inlineSize: "0.375rem",
											blockSize: "0.375rem",
											borderRadius: "999px",
											backgroundColor: "rgb(255 255 255 / 0.55)",
											boxShadow: "0 0 2px rgb(0 0 0 / 0.4)",
											transition: "background-color 150ms ease, transform 150ms ease",
										}),
										when(
											"&[data-current]",
											raw({ backgroundColor: "oklch(0.99 0 0)", transform: "scale(1.2)" }),
										),
										motionReduce(raw({ transition: "none" })),
									]}
								/>
							))}
						</div>
					</>
				) : null}
				<HeartBurst />
				<CarouselSync />
			</div>
		);
	};
}

/** An arrow over the media's edge, revealed by the island on a screen that can hover. */
function CarouselStep(handle: Handle<{ direction: -1 | 1 }>) {
	return () => {
		let back = handle.props.direction === -1;
		return (
			<button
				type="button"
				hidden
				data-carousel-step={String(handle.props.direction)}
				aria-label={back ? "Previous photo" : "Next photo"}
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "50%",
						insetInlineStart: back ? "0.625rem" : "auto",
						insetInlineEnd: back ? "auto" : "0.625rem",
						translate: "0 -50%",
						display: "grid",
						placeItems: "center",
						inlineSize: "2rem",
						blockSize: "2rem",
						padding: "0",
						border: "0",
						borderRadius: "999px",
						backgroundColor: "rgb(255 255 255 / 0.88)",
						color: "oklch(0.2 0.01 60)",
						boxShadow: "0 1px 4px rgb(0 0 0 / 0.25)",
						cursor: "pointer",
						opacity: "0",
						transition: "opacity 150ms ease",
						"@media (hover: none)": { display: "none" },
					}),
					when("&[hidden]", raw({ display: "none" })),
					when("&[disabled]", raw({ visibility: "hidden" })),
					when("&:focus-visible", raw({ opacity: "1", outline: "2px solid var(--ui-brand-ring)" })),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				{back ? (
					<ChevronLeftIcon size={18} aria-hidden="true" />
				) : (
					<ChevronRightIcon size={18} aria-hidden="true" />
				)}
			</button>
		);
	};
}

/** The heart that blooms over the photo on a double tap and fades. */
function HeartBurst() {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					placeItems: "center",
					pointerEvents: "none",
					color: "oklch(0.99 0.01 80)",
					opacity: "0",
					transform: "scale(0.4)",
					filter: "drop-shadow(0 4px 18px rgb(0 0 0 / 0.35))",
					"& > svg": { inlineSize: "6rem", blockSize: "6rem" },
					"[data-burst] > &": {
						animation: "pinhole-burst 900ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both",
					},
				}),
				keyframes("pinhole-burst", {
					"0%": { opacity: "0", transform: "scale(0.4)" },
					"18%": { opacity: "1", transform: "scale(1.12)" },
					"30%": { transform: "scale(0.96)" },
					"70%": { opacity: "1", transform: "scale(1)" },
					"100%": { opacity: "0", transform: "scale(1.05) translateY(-8%)" },
				}),
				motionReduce(raw({ "[data-burst] > &": { animation: "none", opacity: "0" } })),
			]}
		>
			<HeartIcon fill="currentColor" strokeWidth={0} />
		</span>
	);
}

/** A round 40px icon button in an action row, its icon 24px. */
export function actionButton() {
	return [
		raw({
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "2.5rem",
			blockSize: "2.5rem",
			padding: "0",
			border: "0",
			borderRadius: "999px",
			background: "transparent",
			color: "var(--ui-neutral-fg-emphasis)",
			cursor: "pointer",
			textDecoration: "none",
			transition: "transform 120ms ease, color 120ms ease",
		}),
		when("&:hover", raw({ color: "var(--ui-neutral-fg)" })),
		when("&:active", raw({ transform: "scale(0.88)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
		),
		motionReduce(raw({ transition: "none" })),
	];
}

namespace LikeToggle {
	export interface Props {
		/** The post or reel id. */
		id: string;
		/** `p` for a post, `reels` for a reel. */
		kind: "p" | "reels";
		liked: boolean;
		/** The page the post returns to without script. */
		back: string;
		/** White, for a toggle over a reel's video. */
		onMedia?: boolean;
	}
}

/**
 * The heart: flips red the moment it is pressed and posts in the background, so the count
 * beside it, drawn for both states, follows at once.
 */
export function LikeToggle(handle: Handle<LikeToggle.Props>) {
	return () => {
		let { back, id, kind, liked, onMedia = false } = handle.props;
		return (
			<span
				data-like=""
				mix={[
					raw({
						display: "inline-flex",
						"& button": {
							inlineSize: "2.5rem",
							blockSize: "2.5rem",
							padding: "0 !important",
							borderRadius: "999px",
							color: onMedia ? "oklch(0.99 0 0)" : "var(--ui-neutral-fg-emphasis)",
							background: "transparent",
						},
						"& button:hover": { background: "transparent", opacity: "0.7" },
						"& button svg": { inlineSize: "1.625rem", blockSize: "1.625rem" },
						"& [data-toggle-content=on]": { color: "var(--pinhole-heart)" },
						"& [data-toggle-content=on] svg": {
							animation: "pinhole-pop 320ms cubic-bezier(0.3, 1.6, 0.5, 1)",
						},
					}),
					keyframes("pinhole-pop", {
						"0%": { transform: "scale(0.6)" },
						"60%": { transform: "scale(1.2)" },
						"100%": { transform: "scale(1)" },
					}),
					motionReduce(raw({ "& [data-toggle-content=on] svg": { animation: "none" } })),
				]}
			>
				<OptimisticToggle
					action={actionHref(`${kind}/${id}/like`)}
					name="on"
					pressed={liked}
					fields={{ back }}
					labels={{ label: "Like", pressed: "Unlike", failed: "Couldn't like" }}
					pressedContent={
						<HeartIcon
							size={26}
							style="inline-size: 1.625rem; block-size: 1.625rem; max-inline-size: none"
							fill="currentColor"
							strokeWidth={1.75}
							aria-hidden="true"
						/>
					}
					unpressedContent={
						<HeartIcon
							size={26}
							style="inline-size: 1.625rem; block-size: 1.625rem; max-inline-size: none"
							strokeWidth={1.75}
							aria-hidden="true"
						/>
					}
				/>
			</span>
		);
	};
}

/** The bookmark that saves a post to the visitor's collection, flipping at once. */
export function SaveToggle(
	handle: Handle<{ id: string; saved: boolean; back: string; onMedia?: boolean }>,
) {
	return () => {
		let { back, id, onMedia = false, saved } = handle.props;
		return (
			<span
				data-save=""
				mix={[
					raw({
						display: "inline-flex",
						"& button": {
							inlineSize: "2.5rem",
							blockSize: "2.5rem",
							padding: "0 !important",
							borderRadius: "999px",
							color: onMedia ? "oklch(0.99 0 0)" : "var(--ui-neutral-fg-emphasis)",
							background: "transparent",
						},
						"& button:hover": { background: "transparent", opacity: "0.7" },
						"& button svg": { inlineSize: "1.625rem", blockSize: "1.625rem" },
					}),
				]}
			>
				<OptimisticToggle
					action={actionHref(`p/${id}/save`)}
					name="on"
					pressed={saved}
					fields={{ back }}
					labels={{ label: "Save", pressed: "Remove from saved", failed: "Couldn't save" }}
					pressedContent={
						<BookmarkIcon
							size={26}
							style="inline-size: 1.625rem; block-size: 1.625rem; max-inline-size: none"
							fill="currentColor"
							strokeWidth={1.75}
							aria-hidden="true"
						/>
					}
					unpressedContent={
						<BookmarkIcon
							size={26}
							style="inline-size: 1.625rem; block-size: 1.625rem; max-inline-size: none"
							strokeWidth={1.75}
							aria-hidden="true"
						/>
					}
				/>
			</span>
		);
	};
}

namespace FollowButton {
	export interface Props {
		person: Person;
		following: boolean;
		back: string;
		/**
		 * `solid` for the profile header's one action; `link` for a quiet word in a header row;
		 * `overlay` for a white outlined pill over a reel.
		 */
		look?: "solid" | "link" | "overlay";
	}
}

/** The styles each follow look gives the toggle's button. */
const FOLLOW_LOOKS: Record<NonNullable<FollowButton.Props["look"]>, Record<string, unknown>> = {
	solid: { display: "inline-flex", "& button": { minInlineSize: "7rem" } },
	link: {
		display: "inline-flex",
		"& button": {
			blockSize: "2rem",
			paddingInline: "0.25rem",
			background: "transparent",
			color: "var(--ui-color-brand-600)",
			fontWeight: "650",
		},
		"& [data-toggle-content=on]": { color: "var(--ui-neutral-fg-muted)" },
		"& [data-toggle-content=off]": { color: "var(--ui-color-brand-600)" },
	},
	overlay: {
		display: "inline-flex",
		"& button": { blockSize: "2rem", paddingInline: "0 !important", background: "transparent" },
		"& button:hover": { background: "transparent" },
		"& [data-toggle-content]": {
			paddingBlock: "0.25rem",
			paddingInline: "0.75rem",
			border: "1px solid rgb(255 255 255 / 0.75)",
			borderRadius: "var(--ui-radius-md)",
			color: "oklch(0.99 0 0)",
			fontSize: "0.8125rem",
			fontWeight: "650",
		},
		"& [data-toggle-content=on]": { borderColor: "rgb(255 255 255 / 0.35)", opacity: "0.85" },
	},
};

/** Follow / Following, flipping at once and posting in the background. */
export function FollowButton(handle: Handle<FollowButton.Props>) {
	return () => {
		let { back, following, look = "solid", person } = handle.props;
		return (
			<span data-follow="" mix={[raw(FOLLOW_LOOKS[look] as Parameters<typeof raw>[0])]}>
				<OptimisticToggle
					action={actionHref(`u/${person.handle}/follow`)}
					name="on"
					pressed={following}
					fields={{ back }}
					variant={look === "solid" ? "solid" : "ghost"}
					labels={{
						label: `Follow ${person.name}`,
						pressed: `Unfollow ${person.name}`,
						failed: "Couldn't follow",
					}}
					pressedContent={<span>Following</span>}
					unpressedContent={<span>Follow</span>}
				/>
			</span>
		);
	};
}

/**
 * The like count for both states, the visitor's like counted in one and not the other; the
 * row's heart picks which shows, so the count follows a tap before the server answers.
 */
export function LikeCount(
	handle: Handle<{ item: Post | Reel; state: VisitorState; compactCount?: boolean }>,
) {
	return () => {
		let { compactCount = false, item, state } = handle.props;
		let liked = isLiked(state, item.id);
		let base = likeCount(state, item) - (liked ? 1 : 0);
		let format = (count: number) => (compactCount ? compact(count) : count.toLocaleString("en-US"));
		let word = (count: number) => {
			if (compactCount) return "";
			return count === 1 ? " like" : " likes";
		};
		return (
			<span
				mix={[
					raw({
						"& [data-count=on]": { display: "none" },
						"[data-pinhole-item]:has([data-like] form[data-pressed]) & [data-count=on]": {
							display: "inline",
						},
						"[data-pinhole-item]:has([data-like] form[data-pressed]) & [data-count=off]": {
							display: "none",
						},
					}),
				]}
			>
				<span data-count="off">
					{format(base)}
					{word(base)}
				</span>
				<span data-count="on">
					{format(base + 1)}
					{word(base + 1)}
				</span>
			</span>
		);
	};
}

namespace ShareButton {
	export interface Props {
		/** The page path being shared. */
		page: string;
		/** A unique id for the sheet. */
		id: string;
		onMedia?: boolean;
	}
}

/**
 * The paper plane: opens a small sheet with the post's address and a copy button. It opens and
 * closes on the Popover API, without script.
 */
export function ShareButton(handle: Handle<ShareButton.Props>) {
	return () => {
		let { id, onMedia = false, page } = handle.props;
		let link = `${SITE_URL}${href(page)}`;
		return (
			<>
				<button
					type="button"
					popovertarget={id}
					aria-label="Share"
					title="Share"
					mix={[actionButton(), onMedia ? raw({ color: "oklch(0.99 0 0)" }) : raw({})]}
				>
					<SendIcon size={24} strokeWidth={1.75} aria-hidden="true" />
				</button>
				<div
					id={id}
					popover="auto"
					aria-label="Share"
					mix={[
						raw({
							inlineSize: "min(22rem, calc(100vw - 2rem))",
							margin: "auto",
							padding: "1rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-lg)",
							backgroundColor: "var(--ui-bg)",
							color: "var(--ui-neutral-fg-emphasis)",
							boxShadow: "0 24px 60px -20px rgb(30 20 10 / 0.35)",
							"&::backdrop": { backgroundColor: "rgb(20 14 8 / 0.35)" },
						}),
					]}
				>
					<p mix={[raw({ margin: "0 0 0.5rem", fontWeight: "650" })]}>Share</p>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								paddingInlineStart: "0.75rem",
								borderRadius: "var(--ui-radius-md)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
							}),
						]}
					>
						<code
							id={`${id}-link`}
							mix={[
								raw({
									flex: "1 1 auto",
									minInlineSize: "0",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.8125rem",
									userSelect: "all",
								}),
							]}
						>
							{link}
						</code>
						<CopyButton target={`${id}-link`} label="Copy link" copiedLabel="Link copied" />
					</div>
				</div>
			</>
		);
	};
}

/** One comment as a line: the author's handle in bold, then the text. */
export function CommentLine(handle: Handle<{ comment: Comment }>) {
	return () => {
		let { comment } = handle.props;
		let author = findPerson(comment.author);
		return (
			<span>
				{author === undefined ? <strong>{comment.author}</strong> : <HandleLink person={author} />}{" "}
				{comment.text}
			</span>
		);
	};
}

namespace CommentForm {
	export interface Props {
		post: Post;
		back: string;
		/** The field's id, unique on the page. */
		id: string;
		/** Puts the field in focus when the page opens on it. */
		autofocus?: boolean;
	}
}

/** A one-line comment field with a Post button that only reads as active once text is typed. */
export function CommentForm(handle: Handle<CommentForm.Props>) {
	return () => {
		let { autofocus = false, back, id, post } = handle.props;
		return (
			<form
				method="post"
				action={actionHref(`p/${post.id}/comment`)}
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						"&:has(input:placeholder-shown) button": { opacity: "0.4", pointerEvents: "none" },
					}),
				]}
			>
				<input type="hidden" name="back" value={back} />

				<input
					id={id}
					name="text"
					aria-label="Add a comment"
					required
					maxlength={300}
					autocomplete="off"
					placeholder="Add a comment…"
					autofocus={autofocus}
					mix={[
						raw({
							flex: "1 1 auto",
							minInlineSize: "0",
							blockSize: "2.5rem",
							padding: "0",
							border: "0",
							background: "transparent",
							color: "inherit",
							font: "inherit",
							fontSize: "0.9375rem",
							outline: "none",
						}),
					]}
				/>
				<button
					type="submit"
					mix={[
						raw({
							padding: "0.25rem 0.5rem",
							border: "0",
							background: "transparent",
							color: "var(--ui-color-brand-600)",
							font: "inherit",
							fontWeight: "650",
							cursor: "pointer",
						}),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", borderRadius: "4px" }),
						),
					]}
				>
					Post
				</button>
			</form>
		);
	};
}

namespace PostCard {
	export interface Props {
		post: Post;
		state: VisitorState;
		/** The page the toggles return to without script. */
		back: string;
	}
}

/**
 * A post in the feed: header, media, the action row, likes, caption, a peek at the comments
 * and a comment field, separated from the next by a hairline.
 */
export function PostCard(handle: Handle<PostCard.Props>) {
	return () => {
		let { back, post, state } = handle.props;
		let author = findPerson(post.author)!;
		let comments = post.comments.length;
		let peek = post.comments.slice(-2);
		return (
			<article
				id={`post-${post.id}`}
				data-pinhole-item=""
				aria-labelledby={`post-${post.id}-by`}
				mix={[
					raw({
						display: "grid",
						gap: "0.5rem",
						paddingBlockEnd: "1.25rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				<header
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.625rem",
							paddingInline: "0.75rem",
							"@media (min-width: 30rem)": { paddingInline: "0" },
						}),
					]}
				>
					<Face person={author} size={2} />
					<div
						mix={[
							raw({
								display: "grid",
								minInlineSize: "0",
								lineHeight: "1.25",
								fontSize: "0.875rem",
							}),
						]}
					>
						<span
							id={`post-${post.id}-by`}
							mix={[raw({ display: "inline-flex", gap: "0.375rem", alignItems: "baseline" })]}
						>
							<HandleLink person={author} />
							<span aria-hidden="true" mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
								·
							</span>
							<a
								href={href(`p/${post.id}`)}
								data-rmx-prefetch="intent"
								mix={[quietLink(), raw({ color: "var(--ui-neutral-fg-muted)" })]}
							>
								<time>{shortAge(post.ago)}</time>
								<span mix={[srOnly()]}> ago, open post</span>
							</a>
						</span>
						{post.place === undefined ? null : (
							<span
								mix={[
									raw({
										fontSize: "0.8125rem",
										color: "var(--ui-neutral-fg)",
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}),
								]}
							>
								{post.place}
							</span>
						)}
					</div>
				</header>
				<div
					mix={[
						raw({
							"@media (min-width: 30rem)": {
								borderRadius: "var(--ui-radius-sm)",
								overflow: "hidden",
							},
						}),
					]}
				>
					<Media post={post} id={`feed-${post.id}`} />
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.375rem",
							paddingInline: "0.5rem",
							"@media (min-width: 30rem)": { paddingInline: "0" },
						}),
					]}
				>
					<ActionRow post={post} state={state} back={back} shareId={`share-${post.id}`} />
					<div
						mix={[
							raw({
								display: "grid",
								gap: "0.3125rem",
								paddingInline: "0.25rem",
								fontSize: "0.9375rem",
								lineHeight: "1.4",
							}),
						]}
					>
						<strong mix={[raw({ fontWeight: "650" })]}>
							<LikeCount item={post} state={state} />
						</strong>
						<p mix={[raw({ margin: "0" })]}>
							<HandleLink person={author} /> {post.caption}
						</p>
						{post.exposure === undefined ? null : (
							<p
								mix={[
									raw({
										margin: "0",
										fontFamily: "var(--ui-font-mono)",
										fontSize: "0.75rem",
										letterSpacing: "0.02em",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								{post.exposure}
							</p>
						)}
						{comments > 2 ? (
							<a
								href={href(`p/${post.id}`)}
								data-rmx-prefetch="intent"
								mix={[quietLink(), raw({ color: "var(--ui-neutral-fg-muted)" })]}
							>
								View all {comments} comments
							</a>
						) : null}
						{peek.map((comment) => (
							<p mix={[raw({ margin: "0" })]}>
								<CommentLine comment={comment} />
							</p>
						))}
						<CommentForm post={post} back={back} id={`comment-${post.id}`} />
					</div>
				</div>
			</article>
		);
	};
}

namespace ActionRow {
	export interface Props {
		post: Post;
		state: VisitorState;
		back: string;
		shareId: string;
	}
}

/** Like, comment, share, and save at the far end. */
export function ActionRow(handle: Handle<ActionRow.Props>) {
	return () => {
		let { back, post, shareId, state } = handle.props;
		return (
			<div
				role="group"
				aria-label="Post actions"
				mix={[raw({ display: "flex", alignItems: "center", marginInline: "-0.25rem" })]}
			>
				<LikeToggle id={post.id} kind="p" liked={isLiked(state, post.id)} back={back} />
				<a
					href={`${href(`p/${post.id}`)}#comment-field`}
					aria-label="Comment"
					title="Comment"
					mix={[actionButton()]}
				>
					<MessageCircleIcon size={24} strokeWidth={1.75} aria-hidden="true" />
				</a>
				<ShareButton page={`p/${post.id}`} id={shareId} />
				<span mix={[raw({ flex: "1 1 auto" })]} />
				<SaveToggle id={post.id} saved={isSaved(state, post.id)} back={back} />
			</div>
		);
	};
}

/** One tile in a photo grid: a post's first photo or a reel's scene, with its count on hover. */
export type Tile = { kind: "post"; post: Post } | { kind: "reel"; reel: Reel };

namespace PhotoGrid {
	export interface Props {
		tiles: Tile[];
		state: VisitorState;
		/** `mosaic` makes every reel tile two rows tall, the way Explore mixes them in. */
		layout?: "grid" | "mosaic";
		label: string;
	}
}

/**
 * Three columns of square tiles with a hairline gap, each a link to its post or reel; a reel
 * or a post of several photos marks its corner, and a pointer shows its likes and comments.
 */
export function PhotoGrid(handle: Handle<PhotoGrid.Props>) {
	return () => {
		let { label, layout = "grid", state, tiles } = handle.props;
		return (
			<ul
				aria-label={label}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
						gridAutoFlow: "dense",
						gap: "2px",
						margin: "0",
						padding: "0",
						listStyle: "none",
						"@media (min-width: 48rem)": { gap: "0.25rem" },
					}),
				]}
			>
				{tiles.map((tile) => {
					let tall = layout === "mosaic" && tile.kind === "reel";
					let target = tile.kind === "post" ? `p/${tile.post.id}` : `reels/${tile.reel.id}`;
					let photo = tile.kind === "post" ? tile.post.photos[0]! : tile.reel.scene;
					let likes =
						tile.kind === "post" ? likeCount(state, tile.post) : likeCount(state, tile.reel);
					let comments = tile.kind === "post" ? tile.post.comments.length : tile.reel.comments;
					let author = findPerson(tile.kind === "post" ? tile.post.author : tile.reel.author);
					let name =
						tile.kind === "post"
							? `Post by ${author?.name}: ${photo.alt}`
							: `Reel by ${author?.name}: ${tile.reel.caption}`;
					return (
						<li mix={[raw({ gridRow: tall ? "span 2" : "auto", minInlineSize: "0" })]}>
							<a
								href={href(target)}
								aria-label={name}
								data-rmx-prefetch="intent"
								mix={[
									raw({
										position: "relative",
										display: "block",
										blockSize: "100%",
										aspectRatio: tall ? "auto" : "1",
										overflow: "hidden",
										color: "oklch(0.99 0 0)",
										"& [data-grid-stats]": { opacity: "0" },
									}),
									when(
										"&:hover [data-grid-stats], &:focus-visible [data-grid-stats]",
										raw({ opacity: "1" }),
									),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
									),
								]}
							>
								<PhotoArt photo={photo} decorative />
								{tile.kind === "reel" || tile.post.photos.length > 1 ? (
									<span
										aria-hidden="true"
										mix={[
											raw({
												position: "absolute",
												insetBlockStart: "0.5rem",
												insetInlineEnd: "0.5rem",
												filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))",
											}),
										]}
									>
										{tile.kind === "reel" ? <FilmIcon size={18} /> : <LayersIcon size={18} />}
									</span>
								) : null}
								<span
									data-grid-stats=""
									aria-hidden="true"
									mix={[
										raw({
											position: "absolute",
											inset: "0",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											gap: "1.25rem",
											backgroundColor: "rgb(20 14 8 / 0.35)",
											fontWeight: "700",
											transition: "opacity 120ms ease",
											"& > span": { display: "inline-flex", alignItems: "center", gap: "0.375rem" },
										}),
									]}
								>
									<span>
										<HeartIcon size={18} fill="currentColor" strokeWidth={0} /> {compact(likes)}
									</span>
									<span>
										<MessageCircleIcon size={18} fill="currentColor" strokeWidth={0} />{" "}
										{compact(comments)}
									</span>
								</span>
							</a>
						</li>
					);
				})}
			</ul>
		);
	};
}

/** A section heading set small, the way the app labels a row of people or a grid. */
export function Eyebrow(handle: Handle<{ children: RemixNode; id?: string }>) {
	return () => (
		<h2
			id={handle.props.id}
			mix={[
				raw({
					margin: "0",
					fontSize: "0.9375rem",
					fontWeight: "650",
					color: "var(--ui-neutral-fg)",
				}),
			]}
		>
			{handle.props.children}
		</h2>
	);
}
