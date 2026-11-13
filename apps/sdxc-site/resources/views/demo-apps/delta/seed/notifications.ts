/**
 * Delta's seeded notifications: why each one reached the signed-in person (a failed run, a
 * mention, a comment on their commit), who caused it and what they wrote. Each points at a
 * real commit or a seeded run, so its title and time come from git and the run it names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeltaCommitMeta } from "~/app/services/delta/source";

import type { Run } from "./actions";

/** Why a notification reached the person, which the inbox filters and labels by. */
export type Reason = "ci_activity" | "mention" | "comment" | "author";

/** The reasons in the order the filter lists them. */
export const REASONS: readonly Reason[] = ["ci_activity", "mention", "comment", "author"];

/** What a notification is about. */
type Subject = { kind: "run"; run: number } | { kind: "commit"; commit: number };

/** A notification as the seed writes it, before it meets the runs and the history. */
interface NotificationSeed {
	id: string;
	reason: Reason;
	subject: Subject;
	actor: string;
	/** What the actor wrote, shown under the title. */
	excerpt?: string;
	/** Minutes after its subject happened. */
	after: number;
	unread: boolean;
}

/** Every notification, newest subject first. */
const NOTIFICATIONS: readonly NotificationSeed[] = [
	{
		id: "ci-812",
		reason: "ci_activity",
		subject: { kind: "run", run: 812 },
		actor: "sergiodxa",
		after: 2,
		unread: true,
	},
	{
		id: "mention-head",
		reason: "mention",
		subject: { kind: "commit", commit: 0 },
		actor: "mara",
		excerpt:
			"@sergiodxa the job graph scrolls inside its box on a phone now, but the matrix label wraps at 375. Worth a look before the next deploy?",
		after: 18,
		unread: true,
	},
	{
		id: "comment-added",
		reason: "comment",
		subject: { kind: "commit", commit: 1 },
		actor: "kenji",
		excerpt:
			"Histogram diff makes the blame on this one much easier to follow. The moved block in shell.tsx reads as a move now.",
		after: 47,
		unread: true,
	},
	{
		id: "ci-811",
		reason: "ci_activity",
		subject: { kind: "run", run: 811 },
		actor: "ines",
		after: 1,
		unread: false,
	},
	{
		id: "mention-readme",
		reason: "mention",
		subject: { kind: "commit", commit: 1 },
		actor: "ines",
		excerpt:
			"@sergiodxa the README's link to the extractor points at main. On a fork that 404s, so maybe link the commit instead?",
		after: 95,
		unread: false,
	},
	{
		id: "author-history",
		reason: "author",
		subject: { kind: "commit", commit: 2 },
		actor: "tlindqvist",
		excerpt:
			"Could we cap the baked history at 150 commits? The Worker has room today, but the patches grow faster than the files.",
		after: 30,
		unread: false,
	},
	{
		id: "ci-804",
		reason: "ci_activity",
		subject: { kind: "run", run: 804 },
		actor: "priya",
		after: 3,
		unread: false,
	},
];

/** A notification as the inbox draws it: the seed joined to the run or commit it names. */
export interface Notification {
	id: string;
	reason: Reason;
	/** The run's or commit's title. */
	title: string;
	kind: "run" | "commit";
	/** For a run, how it ended, which picks the icon. */
	state?: Run["status"];
	/** The run or commit it is about, by number or sha. */
	target: number | string;
	repo: string;
	actor: string;
	excerpt?: string;
	/** When it arrived, in epoch milliseconds. */
	at: number;
	unread: boolean;
	/** The run's name and number, such as "CI #812", for a run. */
	label?: string;
}

/**
 * Every notification, each joined to the run or commit it names and timed after it; one whose
 * run or commit isn't in the build is left out.
 *
 * @param runs Every run, as Actions lists them.
 * @param commits The history, newest first.
 * @param now The request's time; no notification arrives after it.
 */
export function buildNotifications(
	runs: readonly Run[],
	commits: readonly DeltaCommitMeta[],
	now: number,
): Notification[] {
	if (commits.length === 0) return [];
	let built = NOTIFICATIONS.flatMap((seed): Notification[] => {
		let common = {
			id: seed.id,
			reason: seed.reason,
			repo: "sdxc/delta",
			actor: seed.actor,
			excerpt: seed.excerpt,
			unread: seed.unread,
		};
		if (seed.subject.kind === "run") {
			let id = seed.subject.run;
			let run = runs.find((candidate) => candidate.id === id);
			if (run === undefined) return [];
			let ended = run.startedAt + run.seconds * 1000;
			return [
				{
					...common,
					kind: "run",
					title: run.title,
					state: run.status,
					target: run.id,
					label: `${run.workflow.name} #${run.id}`,
					at: Math.min(now - 60_000, ended + seed.after * 60_000),
				},
			];
		}
		let commit = commits[seed.subject.commit % commits.length]!;
		return [
			{
				...common,
				kind: "commit",
				title: commit.subject,
				target: commit.sha,
				at: Math.min(now - 60_000, Date.parse(commit.date) + seed.after * 60_000),
			},
		];
	});
	return built.sort((a, b) => b.at - a.at);
}
