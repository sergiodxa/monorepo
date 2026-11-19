/**
 * Explore: a search field and topic chips over a mosaic of posts with reels standing two
 * tiles tall among them. The query and topic live in the address, so a search is a link, and
 * a search that names people lists them above the grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SearchIcon, XIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { HeadingScope, LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app";

import type { Tile } from "./parts";
import type { VisitorState } from "./state";

import { PersonAvatar } from "./art";
import { REELS, TOPICS, explorePosts, href, searchPeople } from "./data";
import { Eyebrow, HandleLink, PhotoGrid, srOnly } from "./parts";
import { TABLET } from "./shell";

/** Builds an Explore address from a query and a topic, dropping whichever is blank. */
export function exploreHref(query: string, topic: string | undefined): string {
	let params = new URLSearchParams();
	if (query.trim() !== "") params.set("q", query.trim());
	if (topic !== undefined) params.set("topic", topic);
	let search = params.toString();
	return search === "" ? "explore" : `explore?${search}`;
}

/**
 * Mixes reels into the posts, one after every fourth post, so the grid reads as a mosaic of
 * squares broken by tall reels; with a query or a topic, reels whose caption matches join.
 */
function mosaic(posts: Tile[], query: string, topic: string | undefined): Tile[] {
	let needle = query.trim().toLowerCase();
	let reels = REELS.filter((reel) => {
		if (topic !== undefined) return false;
		return needle === "" || reel.caption.toLowerCase().includes(needle);
	}).map((reel): Tile => ({ kind: "reel", reel }));
	let tiles: Tile[] = [];
	posts.forEach((post, index) => {
		tiles.push(post);
		if (index % 4 === 1 && reels.length > 0) tiles.push(reels.shift()!);
	});
	return [...tiles, ...reels];
}

namespace ExplorePage {
	export interface Props {
		state: VisitorState;
		query: string;
		topic: string | undefined;
	}
}

/** The Explore screen. */
export default function ExplorePage(handle: Handle<ExplorePage.Props>) {
	return () => {
		let { query, state, topic } = handle.props;
		let posts = explorePosts(query, topic).map((post): Tile => ({ kind: "post", post }));
		let tiles = mosaic(posts, query, topic);
		let people = searchPeople(query);
		let searching = query.trim() !== "" || topic !== undefined;
		return (
			<div
				mix={[
					raw({
						inlineSize: "100%",
						maxInlineSize: "60rem",
						marginInline: "auto",
						boxSizing: "border-box",
						paddingBlockEnd: "2rem",
						[`@media ${TABLET}`]: { paddingInline: "1.5rem", paddingBlockStart: "1.5rem" },
					}),
				]}
			>
				<h1 mix={[srOnly()]}>Explore</h1>
				<form
					method="get"
					action={href("explore")}
					role="search"
					mix={[
						raw({
							position: "sticky",
							insetBlockStart: "0",
							zIndex: "10",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							padding: "0.625rem 1rem",
							backgroundColor: "var(--ui-bg)",
							[`@media ${TABLET}`]: { position: "static", padding: "0 0 1rem" },
						}),
					]}
				>
					{topic === undefined ? null : <input type="hidden" name="topic" value={topic} />}
					<label
						mix={[
							raw({
								position: "relative",
								display: "flex",
								alignItems: "center",
								flex: "1 1 auto",
								blockSize: "2.5rem",
								paddingInline: "0.875rem",
								gap: "0.5rem",
								borderRadius: "var(--ui-radius-md)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								color: "var(--ui-neutral-fg-muted)",
								"&:focus-within": { boxShadow: "0 0 0 2px var(--ui-brand-ring)" },
							}),
						]}
					>
						<SearchIcon size={18} aria-hidden="true" />
						<span mix={[srOnly()]}>Search Pinhole</span>
						<input
							type="search"
							name="q"
							value={query}
							placeholder="Search people, places, captions"
							autocomplete="off"
							enterkeyhint="search"
							mix={[
								raw({
									flex: "1 1 auto",
									minInlineSize: "0",
									border: "0",
									background: "transparent",
									color: "var(--ui-neutral-fg-emphasis)",
									font: "inherit",
									fontSize: "1rem",
									outline: "none",
								}),
							]}
						/>
					</label>
					<button
						type="submit"
						mix={[
							raw({
								blockSize: "2.5rem",
								paddingInline: "0.875rem",
								border: "0",
								borderRadius: "var(--ui-radius-md)",
								backgroundColor: "var(--ui-neutral-bg-solid)",
								color: "var(--ui-neutral-fg-on-solid, white)",
								font: "inherit",
								fontWeight: "600",
								cursor: "pointer",
							}),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
							),
						]}
					>
						Search
					</button>
				</form>
				<nav aria-label="Topics">
					<ul
						mix={[
							raw({
								display: "flex",
								gap: "0.5rem",
								margin: "0",
								paddingBlock: "0 0.875rem",
								paddingInline: "1rem",
								listStyle: "none",
								overflowX: "auto",
								scrollbarWidth: "none",
								[`@media ${TABLET}`]: { flexWrap: "wrap", paddingInline: "0" },
							}),
						]}
					>
						{TOPICS.map((entry) => {
							let current = entry.id === topic;
							return (
								<li mix={[raw({ flexShrink: "0" })]}>
									<a
										href={href(exploreHref(query, current ? undefined : entry.id))}
										aria-current={current ? "true" : undefined}
										data-rmx-prefetch="intent"
										mix={[
											raw({
												display: "inline-flex",
												alignItems: "center",
												gap: "0.375rem",
												blockSize: "2.25rem",
												paddingInline: "0.875rem",
												border: "1px solid var(--ui-neutral-border)",
												borderRadius: "999px",
												color: "var(--ui-neutral-fg-emphasis)",
												textDecoration: "none",
												fontSize: "0.875rem",
												fontWeight: "550",
											}),
											when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
											when(
												"&[aria-current]",
												raw({
													borderColor: "var(--ui-neutral-fg-emphasis)",
													backgroundColor: "var(--ui-neutral-fg-emphasis)",
													color: "var(--ui-bg)",
												}),
											),
											when(
												"&:focus-visible",
												raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
											),
										]}
									>
										{entry.name}
										{current ? <XIcon size={14} aria-label="Remove filter" /> : null}
									</a>
								</li>
							);
						})}
					</ul>
				</nav>
				{people.length === 0 ? null : (
					<section
						aria-labelledby="pinhole-people"
						mix={[
							raw({
								display: "grid",
								gap: "0.75rem",
								paddingInline: "1rem",
								paddingBlockEnd: "1.25rem",
								[`@media ${TABLET}`]: { paddingInline: "0" },
							}),
						]}
					>
						<Eyebrow id="pinhole-people">People</Eyebrow>
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
							{people.map((person) => (
								<li mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem" })]}>
									<a href={href(`u/${person.handle}`)} aria-hidden="true" tabindex={-1}>
										<PersonAvatar person={person} size={2.75} />
									</a>
									<span mix={[raw({ display: "grid", lineHeight: "1.3", fontSize: "0.875rem" })]}>
										<HandleLink person={person} />
										<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{person.name}</span>
									</span>
								</li>
							))}
						</ul>
					</section>
				)}
				{tiles.length === 0 ? (
					<div mix={[raw({ paddingBlock: "3rem", paddingInline: "1rem" })]}>
						<HeadingScope level={2}>
							<Empty kind="no-results" size="compact">
								<Empty.Title>Nothing matches that</Empty.Title>
								<Empty.Description>
									{query.trim() === "" ? (
										"No posts in this topic yet."
									) : (
										<>
											No posts{topic === undefined ? "" : " in this topic"} mention{" "}
											<Empty.Query>{query}</Empty.Query>.
										</>
									)}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={href("explore")} size="sm" variant="surface">
										Clear search
									</LinkButton>
								</Empty.Action>
							</Empty>
						</HeadingScope>
					</div>
				) : (
					<section aria-label={searching ? "Results" : "Explore"}>
						{searching ? (
							<p
								role="status"
								mix={[
									raw({
										margin: "0",
										paddingInline: "1rem",
										paddingBlockEnd: "0.75rem",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg-muted)",
										[`@media ${TABLET}`]: { paddingInline: "0" },
									}),
								]}
							>
								{tiles.length === 1 ? "1 result" : `${tiles.length} results`}
							</p>
						) : null}
						<PhotoGrid
							tiles={tiles}
							state={state}
							layout="mosaic"
							label={searching ? "Results" : "Posts and reels"}
						/>
					</section>
				)}
			</div>
		);
	};
}
