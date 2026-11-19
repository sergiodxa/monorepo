/**
 * A person's profile: their avatar, counts, bio and the one action that fits (Follow, or Share
 * on the visitor's own), a row of highlights that open in the story viewer, and tabs of posts,
 * reels, saved (the visitor's own) and tagged photos, each a grid. Also the Saved screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	ArrowLeftIcon,
	BookmarkIcon,
	ContactIcon,
	FilmIcon,
	Grid3x3Icon,
	MenuIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { HeadingScope, LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app";
import { StoryRing } from "@sdxc/ui/video/story-ring";

import type { Person } from "./data";
import type { VisitorState } from "./state";

import { PersonAvatar, PhotoArt } from "./art";
import {
	ME,
	POSTS,
	compact,
	findPost,
	highlightsOf,
	href,
	postsBy,
	postsTagging,
	reelsBy,
	storyOf,
} from "./data";
import { FollowButton, PhotoGrid, ShareButton, quietLink, srOnly } from "./parts";
import { MoreMenu, PHONE_MORE_MENU, PhoneBar, TABLET } from "./shell";
import { followerCount, isFollowing, savedPosts } from "./state";

/** The tabs a profile shows; Saved only on the visitor's own. */
export type ProfileTab = "posts" | "reels" | "saved" | "tagged";

/**
 * Reads the tab from the address, falling back to Posts for an unknown one or for Saved on
 * someone else's profile.
 *
 * @param value The `tab` parameter.
 * @param mine Whether the profile is the visitor's own.
 */
export function profileTab(value: string | null, mine: boolean): ProfileTab {
	if (value === "reels" || value === "tagged") return value;
	if (value === "saved" && mine) return "saved";
	return "posts";
}

/** One stat in the header: a bold number over, or beside, its word. */
function Stat(handle: Handle<{ value: string; label: string }>) {
	return () => (
		<li
			mix={[
				raw({
					display: "grid",
					justifyItems: "center",
					lineHeight: "1.2",
					fontSize: "0.875rem",
					color: "var(--ui-neutral-fg)",
					[`@media ${TABLET}`]: {
						display: "block",
						fontSize: "1rem",
						color: "var(--ui-neutral-fg-emphasis)",
					},
				}),
			]}
		>
			<strong
				mix={[
					raw({
						fontWeight: "650",
						color: "var(--ui-neutral-fg-emphasis)",
						fontVariantNumeric: "tabular-nums",
					}),
				]}
			>
				{handle.props.value}
			</strong>{" "}
			{handle.props.label}
		</li>
	);
}

/** The highlights row: each a quiet ring around its cover, its title under it. */
function Highlights(handle: Handle<{ person: Person }>) {
	return () => {
		let { person } = handle.props;
		let highlights = highlightsOf(person.handle);
		if (highlights.length === 0) return null;
		return (
			<nav aria-label="Highlights">
				<ul
					mix={[
						raw({
							"--pinhole-highlight": "4.25rem",
							display: "flex",
							gap: "1rem",
							margin: "0",
							paddingBlock: "0.5rem",
							paddingInline: "1rem",
							listStyle: "none",
							overflowX: "auto",
							scrollbarWidth: "none",
							[`@media ${TABLET}`]: {
								"--pinhole-highlight": "5.25rem",
								gap: "2.5rem",
								paddingInline: "2rem",
							},
						}),
					]}
				>
					{highlights.map((highlight) => (
						<li mix={[raw({ flexShrink: "0" })]}>
							<a
								href={href(`highlights/${person.handle}/${highlight.id}/1`)}
								mix={[
									raw({
										display: "grid",
										justifyItems: "center",
										gap: "0.375rem",
										inlineSize: "4.5rem",
										color: "var(--ui-neutral-fg-emphasis)",
										textDecoration: "none",
										fontSize: "0.75rem",
										fontWeight: "600",
										[`@media ${TABLET}`]: { inlineSize: "5.5rem" },
									}),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", borderRadius: "0.5rem" }),
									),
								]}
							>
								<StoryRing seen size="var(--pinhole-highlight)">
									<span>
										<PhotoArt photo={highlight.cover} decorative />
									</span>
								</StoryRing>
								{highlight.title}
							</a>
						</li>
					))}
				</ul>
			</nav>
		);
	};
}

/** A tab link with its icon, underlined in ink when current. */
function TabLink(
	handle: Handle<{ href: string; current: boolean; icon: RemixNode; children: RemixNode }>,
) {
	return () => {
		let { children, current, icon } = handle.props;
		return (
			<a
				href={handle.props.href}
				aria-current={current ? "page" : undefined}
				data-rmx-prefetch="intent"
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						justifyContent: "center",
						gap: "0.375rem",
						flex: "1 1 0",
						blockSize: "3rem",
						marginBlockStart: "-1px",
						borderBlockStart: "1px solid transparent",
						color: "var(--ui-neutral-fg-muted)",
						textDecoration: "none",
						fontSize: "0.75rem",
						fontWeight: "650",
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						"& > [data-tab-word]": { display: "none" },
						[`@media ${TABLET}`]: {
							flex: "0 0 auto",
							"& > [data-tab-word]": { display: "inline" },
						},
					}),
					when(
						"&[aria-current='page']",
						raw({
							color: "var(--ui-neutral-fg-emphasis)",
							borderBlockStartColor: "var(--ui-neutral-fg-emphasis)",
						}),
					),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
					),
				]}
			>
				{icon}
				<span data-tab-word="">{children}</span>
				<span mix={[srOnly()]} data-tab-sr="">
					{children}
				</span>
			</a>
		);
	};
}

namespace ProfilePage {
	export interface Props {
		person: Person;
		state: VisitorState;
		tab: ProfileTab;
	}
}

/** The profile screen. */
export default function ProfilePage(handle: Handle<ProfilePage.Props>) {
	return () => {
		let { person, state, tab } = handle.props;
		let mine = person.handle === ME.handle;
		let posts = postsBy(person.handle);
		let story = storyOf(person.handle);
		let page = `u/${person.handle}`;
		let back = tab === "posts" ? page : `${page}?tab=${tab}`;
		let tabHref = (name: ProfileTab) => href(name === "posts" ? page : `${page}?tab=${name}`);
		return (
			<>
				<PhoneBar
					start={
						<>
							{mine ? null : (
								<a
									href={href()}
									aria-label="Back to home"
									mix={[
										raw({
											display: "inline-grid",
											placeItems: "center",
											inlineSize: "2.25rem",
											blockSize: "2.25rem",
											marginInlineStart: "-0.5rem",
											color: "inherit",
										}),
									]}
								>
									<ArrowLeftIcon size={22} aria-hidden="true" />
								</a>
							)}
							<span mix={[raw({ fontWeight: "700", fontSize: "1.0625rem" })]}>{person.handle}</span>
						</>
					}
					end={
						mine ? (
							<>
								<button
									type="button"
									commandfor={PHONE_MORE_MENU}
									command="toggle-popover"
									aria-haspopup="menu"
									aria-label="More"
									mix={[
										raw({
											display: "inline-grid",
											placeItems: "center",
											inlineSize: "2.75rem",
											blockSize: "2.75rem",
											border: "0",
											borderRadius: "999px",
											background: "transparent",
											color: "inherit",
										}),
									]}
								>
									<MenuIcon size={24} aria-hidden="true" />
								</button>
								<MoreMenu id={PHONE_MORE_MENU} placement="bottom-end" />
							</>
						) : undefined
					}
				/>
				<div
					mix={[
						raw({
							inlineSize: "100%",
							maxInlineSize: "58rem",
							marginInline: "auto",
							boxSizing: "border-box",
							paddingBlockEnd: "2rem",
							[`@media ${TABLET}`]: { paddingInline: "1.5rem", paddingBlockStart: "2.5rem" },
						}),
					]}
				>
					<header
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "auto minmax(0, 1fr)",
								gridTemplateAreas: '"avatar stats" "bio bio" "action action"',
								alignItems: "center",
								gap: "1rem 1.5rem",
								padding: "1rem",
								[`@media ${TABLET}`]: {
									gridTemplateColumns: "12rem minmax(0, 1fr)",
									gridTemplateAreas: '"avatar name" "avatar stats" "avatar bio"',
									alignItems: "start",
									rowGap: "1.25rem",
									paddingBlockEnd: "2rem",
								},
							}),
						]}
					>
						<div
							mix={[
								raw({
									"--pinhole-ring": "5.75rem",
									"--pinhole-avatar":
										story === undefined
											? "var(--pinhole-ring)"
											: "calc(var(--pinhole-ring) * 0.9 - 2px)",
									gridArea: "avatar",
									display: "grid",
									placeItems: "center",
									[`@media ${TABLET}`]: { "--pinhole-ring": "10.25rem" },
								}),
							]}
						>
							{story === undefined ? (
								<PersonAvatar person={person} size="var(--pinhole-avatar)" />
							) : (
								<a
									href={href(`stories/${person.handle}/1`)}
									aria-label={`${person.name}'s story`}
									mix={[raw({ borderRadius: "999px" })]}
								>
									<StoryRing seen={story.seen} size="var(--pinhole-ring)">
										<PersonAvatar person={person} size="var(--pinhole-avatar)" />
									</StoryRing>
								</a>
							)}
						</div>
						<div
							mix={[
								raw({
									gridArea: "action",
									display: "flex",
									flexWrap: "wrap",
									alignItems: "center",
									gap: "0.75rem 1rem",
									[`@media ${TABLET}`]: { gridArea: "name" },
								}),
							]}
						>
							<h1
								mix={[
									srOnly(),
									raw({
										margin: "0",
										fontSize: "1.25rem",
										fontWeight: "500",
										[`@media ${TABLET}`]: {
											position: "static",
											inlineSize: "auto",
											blockSize: "auto",
											overflow: "visible",
											clipPath: "none",
										},
									}),
								]}
							>
								{person.handle}
							</h1>
							<div
								mix={[
									raw({
										display: "flex",
										gap: "0.5rem",
										flex: "1 1 auto",
										[`@media ${TABLET}`]: { flex: "0 0 auto" },
										"& > *": { flex: "1 1 0" },
									}),
								]}
							>
								{mine ? (
									<LinkButton href={href("saved")} variant="surface" size="sm">
										Saved posts
									</LinkButton>
								) : (
									<FollowButton
										person={person}
										following={isFollowing(state, person)}
										back={back}
									/>
								)}
								<span mix={[raw({ flex: "0 0 auto !important" })]}>
									<ShareButton page={page} id={`share-profile-${person.handle}`} />
								</span>
							</div>
						</div>
						<ul
							aria-label="Counts"
							mix={[
								raw({
									gridArea: "stats",
									display: "flex",
									justifyContent: "space-around",
									gap: "2.5rem",
									margin: "0",
									padding: "0",
									listStyle: "none",
									[`@media ${TABLET}`]: { justifyContent: "start" },
								}),
							]}
						>
							<Stat value={compact(posts.length)} label={posts.length === 1 ? "post" : "posts"} />
							<Stat value={compact(followerCount(state, person))} label="followers" />
							<Stat value={compact(person.following)} label="following" />
						</ul>
						<div
							mix={[
								raw({
									gridArea: "bio",
									display: "grid",
									gap: "0.125rem",
									fontSize: "0.9375rem",
									lineHeight: "1.45",
								}),
							]}
						>
							<strong mix={[raw({ fontWeight: "650" })]}>{person.name}</strong>
							<p mix={[raw({ margin: "0", whiteSpace: "pre-line" })]}>{person.bio}</p>
							{person.link === undefined ? null : (
								<span
									mix={[
										raw({
											color: "var(--ui-color-brand-700)",
											fontWeight: "600",
											fontFamily: "var(--ui-font-mono)",
											fontSize: "0.8125rem",
										}),
									]}
								>
									{person.link}
								</span>
							)}
						</div>
					</header>
					<Highlights person={person} />
					<nav
						aria-label="Profile sections"
						mix={[
							raw({
								display: "flex",
								justifyContent: "center",
								gap: "3.5rem",
								marginBlockStart: "1rem",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<TabLink
							href={tabHref("posts")}
							current={tab === "posts"}
							icon={<Grid3x3Icon size={16} aria-hidden="true" />}
						>
							Posts
						</TabLink>
						<TabLink
							href={tabHref("reels")}
							current={tab === "reels"}
							icon={<FilmIcon size={16} aria-hidden="true" />}
						>
							Reels
						</TabLink>
						{mine ? (
							<TabLink
								href={tabHref("saved")}
								current={tab === "saved"}
								icon={<BookmarkIcon size={16} aria-hidden="true" />}
							>
								Saved
							</TabLink>
						) : null}
						<TabLink
							href={tabHref("tagged")}
							current={tab === "tagged"}
							icon={<ContactIcon size={16} aria-hidden="true" />}
						>
							Tagged
						</TabLink>
					</nav>
					<ProfileGrid person={person} state={state} tab={tab} />
				</div>
			</>
		);
	};
}

/** The grid a profile tab shows, or the empty state its cause calls for. */
function ProfileGrid(handle: Handle<ProfilePage.Props>) {
	return () => {
		let { person, state, tab } = handle.props;
		let mine = person.handle === ME.handle;
		if (tab === "reels") {
			let reels = reelsBy(person.handle);
			if (reels.length === 0) {
				return (
					<Nothing title="No reels yet">
						{mine
							? "Reels you share show up here."
							: `When ${person.name} shares a reel, it shows up here.`}
					</Nothing>
				);
			}
			return (
				<PhotoGrid
					tiles={reels.map((reel) => ({ kind: "reel", reel }))}
					state={state}
					label="Reels"
				/>
			);
		}
		if (tab === "saved") return <SavedGrid state={state} />;
		let posts = tab === "tagged" ? postsTagging(person.handle) : postsBy(person.handle);
		if (posts.length === 0) {
			return (
				<Nothing title={tab === "tagged" ? "No photos of them yet" : "No posts yet"}>
					{tab === "tagged"
						? `Photos ${person.name} is tagged in show up here.`
						: "Photos they share show up here."}
				</Nothing>
			);
		}
		return (
			<PhotoGrid
				tiles={posts.map((post) => ({ kind: "post", post }))}
				state={state}
				label={tab === "tagged" ? "Tagged" : "Posts"}
			/>
		);
	};
}

/** The visitor's saved posts as a grid, or why it is empty. */
function SavedGrid(handle: Handle<{ state: VisitorState }>) {
	return () => {
		let { state } = handle.props;
		let saved = new Set(savedPosts(state));
		let posts = POSTS.filter((post) => saved.has(post.id));
		if (posts.length === 0) {
			return (
				<Nothing
					title="Save what you want to see again"
					action={
						<LinkButton href={href("explore")} size="sm">
							Explore posts
						</LinkButton>
					}
				>
					Tap the bookmark under any post to save it here. Only you can see what you saved.
				</Nothing>
			);
		}
		return (
			<PhotoGrid
				tiles={posts.map((post) => ({ kind: "post", post }))}
				state={state}
				label="Saved posts"
			/>
		);
	};
}

/** A quiet empty state under a grid's tabs. */
function Nothing(handle: Handle<{ title: string; children: RemixNode; action?: RemixNode }>) {
	return () => (
		<div mix={[raw({ paddingBlock: "3rem", paddingInline: "1rem" })]}>
			<HeadingScope level={2}>
				<Empty kind="first-run" size="compact">
					<Empty.Title>{handle.props.title}</Empty.Title>
					<Empty.Description>{handle.props.children}</Empty.Description>
					{handle.props.action === undefined ? null : (
						<Empty.Action>{handle.props.action}</Empty.Action>
					)}
				</Empty>
			</HeadingScope>
		</div>
	);
}

/** The Saved screen: the visitor's collection on its own. */
export function SavedPage(handle: Handle<{ state: VisitorState }>) {
	return () => {
		let { state } = handle.props;
		let count = savedPosts(state).filter((id) => findPost(id) !== undefined).length;
		return (
			<>
				<PhoneBar
					start={<span mix={[raw({ fontWeight: "700", fontSize: "1.0625rem" })]}>Saved</span>}
				/>
				<div
					mix={[
						raw({
							inlineSize: "100%",
							maxInlineSize: "58rem",
							marginInline: "auto",
							boxSizing: "border-box",
							paddingBlockEnd: "2rem",
							[`@media ${TABLET}`]: { paddingInline: "1.5rem", paddingBlockStart: "2.5rem" },
						}),
					]}
				>
					<header
						mix={[
							raw({
								display: "flex",
								alignItems: "baseline",
								justifyContent: "space-between",
								gap: "1rem",
								padding: "1rem",
							}),
						]}
					>
						<h1
							mix={[
								raw({
									margin: "0",
									fontSize: "1.5rem",
									fontFamily: "var(--pinhole-display)",
									fontWeight: "600",
								}),
							]}
						>
							Saved
						</h1>
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{count === 1 ? "1 post" : `${count} posts`} · only you can see this
						</span>
					</header>
					<SavedGrid state={state} />
					<p
						mix={[
							raw({
								margin: "1.5rem 1rem 0",
								fontSize: "0.8125rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						Saved posts also live on{" "}
						<a
							href={href(`u/${ME.handle}?tab=saved`)}
							mix={[quietLink(), raw({ fontWeight: "600" })]}
						>
							your profile
						</a>
						.
					</p>
				</div>
			</>
		);
	};
}
