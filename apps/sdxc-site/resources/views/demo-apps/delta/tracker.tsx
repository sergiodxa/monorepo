/**
 * Delta's issue screens as the router reaches them: each address's screen drawn from the seeds
 * and the visitor's cookies, the counts the repository tabs show, and every form those screens
 * post, answered by redirecting back with the visitor's work in a cookie.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import { generateUUID } from "@sdxc/uuid/v4";

import type { DemoAppRedirect, DemoAppRequest } from "~/resources/views/demo-apps";

import { readAnchors, readHistory, readTree } from "~/app/services/delta/source";

import type { DeltaRoute } from "./data";
import type { CiteContext } from "./markup";

import { issueHref, issuesHref, parsePage, pullHref, pullsHref } from "./data";
import { COPY } from "./labels";
import { allPulls, findPull } from "./pull-records";
import { allIssues, findIssue, seedBase } from "./records";
import { IssueScreen } from "./screens/issue";
import { IssuesScreen } from "./screens/issues";
import { PullScreen } from "./screens/pull";
import { PullsScreen } from "./screens/pulls";
import { LABELS, MILESTONES } from "./seed/issues";
import { ME, PEOPLE } from "./seed/people";
import { PULLS } from "./seed/pulls";
import { clearCookies, commentsCookie, editOf, readState, recordCookie } from "./state";

/** The repository's name as titles and the top bar write it. */
const REPO_NAME = `${COPY.org}/${COPY.repo}`;

/** The toasts these screens' forms name. */
export const TRACKER_TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	"issues-close": { title: "Issues closed" },
	"issues-reopen": { title: "Issues reopened" },
	"issues-assign-me": { title: "Issues assigned to you" },
	merged: { title: "Pull request merged" },
};

/** A screen as Delta's router draws it. */
interface Screen {
	title: string;
	nav: string;
	crumb: string;
	body: RemixNode;
	status?: number;
}

/** The moment seeds count back from, for this build's history. */
async function readBase(now: number): Promise<number> {
	let history = await readHistory();
	return seedBase(history.commits[0]?.date, now);
}

/** Each file's lines at the deployed commit, split once per isolate. */
let splitFiles: Promise<Map<string, string[]>> | undefined;

/**
 * What a body needs to cite code and link `#number`: the anchors, the deployed files' lines,
 * and an address for every number that has a page.
 */
async function citeContext(): Promise<CiteContext> {
	splitFiles ??= readTree().then(
		(tree) =>
			new Map(
				tree.files.map((file) => [file.path, file.text.replace(/\r?\n$/, "").split(/\r?\n/)]),
			),
	);
	let [anchors, files] = await Promise.all([readAnchors(), splitFiles]);
	let issues = new Set(
		allIssues({ records: new Map(), comments: [] }, 0).map((issue) => issue.number),
	);
	let pulls = new Set(PULLS.map((pull) => pull.number));
	return {
		anchors,
		lines: (path) => files.get(path),
		refHref: (number) => {
			if (issues.has(number)) return issueHref(number);
			return pulls.has(number) ? pullHref(number) : undefined;
		},
	};
}

/**
 * The counts the repository tabs show for one visitor: open issues, after their own closes
 * and reopens.
 */
export async function repoCounts(cookie: string | null): Promise<Record<string, number>> {
	let state = readState(cookie);
	let base = await readBase(Date.now());
	let pulls = await allPulls(state, Date.now());
	return {
		issues: allIssues(state, base).filter((issue) => issue.state === "open").length,
		pulls: pulls.filter((pull) => pull.state === "open").length,
	};
}

/**
 * Draws an issue screen, or `null` for an address none of them answers.
 *
 * @param target The route the address names.
 * @param request The request, whose cookie carries the visitor's work.
 * @param shared The commit count and the request's time, as every repository screen takes them.
 */
export async function trackerScreen(
	target: DeltaRoute,
	request: DemoAppRequest,
	shared: { commits: number; now: number },
): Promise<Screen | null> {
	let state = readState(request.cookie);
	let base = await readBase(shared.now);
	if (target.screen === "issues") {
		return {
			title: `${COPY.issues.title} · ${REPO_NAME}`,
			nav: "repo",
			crumb: `${REPO_NAME} › ${COPY.issues.title}`,
			body: (
				<IssuesScreen
					issues={allIssues(state, base)}
					url={request.url}
					now={shared.now}
					commits={shared.commits}
				/>
			),
		};
	}
	if (target.screen === "pulls") {
		return {
			title: `${COPY.pulls.title} · ${REPO_NAME}`,
			nav: "repo",
			crumb: `${REPO_NAME} › ${COPY.pulls.title}`,
			body: (
				<PullsScreen
					pulls={await allPulls(state, shared.now)}
					url={request.url}
					now={shared.now}
					commits={shared.commits}
				/>
			),
		};
	}
	if (target.screen === "pull" && target.tab === "conversation") {
		let pull = await findPull(target.number, state, shared.now);
		if (pull === undefined) return null;
		return {
			title: COPY.pull.title(pull.title, pull.number),
			nav: "repo",
			crumb: `${REPO_NAME} › #${pull.number}`,
			body: (
				<PullScreen
					pull={pull}
					context={await citeContext()}
					now={shared.now}
					commits={shared.commits}
					listHref={pullsHref()}
				/>
			),
		};
	}
	if (target.screen === "issue") {
		let issue = findIssue(target.number, state, base);
		if (issue === undefined) return null;
		return {
			title: COPY.issue.title(issue.title, issue.number),
			nav: "repo",
			crumb: `${REPO_NAME} › #${issue.number}`,
			body: (
				<IssueScreen
					issue={issue}
					context={await citeContext()}
					now={shared.now}
					commits={shared.commits}
					listHref={issuesHref()}
				/>
			),
		};
	}
	return null;
}

/** The text of a form field, or `""` when it is missing or a file. */
function field(form: FormData, name: string): string {
	let value = form.getAll(name).at(-1);
	return typeof value === "string" ? value : "";
}

/** Every text value a form posts under one name. */
function fields(form: FormData, name: string): string[] {
	return form.getAll(name).filter((value): value is string => typeof value === "string");
}

/** The page a post on `page` returns to, keeping its query and dropping what only the post used. */
function backTo(page: string, url: URL): string {
	let params = new URLSearchParams(url.search);
	for (let name of ["toast", "set", "at", "do", "thread"]) params.delete(name);
	let search = params.toString();
	return search === "" ? page : `${page}?${search}`;
}

/** Whether a handle names a member of the org. */
function isMember(handle: string): boolean {
	return PEOPLE.some((person) => person.handle === handle);
}

/**
 * Answers a side panel picker on an issue or pull request: the field it names is replaced
 * whole by what the picker posted, so unchecking everything clears it.
 */
function submitPicker(
	number: number,
	set: string,
	form: FormData,
	back: string,
	request: DemoAppRequest,
): DemoAppRedirect | null {
	let edit = editOf(readState(request.cookie), number);
	if (set === "labels") {
		edit.labels = fields(form, "label").filter((id) => LABELS.some((label) => label.id === id));
	} else if (set === "assignees") {
		edit.assignees = fields(form, "assignee").filter(isMember).slice(0, 10);
	} else if (set === "reviewers") {
		edit.reviewers = fields(form, "reviewer").filter(isMember).slice(0, 15);
	} else if (set === "milestone") {
		let milestone = field(form, "milestone");
		if (milestone !== "" && !MILESTONES.some((entry) => entry.id === milestone)) return null;
		edit.milestone = milestone === "" ? null : milestone;
	} else {
		return null;
	}
	return { page: back, cookies: [recordCookie(number, edit)] };
}

/**
 * Answers a pull request's conversation: a comment, a reply in a thread (landing on it), a
 * thread resolved or reopened, a picker, and a merge, which redraws the page with its toast.
 */
function submitPull(
	number: number,
	form: FormData,
	request: DemoAppRequest,
): DemoAppRedirect | null {
	let seed = PULLS.find((pull) => pull.number === number);
	if (seed === undefined) return null;
	let state = readState(request.cookie);
	let back = backTo(`delta/pull/${number}`, request.url);
	let params = request.url.searchParams;
	let set = params.get("set");
	if (set !== null) return submitPicker(number, set, form, back, request);
	let verb = params.get("do");
	let thread = params.get("thread");
	let edit = editOf(state, number);
	if (verb === "merge") {
		if (edit.merged !== undefined || seed.state !== "open") return { page: back };
		let method = field(form, "method");
		edit.merged = {
			at: Date.now(),
			method: method === "squash" || method === "rebase" ? method : "merge",
		};
		return { page: back, hash: "merged", toast: "merged", cookies: [recordCookie(number, edit)] };
	}
	if (thread !== null && verb === "resolve") {
		edit.resolved = { ...edit.resolved, [thread]: field(form, "resolved") === "true" };
		return { page: back, hash: `thread-${thread}`, cookies: [recordCookie(number, edit)] };
	}
	let body = field(form, "body").trim().slice(0, 600);
	if (body === "") return { page: back };
	let comment = {
		id: `v-${generateUUID().slice(0, 8)}`,
		number,
		thread: thread !== null && verb === "reply" ? thread : undefined,
		body,
		at: Date.now(),
	};
	if (comment.thread === undefined && field(form, "intent") !== "comment") return null;
	let hash = comment.thread === undefined ? `comment-${comment.id}` : `discussion-${comment.id}`;
	return { page: back, hash, cookies: [commentsCookie(state, comment)] };
}

/**
 * Answers an issue's forms: a comment joins the visitor's comments and the page lands on it;
 * Close and Reopen change the state, closing with the typed text as a comment when there is
 * one; a side panel picker replaces its field whole.
 */
function submitIssue(
	number: number,
	form: FormData,
	request: DemoAppRequest,
): DemoAppRedirect | null {
	let state = readState(request.cookie);
	let issue = findIssue(number, state, 0);
	if (issue === undefined) return null;
	let back = backTo(`delta/issues/${number}`, request.url);
	let set = request.url.searchParams.get("set");
	let edit = editOf(state, number);
	if (set !== null) return submitPicker(number, set, form, back, request);
	let intent = field(form, "intent");
	let body = field(form, "body").trim().slice(0, 600);
	let cookies: string[] = [];
	let hash: string | undefined;
	if (body !== "" && (intent === "comment" || intent === "close" || intent === "reopen")) {
		let comment = { id: `v-${generateUUID().slice(0, 8)}`, number, body, at: Date.now() };
		cookies.push(commentsCookie(state, comment));
		hash = `comment-${comment.id}`;
	}
	if (intent === "close" || intent === "reopen") {
		edit.state = intent === "close" ? "closed" : "open";
		cookies.push(recordCookie(number, edit));
	} else if (intent !== "comment") {
		return null;
	}
	return { page: back, hash, cookies };
}

/**
 * Answers the issues list's bulk bar: the same change to every checked issue, then the list
 * as it was, with one toast for all of them.
 */
function submitBulk(form: FormData, request: DemoAppRequest): DemoAppRedirect | null {
	let intent = field(form, "intent");
	if (intent !== "close" && intent !== "reopen" && intent !== "assign-me") return null;
	let state = readState(request.cookie);
	let numbers = fields(form, "ids").map(Number);
	let issues = allIssues(state, 0).filter((issue) => numbers.includes(issue.number));
	let back = backTo("delta/issues", request.url);
	if (issues.length === 0) return { page: back };
	let cookies = issues.map((issue) => {
		let edit = editOf(state, issue.number);
		if (intent === "close") edit.state = "closed";
		if (intent === "reopen") edit.state = "open";
		if (intent === "assign-me" && !issue.assignees.includes(ME)) {
			edit.assignees = [...issue.assignees, ME];
		}
		return recordCookie(issue.number, edit);
	});
	return { page: back, toast: `issues-${intent}`, cookies };
}

/**
 * Answers a post on one of these screens, or `null` for a page they don't own; Reset clears
 * every cookie the visitor's work is kept in.
 *
 * @param page The page path the form posted to.
 * @param form The form's fields.
 * @param request The request, whose address and cookie the answer reads.
 */
export function submitTracker(
	page: string,
	form: FormData,
	request: DemoAppRequest,
): DemoAppRedirect | null {
	if (page === "reset") return { page: "", toast: "reset", cookies: clearCookies(request.cookie) };
	let target = parsePage(page);
	if (target?.screen === "issue") return submitIssue(target.number, form, request);
	if (target?.screen === "pull") return submitPull(target.number, form, request);
	if (target?.screen === "issues" && form.has("bulk")) return submitBulk(form, request);
	return null;
}
