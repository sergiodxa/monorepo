/**
 * Explore: the search box on top, what is trending, and people to follow, and for a search,
 * the posts and people it finds. The query lives in the address, so a search is a link
 * anyone can open, and no results says what to try next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SearchXIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";

import type { Person } from "~/resources/views/demo-apps/chorus/data";
import type { PostView, VisitorState } from "~/resources/views/demo-apps/chorus/state";

import {
	ARRIVED_POSTS,
	PEOPLE,
	POSTS,
	TRENDS,
	href,
} from "~/resources/views/demo-apps/chorus/data";
import { Feed, FeedTabs, postById } from "~/resources/views/demo-apps/chorus/feed";
import {
	PersonRow,
	SearchBox,
	TrendLines,
	trendRow,
} from "~/resources/views/demo-apps/chorus/rail";
import { ChorusShell } from "~/resources/views/demo-apps/chorus/shell";

/** Explore's tabs: trends and people without a query; top posts and people with one. */
export type ExploreTab = "top" | "people";

/**
 * Finds the posts and people a query matches, case-insensitively: a post by its text, its
 * author's name or its link card, a person by name, handle or bio. A leading `@` searches handles alone.
 *
 * @param query What was typed.
 * @param state The visitor's state, whose own posts are searched too.
 */
export function search(
	query: string,
	state: VisitorState,
): { posts: PostView[]; people: Person[] } {
	let needle = query.trim().toLowerCase();
	if (needle === "") return { posts: [], people: [] };
	let handleOnly = needle.startsWith("@");
	let bare = handleOnly ? needle.slice(1) : needle;
	let people = PEOPLE.filter((person) =>
		handleOnly
			? person.handle.includes(bare)
			: [person.name, person.handle, person.bio].some((field) =>
					field.toLowerCase().includes(needle),
				),
	);
	if (handleOnly) return { posts: [], people };
	let ids = [...POSTS, ...ARRIVED_POSTS]
		.map((post) => post.id)
		.concat(state.posts.map((post) => post.id));
	let posts = ids
		.flatMap((id) => postById(id, state) ?? [])
		.filter((post) =>
			[post.text, post.person.name, post.link?.title ?? "", post.link?.description ?? ""].some(
				(field) => field.toLowerCase().includes(needle),
			),
		)
		.sort((a, b) => b.likes - a.likes);
	return { posts, people };
}

namespace ExploreScreen {
	export interface Props {
		query: string;
		tab: ExploreTab;
		state: VisitorState;
		now: number;
	}
}

/** Renders Explore for a query, or its trends and people when there is none. */
export function ExploreScreen(handle: Handle<ExploreScreen.Props>) {
	return () => {
		let { now, query, state, tab } = handle.props;
		let encoded = encodeURIComponent(query);
		let base = query === "" ? "explore" : `explore?q=${encoded}`;
		let peoplePage = query === "" ? "explore?tab=people" : `explore?q=${encoded}&tab=people`;

		return (
			<ChorusShell
				current="explore"
				railSearch={false}
				header={
					<>
						<h1
							mix={[
								raw({
									position: "absolute",
									inlineSize: "1px",
									blockSize: "1px",
									overflow: "hidden",
									clipPath: "inset(50%)",
								}),
							]}
						>
							{query === "" ? "Explore" : `Search: ${query}`}
						</h1>
						<div mix={[raw({ padding: "0.5rem 1rem" })]}>
							<SearchBox query={query} />
						</div>
						<FeedTabs
							label="Explore sections"
							tabs={[
								{
									label: query === "" ? "Trending" : "Top",
									href: href(base),
									current: tab === "top",
								},
								{ label: "People", href: href(peoplePage), current: tab === "people" },
							]}
						/>
					</>
				}
			>
				<ExploreBody
					query={query}
					tab={tab}
					state={state}
					now={now}
					page={tab === "people" ? peoplePage : base}
				/>
			</ChorusShell>
		);
	};
}

/** Explore's body for its tab and query: people, the trends, no results, or what was found. */
function ExploreBody(handle: Handle<ExploreScreen.Props & { page: string }>) {
	return () => {
		let { now, page, query, state, tab } = handle.props;
		let results = search(query, state);
		if (tab === "people") {
			return (
				<PeopleList
					people={query === "" ? PEOPLE : results.people}
					state={state}
					page={page}
					query={query}
				/>
			);
		}
		if (query === "") return <TrendList />;
		if (results.posts.length === 0 && results.people.length === 0)
			return <NoResults query={query} />;
		return (
			<>
				{results.people.length > 0 ? (
					<section
						aria-label="People"
						mix={[raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" })]}
					>
						<h2
							mix={[
								raw({
									margin: "0",
									padding: "0.75rem 1rem 0.25rem",
									fontSize: "1.25rem",
									fontWeight: "800",
								}),
							]}
						>
							People
						</h2>
						{results.people.slice(0, 3).map((person) => (
							<PersonRow person={person} state={state} returnTo={page} bio />
						))}
					</section>
				) : null}
				<Feed
					items={results.posts.map((post) => ({ post }))}
					state={state}
					now={now}
					returnTo={page}
					label={`Posts matching ${query}`}
				/>
			</>
		);
	};
}

/** Every trend, ranked, each opening its search. */
function TrendList() {
	return () => (
		<ol aria-label="Trending" mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}>
			{TRENDS.map((trend, index) => (
				<li>
					<a
						href={href(`explore?q=${encodeURIComponent(trend.query)}`)}
						mix={[
							trendRow(),
							raw({
								paddingBlock: "0.75rem",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{index + 1} ·
						</span>
						<TrendLines trend={trend} />
					</a>
				</li>
			))}
		</ol>
	);
}

/** Every person a list shows, each with their bio and a follow pill. */
function PeopleList(
	handle: Handle<{ people: Person[]; state: VisitorState; page: string; query: string }>,
) {
	return () => {
		let { page, people, query, state } = handle.props;
		if (people.length === 0) return <NoResults query={query} />;
		return (
			<section aria-label="People">
				{people.map((person) => (
					<div mix={[raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" })]}>
						<PersonRow person={person} state={state} returnTo={page} bio />
					</div>
				))}
			</section>
		);
	};
}

/** No results for a query: what was searched, and a way out. */
function NoResults(handle: Handle<{ query: string }>) {
	return () => (
		<Empty kind="no-results" icon={<SearchXIcon />}>
			<Empty.Title>No results for “{handle.props.query}”</Empty.Title>
			<Empty.Description>Try a shorter word, a name, or one of the trends.</Empty.Description>
			<Empty.Action>
				<LinkButton href={href("explore")} variant="outline" color="neutral">
					See what's trending
				</LinkButton>
			</Empty.Action>
		</Empty>
	);
}
