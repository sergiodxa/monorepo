/**
 * Delta's CI as the router reads it: the runs built from the real history and the anchors
 * their findings cite, the Actions, run and job screens drawn from them, and the running
 * job's log as a stream that writes one line at a time, the way a runner does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import type { DeltaAnchor } from "~/app/services/delta/source";
import type { DemoAppRequest } from "~/resources/views/demo-apps";

import { readAnchors, readHistory, readTree } from "~/app/services/delta/source";

import type { DeltaRoute } from "./data";
import type { Run, RunSites } from "./seed/actions";

import { COPY } from "./labels";
import { ActionsScreen } from "./screens/actions";
import { JobScreen, RunScreen } from "./screens/run";
import { FAILURE_ANCHOR, LIVE, WARNING_ANCHOR, buildRuns, liveStepLines } from "./seed/actions";

/** A CI screen, as the router wraps it in the shell. */
export interface CiScreen {
	title: string;
	nav: string;
	crumb: string;
	body: RemixNode;
}

/** The repository's name as titles write it. */
const REPO_NAME = `${COPY.org}/${COPY.repo}`;

/**
 * The real lines the failing run cites: the assertion with the two lines before it and one
 * after, read from the pinned file, and the line the check's warning names.
 */
async function readSites(anchors: Record<string, DeltaAnchor>): Promise<RunSites> {
	let tree = await readTree();
	let sites: RunSites = {};
	let failure = anchors[FAILURE_ANCHOR];
	if (failure?.status === "current") {
		let file = tree.files.find((candidate) => candidate.path === failure.path);
		let lines = file?.text.split("\n") ?? [];
		sites.failure = {
			path: failure.path,
			line: failure.start,
			excerpt: lines.slice(Math.max(0, failure.start - 3), failure.start + 1),
		};
	}
	let warning = anchors[WARNING_ANCHOR];
	if (warning?.status === "current") sites.warning = { path: warning.path, line: warning.start };
	return sites;
}

/**
 * Every run as of `now`, each joined to the commit it built, with the anchors their findings
 * cite.
 */
export async function loadRuns(now: number): Promise<{
	runs: Run[];
	anchors: Record<string, DeltaAnchor>;
}> {
	let [history, anchors] = await Promise.all([readHistory(), readAnchors()]);
	let runs = buildRuns(history.commits, now, await readSites(anchors));
	return { runs, anchors };
}

/**
 * Answers the Actions list, a run's summary or one of its jobs; `null` for a run or a job
 * the seed doesn't hold, which the router answers with its 404.
 *
 * @param target The route the address names.
 * @param request The page request, whose query holds the filters and the timestamps toggle.
 * @param context The commits on the branch, which the tabs count, and the request's time.
 */
export async function ciScreen(
	target: Extract<DeltaRoute, { screen: "actions" | "run" }>,
	request: DemoAppRequest,
	context: { commits: number; now: number },
): Promise<CiScreen | null> {
	let { commits, now } = context;
	let { anchors, runs } = await loadRuns(now);
	if (target.screen === "actions") {
		return {
			title: `${COPY.actions.title} · ${REPO_NAME}`,
			nav: "repo",
			crumb: `${REPO_NAME} › ${COPY.actions.title}`,
			body: <ActionsScreen runs={runs} url={request.url} commits={commits} now={now} />,
		};
	}
	let run = runs.find((candidate) => candidate.id === target.id);
	if (run === undefined) return null;
	let number = `${run.workflow.name} #${run.id}`;
	if (target.job === undefined) {
		return {
			title: `${run.title} · ${number}`,
			nav: "repo",
			crumb: `${REPO_NAME} › ${number}`,
			body: <RunScreen run={run} anchors={anchors} commits={commits} now={now} />,
		};
	}
	let job = run.jobs.find((candidate) => candidate.n === target.job);
	if (job === undefined) return null;
	return {
		title: `${job.name} · ${number}`,
		nav: "repo",
		crumb: `${REPO_NAME} › ${number}`,
		body: <JobScreen run={run} job={job} url={request.url} commits={commits} now={now} />,
	};
}

/** How long the stream waits before a line, in milliseconds: longer at a fold and at a result. */
function pause(text: string, index: number): number {
	if (text.startsWith("##[group]")) return 420;
	if (text.includes("✓") || text.includes("×")) return 140 + ((index * 37) % 160);
	return 70 + ((index * 53) % 90);
}

/** Resolves after `ms` milliseconds, or at once when the reader went away. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		let timer = setTimeout(resolve, ms);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				resolve();
			},
			{ once: true },
		);
	});
}

/**
 * Answers the running job's log after line `after`, one line per `\n` with its ISO time in
 * front, each written after a short pause so the page appends them as a runner prints. Any
 * other part answers `null`.
 *
 * @param part The stream's path, `runs/<id>/job/<n>`.
 * @param request The stream request; `after` names the last line the page already holds.
 */
export function ciStream(part: string, request: DemoAppRequest): ReadableStream<string> | null {
	if (part !== `runs/${LIVE.run}/job/${LIVE.job}`) return null;
	let after = Number(request.url.searchParams.get("after") ?? "0");
	if (!Number.isSafeInteger(after) || after < 0) return null;
	let controller = new AbortController();
	let now = Date.now();
	return new ReadableStream<string>({
		async start(stream) {
			let { runs } = await loadRuns(now);
			let run = runs.find((candidate) => candidate.id === LIVE.run);
			let lines = run === undefined ? [] : liveStepLines(run).filter((line) => line.n > after);
			for (let [index, line] of lines.entries()) {
				await wait(pause(line.text, index), controller.signal);
				if (controller.signal.aborted) return;
				stream.enqueue(`${line.ts === undefined ? "" : `${line.ts} `}${line.text}\n`);
			}
			stream.close();
		},
		cancel() {
			controller.abort();
		},
	});
}
