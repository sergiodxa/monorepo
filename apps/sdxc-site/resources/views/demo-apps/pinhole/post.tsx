/**
 * A post on its own page: on a wide screen the photographs fill the left of one card and the
 * header, the caption and every comment scroll beside them over the actions and the comment
 * field; on a phone they stack in reading order. More from the author follows below.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ArrowLeftIcon, HeartIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";

import type { Post } from "./data";
import type { CommentView, VisitorState } from "./state";

import { PersonAvatar } from "./art";
import { ME, actionHref, findPerson, href, postsBy, shortAge } from "./data";
import {
	ActionRow,
	Eyebrow,
	Face,
	FollowButton,
	HandleLink,
	LikeCount,
	Media,
	PhotoGrid,
	CommentForm,
} from "./parts";
import { DESKTOP, PhoneBar } from "./shell";
import { commentsOf, isFollowing } from "./state";

/** How a post's age reads in full under its actions. */
function longAge(minutes: number): string {
	if (minutes < 60) return `${Math.max(1, Math.floor(minutes))} minutes ago`;
	if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} hours ago`;
	let days = Math.floor(minutes / (60 * 24));
	return days === 1 ? "1 day ago" : `${days} days ago`;
}

/**
 * One comment: the author's avatar, their handle and words, its age and likes, and a small
 * heart that likes it in place.
 */
function CommentItem(handle: Handle<{ comment: CommentView; post: Post }>) {
	return () => {
		let { comment, post } = handle.props;
		let author = findPerson(comment.author)!;
		return (
			<li
				id={`comment-${comment.id}`}
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "auto minmax(0, 1fr) auto",
						gap: "0.75rem",
						alignItems: "start",
						scrollMarginBlock: "5rem",
						"&:target": {
							backgroundColor: "var(--ui-brand-bg-tint)",
							borderRadius: "var(--ui-radius-md)",
						},
					}),
				]}
			>
				<a href={href(`u/${author.handle}`)} aria-hidden="true" tabindex={-1}>
					<PersonAvatar person={author} size={2} />
				</a>
				<div
					mix={[raw({ display: "grid", gap: "0.25rem", fontSize: "0.875rem", lineHeight: "1.4" })]}
				>
					<p mix={[raw({ margin: "0" })]}>
						<HandleLink person={author} /> {comment.text}
					</p>
					<p
						mix={[
							raw({
								margin: "0",
								display: "flex",
								gap: "0.75rem",
								fontSize: "0.75rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<span>{comment.fresh ? "Just now" : shortAge(comment.ago)}</span>
						{comment.likes > 0 ? (
							<span>
								{comment.likes} {comment.likes === 1 ? "like" : "likes"}
							</span>
						) : null}
					</p>
				</div>
				<span
					mix={[
						raw({
							"& button": {
								inlineSize: "2rem",
								blockSize: "2rem",
								padding: "0",
								background: "transparent",
								color: "var(--ui-neutral-fg-muted)",
							},
							"& [data-toggle-content=on]": { color: "var(--pinhole-heart)" },
						}),
					]}
				>
					<OptimisticToggle
						action={actionHref(`p/${post.id}/c/${comment.id}/like`)}
						name="on"
						pressed={comment.liked}
						fields={{ back: `p/${post.id}` }}
						labels={{ label: "Like comment", pressed: "Unlike comment", failed: "Couldn't like" }}
						pressedContent={<HeartIcon size={14} fill="currentColor" aria-hidden="true" />}
						unpressedContent={<HeartIcon size={14} aria-hidden="true" />}
					/>
				</span>
			</li>
		);
	};
}

/** The post page. */
export default function PostPage(handle: Handle<{ post: Post; state: VisitorState }>) {
	return () => {
		let { post, state } = handle.props;
		let author = findPerson(post.author)!;
		let back = `p/${post.id}`;
		let comments = commentsOf(state, post);
		let more = postsBy(author.handle)
			.filter((other) => other.id !== post.id)
			.slice(0, 6);
		let mine = author.handle === ME.handle;
		return (
			<>
				<PhoneBar
					start={
						<>
							<a
								href={href(`u/${author.handle}`)}
								aria-label={`Back to ${author.handle}`}
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
							<span mix={[raw({ fontWeight: "650" })]}>Post</span>
						</>
					}
				/>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "2.5rem",
							inlineSize: "100%",
							maxInlineSize: "60rem",
							marginInline: "auto",
							paddingBlock: "0 2rem",
							boxSizing: "border-box",
							[`@media ${DESKTOP}`]: { paddingBlock: "2rem 3rem", paddingInline: "1.5rem" },
						}),
					]}
				>
					<article
						data-pinhole-item=""
						aria-labelledby="post-title"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "minmax(0, 1fr)",
								gridTemplateAreas: '"header" "media" "actions" "comments" "form"',
								backgroundColor: "var(--ui-bg)",
								[`@media ${DESKTOP}`]: {
									gridTemplateColumns: "minmax(0, 1fr) 21rem",
									gridTemplateRows: "auto minmax(0, 1fr) auto auto",
									gridTemplateAreas: '"media header" "media comments" "media actions" "media form"',
									blockSize: "min(46rem, calc(100dvh - 6rem))",
									border: "1px solid var(--ui-neutral-border)",
									borderRadius: "var(--ui-radius-sm)",
									overflow: "hidden",
								},
							}),
						]}
					>
						<header
							mix={[
								raw({
									gridArea: "header",
									display: "flex",
									alignItems: "center",
									gap: "0.75rem",
									padding: "0.75rem 1rem",
									[`@media ${DESKTOP}`]: { borderBlockEnd: "1px solid var(--ui-neutral-border)" },
								}),
							]}
						>
							<Face person={author} size={2} />
							<div
								mix={[
									raw({
										display: "grid",
										lineHeight: "1.3",
										fontSize: "0.875rem",
										flex: "1 1 auto",
										minInlineSize: "0",
									}),
								]}
							>
								<span mix={[raw({ display: "inline-flex", gap: "0.5rem", alignItems: "center" })]}>
									<h1
										id="post-title"
										mix={[raw({ margin: "0", fontSize: "inherit", fontWeight: "inherit" })]}
									>
										<HandleLink person={author} />
									</h1>
									{mine ? null : (
										<FollowButton
											person={author}
											following={isFollowing(state, author)}
											back={back}
											look="link"
										/>
									)}
								</span>
								{post.place === undefined ? null : (
									<span mix={[raw({ color: "var(--ui-neutral-fg)", fontSize: "0.8125rem" })]}>
										{post.place}
									</span>
								)}
							</div>
						</header>
						<div
							mix={[
								raw({
									gridArea: "media",
									minBlockSize: "0",
									backgroundColor: "oklch(0.14 0.008 60)",
									[`@media ${DESKTOP}`]: { display: "grid", alignItems: "center" },
								}),
							]}
						>
							<Media post={post} id={`post-${post.id}`} />
						</div>
						<ul
							aria-label="Comments"
							mix={[
								raw({
									gridArea: "comments",
									display: "grid",
									alignContent: "start",
									gap: "1rem",
									margin: "0",
									padding: "0.75rem 1rem",
									listStyle: "none",
									minBlockSize: "0",
									overflowY: "auto",
									overscrollBehavior: "contain",
								}),
							]}
						>
							<li
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "auto minmax(0, 1fr)",
										gap: "0.75rem",
										alignItems: "start",
									}),
								]}
							>
								<a href={href(`u/${author.handle}`)} aria-hidden="true" tabindex={-1}>
									<PersonAvatar person={author} size={2} />
								</a>
								<div
									mix={[
										raw({
											display: "grid",
											gap: "0.25rem",
											fontSize: "0.875rem",
											lineHeight: "1.45",
										}),
									]}
								>
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
													color: "var(--ui-neutral-fg-muted)",
												}),
											]}
										>
											{post.exposure}
										</p>
									)}
								</div>
							</li>
							{comments.length === 0 ? (
								<li
									mix={[
										raw({
											paddingBlock: "1.5rem",
											textAlign: "center",
											color: "var(--ui-neutral-fg-muted)",
											fontSize: "0.875rem",
										}),
									]}
								>
									No comments yet. Start the conversation.
								</li>
							) : (
								comments.map((comment) => <CommentItem comment={comment} post={post} />)
							)}
						</ul>
						<div
							mix={[
								raw({
									gridArea: "actions",
									display: "grid",
									gap: "0.25rem",
									padding: "0.25rem 0.75rem 0.5rem",
									[`@media ${DESKTOP}`]: { borderBlockStart: "1px solid var(--ui-neutral-border)" },
								}),
							]}
						>
							<ActionRow post={post} state={state} back={back} shareId={`share-post-${post.id}`} />
							<strong mix={[raw({ paddingInline: "0.25rem", fontSize: "0.9375rem" })]}>
								<LikeCount item={post} state={state} />
							</strong>
							<span
								mix={[
									raw({
										paddingInline: "0.25rem",
										fontSize: "0.75rem",
										color: "var(--ui-neutral-fg-muted)",
										textTransform: "uppercase",
										letterSpacing: "0.04em",
									}),
								]}
							>
								{longAge(post.ago)}
							</span>
						</div>
						<div
							mix={[
								raw({
									gridArea: "form",
									paddingInline: "1rem 0.75rem",
									borderBlockStart: "1px solid var(--ui-neutral-border)",
								}),
							]}
						>
							<CommentForm post={post} back={back} id="comment-field" />
						</div>
					</article>
					{more.length === 0 ? null : (
						<section
							aria-labelledby="pinhole-more"
							mix={[
								raw({
									display: "grid",
									gap: "1rem",
									paddingInline: "0",
									[`@media ${DESKTOP}`]: { paddingInline: "0" },
								}),
							]}
						>
							<div
								mix={[
									raw({ paddingInline: "1rem", [`@media ${DESKTOP}`]: { paddingInline: "0" } }),
								]}
							>
								<Eyebrow id="pinhole-more">
									More from{" "}
									<a
										href={href(`u/${author.handle}`)}
										mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}
									>
										{author.handle}
									</a>
								</Eyebrow>
							</div>
							<PhotoGrid
								tiles={more.map((other) => ({ kind: "post", post: other }))}
								state={state}
								label={`More posts by ${author.name}`}
							/>
						</section>
					)}
				</div>
			</>
		);
	};
}
