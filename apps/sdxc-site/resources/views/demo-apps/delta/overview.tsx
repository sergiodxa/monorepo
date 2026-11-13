/**
 * Delta's dashboard as the router reaches it: what waits on the signed-in person, read from
 * the seeded pull requests, issues and runs with the visitor's own work applied, beside the
 * repository as their settings left it and its newest real commits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import type { DeltaCommit, DeltaCommitMeta, DeltaHistory } from "~/app/services/delta/source";
import type { DemoAppRequest } from "~/resources/views/demo-apps";

import { loadRuns } from "./ci";
import { COPY } from "./labels";
import { readPrefs } from "./prefs";
import { allPulls } from "./pull-records";
import { allIssues, seedBase } from "./records";
import { DashboardScreen } from "./screens/dashboard";
import { ME } from "./seed/people";
import { readState } from "./state";

/** A screen as Delta's router draws it. */
interface Screen {
	title: string;
	nav: string;
	crumb: string;
	body: RemixNode;
}

/**
 * Draws the dashboard for a request: the visitor's open pull requests and the reviews asked
 * of them, the open issues assigned to them and every failed run, newest first.
 *
 * @param request The page request, whose cookies hold the visitor's work and settings.
 * @param context The history, the file count, the newest commit and the request's time.
 */
export async function dashboardScreen(
	request: DemoAppRequest,
	context: {
		history: DeltaHistory;
		files: number;
		latest: DeltaCommit | DeltaCommitMeta | undefined;
		now: number;
	},
): Promise<Screen> {
	let { files, history, latest, now } = context;
	let state = readState(request.cookie);
	let [pulls, { runs }] = await Promise.all([allPulls(state, now), loadRuns(now)]);
	let open = pulls.filter((pull) => pull.state === "open");
	let issues = allIssues(state, seedBase(history.commits[0]?.date, now)).filter(
		(issue) => issue.state === "open" && issue.assignees.includes(ME),
	);
	return {
		title: COPY.dashboard.title,
		nav: "dashboard",
		crumb: COPY.dashboard.title,
		body: (
			<DashboardScreen
				history={history}
				files={files}
				latest={latest}
				pulls={open.filter((pull) => pull.author === ME)}
				reviews={open.filter((pull) =>
					pull.reviewers.some(
						(reviewer) => reviewer.handle === ME && reviewer.state === "requested",
					),
				)}
				issues={issues}
				failures={runs.filter((run) => run.status === "failure")}
				settings={readPrefs(request.cookie).settings}
				now={now}
			/>
		),
	};
}
