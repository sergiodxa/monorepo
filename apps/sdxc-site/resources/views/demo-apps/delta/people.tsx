/**
 * Delta's people as the router reaches them: the org's page and each member's profile, with
 * contributions counted from git for the repository's real author and seeded for everyone
 * else, and activity drawn from real commits and the seeded runs and comments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import type { DeltaCommit, DeltaCommitMeta } from "~/app/services/delta/source";
import type { DemoAppRequest } from "~/resources/views/demo-apps";

import { readHistory } from "~/app/services/delta/source";

import type { DeltaRoute } from "./data";
import type { ActivityItem } from "./screens/people";
import type { Run } from "./seed/actions";
import type { ContributionDay, Person } from "./seed/people";

import { loadRuns } from "./ci";
import { COPY } from "./labels";
import { OrgScreen, UserScreen } from "./screens/people";
import { buildNotifications } from "./seed/notifications";
import { PEOPLE, findPerson, personByName, seededContributions } from "./seed/people";
import { PINS, REPOS } from "./seed/repos";

/** A screen as Delta's router draws it. */
interface Screen {
	title: string;
	nav: string;
	crumb: string;
	body: RemixNode;
}

/** How many rows an activity list shows. */
const ACTIVITY = 8;

/** A commit's author as a handle, for the one real person; the name as written otherwise. */
function handleOf(name: string): string {
	return personByName(name)?.handle ?? name;
}

/** Whether a person wrote a commit, as its author or a co-author. */
function wrote(person: Person, commit: DeltaCommit | DeltaCommitMeta): boolean {
	let coAuthors = "coAuthors" in commit ? commit.coAuthors : [];
	return commit.author === person.name || coAuthors.includes(person.name);
}

/** A pushed commit as an activity row. */
function pushed(commit: DeltaCommitMeta): ActivityItem {
	return {
		at: Date.parse(commit.date),
		actor: handleOf(commit.author),
		verb: COPY.people.pushed,
		target: { kind: "commit", sha: commit.sha, subject: commit.subject },
	};
}

/** A run someone started as an activity row. */
function ran(run: Run): ActivityItem {
	return {
		at: run.startedAt,
		actor: run.actor,
		verb: COPY.people.ran(`${run.workflow.name} #${run.id}`),
		target: { kind: "run", id: run.id, title: run.title, status: run.status },
	};
}

/**
 * A real person's contributions: one per commit they wrote or co-wrote, on the day their
 * clock said, as git records the author date with its offset.
 */
function realContributions(person: Person, commits: readonly DeltaCommit[]): ContributionDay[] {
	let counts = new Map<string, number>();
	for (let commit of commits) {
		if (!wrote(person, commit)) continue;
		let day = commit.date.slice(0, 10);
		counts.set(day, (counts.get(day) ?? 0) + 1);
	}
	return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

/**
 * Answers the org's page or a member's profile; `null` for a handle no member has, which the
 * router answers with its 404.
 *
 * @param target The route the address names.
 * @param request The page request, whose `?year=` picks the profile's year.
 * @param now The request's time.
 */
export async function peopleScreen(
	target: Extract<DeltaRoute, { screen: "org" | "user" }>,
	request: DemoAppRequest,
	now: number,
): Promise<Screen | null> {
	let [history, { runs }] = await Promise.all([readHistory(), loadRuns(now)]);
	let commits = history.commits;
	if (target.screen === "org") {
		let activity = [...commits.slice(0, ACTIVITY).map(pushed), ...runs.map(ran)]
			.sort((a, b) => b.at - a.at)
			.slice(0, ACTIVITY);
		return {
			title: COPY.org,
			nav: "org",
			crumb: COPY.org,
			body: <OrgScreen repos={REPOS} members={PEOPLE} activity={activity} now={now} />,
		};
	}
	let person = findPerson(target.handle);
	if (person === undefined) return null;
	let today = new Date(now).toISOString().slice(0, 10);
	let days = person.real ? realContributions(person, commits) : seededContributions(person, today);
	let years = [...new Set(days.map((day) => Number(day.date.slice(0, 4))))].sort((a, b) => b - a);
	let asked = Number(request.url.searchParams.get("year"));
	let year = years.includes(asked) ? asked : null;
	let notes = buildNotifications(runs, commits, now).filter(
		(note) => note.actor === person.handle && note.kind === "commit",
	);
	let activity: ActivityItem[] = [
		...commits.filter((commit) => wrote(person, commit)).map(pushed),
		...runs.filter((run) => run.actor === person.handle).map(ran),
		...notes.map((note) => ({
			at: note.at,
			actor: person.handle,
			verb: COPY.people.commented,
			target: { kind: "commit" as const, sha: String(note.target), subject: note.title },
		})),
	]
		.sort((a, b) => b.at - a.at)
		.slice(0, ACTIVITY);
	let pins = (PINS[person.handle] ?? ["delta"]).flatMap(
		(name) => REPOS.find((repo) => repo.name === name) ?? [],
	);
	return {
		title: `${person.name} (${person.handle})`,
		nav: "org",
		crumb: person.handle,
		body: (
			<UserScreen
				person={person}
				repos={pins}
				days={days}
				year={year}
				years={years}
				activity={activity}
				today={today}
				now={now}
			/>
		),
	};
}
