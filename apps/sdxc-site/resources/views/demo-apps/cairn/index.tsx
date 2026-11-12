/**
 * Cairn, the issue tracker demo: Saltmarsh's two teams, their issues as grouped lists and
 * boards, projects on a roadmap, cycles with burn-up charts, and an inbox. What the visitor
 * changes, creates and comments lives in their own cookies. Lichen green on cool slate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import { CompassIcon } from "@sdxc/icons";
import { LinkButton } from "@sdxc/ui";
import { readAppShellCookie } from "@sdxc/ui/app/app-shell";
import { Empty } from "@sdxc/ui/app/empty";
import { readSplitViewLayout } from "@sdxc/ui/app/split-view";
import { generateUUID } from "@sdxc/uuid/v4";

import type {
	DemoApp,
	DemoAppRedirect,
	DemoAppRequest,
	DemoAppScreen,
} from "~/resources/views/demo-apps";

import type { CreateDraft } from "./create";
import type { ListScope } from "./list";
import type { Edit, VisitorState } from "./state";

import { BoardScreen } from "./board";
import { CreateIssuePage, TITLE_LIMIT, blankDraft } from "./create";
import { BurnUpChart, CycleHeader, CycleStats, CyclesScreen, cycleTitle } from "./cycles";
import {
	CYCLES,
	ISSUES,
	ME,
	PROJECTS,
	TEAMS,
	VIEWS,
	findCycle,
	findProject,
	findTeam,
	findView,
	href,
	isClosed,
} from "./data";
import { IssueDetail } from "./detail";
import { InboxScreen } from "./inbox";
import { IssueListScreen, SPLIT_COOKIE } from "./list";
import { ProjectHeader, ProjectsScreen } from "./projects";
import { RoadmapScreen } from "./roadmap";
import { CairnShell, SHELL_COOKIE } from "./shell";
import {
	allIssues,
	asAssignee,
	asPriority,
	asStatus,
	clearCookies,
	commentsCookie,
	createdCookie,
	currentFields,
	editCookie,
	findIssue,
	isPersonal,
	nextIssueId,
	readState,
} from "./state";
import { CairnThumbnail } from "./thumbnail";

/** Lichen green at hue 145: muted and leafy, its 600 step dark enough for white text. */
const BRAND = [
	"oklch(0.972 0.016 140)",
	"oklch(0.94 0.035 140)",
	"oklch(0.89 0.065 142)",
	"oklch(0.82 0.1 143)",
	"oklch(0.73 0.13 144)",
	"oklch(0.64 0.14 145)",
	"oklch(0.54 0.13 146)",
	"oklch(0.46 0.11 147)",
	"oklch(0.385 0.09 148)",
	"oklch(0.31 0.07 150)",
	"oklch(0.22 0.05 152)",
] as const;

/** Cool slate with a trace of sea green, so the chrome reads like weathered stone. */
const NEUTRAL = [
	"oklch(0.975 0.003 170)",
	"oklch(0.952 0.004 170)",
	"oklch(0.91 0.006 170)",
	"oklch(0.855 0.008 170)",
	"oklch(0.72 0.01 170)",
	"oklch(0.6 0.011 170)",
	"oklch(0.5 0.011 170)",
	"oklch(0.415 0.01 170)",
	"oklch(0.32 0.009 170)",
	"oklch(0.225 0.008 170)",
	"oklch(0.16 0.006 170)",
] as const;

/**
 * A humanist sans with a monospace for ids and estimates, tight square corners, a narrow
 * sidebar and a wide list beside an open issue.
 */
const TOKENS = {
	"--ui-font-sans":
		'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, system-ui, sans-serif',
	"--ui-font-mono": '"SF Mono", ui-monospace, "Cascadia Code", Menlo, Consolas, monospace',
	"--ui-radius-md": "0.25rem",
	"--ui-radius-lg": "0.375rem",
	"--ui-button-radius": "0.25rem",
	"--ui-app-sidebar-width": "14.5rem",
	"--ui-app-list-width": "28rem",
	"--ui-app-inset-radius": "0.5rem",
} as const;

/** What a bulk action did, as its toast says it. */
const BULK_TOASTS = {
	"status-started": "Issues moved to In Progress",
	"status-done": "Issues marked done",
	"assign-me": "Issues assigned to you",
	"priority-1": "Issues marked urgent",
} as const;

/** Every toast a redirect can name: the bulk bar's and the reset, nothing for single edits. */
const TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	...Object.fromEntries(
		Object.entries(BULK_TOASTS).map(([key, title]) => [`bulk-${key}`, { title }]),
	),
	reset: { title: "Demo reset", description: "Your edits, issues and comments are cleared." },
};

/** The screens a visitor reaches by clicking, My issues first. */
const SCREENS = [
	"",
	"?issue=WEB-118",
	"?group=priority",
	"?density=comfortable",
	"?status=todo&status=started",
	"?q=zebra",
	"inbox",
	"inbox?issue=PLT-214",
	"inbox?issue=WEB-140",
	...TEAMS.flatMap((team) => [`team/${team.id}`, `team/${team.id}/board`]),
	"team/web?issue=WEB-124",
	"team/web?group=assignee",
	"team/web?group=project&order=updated",
	"team/web?label=bug",
	"team/web/board?issue=WEB-130",
	"team/plat?issue=PLT-207",
	...VIEWS.map((view) => `views/${view.id}`),
	"projects",
	...PROJECTS.map((project) => `projects/${project.id}`),
	"roadmap",
	"roadmap?show=closed",
	"cycles",
	...CYCLES.map((cycle) => `cycles/${cycle.id}`),
	...ISSUES.slice(0, 4).map((issue) => `issue/${issue.id}`),
	"new",
];

/** The app's own 404, inside the shell so the sidebar still leads somewhere. */
function notFound(collapsed: boolean, state: VisitorState): DemoAppScreen {
	return {
		title: "Page not found",
		status: 404,
		body: (
			<CairnShell current="none" collapsed={collapsed} crumb="Not found" state={state} from="">
				<Empty icon={<CompassIcon />}>
					<Empty.Title>Nothing lives at this address</Empty.Title>
					<Empty.Description>
						The issue may have moved to another team, or the link is mistyped. Your issues are one
						click away.
					</Empty.Description>
					<Empty.Action>
						<LinkButton href={href()}>Go to My issues</LinkButton>
					</Empty.Action>
				</Empty>
			</CairnShell>
		),
	};
}

/** The scope of a saved view. */
function viewScope(id: string): ListScope | undefined {
	let view = findView(id);
	if (!view) return undefined;
	let rules: Record<string, ListScope["includes"]> = {
		urgent: (issue) => (issue.priority === 1 || issue.priority === 2) && !isClosed(issue.status),
		"unassigned-bugs": (issue) =>
			issue.labels.includes("bug") && !issue.assignee && !isClosed(issue.status),
		"in-review": (issue) => issue.status === "review",
	};
	let includes = rules[view.id] ?? (() => false);
	return {
		page: `views/${view.id}`,
		title: view.name,
		description: view.description,
		section: `view:${view.id}`,
		includes,
	};
}

/**
 * Picks the list scope a page path names, or `undefined` when the path names no list.
 *
 * @param first The path's first segment.
 * @param second The path's second segment.
 * @param issues The visitor's issues, for a project's or cycle's header.
 */
function listScope(
	first: string,
	second: string | undefined,
	issues: ReturnType<typeof allIssues>,
): ListScope | undefined {
	if ((first === "" || first === "my") && second === undefined) {
		return {
			page: "my",
			title: "My issues",
			description: "assigned to you",
			section: "my",
			hide: ["assignee"],
			includes: (issue) => issue.assignee === ME,
		};
	}
	if (first === "team" && second !== undefined) {
		let team = findTeam(second);
		if (!team) return undefined;
		return {
			page: `team/${team.id}`,
			title: `${team.name} issues`,
			description: `every ${team.name} issue`,
			section: `team:${team.id}`,
			team: team.id,
			includes: (issue) => issue.team === team.id,
		};
	}
	if (first === "views" && second !== undefined) return viewScope(second);
	if (first === "projects" && second !== undefined) {
		let project = findProject(second);
		if (!project) return undefined;
		return {
			page: `projects/${project.id}`,
			title: project.name,
			description: project.summary,
			section: "projects",
			team: project.team,
			hide: ["project"],
			includes: (issue) => issue.project === project.id,
			header: <ProjectHeader project={project} issues={issues} />,
		};
	}
	if (first === "cycles" && second !== undefined) {
		let cycle = findCycle(second);
		if (!cycle) return undefined;
		let { title, description } = cycleTitle(cycle);
		return {
			page: `cycles/${cycle.id}`,
			title,
			description,
			section: `cycle:${cycle.id}`,
			team: cycle.team,
			includes: (issue) => issue.cycle === cycle.id,
			header: <CycleHeader cycle={cycle} issues={issues} />,
		};
	}
	return undefined;
}

/**
 * Answers a page path with its screen, or `null` when no screen lives there.
 *
 * @param request The page and its address.
 * @param state The visitor's state.
 * @param draft A refused create form to show again.
 */
function route(
	request: DemoAppRequest,
	state: VisitorState,
	draft?: { draft: CreateDraft; title: string; from: string },
): DemoAppScreen | null {
	let { page, url, cookie } = request;
	let collapsed = readAppShellCookie(cookie, SHELL_COOKIE);
	let layout = readSplitViewLayout(cookie, SPLIT_COOKIE);
	let issues = allIssues(state);
	let [first = "", second, third, ...rest] = page.split("/");
	if (rest.length > 0) return null;

	if (first === "team" && third === "board") {
		let team = findTeam(second);
		if (!team) return null;
		return {
			title: `${team.name} board`,
			body: (
				<BoardScreen
					team={team}
					state={state}
					issues={issues.filter((issue) => issue.team === team.id)}
					url={url}
					collapsed={collapsed}
				/>
			),
		};
	}
	if (third !== undefined) return null;

	let scope = listScope(first, second, issues);
	if (scope) {
		let open = url.searchParams.get("issue");
		let scoped = issues.filter(scope.includes);
		let title =
			open && scoped.some((issue) => issue.id === open) ? `${open} · ${scope.title}` : scope.title;
		return {
			title,
			body: (
				<IssueListScreen
					scope={scope}
					state={state}
					url={url}
					collapsed={collapsed}
					layout={layout}
					issues={scoped}
				/>
			),
		};
	}
	if (second !== undefined && first !== "issue") return null;

	if (first === "inbox") {
		return {
			title: "Inbox",
			body: (
				<InboxScreen
					state={state}
					issues={issues}
					open={url.searchParams.get("issue")}
					collapsed={collapsed}
					layout={layout}
				/>
			),
		};
	}
	if (first === "projects") {
		return {
			title: "Projects",
			body: <ProjectsScreen state={state} issues={issues} collapsed={collapsed} />,
		};
	}
	if (first === "roadmap") {
		return {
			title: "Roadmap",
			body: (
				<RoadmapScreen
					state={state}
					issues={issues}
					collapsed={collapsed}
					tab={url.searchParams.get("show") === "closed" ? "closed" : "active"}
				/>
			),
		};
	}
	if (first === "cycles") {
		return {
			title: "Cycles",
			body: <CyclesScreen state={state} issues={issues} collapsed={collapsed} />,
		};
	}
	if (first === "issue" && second !== undefined) {
		let issue = findIssue(second, state);
		if (!issue) return null;
		return {
			title: `${issue.id} ${issue.title}`,
			body: (
				<CairnShell
					current={`team:${issue.team}`}
					collapsed={collapsed}
					crumb={`${findTeam(issue.team)?.name ?? ""} › ${issue.id}`}
					state={state}
					team={issue.team}
					from={`issue/${issue.id}`}
					flush
				>
					<IssueDetail issue={issue} state={state} returnTo={`issue/${issue.id}`} level={1} />
				</CairnShell>
			),
		};
	}
	if (first === "new") {
		let from = draft?.from ?? "";
		return {
			title: "Create issue",
			body: (
				<CairnShell
					current="none"
					collapsed={collapsed}
					crumb="Create issue"
					state={state}
					from={from}
				>
					<CreateIssuePage
						draft={
							draft?.draft ?? blankDraft(url.searchParams.get("team") === "plat" ? "plat" : "web")
						}
						issues={draft ? { title: draft.title } : undefined}
						from={from}
					/>
				</CairnShell>
			),
		};
	}
	return null;
}

/** Answers one of Cairn's frames: a cycle's figures or its burn-up chart. */
function framePart(part: string, request: DemoAppRequest): RemixNode | null {
	let [first, id, kind, ...rest] = part.split("/");
	if (first !== "cycles" || rest.length > 0) return null;
	let cycle = findCycle(id);
	if (!cycle) return null;
	let issues = allIssues(readState(request.cookie));
	if (kind === "stats") return <CycleStats cycle={cycle} issues={issues} />;
	if (kind === "chart") return <BurnUpChart cycle={cycle} issues={issues} />;
	return null;
}

/**
 * The text of a form field, or `""` when it is missing or a file. A field sent twice reads as
 * its last value: a board's drop and a menu's submitter both come after the form's own fields.
 */
function field(form: FormData, name: string): string {
	let value = form.getAll(name).at(-1);
	return typeof value === "string" ? value : "";
}

/**
 * The page a form came from, from its `from` field: a page path under the app, never an
 * address elsewhere; an unreadable one falls back to `fallback`.
 */
function fromPage(form: FormData, fallback: string): string {
	let value = field(form, "from");
	if (value === "" || value.includes("//") || value.startsWith("/") || value.includes("\\"))
		return fallback;
	return value;
}

/** The page an edit returns to: the page it posted to, with its query and without a toast. */
function postedPage(page: string, url: URL): string {
	let params = new URLSearchParams(url.search);
	params.delete("toast");
	let search = params.toString();
	return search === "" ? page : `${page}?${search}`;
}

/**
 * Answers an issue's form: a comment adds to the visitor's comments; a status, priority or
 * assignee replaces that field and keeps the others, recorded with the time it was saved.
 */
function submitIssue(
	id: string,
	form: FormData,
	state: VisitorState,
	back: string,
): DemoAppRedirect | null {
	let issue = findIssue(id, state);
	if (!issue) return null;

	if (field(form, "intent") === "comment") {
		let body = field(form, "body").trim();
		if (body === "") return { page: back };
		let comment = {
			id: `v-${generateUUID().slice(0, 8)}`,
			issue: issue.id,
			body: body.slice(0, 600),
			at: Date.now(),
		};
		return { page: back, hash: `comment-${comment.id}`, cookies: [commentsCookie(state, comment)] };
	}

	let edit: Edit = { ...currentFields(issue), at: Date.now() };
	let changed = false;
	if (form.has("status")) {
		let status = asStatus(field(form, "status"));
		if (!status) return null;
		edit.status = status;
		changed = true;
	}
	if (form.has("priority")) {
		let priority = asPriority(field(form, "priority"));
		if (priority === undefined) return null;
		edit.priority = priority;
		changed = true;
	}
	if (form.has("assignee")) {
		let assignee = asAssignee(field(form, "assignee"));
		if (assignee === undefined) return null;
		edit.assignee = assignee ?? undefined;
		changed = true;
	}
	if (!changed) return null;
	return { page: back, cookies: [editCookie(issue.id, edit)] };
}

/** Answers the bulk bar: the same change to every checked issue, and one toast for all of them. */
function submitBulk(form: FormData, state: VisitorState, back: string): DemoAppRedirect | null {
	let intent = field(form, "intent") as keyof typeof BULK_TOASTS;
	if (!Object.hasOwn(BULK_TOASTS, intent)) return null;
	let ids = form.getAll("ids").filter((value): value is string => typeof value === "string");
	let issues = ids.flatMap((id) => findIssue(id, state) ?? []);
	if (issues.length === 0) return { page: back };
	let at = Date.now();
	let cookies = issues.map((issue) => {
		let edit: Edit = { ...currentFields(issue), at };
		if (intent === "status-started") edit.status = "started";
		if (intent === "status-done") edit.status = "done";
		if (intent === "assign-me") edit.assignee = ME;
		if (intent === "priority-1") edit.priority = 1;
		return editCookie(issue.id, edit);
	});
	return { page: back, toast: `bulk-${intent}`, cookies };
}

/**
 * Answers the create form: a titled issue joins the visitor's issues and opens beside its
 * team's list; an untitled one answers the form again with everything typed.
 */
function submitCreate(
	form: FormData,
	request: DemoAppRequest,
	state: VisitorState,
): DemoAppRedirect | DemoAppScreen | null {
	let team = findTeam(field(form, "team"));
	let status = asStatus(field(form, "status"));
	let priority = asPriority(field(form, "priority"));
	let assignee = asAssignee(field(form, "assignee"));
	let project = field(form, "project");
	if (!team || !status || priority === undefined || assignee === undefined) return null;
	if (project !== "" && !findProject(project)) return null;

	let title = field(form, "title").trim().slice(0, TITLE_LIMIT);
	let description = field(form, "description").trim().slice(0, 600);
	if (title === "") {
		let draft: CreateDraft = {
			title: field(form, "title"),
			description: field(form, "description"),
			team: team.id,
			status,
			priority,
			assignee: assignee ?? "none",
			project,
		};
		let screen = route({ ...request, page: "new" }, state, {
			draft,
			title: "Give the issue a title, then create it again.",
			from: fromPage(form, ""),
		});
		return screen ? { ...screen, status: 400 } : null;
	}

	let id = nextIssueId(state, team.id);
	let cookie = createdCookie(state, {
		id,
		team: team.id,
		title,
		description,
		status,
		priority,
		assignee: assignee ?? undefined,
		project: project === "" ? undefined : project,
		at: Date.now(),
	});
	return { page: `team/${team.id}?issue=${id}`, cookies: [cookie] };
}

/**
 * Cairn as the gallery and `/demo/apps/cairn` read it: its theme, every screen, its frames,
 * and how each form answers.
 */
export default {
	name: "Cairn",
	kind: "Issue tracker",
	tagline: "Issues, boards, projects on a roadmap and cycles for a product team.",
	artDirection: "Lichen green on cool slate, a humanist sans with mono ids, tight square corners.",
	description:
		"Cairn, an invented issue tracker: grouped issue lists with filters in the address, a drag-and-drop board, projects on a roadmap, cycles with burn-up charts and an inbox.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <CairnThumbnail />,
	screens: SCREENS,
	cookies: [SHELL_COOKIE, SPLIT_COOKIE],
	isPersonal,
	toasts: TOASTS,
	frame: (part, request) => framePart(part, request),
	render(request) {
		let state = readState(request.cookie);
		return (
			route(request, state) ?? notFound(readAppShellCookie(request.cookie, SHELL_COOKIE), state)
		);
	},
	submit(page, form, request) {
		let state = readState(request.cookie);
		if (page === "new") return submitCreate(form, request, state);
		if (page === "reset")
			return { page: "", toast: "reset", cookies: clearCookies(request.cookie) };
		if (route(request, state) === null) return null;
		let back = postedPage(page, request.url);
		if (form.has("issue")) return submitIssue(field(form, "issue"), form, state, back);
		if (form.has("bulk")) return submitBulk(form, state, back);
		return null;
	},
} satisfies DemoApp;
