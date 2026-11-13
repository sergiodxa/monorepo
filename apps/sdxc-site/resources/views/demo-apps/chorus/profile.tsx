/**
 * A Chorus profile: the banner and avatar, name, bio and the facts under it, follower
 * counts, and the Posts, Replies, Media and Likes tabs, each its own address. Noor's own
 * profile counts what the visitor posted and liked; likes are private to their owner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	CalendarIcon,
	HeartIcon,
	ImageIcon,
	LinkIcon,
	LockIcon,
	MapPinIcon,
	MessageCircleIcon,
} from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

import type { Person } from "~/resources/views/demo-apps/chorus/data";
import type { FeedItem } from "~/resources/views/demo-apps/chorus/feed";
import type { PostView, VisitorState } from "~/resources/views/demo-apps/chorus/state";

import { ARRIVED_POSTS, FOR_YOU, ME, POSTS, href } from "~/resources/views/demo-apps/chorus/data";
import {
	Feed,
	FeedTabs,
	TitleBar,
	postById,
	repliedPerson,
} from "~/resources/views/demo-apps/chorus/feed";
import { PersonAvatar, SceneArt, compact } from "~/resources/views/demo-apps/chorus/parts";
import { FollowButton, FollowsYou } from "~/resources/views/demo-apps/chorus/rail";
import { ChorusColumn, TABLET } from "~/resources/views/demo-apps/chorus/shell";
import { followerCount, followingCount, isOn } from "~/resources/views/demo-apps/chorus/state";

/** A profile's tabs, in order; `posts` is the profile's own address. */
export const PROFILE_TABS = ["posts", "replies", "media", "likes"] as const;

/** One profile tab. */
export type ProfileTab = (typeof PROFILE_TABS)[number];

/** Every post a person wrote that the visitor can see, newest first. */
function postsBy(person: Person, state: VisitorState): PostView[] {
	let ids = [...POSTS, ...ARRIVED_POSTS]
		.filter((post) => post.author === person.handle)
		.map((post) => post.id);
	if (person.handle === ME.handle) ids.push(...state.posts.map((post) => post.id));
	return ids
		.flatMap((id) => postById(id, state) ?? [])
		.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * The items a profile tab lists.
 *
 * @param person Whose profile.
 * @param tab The tab.
 * @param state The visitor's state.
 * @returns The tab's feed, newest first; reposts sit at the top of Posts.
 */
export function profileItems(person: Person, tab: ProfileTab, state: VisitorState): FeedItem[] {
	let own = postsBy(person, state);
	if (tab === "replies") {
		return own
			.filter((post) => post.replyTo !== undefined)
			.map((post) => ({ post, replyingTo: repliedPerson(post, state) }));
	}
	if (tab === "media")
		return own.filter((post) => (post.pictures?.length ?? 0) > 0).map((post) => ({ post }));
	if (tab === "likes") {
		return [...POSTS, ...ARRIVED_POSTS]
			.flatMap((post) => postById(post.id, state) ?? [])
			.filter((post) => isOn(state, "like", post.id, post.liked ?? false))
			.map((post) => ({ post }));
	}
	let reposts: FeedItem[] =
		person.handle === ME.handle
			? [...POSTS, ...ARRIVED_POSTS]
					.flatMap((post) => postById(post.id, state) ?? [])
					.filter((post) => post.reposted)
					.map((post) => ({ post, repostedBy: ME }))
			: FOR_YOU.filter((entry) => entry.repostedBy === person.handle).flatMap((entry) => {
					let post = postById(entry.post, state);
					return post ? [{ post, repostedBy: person }] : [];
				});
	return [
		...reposts,
		...own.filter((post) => post.replyTo === undefined).map((post) => ({ post })),
	];
}

/** The banner: a soft field in the person's hue with the scene that suits them faintly over it. */
function Banner(handle: Handle<{ person: Person }>) {
	return () => {
		let { person } = handle.props;
		return (
			<div
				style={`--chorus-hue: ${person.hue}`}
				mix={[
					raw({
						position: "relative",
						aspectRatio: "3 / 1",
						overflow: "hidden",
						background:
							"linear-gradient(120deg, oklch(0.78 0.11 var(--chorus-hue)), oklch(0.62 0.14 calc(var(--chorus-hue) + 40)))",
						"& > svg": { opacity: "0.35", mixBlendMode: "soft-light" },
					}),
				]}
			>
				<SceneArt scene={person.handle === ME.handle ? "forest" : "dunes"} />
			</div>
		);
	};
}

namespace ProfileScreen {
	export interface Props {
		person: Person;
		tab: ProfileTab;
		state: VisitorState;
		now: number;
	}
}

/** Renders a profile with one of its tabs open. */
export function ProfileScreen(handle: Handle<ProfileScreen.Props>) {
	return () => {
		let { now, person, state, tab } = handle.props;
		let mine = person.handle === ME.handle;
		let items = profileItems(person, tab, state);
		let base = `u/${person.handle}`;
		let page = tab === "posts" ? base : `${base}/${tab}`;
		let count = postsBy(person, state).length;
		let following = mine ? followingCount(state) : person.following;

		return (
			<ChorusColumn
				current={mine ? "profile" : "none"}
				header={
					<TitleBar
						title={person.name}
						subtitle={`${count.toLocaleString("en")} posts`}
						back={href()}
					/>
				}
			>
				<Banner person={person} />
				<div mix={[raw({ display: "grid", gap: "0.75rem", padding: "0.75rem 1rem 0" })]}>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "flex-start",
								justifyContent: "space-between",
								gap: "1rem",
								minBlockSize: "3rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									position: "relative",
									zIndex: "1",
									display: "inline-flex",
									marginBlockStart: "calc(-1 * (0.75rem + 2.75rem))",
									borderRadius: person.org ? "28%" : "999px",
									boxShadow: "0 0 0 4px var(--ui-bg)",
									"--chorus-avatar": "5.5rem",
									[`@media ${TABLET}`]: {
										marginBlockStart: "calc(-1 * (0.75rem + 4rem))",
										"--chorus-avatar": "8rem",
									},
								}),
							]}
						>
							<PersonAvatar person={person} />
						</span>
						{mine ? (
							<LinkButton
								href={href("compose")}
								variant="outline"
								color="neutral"
								size="sm"
								mix={[raw({ "--ui-button-radius": "999px", fontWeight: "700" })]}
							>
								New post
							</LinkButton>
						) : (
							<span mix={[raw({ display: "inline-flex", gap: "0.5rem", alignItems: "center" })]}>
								<LinkButton
									href={href(`messages/${person.handle}`)}
									variant="outline"
									color="neutral"
									size="sm"
									aria-label={`Message ${person.name}`}
									mix={[raw({ "--ui-button-radius": "999px" })]}
								>
									<MessageCircleIcon size={16} aria-hidden="true" />
								</LinkButton>
								<FollowButton person={person} state={state} returnTo={page} />
							</span>
						)}
					</div>
					<div mix={[raw({ display: "grid" })]}>
						<h2
							mix={[
								raw({ margin: "0", fontSize: "1.25rem", fontWeight: "800", lineHeight: "1.4" }),
							]}
						>
							{person.name}
						</h2>
						<span
							mix={[
								raw({
									display: "flex",
									gap: "0.375rem",
									alignItems: "center",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							@{person.handle}
							{person.followsYou ? <FollowsYou /> : null}
						</span>
					</div>
					<p mix={[raw({ margin: "0", lineHeight: "1.45", textWrap: "pretty" })]}>{person.bio}</p>
					<ul
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.25rem 1rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
								fontSize: "0.9375rem",
								color: "var(--ui-neutral-fg-muted)",
								"& > li": { display: "inline-flex", alignItems: "center", gap: "0.25rem" },
							}),
						]}
					>
						{person.location ? (
							<li>
								<MapPinIcon size={16} aria-hidden="true" />
								{person.location}
							</li>
						) : null}
						{person.site ? (
							<li>
								<LinkIcon size={16} aria-hidden="true" />
								<a
									href={`https://${person.site}`}
									rel="noopener me"
									mix={[raw({ color: "var(--ui-brand-fg)", textDecoration: "none" })]}
								>
									{person.site}
								</a>
							</li>
						) : null}
						<li>
							<CalendarIcon size={16} aria-hidden="true" />
							Joined {person.joined}
						</li>
					</ul>
					<p
						mix={[
							raw({
								display: "flex",
								gap: "1.25rem",
								margin: "0",
								fontSize: "0.9375rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<span>
							<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
								{compact(following)}
							</strong>{" "}
							Following
						</span>
						<span>
							<strong mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>
								{compact(mine ? ME.followers : followerCount(state, person))}
							</strong>{" "}
							Followers
						</span>
					</p>
				</div>
				<div
					mix={[
						raw({
							marginBlockStart: "0.5rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<FeedTabs
						label={`${person.name}'s profile`}
						keepScroll
						tabs={PROFILE_TABS.map((entry) => ({
							label: entry[0]!.toUpperCase() + entry.slice(1),
							href: href(entry === "posts" ? base : `${base}/${entry}`),
							current: entry === tab,
						}))}
					/>
				</div>
				<ProfileTabBody
					person={person}
					tab={tab}
					items={items}
					state={state}
					now={now}
					page={page}
				/>
			</ChorusColumn>
		);
	};
}

namespace ProfileTabBody {
	export interface Props {
		person: Person;
		tab: ProfileTab;
		items: FeedItem[];
		state: VisitorState;
		now: number;
		page: string;
	}
}

/** One tab's body: the feed, the media grid, or the empty state its cause calls for. */
function ProfileTabBody(handle: Handle<ProfileTabBody.Props>) {
	return () => {
		let { items, now, page, person, state, tab } = handle.props;
		let mine = person.handle === ME.handle;
		if (tab === "likes" && !mine) {
			return (
				<Empty kind="permission" icon={<LockIcon />}>
					<Empty.Title>Likes are private</Empty.Title>
					<Empty.Description>Only {person.name} can see the posts they liked.</Empty.Description>
				</Empty>
			);
		}
		if (items.length === 0) {
			let copy = emptyCopy(tab, person);
			return (
				<Empty kind="first-run" icon={copy.icon}>
					<Empty.Title>{copy.title}</Empty.Title>
					<Empty.Description>{copy.description}</Empty.Description>
				</Empty>
			);
		}
		if (tab === "media") {
			return (
				<ul
					aria-label="Media"
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
							gap: "2px",
							margin: "0",
							padding: "2px 0",
							listStyle: "none",
						}),
					]}
				>
					{items.flatMap((item) =>
						(item.post.pictures ?? []).map((picture) => (
							<li>
								<a
									href={href(`post/${item.post.id}`)}
									aria-label={picture.alt}
									mix={[
										raw({ display: "block", aspectRatio: "1", overflow: "hidden" }),
										when("&:hover", raw({ opacity: "0.9" })),
									]}
								>
									<SceneArt scene={picture.scene} />
								</a>
							</li>
						)),
					)}
				</ul>
			);
		}
		return (
			<Feed
				items={items}
				state={state}
				now={now}
				returnTo={page}
				label={`${person.name}'s ${tab}`}
			/>
		);
	};
}

/** What an empty tab says, by tab and by whose profile it is. */
function emptyCopy(
	tab: ProfileTab,
	person: Person,
): { title: string; description: string; icon: RemixNode } {
	let mine = person.handle === ME.handle;
	if (tab === "likes") {
		return {
			icon: <HeartIcon />,
			title: "No likes yet",
			description: "Tap the heart on any post and it shows up here.",
		};
	}
	if (tab === "media") {
		return {
			icon: <ImageIcon />,
			title: "No photos yet",
			description: mine
				? "Posts with pictures land here."
				: `${person.name} hasn't posted pictures yet.`,
		};
	}
	if (tab === "replies") {
		return {
			icon: <MessageCircleIcon />,
			title: "No replies yet",
			description: mine
				? "Your replies to other posts land here."
				: `${person.name} hasn't replied to anyone yet.`,
		};
	}
	return {
		icon: <MessageCircleIcon />,
		title: "No posts yet",
		description: mine ? "Your first post shows up here." : `${person.name} hasn't posted yet.`,
	};
}
