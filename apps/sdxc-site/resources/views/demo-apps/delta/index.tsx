/**
 * Delta, the code-hosting demo: the `sdxc/delta` repository browsing its own source, with
 * every file, commit and blame line read from git when the site is built. Brass on warm
 * graphite, code-forward type and the tightest density of the demos.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Toast } from "@sdxc/ui/app";
import type { RemixNode } from "remix/component";

import { readAppShellCookie } from "@sdxc/ui/app/app-shell";

import type { DeltaFile } from "~/app/services/delta/source";
import type { DemoApp, DemoAppRequest } from "~/resources/views/demo-apps";

import {
	commitsBySha,
	fileTokens,
	findCommit,
	readBlame,
	readHistory,
	readTree,
} from "~/app/services/delta/source";
import { DEMO_APP_TOAST_PARAM, readToastParam } from "~/resources/views/demo-apps";

import { MAIN_FRAME, MainFrame, MainScreen, mainSource } from "../main-frame";

import type { ShellSection } from "./shell";

import { buildTree, isHeadRef, listFolder, parsePage, shortSha } from "./data";
import { COPY } from "./labels";
import { BlobScreen, NotInBuild } from "./screens/blob";
import { ComingScreen, DashboardScreen, NotFoundScreen } from "./screens/coming";
import { CommitScreen, CommitsScreen } from "./screens/commits";
import { FindScreen } from "./screens/find";
import { HomeScreen } from "./screens/home";
import { DeltaFrame, SHELL_COOKIE } from "./shell";
import { DeltaThumbnail } from "./thumbnail";

/** Brass at hue 75: warm, unused by the other demos, its 600 step dark enough for white text. */
const BRAND = [
	"oklch(0.975 0.016 85)",
	"oklch(0.945 0.036 83)",
	"oklch(0.9 0.065 80)",
	"oklch(0.845 0.095 78)",
	"oklch(0.785 0.118 76)",
	"oklch(0.72 0.13 75)",
	"oklch(0.56 0.115 72)",
	"oklch(0.475 0.098 70)",
	"oklch(0.395 0.08 68)",
	"oklch(0.32 0.062 66)",
	"oklch(0.225 0.044 64)",
] as const;

/** Warm graphite, a trace of the brass in every grey, so code reads as paper and ink. */
const NEUTRAL = [
	"oklch(0.978 0.004 75)",
	"oklch(0.955 0.005 75)",
	"oklch(0.912 0.006 75)",
	"oklch(0.857 0.007 75)",
	"oklch(0.72 0.008 75)",
	"oklch(0.6 0.009 75)",
	"oklch(0.5 0.009 75)",
	"oklch(0.415 0.009 75)",
	"oklch(0.32 0.008 75)",
	"oklch(0.225 0.007 75)",
	"oklch(0.165 0.006 75)",
] as const;

/**
 * A system sans for prose and a monospace for shas, refs, paths and counts; small radii,
 * hairline edges, and the diff, syntax, blame-age and graph colours a code host draws with.
 */
const TOKENS = {
	"--ui-font-sans":
		'-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", "Noto Sans", Helvetica, Arial, system-ui, sans-serif',
	"--ui-font-mono":
		'"SF Mono", ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
	"--ui-radius-md": "0.25rem",
	"--ui-radius-lg": "0.375rem",
	"--ui-button-radius": "0.25rem",
	"--ui-app-sidebar-width": "14.5rem",
	"--ui-app-inset-radius": "0.375rem",
	"--ui-app-inset-shadow": "none",
	"--code-view-line-height": "1.25rem",
	"--code-view-font-size": "0.75rem",
	"--highlight-comment": "light-dark(oklch(0.55 0.015 75), oklch(0.66 0.015 75))",
	"--highlight-keyword": "light-dark(oklch(0.5 0.15 35), oklch(0.76 0.12 40))",
	"--highlight-operator": "light-dark(oklch(0.5 0.15 35), oklch(0.76 0.12 40))",
	"--highlight-string": "light-dark(oklch(0.46 0.1 155), oklch(0.8 0.1 150))",
	"--highlight-attr-value": "light-dark(oklch(0.46 0.1 155), oklch(0.8 0.1 150))",
	"--highlight-number": "light-dark(oklch(0.48 0.14 255), oklch(0.78 0.1 250))",
	"--highlight-boolean": "light-dark(oklch(0.48 0.14 255), oklch(0.78 0.1 250))",
	"--highlight-constant": "light-dark(oklch(0.48 0.14 255), oklch(0.78 0.1 250))",
	"--highlight-builtin": "light-dark(oklch(0.48 0.14 255), oklch(0.78 0.1 250))",
	"--highlight-function": "light-dark(oklch(0.47 0.15 300), oklch(0.78 0.11 300))",
	"--highlight-class-name": "light-dark(oklch(0.47 0.15 300), oklch(0.78 0.11 300))",
	"--highlight-property": "light-dark(oklch(0.45 0.08 215), oklch(0.8 0.08 205))",
	"--highlight-tag": "light-dark(oklch(0.45 0.08 215), oklch(0.8 0.08 205))",
	"--highlight-attr-name": "light-dark(oklch(0.52 0.11 70), oklch(0.82 0.1 78))",
	"--highlight-variable": "light-dark(oklch(0.52 0.11 70), oklch(0.82 0.1 78))",
	"--highlight-regex": "light-dark(oklch(0.52 0.11 70), oklch(0.82 0.1 78))",
	"--highlight-punctuation": "light-dark(oklch(0.42 0.01 75), oklch(0.78 0.01 75))",
	"--diff-add-bg": "light-dark(oklch(0.96 0.035 150), oklch(0.3 0.045 150))",
	"--diff-add-word": "light-dark(oklch(0.88 0.08 150), oklch(0.42 0.085 150))",
	"--diff-del-bg": "light-dark(oklch(0.96 0.03 25), oklch(0.3 0.045 25))",
	"--diff-del-word": "light-dark(oklch(0.88 0.07 25), oklch(0.43 0.09 25))",
	"--code-age-1": "light-dark(oklch(0.93 0.02 75), oklch(0.32 0.02 75))",
	"--code-age-2": "light-dark(oklch(0.88 0.05 78), oklch(0.4 0.05 75))",
	"--code-age-3": "light-dark(oklch(0.82 0.09 76), oklch(0.5 0.08 74))",
	"--code-age-4": "light-dark(oklch(0.74 0.12 75), oklch(0.62 0.11 74))",
	"--code-age-5": "light-dark(oklch(0.62 0.13 72), oklch(0.74 0.13 75))",
	"--graph-level-0": "light-dark(oklch(0.94 0.005 75), oklch(0.27 0.006 75))",
	"--graph-level-1": "light-dark(oklch(0.88 0.06 80), oklch(0.4 0.06 75))",
	"--graph-level-2": "light-dark(oklch(0.8 0.1 77), oklch(0.52 0.09 74))",
	"--graph-level-3": "light-dark(oklch(0.7 0.13 75), oklch(0.64 0.12 74))",
	"--graph-level-4": "light-dark(oklch(0.56 0.12 72), oklch(0.78 0.13 76))",
} as const;

/** Every toast a redirect can name. */
const TOASTS: Record<string, Omit<Toast.Flash, "id">> = {
	reset: {
		title: "Demo reset",
		description: "Delta keeps nothing of yours yet, so it starts fresh.",
	},
};

/** The screens a visitor reaches by clicking, the dashboard first. */
const SCREENS = [
	"",
	"delta",
	"delta/tree/main/screens",
	"delta/blob/main/README.md",
	"delta/blob/main/shell.tsx?L=12-18",
	"delta/blob/main/screens/blob.tsx",
	"delta/blame/main/shell.tsx",
	"delta/find/main",
	"delta/find/main?q=shell",
	"delta/commits/main",
	"delta/issues",
	"delta/pulls",
	"delta/actions",
	"delta/settings",
	"notifications",
	"sdxc",
];

/** One screen as both the whole page and the `main` frame draw it. */
interface Screen {
	title: string;
	nav: ShellSection;
	/** The top bar's place name. */
	crumb: string;
	body: RemixNode;
	status?: number;
	/** The file the screen opens, which the tree beside `main` marks on the first paint. */
	file?: string;
}

/** The repository's name as titles and the top bar write it. */
const REPO_NAME = `${COPY.org}/${COPY.repo}`;

/** The app's own 404, inside the shell. */
function notFound(): Screen {
	return {
		title: "Page not found",
		nav: "none",
		crumb: REPO_NAME,
		status: 404,
		body: <NotFoundScreen />,
	};
}

/**
 * Answers a page path with its screen. The data is read once per isolate and every screen is
 * drawn from it with the request's own time, so ages count from now.
 */
async function route(request: DemoAppRequest): Promise<Screen> {
	let target = parsePage(request.page);
	if (target === null) return notFound();
	let [tree, history, commits] = await Promise.all([readTree(), readHistory(), commitsBySha()]);
	let now = Date.now();
	let count = history.commits.length;
	let latest = commits.get(tree.lastCommits[""] ?? "");

	switch (target.screen) {
		case "dashboard":
			return {
				title: COPY.dashboard.title,
				nav: "dashboard",
				crumb: COPY.dashboard.title,
				body: (
					<DashboardScreen history={history} files={tree.files.length} latest={latest} now={now} />
				),
			};
		case "notifications":
		case "org":
			return {
				title: COPY.coming[target.screen],
				nav: target.screen,
				crumb: COPY.coming[target.screen],
				body: <ComingScreen section={target.screen} commitCount={count} />,
			};
		case "coming":
			return {
				title: `${COPY.coming[target.section]} · ${REPO_NAME}`,
				nav: "repo",
				crumb: `${REPO_NAME} › ${COPY.coming[target.section]}`,
				body: <ComingScreen section={target.section} commitCount={count} />,
			};
		case "home":
		case "tree": {
			let folder = target.screen === "home" ? "" : target.path;
			let gitRef = target.screen === "home" ? "main" : target.ref;
			if (!isHeadRef(gitRef, tree.head)) {
				if ((await findCommit(gitRef)) === undefined) return notFound();
				return {
					title: `${folder || REPO_NAME} at ${shortSha(gitRef)}`,
					nav: "repo",
					crumb: REPO_NAME,
					body: <NotInBuild path={folder} gitRef={gitRef} commitCount={count} />,
				};
			}
			let entries = listFolder(tree.files, folder);
			if (entries === undefined && folder !== "") return notFound();
			return {
				title: folder === "" ? REPO_NAME : `${folder} · ${REPO_NAME}`,
				nav: "repo",
				crumb: folder === "" ? REPO_NAME : `${REPO_NAME} / ${folder}`,
				body: (
					<HomeScreen
						folder={folder}
						entries={entries ?? []}
						files={tree.files}
						lastCommits={tree.lastCommits}
						history={history}
						commits={commits}
						now={now}
					/>
				),
			};
		}
		case "blob": {
			let file: DeltaFile | undefined = tree.files.find(
				(candidate) => candidate.path === target.path,
			);
			if (!isHeadRef(target.ref, tree.head)) {
				if ((await findCommit(target.ref)) === undefined) return notFound();
				return {
					title: `${target.path} at ${shortSha(target.ref)}`,
					nav: "repo",
					crumb: `${REPO_NAME} / ${target.path}`,
					body: <NotInBuild path={target.path} gitRef={target.ref} commitCount={count} />,
				};
			}
			if (file === undefined) return notFound();
			let blame = target.view === "blame" ? ((await readBlame())[file.path] ?? []) : [];
			let lastSha = tree.lastCommits[file.path];
			return {
				title: `${target.view === "blame" ? "Blame " : ""}${file.path} at ${target.ref === "main" ? "main" : shortSha(target.ref)} · ${REPO_NAME}`,
				nav: "repo",
				crumb: `${REPO_NAME} / ${file.path}`,
				file: file.path,
				body: (
					<BlobScreen
						file={file}
						view={target.view}
						gitRef={target.ref}
						head={tree.head}
						url={request.url}
						tokens={fileTokens(file, tree.head)}
						blame={blame}
						commits={commits}
						lastCommit={lastSha === undefined ? undefined : commits.get(lastSha)}
						commitCount={count}
						now={now}
					/>
				),
			};
		}
		case "find": {
			if (!isHeadRef(target.ref, tree.head)) return notFound();
			let query = request.url.searchParams.get("q") ?? "";
			return {
				title: query === "" ? `${COPY.find.title} · ${REPO_NAME}` : `${query} · ${COPY.find.title}`,
				nav: "repo",
				crumb: `${REPO_NAME} › ${COPY.find.title}`,
				body: (
					<FindScreen
						paths={tree.files.map((file) => file.path)}
						query={query}
						commitCount={count}
					/>
				),
			};
		}
		case "commits":
			if (target.ref !== "main") return notFound();
			return {
				title: `${COPY.commits.title} · ${REPO_NAME}`,
				nav: "repo",
				crumb: `${REPO_NAME} › ${COPY.commits.title}`,
				body: <CommitsScreen history={history} now={now} />,
			};
		case "commit": {
			let commit = await findCommit(target.sha);
			if (commit === undefined) return notFound();
			return {
				title: `${commit.subject} · ${shortSha(commit.sha)}`,
				nav: "repo",
				crumb: `${REPO_NAME} › ${shortSha(commit.sha)}`,
				body: <CommitScreen commit={commit} commits={count} now={now} />,
			};
		}
	}
}

/**
 * Delta as the gallery and `/demo/apps/delta` read it: its theme, every screen, and the one
 * form it answers.
 */
export default {
	name: "Delta",
	kind: "Code host",
	tagline: "A repository browsing its own source: files, blame and commits straight from git.",
	artDirection: "Brass on warm graphite, mono for shas and paths, tight rows and small radii.",
	description:
		"Delta, a code host whose one repository is its own source: a file tree beside the code, line links, blame and the commits list, every file and commit read from git when the site is built.",
	theme: { brand: BRAND, neutral: NEUTRAL, tokens: TOKENS },
	thumbnail: () => <DeltaThumbnail />,
	screens: SCREENS,
	cookies: [SHELL_COOKIE],
	toasts: TOASTS,
	async target(name, request) {
		if (name !== MAIN_FRAME) return null;
		let screen = await route(request);
		let param = request.url.searchParams.get(DEMO_APP_TOAST_PARAM);
		let key = param === null ? null : readToastParam(param).key;
		return (
			<MainScreen
				title={screen.title}
				nav={screen.nav}
				crumb={screen.crumb}
				url={request.url}
				toast={key !== null && Object.hasOwn(TOASTS, key) ? TOASTS[key] : undefined}
			>
				{screen.body}
			</MainScreen>
		);
	},
	async render(request) {
		let [screen, tree] = await Promise.all([route(request), readTree()]);
		return {
			title: screen.title,
			status: screen.status,
			body: (
				<DeltaFrame
					current={screen.nav}
					crumb={screen.crumb}
					collapsed={readAppShellCookie(request.cookie, SHELL_COOKIE)}
					tree={buildTree(tree.files)}
					paths={tree.files.map((file) => file.path)}
					file={screen.file}
				>
					<MainFrame src={mainSource(request.url)} />
				</DeltaFrame>
			),
		};
	},
	submit(page) {
		if (page === "reset") return { page: "", toast: "reset" };
		return null;
	},
} satisfies DemoApp;
