/**
 * Pinhole's home: the story tray across the top, the posts of the people the visitor follows
 * until they are all caught up, then suggested posts; on a wide screen, the visitor's own row
 * and people to follow sit beside the feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CircleCheckIcon, MenuIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { StoryRing } from "@sdxc/ui/video/story-ring";

import type { VisitorState } from "./state";

import { PersonAvatar, PinholeMark } from "./art";
import { ME, PEOPLE, POSTS, STORIES, findPerson, href } from "./data";
import { Eyebrow, FollowButton, HandleLink, PostCard, quietLink, srOnly } from "./parts";
import { DESKTOP, MoreMenu, PHONE_MORE_MENU, PhoneBar, Wordmark } from "./shell";
import { isFollowing } from "./state";

/**
 * The tray of today's stories, unseen first, each a ring over the person's avatar and their
 * handle, scrolling sideways on native snap.
 */
function StoryTray() {
	return () => (
		<nav aria-label="Stories">
			<ul
				mix={[
					raw({
						display: "flex",
						gap: "0.875rem",
						margin: "0",
						paddingBlock: "1rem 0.75rem",
						paddingInline: "1rem",
						listStyle: "none",
						overflowX: "auto",
						scrollSnapType: "x proximity",
						scrollPaddingInline: "1rem",
						scrollbarWidth: "none",
						"&::-webkit-scrollbar": { display: "none" },
						"@media (min-width: 30rem)": { paddingInline: "0", scrollPaddingInline: "0" },
					}),
				]}
			>
				{[...STORIES]
					.sort((a, b) => Number(a.seen) - Number(b.seen))
					.map((story) => {
						let person = findPerson(story.author)!;
						return (
							<li mix={[raw({ flexShrink: "0", scrollSnapAlign: "start" })]}>
								<a
									href={href(`stories/${person.handle}/1`)}
									aria-label={`${person.name}'s story${story.seen ? ", seen" : ""}`}
									mix={[
										raw({
											display: "grid",
											justifyItems: "center",
											gap: "0.375rem",
											inlineSize: "4.5rem",
											color: "var(--ui-neutral-fg-emphasis)",
											textDecoration: "none",
											fontSize: "0.75rem",
										}),
										when(
											"&:focus-visible",
											raw({ outline: "2px solid var(--ui-brand-ring)", borderRadius: "0.5rem" }),
										),
										when("&:active [data-slot=story-ring]", raw({ transform: "scale(0.94)" })),
									]}
								>
									<StoryRing seen={story.seen} size={4}>
										<PersonAvatar person={person} size={3.5} />
									</StoryRing>
									<span
										aria-hidden="true"
										mix={[
											raw({
												maxInlineSize: "100%",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
												color: story.seen ? "var(--ui-neutral-fg-muted)" : "inherit",
											}),
										]}
									>
										{person.handle}
									</span>
								</a>
							</li>
						);
					})}
			</ul>
		</nav>
	);
}

/** The marker where the followed posts end: a check and a line saying so. */
function CaughtUp() {
	return () => (
		<div
			role="status"
			mix={[
				raw({
					display: "grid",
					justifyItems: "center",
					gap: "0.375rem",
					paddingBlock: "2.5rem",
					textAlign: "center",
				}),
			]}
		>
			<CircleCheckIcon
				size={44}
				strokeWidth={1.25}
				aria-hidden="true"
				mix={[raw({ color: "var(--ui-color-brand-500)" })]}
			/>
			<p mix={[raw({ margin: "0", fontSize: "1.0625rem", fontWeight: "650" })]}>
				You're all caught up
			</p>
			<p mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
				You've seen every new post from the people you follow.
			</p>
		</div>
	);
}

/** The column beside the feed on a wide screen: the visitor's row, people to follow, the small print. */
function Aside(handle: Handle<{ state: VisitorState }>) {
	return () => {
		let { state } = handle.props;
		let suggested = PEOPLE.filter(
			(person) => person.handle !== ME.handle && !person.followed,
		).slice(0, 4);
		return (
			<aside
				aria-label="Suggestions"
				mix={[
					raw({
						display: "none",
						alignContent: "start",
						gap: "1.25rem",
						paddingBlockStart: "2rem",
						fontSize: "0.875rem",
						[`@media ${DESKTOP}`]: { display: "grid" },
					}),
				]}
			>
				<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem" })]}>
					<a href={href(`u/${ME.handle}`)} aria-hidden="true" tabindex={-1}>
						<PersonAvatar person={ME} size={2.75} />
					</a>
					<div mix={[raw({ display: "grid", lineHeight: "1.3", minInlineSize: "0" })]}>
						<HandleLink person={ME} />
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{ME.name}</span>
					</div>
				</div>
				<section
					aria-labelledby="pinhole-suggested"
					mix={[raw({ display: "grid", gap: "0.75rem" })]}
				>
					<Eyebrow id="pinhole-suggested">Suggested for you</Eyebrow>
					<ul
						mix={[
							raw({
								display: "grid",
								gap: "0.75rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
						]}
					>
						{suggested.map((person) => (
							<li mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem" })]}>
								<a href={href(`u/${person.handle}`)} aria-hidden="true" tabindex={-1}>
									<PersonAvatar person={person} size={2.25} />
								</a>
								<div
									mix={[
										raw({
											display: "grid",
											lineHeight: "1.3",
											minInlineSize: "0",
											flex: "1 1 auto",
										}),
									]}
								>
									<HandleLink person={person} />
									<span
										mix={[
											raw({
												color: "var(--ui-neutral-fg-muted)",
												fontSize: "0.8125rem",
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
											}),
										]}
									>
										{person.bio}
									</span>
								</div>
								<FollowButton
									person={person}
									following={isFollowing(state, person)}
									back=""
									look="link"
								/>
							</li>
						))}
					</ul>
				</section>
				<p
					mix={[
						raw({
							margin: "0",
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
							lineHeight: "1.6",
						}),
					]}
				>
					Pinhole is an invented app, a demo built with{" "}
					<a href="/" mix={[quietLink()]}>
						sdxc
					</a>
					. Every person and picture is made up.
				</p>
			</aside>
		);
	};
}

/** The home screen. */
export default function Home(handle: Handle<{ state: VisitorState }>) {
	return () => {
		let { state } = handle.props;
		let followed = POSTS.filter((post) => {
			let author = findPerson(post.author)!;
			return author.handle === ME.handle || isFollowing(state, author);
		});
		let suggested = POSTS.filter((post) => !followed.includes(post));
		return (
			<>
				<PhoneBar
					start={
						<a
							href={href()}
							aria-label="Pinhole home"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									color: "inherit",
									textDecoration: "none",
								}),
							]}
						>
							<PinholeMark size={24} />
							<span mix={[raw({ "& [data-rail-label]": { display: "inline" } })]}>
								<Wordmark />
							</span>
						</a>
					}
					end={
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
					}
				/>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 30rem)",
							justifyContent: "center",
							columnGap: "4rem",
							paddingBlockEnd: "2rem",
							[`@media ${DESKTOP}`]: { gridTemplateColumns: "minmax(0, 30rem) 20rem" },
						}),
					]}
				>
					<div mix={[raw({ minInlineSize: "0" })]}>
						<h1 mix={[srOnly()]}>Home</h1>
						<StoryTray />
						<section
							aria-label="Feed"
							mix={[raw({ display: "grid", gap: "1.25rem", paddingBlockStart: "0.5rem" })]}
						>
							{followed.map((post) => (
								<PostCard post={post} state={state} back="" />
							))}
						</section>
						<CaughtUp />
						{suggested.length === 0 ? null : (
							<section
								aria-labelledby="pinhole-suggested-posts"
								mix={[raw({ display: "grid", gap: "1.25rem" })]}
							>
								<div
									mix={[
										raw({
											paddingInline: "0.75rem",
											"@media (min-width: 30rem)": { paddingInline: "0" },
										}),
									]}
								>
									<Eyebrow id="pinhole-suggested-posts">Suggested posts</Eyebrow>
								</div>
								{suggested.map((post) => (
									<PostCard post={post} state={state} back="" />
								))}
							</section>
						)}
					</div>
					<Aside state={state} />
				</div>
			</>
		);
	};
}
