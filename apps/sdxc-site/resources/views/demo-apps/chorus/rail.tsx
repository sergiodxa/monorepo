/**
 * The right rail's parts: the search box, what is trending, and people to follow. The two
 * cards stream in as frames, and each draws its own placeholder from the same markup with
 * the text hidden under bars, so a card lands at exactly the height it reserved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { SearchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Button } from "@sdxc/ui";
import { OptimisticToggle } from "@sdxc/ui/app/optimistic-toggle";
import { Skeleton } from "@sdxc/ui/app/skeleton";

import type { Person } from "~/resources/views/demo-apps/chorus/data";
import type { VisitorState } from "~/resources/views/demo-apps/chorus/state";

import { PEOPLE, TRENDS, actionHref, href } from "~/resources/views/demo-apps/chorus/data";
import { PersonAvatar, compact } from "~/resources/views/demo-apps/chorus/parts";
import { follows } from "~/resources/views/demo-apps/chorus/state";

/** The people the rail suggests: the first three Noor does not follow before the visitor acts. */
export const SUGGESTED: Person[] = PEOPLE.filter((person) => !person.followed).slice(0, 3);

/** How many trends the rail lists before "Show more". */
const RAIL_TRENDS = 5;

/** Text that is real, or a bar of its exact size in a placeholder. */
function Text(handle: Handle<{ ghost?: boolean; children: RemixNode }>) {
	return () =>
		handle.props.ghost ? (
			<Skeleton.Text>{handle.props.children}</Skeleton.Text>
		) : (
			handle.props.children
		);
}

/** The search box: a GET form to Explore, so a search is an address to send. */
export function SearchBox(handle: Handle<{ query?: string; autofocus?: boolean }>) {
	return () => (
		<search>
			<form
				method="get"
				action={href("explore")}
				mix={[
					raw({
						position: "relative",
						display: "flex",
						alignItems: "center",
					}),
				]}
			>
				<SearchIcon
					size={18}
					aria-hidden="true"
					mix={[
						raw({
							position: "absolute",
							insetInlineStart: "1rem",
							color: "var(--ui-neutral-fg-muted)",
							pointerEvents: "none",
						}),
					]}
				/>
				<input
					type="search"
					name="q"
					value={handle.props.query ?? ""}
					aria-label="Search Chorus"
					placeholder="Search"
					autocomplete="off"
					autofocus={handle.props.autofocus}
					data-shortcut="/"
					data-shortcut-label="Search"
					data-shortcut-group="Navigation"
					mix={[
						raw({
							inlineSize: "100%",
							blockSize: "2.75rem",
							boxSizing: "border-box",
							paddingInline: "2.75rem 1rem",
							border: "1px solid transparent",
							borderRadius: "999px",
							backgroundColor: "var(--ui-neutral-bg-tint-hover)",
							color: "inherit",
							font: "inherit",
							fontSize: "1rem",
							outline: "none",
						}),
						when(
							"&:focus",
							raw({
								borderColor: "var(--ui-brand-border-strong)",
								backgroundColor: "var(--ui-bg)",
							}),
						),
					]}
				/>
			</form>
		</search>
	);
}

/** A rail card: a rounded box with its heading, rows and a "Show more" link. */
function RailCard(
	handle: Handle<{ title: string; more: string; ghost?: boolean; children: RemixNode }>,
) {
	return () => {
		let { children, ghost, more, title } = handle.props;
		return (
			<section
				aria-label={ghost ? undefined : title}
				aria-hidden={ghost ? "true" : undefined}
				mix={[
					raw({
						display: "grid",
						overflow: "hidden",
						borderRadius: "1rem",
						border: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				<h2
					mix={[
						raw({
							margin: "0",
							padding: "0.75rem 1rem 0.25rem",
							fontSize: "1.25rem",
							fontWeight: "800",
							lineHeight: "1.5rem",
						}),
					]}
				>
					<Text ghost={ghost}>{title}</Text>
				</h2>
				{children}
				<a
					href={more}
					tabIndex={ghost ? -1 : undefined}
					mix={[
						raw({
							padding: "0.875rem 1rem",
							fontSize: "0.9375rem",
							lineHeight: "1.25rem",
							color: "var(--ui-brand-fg)",
							textDecoration: "none",
						}),
						when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
					]}
				>
					<Text ghost={ghost}>Show more</Text>
				</a>
			</section>
		);
	};
}

/** One row's look in a rail card or on Explore: padding, a hover fill, the whole row a link. */
export function trendRow() {
	return [
		raw({
			display: "grid",
			gap: "0.125rem",
			padding: "0.625rem 1rem",
			color: "inherit",
			textDecoration: "none",
		}),
		when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
		),
	];
}

/** One trend's three lines: its context, its topic, its post count. */
export function TrendLines(handle: Handle<{ trend: (typeof TRENDS)[number]; ghost?: boolean }>) {
	return () => {
		let { ghost, trend } = handle.props;
		return (
			<>
				<span
					mix={[
						raw({ fontSize: "0.8125rem", lineHeight: "1rem", color: "var(--ui-neutral-fg-muted)" }),
					]}
				>
					<Text ghost={ghost}>{trend.context}</Text>
				</span>
				<span mix={[raw({ fontWeight: "700", lineHeight: "1.25rem" })]}>
					<Text ghost={ghost}>{trend.topic}</Text>
				</span>
				<span
					mix={[
						raw({ fontSize: "0.8125rem", lineHeight: "1rem", color: "var(--ui-neutral-fg-muted)" }),
					]}
				>
					<Text ghost={ghost}>{compact(trend.posts)} posts</Text>
				</span>
			</>
		);
	};
}

/** What is trending, top five, each opening its search on Explore. */
export function TrendsCard(handle: Handle<{ ghost?: boolean }>) {
	return () => {
		let { ghost } = handle.props;
		return (
			<RailCard title="Trending now" more={href("explore")} ghost={ghost}>
				{TRENDS.slice(0, RAIL_TRENDS).map((trend) => (
					<a
						href={href(`explore?q=${encodeURIComponent(trend.query)}`)}
						tabIndex={ghost ? -1 : undefined}
						mix={[trendRow()]}
					>
						<TrendLines trend={trend} ghost={ghost} />
					</a>
				))}
			</RailCard>
		);
	};
}

namespace FollowButton {
	export interface Props {
		person: Person;
		state: VisitorState;
		/** The page a no-script follow returns to. */
		returnTo: string;
	}
}

/**
 * Follow and Following, flipping at once: a dark pill to follow, the brand's while followed.
 * Without script it is a form that comes back to `returnTo`.
 */
export function FollowButton(handle: Handle<FollowButton.Props>) {
	return () => {
		let { person, returnTo, state } = handle.props;
		let on = follows(state, person);
		return (
			<OptimisticToggle
				action={actionHref(`u/${person.handle}`)}
				name="on"
				pressed={on}
				variant="solid"
				fields={{ intent: "follow", return: returnTo }}
				labels={{
					label: `Follow ${person.name}`,
					pressed: `Unfollow ${person.name}`,
					failed: "Couldn't follow",
				}}
				pressedContent="Following"
				unpressedContent="Follow"
			/>
		);
	};
}

/** The placeholder twin of {@link FollowButton}: the same pill, wrapped as the toggle wraps it. */
function FollowGhost() {
	return () => (
		<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
			<Skeleton.Text block>
				<Button type="button" size="sm" variant="solid" tabIndex={-1}>
					<span>Following</span>
				</Button>
			</Skeleton.Text>
			<span />
		</span>
	);
}

/** One suggested person: avatar, name, handle and "Follows you", and the follow pill. */
export function PersonRow(
	handle: Handle<{
		person: Person;
		state?: VisitorState;
		returnTo: string;
		ghost?: boolean;
		bio?: boolean;
	}>,
) {
	return () => {
		let { bio, ghost, person, returnTo, state } = handle.props;
		return (
			<div
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateColumns: "2.5rem minmax(0, 1fr) auto",
						alignItems: "center",
						columnGap: "0.75rem",
						padding: "0.625rem 1rem",
					}),
					when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
				]}
			>
				{ghost ? (
					<span
						mix={[
							raw({
								inlineSize: "2.5rem",
								blockSize: "2.5rem",
								borderRadius: "999px",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
				) : (
					<PersonAvatar person={person} />
				)}
				<span
					mix={[
						raw({
							display: "grid",
							minInlineSize: "0",
							gridTemplateColumns: "minmax(0, 1fr)",
							lineHeight: "1.25rem",
						}),
					]}
				>
					<a
						href={href(`u/${person.handle}`)}
						tabIndex={ghost ? -1 : undefined}
						data-rmx-prefetch="intent"
						mix={[
							raw({
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								fontWeight: "700",
								color: "inherit",
								textDecoration: "none",
								"&::after": { content: '""', position: "absolute", inset: "0" },
							}),
							when("&:hover", raw({ textDecoration: "underline" })),
						]}
					>
						<Text ghost={ghost}>{person.name}</Text>
					</a>
					<span
						mix={[
							raw({
								display: "flex",
								gap: "0.375rem",
								alignItems: "center",
								minInlineSize: "0",
								fontSize: "0.875rem",
								color: "var(--ui-neutral-fg-muted)",
								whiteSpace: "nowrap",
							}),
						]}
					>
						<span mix={[raw({ overflow: "hidden", textOverflow: "ellipsis" })]}>
							<Text ghost={ghost}>@{person.handle}</Text>
						</span>
						{person.followsYou ? <FollowsYou ghost={ghost} /> : null}
					</span>
					{bio ? (
						<span
							mix={[
								raw({
									marginBlockStart: "0.25rem",
									fontSize: "0.9375rem",
									lineHeight: "1.35",
									whiteSpace: "normal",
								}),
							]}
						>
							<Text ghost={ghost}>{person.bio}</Text>
						</span>
					) : null}
				</span>
				<span mix={[raw({ position: "relative", zIndex: "1" })]}>
					{ghost || !state ? (
						<FollowGhost />
					) : (
						<FollowButton person={person} state={state} returnTo={returnTo} />
					)}
				</span>
			</div>
		);
	};
}

/** The small "Follows you" tag beside a handle. */
export function FollowsYou(handle: Handle<{ ghost?: boolean }>) {
	return () => (
		<span
			mix={[
				raw({
					flexShrink: "0",
					paddingInline: "0.3125rem",
					borderRadius: "0.25rem",
					fontSize: "0.75rem",
					lineHeight: "1.125rem",
					backgroundColor: handle.props.ghost ? "transparent" : "var(--ui-neutral-bg-tint-hover)",
				}),
			]}
		>
			<Text ghost={handle.props.ghost}>Follows you</Text>
		</span>
	);
}

/** People to follow, three of them, each with a pill that follows at once. */
export function FollowCard(handle: Handle<{ ghost?: boolean; state?: VisitorState }>) {
	return () => {
		let { ghost, state } = handle.props;
		return (
			<RailCard title="Who to follow" more={href("explore?tab=people")} ghost={ghost}>
				{SUGGESTED.map((person) => (
					<PersonRow person={person} state={state} returnTo="" ghost={ghost} />
				))}
			</RailCard>
		);
	};
}
