/**
 * Reels: a full-height vertical feed, one reel per screen, each a short clip over its drawn
 * moving scene with the author, caption and sound at its foot and the like, comments and share
 * column at its edge. Every reel has its own address; the page opens scrolled to it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	AudioLinesIcon,
	ChevronDownIcon,
	ChevronUpIcon,
	MessageCircleIcon,
	XIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { ReelFeed } from "@sdxc/ui/video/reel-feed";

import routes from "~/routes/web";

import type { Reel } from "./data";
import type { VisitorState } from "./state";

import { PersonAvatar, PhotoArt } from "./art";
import { PEOPLE, REELS, compact, findPerson, href, shortAge } from "./data";
import {
	FollowButton,
	HandleLink,
	LikeCount,
	LikeToggle,
	ShareButton,
	actionButton,
	srOnly,
} from "./parts";
import { ReelTitle } from "./reel-title";
import { PHONE_STAGE, TABLET } from "./shell";
import { isFollowing, isLiked } from "./state";

/** What people say under a reel; each reel shows four, picked by its place in the feed. */
const REPLIES = [
	"The light in this 🤍",
	"How long did this take?",
	"Watched it six times.",
	"Need a tutorial on exactly this",
	"The sound!!",
	"Okay this is my new favourite account",
	"Saving for later",
	"The colours are unreal",
] as const;

/** The title a reel's page and tab carry. */
export function reelTitle(reel: Reel): string {
	return `Reel by ${findPerson(reel.author)?.name ?? reel.author}`;
}

/** The clip a reel plays: one of the demo's transparent clips, in WebM and in MP4. */
function sourcesOf(reel: Reel): ReelFeed.Source[] {
	return [
		{ src: routes.demoMedia.href({ file: `video/vesper/${reel.clip}.webm` }), type: "video/webm" },
		{ src: routes.demoMedia.href({ file: `video/vesper/${reel.clip}.mp4` }), type: "video/mp4" },
	];
}

/** One figure in a reel's action column: an icon over its count, in white with a soft shadow. */
function ActionFigure(
	handle: Handle<{
		children: import("remix/component").RemixNode;
		count?: import("remix/component").RemixNode;
	}>,
) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					justifyItems: "center",
					gap: "0.125rem",
					fontSize: "0.75rem",
					fontWeight: "600",
					color: "oklch(0.99 0 0)",
					textShadow: "0 1px 2px rgb(0 0 0 / 0.5)",
					"& svg": { filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.45))" },
				}),
			]}
		>
			{handle.props.children}
			{handle.props.count === undefined ? null : <span>{handle.props.count}</span>}
		</div>
	);
}

/** A reel's comments in a sheet that opens on the Popover API. */
function CommentsSheet(handle: Handle<{ reel: Reel; index: number }>) {
	return () => {
		let { index, reel } = handle.props;
		let id = `reel-comments-${reel.id}`;
		let people = PEOPLE.filter((person) => person.handle !== reel.author);
		let lines = [0, 1, 2, 3].map((step) => ({
			person: people[(index * 3 + step * 2) % people.length]!,
			text: REPLIES[(index + step * 3) % REPLIES.length]!,
			ago: 30 + step * 47 + index * 11,
		}));
		return (
			<>
				<ActionFigure count={compact(reel.comments)}>
					<button
						type="button"
						popovertarget={id}
						aria-label={`Comments, ${reel.comments}`}
						mix={[actionButton(), raw({ color: "inherit" })]}
					>
						<MessageCircleIcon size={28} strokeWidth={1.75} aria-hidden="true" />
					</button>
				</ActionFigure>
				<div
					id={id}
					popover="auto"
					aria-label="Comments"
					mix={[
						raw({
							inlineSize: "min(26rem, calc(100vw - 1rem))",
							maxBlockSize: "70dvh",
							margin: "auto auto 0",
							"@supports (anchor-name: --reel)": {
								positionAnchor: `--reel-${reel.id}`,
								inset: "auto",
								insetInlineStart: "anchor(left)",
								insetInlineEnd: "anchor(right)",
								insetBlockEnd: "anchor(bottom)",
								inlineSize: "auto",
								maxBlockSize: "min(65dvh, 32rem)",
								margin: "0",
								"@media (min-width: 64rem)": {
									insetInlineStart: "calc(anchor(right) + 1rem)",
									insetInlineEnd: "1rem",
									insetBlockStart: "anchor(top)",
									insetBlockEnd: "anchor(bottom)",
									inlineSize: "auto",
									blockSize: "auto",
									maxInlineSize: "24rem",
									maxBlockSize: "none",
									borderRadius: "1rem",
								},
							},
							padding: "0",
							border: "0",
							borderStartStartRadius: "1rem",
							borderStartEndRadius: "1rem",
							backgroundColor: "var(--ui-bg)",
							color: "var(--ui-neutral-fg-emphasis)",
							boxShadow: "0 -20px 60px -20px rgb(0 0 0 / 0.5)",
							overflowY: "auto",
							"&::backdrop": { backgroundColor: "rgb(0 0 0 / 0.3)" },
							"@media (min-width: 64rem)": { "&::backdrop": { backgroundColor: "transparent" } },
						}),
					]}
				>
					<div
						mix={[
							raw({
								position: "sticky",
								insetBlockStart: "0",
								display: "grid",
								gridTemplateColumns: "2.5rem 1fr 2.5rem",
								alignItems: "center",
								paddingBlock: "0.375rem",
								paddingInline: "0.5rem",
								backgroundColor: "var(--ui-bg)",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<span />
						<p mix={[raw({ margin: "0", textAlign: "center", fontWeight: "650" })]}>Comments</p>
						<button
							type="button"
							popovertarget={id}
							popovertargetaction="hide"
							aria-label="Close comments"
							mix={[actionButton()]}
						>
							<XIcon size={20} aria-hidden="true" />
						</button>
					</div>
					<ul
						mix={[
							raw({
								display: "grid",
								gap: "1rem",
								margin: "0",
								padding: "1rem",
								listStyle: "none",
							}),
						]}
					>
						{lines.map((line) => (
							<li
								mix={[
									raw({ display: "flex", gap: "0.75rem", fontSize: "0.875rem", lineHeight: "1.4" }),
								]}
							>
								<PersonAvatar person={line.person} size={2} />
								<span>
									<HandleLink person={line.person} />{" "}
									<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.75rem" })]}>
										{shortAge(line.ago)}
									</span>
									<br />
									{line.text}
								</span>
							</li>
						))}
					</ul>
				</div>
			</>
		);
	};
}

namespace ReelOverlay {
	export interface Props {
		reel: Reel;
		index: number;
		state: VisitorState;
	}
}

/** What sits over a reel: the action column at its end, the author and caption at its foot. */
function ReelOverlay(handle: Handle<ReelOverlay.Props>) {
	return () => {
		let { index, reel, state } = handle.props;
		let author = findPerson(reel.author)!;
		let page = `reels/${reel.id}`;
		return (
			<div
				data-pinhole-item=""
				mix={[
					raw({
						position: "absolute",
						inset: "auto 0 0 0",
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr) auto",
						alignItems: "end",
						gap: "0.75rem",
						padding: "4rem 0.5rem 1.25rem 1rem",
						background: "linear-gradient(transparent, rgb(0 0 0 / 0.55))",
						color: "oklch(0.99 0 0)",
						pointerEvents: "none",
						"& a, & button, & form, & [popover]": { pointerEvents: "auto" },
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.625rem",
							minInlineSize: "0",
							textShadow: "0 1px 2px rgb(0 0 0 / 0.45)",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.625rem",
								fontSize: "0.9375rem",
								"& a": { color: "inherit" },
							}),
						]}
					>
						<PersonAvatar person={author} size={2} />
						<HandleLink person={author} />
						<FollowButton
							person={author}
							following={isFollowing(state, author)}
							back={page}
							look="overlay"
						/>
					</div>
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "0.875rem",
								lineHeight: "1.4",
								display: "-webkit-box",
								WebkitLineClamp: "2",
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
							}),
						]}
					>
						{reel.caption}
					</p>
					<p
						mix={[
							raw({
								margin: "0",
								display: "inline-flex",
								alignItems: "center",
								gap: "0.375rem",
								fontSize: "0.8125rem",
								opacity: "0.92",
							}),
						]}
					>
						<AudioLinesIcon size={14} aria-hidden="true" />
						<span
							mix={[raw({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })]}
						>
							{reel.sound}
						</span>
					</p>
				</div>
				<div
					role="group"
					aria-label="Reel actions"
					mix={[raw({ display: "grid", gap: "0.875rem", justifyItems: "center" })]}
				>
					<ActionFigure count={<LikeCount item={reel} state={state} compactCount />}>
						<LikeToggle
							id={reel.id}
							kind="reels"
							liked={isLiked(state, reel.id)}
							back={page}
							onMedia
						/>
					</ActionFigure>
					<CommentsSheet reel={reel} index={index} />
					<ActionFigure>
						<ShareButton page={page} id={`share-reel-${reel.id}`} onMedia />
					</ActionFigure>
				</div>
			</div>
		);
	};
}

/** An up or down arrow beside the feed on a pointer screen, a link to that reel that steps in place. */
function StepLink(handle: Handle<{ target: Reel | undefined; current: Reel; direction: -1 | 1 }>) {
	return () => {
		let { current, direction, target } = handle.props;
		let up = direction === -1;
		let label = up ? "Previous reel" : "Next reel";
		let mix = [
			raw({
				display: "grid",
				placeItems: "center",
				inlineSize: "2.75rem",
				blockSize: "2.75rem",
				borderRadius: "999px",
				backgroundColor: "rgb(255 255 255 / 0.12)",
				color: "oklch(0.98 0 0)",
				textDecoration: "none",
			}),
			when("&:hover", raw({ backgroundColor: "rgb(255 255 255 / 0.22)" })),
			when(
				"&:focus-visible",
				raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
			),
			when("&[aria-disabled]", raw({ opacity: "0.3", pointerEvents: "none" })),
		];
		let icon = up ? (
			<ChevronUpIcon size={22} aria-hidden="true" />
		) : (
			<ChevronDownIcon size={22} aria-hidden="true" />
		);
		return (
			<a
				href={href(`reels/${(target ?? current).id}`)}
				data-reel-step={String(direction)}
				aria-disabled={target === undefined ? "true" : undefined}
				aria-label={label}
				title={label}
				mix={mix}
			>
				{icon}
			</a>
		);
	};
}

namespace ReelsPage {
	export interface Props {
		state: VisitorState;
		/** The reel the page opens on. */
		current: Reel;
	}
}

/** The Reels screen. */
export default function ReelsPage(handle: Handle<ReelsPage.Props>) {
	return () => {
		let { current, state } = handle.props;
		let index = REELS.indexOf(current);
		return (
			<div
				class="dark"
				mix={[
					raw({
						"--ui-reel-feed-height": PHONE_STAGE,
						"--ui-reel-feed-radius": "0",
						position: "relative",
						backgroundColor: "oklch(0.13 0.008 60)",
						colorScheme: "dark",
						[`@media ${TABLET}`]: {
							"--ui-reel-feed-height": "100dvh",
							"--ui-reel-feed-radius": "0.625rem",
						},
					}),
				]}
			>
				<h1
					mix={[
						raw({
							position: "absolute",
							insetBlockStart: "0.75rem",
							insetInlineStart: "1rem",
							zIndex: "2",
							margin: "0",
							fontSize: "1.375rem",
							fontWeight: "700",
							color: "oklch(0.99 0 0)",
							textShadow: "0 1px 3px rgb(0 0 0 / 0.5)",
							pointerEvents: "none",
							[`@media ${TABLET}`]: srOnlyStyles(),
						}),
					]}
				>
					Reels
				</h1>
				<ReelFeed
					label="Reels"
					followAddress
					autoAdvance
					loop
					prefetchTarget="main"
					controls={
						<>
							<div
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "50%",
										insetInlineEnd: "1.5rem",
										translate: "0 -50%",
										display: "none",
										gap: "0.75rem",
										"@media (min-width: 64rem) and (hover: hover)": { display: "grid" },
									}),
								]}
							>
								<StepLink target={REELS[index - 1]} current={current} direction={-1} />
								<StepLink target={REELS[index + 1] ?? REELS[0]} current={current} direction={1} />
							</div>
							<ReelTitle />
						</>
					}
				>
					{REELS.map((reel, position) => (
						<ReelFeed.Item
							id={`reel-${reel.id}`}
							href={href(`reels/${reel.id}`)}
							label={reelTitle(reel)}
							data-title={reelTitle(reel)}
							offset={position - index}
							loopAt={reel.seconds}
							sources={sourcesOf(reel)}
							backdrop={<PhotoArt photo={reel.scene} decorative moving />}
							labels={{ pause: "Pause" }}
							mix={[raw({ [`@media ${TABLET}`]: { paddingBlock: "1rem" } })]}
						>
							<span
								aria-hidden="true"
								style={`position: absolute; inset: 0; pointer-events: none; anchor-name: --reel-${reel.id}`}
							/>
							<ReelOverlay reel={reel} index={position} state={state} />
						</ReelFeed.Item>
					))}
				</ReelFeed>
				<p mix={[srOnly()]}>Swipe or use the arrow keys to move between reels.</p>
			</div>
		);
	};
}

/** The visually hidden declarations, for a heading that only hides from a wide screen. */
function srOnlyStyles(): Record<string, string> {
	return {
		position: "absolute",
		inlineSize: "1px",
		blockSize: "1px",
		overflow: "hidden",
		clipPath: "inset(50%)",
		whiteSpace: "nowrap",
	};
}
