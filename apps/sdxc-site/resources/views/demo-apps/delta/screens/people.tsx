/**
 * The `sdxc` org's page and each member's profile: who they are, the repositories they pin,
 * a year of contributions (from git for the repository's real author, seeded for everyone
 * else) with a year switcher of plain links, and what they did lately.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import {
	BookOpenIcon,
	CalendarIcon,
	ExternalLinkIcon,
	GitForkIcon,
	LinkIcon,
	StarIcon,
	UsersIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { HeadingScope, RelativeTime } from "@sdxc/ui";
import { ContributionGraph } from "@sdxc/ui/app/contribution-graph";
import { PageHeader } from "@sdxc/ui/app/page-header";

import type { ContributionDay, Person } from "../seed/people";
import type { PinnedRepo } from "../seed/repos";

import { commitHref, href, repoHref, runHref, shortSha } from "../data";
import { DeltaMark, InitialsTile } from "../glyphs";
import { COPY } from "../labels";
import { nameOf } from "../seed/people";

import { StateIcon } from "./ci-parts";

/** One thing a person or the org did lately, newest first in a list. */
export interface ActivityItem {
	/** When it happened, in epoch milliseconds. */
	at: number;
	actor: string;
	/** What they did, as a sentence after their name. */
	verb: string;
	/** The commit or run it was, which the row links to. */
	target:
		| { kind: "commit"; sha: string; subject: string }
		| {
				kind: "run";
				id: number;
				title: string;
				status: "success" | "failure" | "cancelled" | "in_progress";
		  };
}

/**
 * A profile's round avatar, tinted from the name like every other tile: 72px beside the name
 * on a narrow pane, 128px above it once the profile has its side column.
 */
function Avatar(handle: Handle<{ name: string }>) {
	return () => {
		let ring = raw({
			display: "inline-flex",
			justifySelf: "start",
			borderRadius: "999px",
			boxShadow: "0 0 0 1px var(--ui-neutral-border)",
		});
		return (
			<>
				<span
					mix={[ring, raw({ "@container delta-profile (min-width: 52rem)": { display: "none" } })]}
				>
					<InitialsTile name={handle.props.name} size={72} />
				</span>
				<span
					mix={[
						ring,
						raw({
							display: "none",
							"@container delta-profile (min-width: 52rem)": { display: "inline-flex" },
						}),
					]}
				>
					<InitialsTile name={handle.props.name} size={128} />
				</span>
			</>
		);
	};
}

/** A section's heading, the size every column on these pages uses. */
function SectionTitle(handle: Handle<{ id: string; children: RemixNode }>) {
	return () => (
		<h2 id={handle.props.id} mix={[text("sm"), weight("semibold"), raw({ margin: 0 })]}>
			{handle.props.children}
		</h2>
	);
}

/** Renders a pinned repository as a card: the hosted one opens its code, the rest their docs. */
function RepoCard(handle: Handle<{ repo: PinnedRepo }>) {
	return () => {
		let { repo } = handle.props;
		let hosted = repo.docs === undefined;
		return (
			<li
				mix={[
					raw({
						position: "relative",
						display: "grid",
						gridTemplateRows: "auto 1fr auto",
						gap: "0.5rem",
						padding: "0.875rem 1rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-lg)",
						background: "var(--ui-bg)",
						"&:hover": { borderColor: "var(--ui-neutral-border-hover, var(--ui-brand-border))" },
						"&:has(a:focus-visible)": {
							outline: "2px solid var(--ui-brand-ring)",
							outlineOffset: "1px",
						},
					}),
				]}
			>
				<span
					mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem", minInlineSize: 0 })]}
				>
					<BookOpenIcon size={16} aria-hidden="true" mix={[fg("neutral.muted")]} />
					<a
						href={hosted ? repoHref() : repo.docs}
						{...(hosted ? { "data-rmx-prefetch": "intent" } : {})}
						mix={[
							font("mono"),
							text("sm"),
							weight("semibold"),
							fg("brand"),
							raw({
								minInlineSize: 0,
								overflowWrap: "anywhere",
								textDecoration: "none",
								outline: "none",
								"&::after": { content: '""', position: "absolute", inset: 0 },
								"&:hover": { textDecoration: "underline" },
							}),
						]}
					>
						{`${COPY.org}/${repo.name}`}
					</a>
					{hosted ? null : (
						<span
							title={COPY.people.docsHint}
							mix={[
								raw({ marginInlineStart: "auto", display: "inline-flex" }),
								fg("neutral.muted"),
							]}
						>
							<ExternalLinkIcon size={14} aria-hidden="true" />
							<span mix={[visuallyHidden()]}>{COPY.people.docsHint}</span>
						</span>
					)}
				</span>
				<p mix={[text("sm"), fg("neutral.muted"), raw({ margin: 0 })]}>{repo.description}</p>
				<span
					mix={[
						raw({ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }),
						text("xs"),
						fg("neutral.muted"),
						tabularNums(),
					]}
				>
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}>
						<span
							aria-hidden="true"
							mix={[
								raw({
									inlineSize: "0.625rem",
									blockSize: "0.625rem",
									borderRadius: "999px",
									background: "oklch(0.62 0.13 245)",
								}),
							]}
						/>
						{repo.language}
					</span>
					<span
						aria-label={COPY.people.stars(repo.stars)}
						mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.25rem" })]}
					>
						<StarIcon size={13} aria-hidden="true" />
						{COPY.people.compact(repo.stars)}
					</span>
					<span
						aria-label={COPY.people.forks(repo.forks)}
						mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.25rem" })]}
					>
						<GitForkIcon size={13} aria-hidden="true" />
						{repo.forks}
					</span>
				</span>
			</li>
		);
	};
}

/** Renders the pinned repositories as a grid of cards, two across where they fit. */
function PinnedRepos(handle: Handle<{ repos: readonly PinnedRepo[] }>) {
	return () => (
		<section aria-labelledby="delta-pinned" mix={[raw({ display: "grid", gap: "0.625rem" })]}>
			<SectionTitle id="delta-pinned">{COPY.people.pinned}</SectionTitle>
			<ul
				mix={[
					raw({
						listStyle: "none",
						margin: 0,
						padding: 0,
						display: "grid",
						gap: "0.75rem",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 18rem), 1fr))",
					}),
				]}
			>
				{handle.props.repos.map((repo) => (
					<RepoCard repo={repo} />
				))}
			</ul>
		</section>
	);
}

/** Renders the activity list: who did what, linked to the commit or run, with its age. */
function Activity(handle: Handle<{ items: readonly ActivityItem[]; now: number; empty: string }>) {
	return () => {
		let { empty, items, now } = handle.props;
		return (
			<section aria-labelledby="delta-activity" mix={[raw({ display: "grid", gap: "0.625rem" })]}>
				<SectionTitle id="delta-activity">{COPY.people.activity}</SectionTitle>
				{items.length === 0 ? (
					<p mix={[text("sm"), fg("neutral.muted"), raw({ margin: 0 })]}>{empty}</p>
				) : (
					<ol
						mix={[
							raw({
								listStyle: "none",
								margin: 0,
								padding: 0,
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg)",
								background: "var(--ui-bg)",
							}),
						]}
					>
						{items.map((item) => (
							<li
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "auto minmax(0, 1fr) auto",
										alignItems: "start",
										gap: "0.625rem",
										padding: "0.625rem 1rem",
										borderBlockStart: "1px solid var(--ui-neutral-border)",
										"&:first-child": { borderBlockStart: "0" },
									}),
									text("sm"),
								]}
							>
								{item.target.kind === "run" ? (
									<StateIcon state={item.target.status} />
								) : (
									<InitialsTile name={nameOf(item.actor)} size={18} />
								)}
								<span mix={[raw({ minInlineSize: 0, display: "grid", gap: "0.125rem" })]}>
									<span mix={[fg("neutral.muted")]}>
										<a
											href={href(`u/${item.actor}`)}
											data-rmx-prefetch="intent"
											mix={[weight("medium"), fg("neutral.emphasis")]}
										>
											{item.actor}
										</a>{" "}
										{item.verb}
									</span>
									<a
										href={
											item.target.kind === "run"
												? runHref(item.target.id)
												: commitHref(item.target.sha)
										}
										data-rmx-prefetch="intent"
										mix={[fg("neutral.emphasis"), raw({ overflowWrap: "anywhere" })]}
									>
										{item.target.kind === "run" ? (
											item.target.title
										) : (
											<>
												<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>
													{`${shortSha(item.target.sha)} `}
												</span>
												{item.target.subject}
											</>
										)}
									</a>
								</span>
								<span mix={[text("xs"), fg("neutral.muted"), raw({ whiteSpace: "nowrap" })]}>
									<RelativeTime date={new Date(item.at).toISOString()} now={now} locale="en" />
								</span>
							</li>
						))}
					</ol>
				)}
			</section>
		);
	};
}

namespace Contributions {
	export interface Props {
		days: readonly ContributionDay[];
		/** The year shown, or `null` for the twelve months up to today. */
		year: number | null;
		/** The years the person has contributions in, newest first. */
		years: readonly number[];
		today: string;
		/** The profile's address, which each year link sets `?year=` on. */
		page: string;
	}
}

/** The first and last day a graph draws: one calendar year, or the year up to today. */
function rangeOf(year: number | null, today: string): { start: string; end: string } {
	if (year !== null) {
		let end = `${year}-12-31` < today ? `${year}-12-31` : today;
		return { start: `${year}-01-01`, end };
	}
	let start = new Date(Date.parse(`${today}T00:00:00Z`) - 364 * 86_400_000)
		.toISOString()
		.slice(0, 10);
	return { start, end: today };
}

/**
 * Renders a year of contributions with the year switcher beside it: each year a plain link
 * setting `?year=`, the current one marked, and the last twelve months first.
 */
function Contributions(handle: Handle<Contributions.Props>) {
	return () => {
		let { days, page, today, year, years } = handle.props;
		let { end, start } = rangeOf(year, today);
		let total = days
			.filter((day) => day.date >= start && day.date <= end)
			.reduce((sum, day) => sum + day.count, 0);
		let caption = COPY.people.contributions(total, year);
		return (
			<section
				aria-labelledby="delta-contributions"
				mix={[raw({ display: "grid", gap: "0.625rem" })]}
			>
				<h2 id="delta-contributions" mix={[visuallyHidden()]}>
					{COPY.people.contributionsTitle}
				</h2>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "0.75rem",
							alignItems: "start",
							"@container delta-profile (min-width: 46rem)": {
								gridTemplateColumns: "minmax(0, 1fr) 5.5rem",
							},
						}),
					]}
				>
					<div
						mix={[
							raw({
								minInlineSize: 0,
								padding: "0.875rem 1rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-lg)",
								background: "var(--ui-bg)",
							}),
						]}
					>
						<ContributionGraph
							days={days}
							start={start}
							end={end}
							locale="en"
							labels={{
								caption,
								day: (count, date) => COPY.people.day(count, date),
								less: COPY.people.less,
								more: COPY.people.more,
							}}
						/>
					</div>
					<nav aria-label={COPY.people.years}>
						<ul
							mix={[
								raw({
									listStyle: "none",
									margin: 0,
									padding: 0,
									display: "flex",
									flexWrap: "wrap",
									gap: "0.25rem",
									"@container delta-profile (min-width: 46rem)": { flexDirection: "column" },
								}),
							]}
						>
							{[null, ...years].map((option) => (
								<li>
									<a
										href={option === null ? page : `${page}?year=${option}`}
										data-rmx-prefetch="intent"
										aria-current={option === year ? "page" : undefined}
										mix={[
											raw({
												display: "block",
												padding: "0.3125rem 0.625rem",
												borderRadius: "var(--ui-radius-md)",
												textDecoration: "none",
												color: "var(--ui-neutral-fg-muted)",
												whiteSpace: "nowrap",
												"&:hover": {
													background: "var(--ui-neutral-bg-tint-hover)",
													color: "var(--ui-neutral-fg-emphasis)",
												},
												"&[aria-current=page]": {
													background: "var(--ui-brand-bg-solid)",
													color: "var(--ui-brand-fg-on-solid, white)",
												},
											}),
											text("sm"),
											tabularNums(),
										]}
									>
										{option === null ? COPY.people.lastYear : String(option)}
									</a>
								</li>
							))}
						</ul>
					</nav>
				</div>
			</section>
		);
	};
}

namespace UserScreen {
	export interface Props {
		person: Person;
		repos: readonly PinnedRepo[];
		days: readonly ContributionDay[];
		year: number | null;
		years: readonly number[];
		activity: readonly ActivityItem[];
		today: string;
		now: number;
	}
}

/**
 * Renders a member's profile: their card on one side (avatar, name, handle, bio, role and
 * when they joined), and their pinned repositories, contributions and recent activity beside it.
 */
export function UserScreen(handle: Handle<UserScreen.Props>) {
	return () => {
		let { activity, days, now, person, repos, today, year, years } = handle.props;
		let joined = new Intl.DateTimeFormat("en", {
			month: "short",
			year: "numeric",
			timeZone: "UTC",
		}).format(new Date(`${person.joined}T00:00:00Z`));
		return (
			<div mix={[raw({ containerName: "delta-profile", containerType: "inline-size" })]}>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr)",
							gap: "1.5rem",
							paddingBlockStart: "0.5rem",
							"@container delta-profile (min-width: 52rem)": {
								gridTemplateColumns: "16rem minmax(0, 1fr)",
								gap: "2rem",
							},
						}),
					]}
				>
					<aside
						aria-label={COPY.people.about(person.name)}
						mix={[
							raw({
								display: "grid",
								gap: "0.75rem",
								alignContent: "start",
								gridTemplateColumns: "auto minmax(0, 1fr)",
								alignItems: "center",
								"@container delta-profile (min-width: 52rem)": {
									gridTemplateColumns: "minmax(0, 1fr)",
								},
							}),
						]}
					>
						<Avatar name={person.name} />
						<div mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: 0 })]}>
							<h1
								mix={[raw({ margin: 0, fontSize: "1.5rem", lineHeight: 1.25 }), weight("semibold")]}
							>
								{person.name}
							</h1>
							<span mix={[text("lg"), fg("neutral.muted"), font("mono")]}>{person.handle}</span>
						</div>
						<p mix={[raw({ margin: 0, gridColumn: "1 / -1" }), text("sm")]}>{person.bio}</p>
						<ul
							mix={[
								raw({
									listStyle: "none",
									margin: 0,
									padding: 0,
									display: "grid",
									gap: "0.375rem",
									gridColumn: "1 / -1",
								}),
								text("sm"),
								fg("neutral.muted"),
							]}
						>
							<li mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}>
								<UsersIcon size={15} aria-hidden="true" />
								<span>
									{COPY.people.roleIn(person.role)}{" "}
									<a
										href={href(COPY.org)}
										data-rmx-prefetch="intent"
										mix={[weight("medium"), fg("neutral.emphasis")]}
									>
										{COPY.org}
									</a>
								</span>
							</li>
							<li mix={[raw({ display: "flex", alignItems: "center", gap: "0.5rem" })]}>
								<CalendarIcon size={15} aria-hidden="true" />
								<span>{COPY.people.joined(joined)}</span>
							</li>
						</ul>
					</aside>
					<HeadingScope level={2}>
						<div mix={[raw({ display: "grid", gap: "1.75rem", minInlineSize: 0 })]}>
							<PinnedRepos repos={repos} />
							<Contributions
								days={days}
								year={year}
								years={years}
								today={today}
								page={href(`u/${person.handle}`)}
							/>
							<Activity items={activity} now={now} empty={COPY.people.noActivity(person.name)} />
						</div>
					</HeadingScope>
				</div>
			</div>
		);
	};
}

namespace OrgScreen {
	export interface Props {
		repos: readonly PinnedRepo[];
		members: readonly Person[];
		activity: readonly ActivityItem[];
		now: number;
	}
}

/** Renders the org's page: its header, pinned repositories, members and recent activity. */
export function OrgScreen(handle: Handle<OrgScreen.Props>) {
	return () => {
		let { activity, members, now, repos } = handle.props;
		return (
			<>
				<PageHeader
					title={
						<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })]}>
							<span
								mix={[
									raw({
										display: "inline-flex",
										"& svg": { inlineSize: "2.5rem", blockSize: "2.5rem" },
									}),
								]}
							>
								<DeltaMark />
							</span>
							<span mix={[font("mono")]}>{COPY.org}</span>
						</span>
					}
					description={
						<span mix={[raw({ display: "grid", gap: "0.375rem" })]}>
							<span>{COPY.people.orgBio}</span>
							<span
								mix={[
									raw({ display: "flex", flexWrap: "wrap", gap: "0.375rem 1rem" }),
									text("sm"),
									fg("neutral.muted"),
								]}
							>
								<span
									mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}
								>
									<LinkIcon size={14} aria-hidden="true" />
									<a href="/" mix={[fg("brand")]}>
										sdxc.dev
									</a>
								</span>
								<span
									mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.375rem" })]}
								>
									<UsersIcon size={14} aria-hidden="true" />
									{COPY.people.members(members.length)}
								</span>
							</span>
						</span>
					}
				/>
				<HeadingScope level={2}>
					<div mix={[raw({ containerName: "delta-profile", containerType: "inline-size" })]}>
						<div
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "minmax(0, 1fr)",
									gap: "1.75rem",
									"@container delta-profile (min-width: 56rem)": {
										gridTemplateColumns: "minmax(0, 1fr) 17rem",
										gap: "2rem",
									},
								}),
							]}
						>
							<div
								mix={[
									raw({ display: "grid", gap: "1.75rem", alignContent: "start", minInlineSize: 0 }),
								]}
							>
								<PinnedRepos repos={repos} />
								<Activity items={activity} now={now} empty={COPY.people.noOrgActivity} />
							</div>
							<section
								aria-labelledby="delta-members"
								mix={[raw({ display: "grid", gap: "0.625rem", alignContent: "start" })]}
							>
								<SectionTitle id="delta-members">{COPY.people.membersTitle}</SectionTitle>
								<ul
									mix={[
										raw({
											listStyle: "none",
											margin: 0,
											padding: 0,
											display: "grid",
											gap: "0.25rem",
										}),
									]}
								>
									{members.map((member) => (
										<li>
											<a
												href={href(`u/${member.handle}`)}
												data-rmx-prefetch="intent"
												mix={[
													raw({
														display: "grid",
														gridTemplateColumns: "auto minmax(0, 1fr)",
														columnGap: "0.625rem",
														alignItems: "center",
														padding: "0.375rem 0.5rem",
														marginInline: "-0.5rem",
														borderRadius: "var(--ui-radius-md)",
														textDecoration: "none",
														color: "inherit",
														"&:hover": { background: "var(--ui-neutral-bg-tint-hover)" },
													}),
												]}
											>
												<span mix={[raw({ gridRow: "1 / span 2" })]}>
													<InitialsTile name={member.name} size={32} />
												</span>
												<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>
													{member.name}
												</span>
												<span mix={[text("xs"), fg("neutral.muted")]}>
													<span mix={[font("mono")]}>{member.handle}</span>
													{` · ${member.role}`}
												</span>
											</a>
										</li>
									))}
								</ul>
							</section>
						</div>
					</div>
				</HeadingScope>
			</>
		);
	};
}
