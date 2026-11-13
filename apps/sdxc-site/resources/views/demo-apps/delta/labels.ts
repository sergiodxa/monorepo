/**
 * Every string Delta shows or announces, in one place the way a real code host keeps its
 * translations: one name per screen and ref, Verb + Noun buttons, and counts phrased the
 * same in the header, the file list and the commits list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppShell } from "@sdxc/ui/app/app-shell";
import type { AutoRefresh } from "@sdxc/ui/app/auto-refresh";
import type { CodeView } from "@sdxc/ui/app/code-view";
import type { CommandPalette } from "@sdxc/ui/app/command-palette";
import type { Diff } from "@sdxc/ui/app/diff";
import type { FilterBar } from "@sdxc/ui/app/filter-bar";
import type { FilterMenu } from "@sdxc/ui/app/filter-menu";
import type { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import type { LogViewer } from "@sdxc/ui/app/log-viewer";
import type { Tree } from "@sdxc/ui/app/tree";

/** The shell's landmark, skip link, phone menu and collapse toggle. */
export const SHELL_LABELS: AppShell.Labels = {
	nav: "Delta",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** The command menu's chrome. */
export const PALETTE_LABELS: CommandPalette.Labels = {
	title: "Command menu",
	open: "Open command menu",
	placeholder: "Search files, screens or commands…",
	recent: "Recent",
	noResults: "Nothing matches",
	noResultsHint: "Try a file name like shell.tsx, or press t to go to a file.",
	results: "{count} results",
	back: "Back",
	close: "Close",
};

/** The keyboard help sheet's chrome. */
export const HELP_LABELS: KeyboardHelp.Labels = {
	title: "Keyboard shortcuts",
	close: "Close",
	or: "or",
	open: "Show keyboard shortcuts",
	general: "General",
	other: "More",
};

/** The code view's line menu and keys. */
export const CODE_LABELS: CodeView.Labels = {
	lineMenu: "Line options",
	copyLine: "Copy line",
	copyPermalink: "Copy permalink",
	copied: "Copied",
	group: "Source code",
	permalinkKey: "Expand URL to its permalink",
	clearSelection: "Clear line selection",
};

/** The file tree's keys in the help sheet. */
export const TREE_LABELS: NonNullable<Tree.NavigationProps["labels"]> = {
	group: "File tree",
	next: "Next file or folder",
	previous: "Previous file or folder",
	expand: "Open folder",
	collapse: "Close folder",
	first: "First file",
	last: "Last file",
};

/** The branch picker. */
export const REF_LABELS: FilterMenu.Labels = {
	title: "Switch branches",
	filter: "Filter branches",
	empty: "Nothing to show",
	more: "{count} more, refine your filter",
	save: "Save",
};

/** What a page of diffs announces once a path is copied. */
export const DIFF_LABELS: Diff.Labels = { copied: "Copied" };

/** The unified/split switch and the review's progress above a page of diffs. */
export const DIFF_TOOLBAR_LABELS: Diff.ToolbarLabels = {
	view: "Diff view",
	unified: "Unified",
	split: "Split",
	filesViewed: "files viewed",
};

/** One file's card: its header, its hidden column names and the notes that stand in for lines. */
export const DIFF_FILE_LABELS: Diff.FileLabels = {
	columns: {
		oldNumber: "Original file line number",
		newNumber: "Diff line number",
		oldText: "Original file line",
		change: "Diff line change",
	},
	expandContext: "Expand context",
	copyPath: "Copy file path",
	statuses: {
		added: "Added",
		modified: "Modified",
		deleted: "Deleted",
		renamed: "Renamed",
		copied: "Copied",
	},
	changes: (additions, deletions) =>
		`${additions} ${additions === 1 ? "addition" : "additions"}, ${deletions} ${deletions === 1 ? "deletion" : "deletions"}`,
	binary: "Binary file not shown.",
	tooLarge: "This diff is too large to keep in the build.",
	largeDiff: "Large diffs are not rendered by default.",
	empty: "File renamed without changes.",
};

/** The runs list's filter bar. */
export const RUNS_FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter workflow runs",
	tabs: "Workflow runs",
	filters: "Filters",
	options: "View",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
};

/** The runs list's refresh control. */
export const REFRESH_LABELS: AutoRefresh.Labels = {
	trigger: "Auto-refresh",
	updated: "Updated {time}",
};

/** A job log's chrome and each step's state. */
export const LOG_LABELS: LogViewer.Labels = {
	log: "Job log",
	states: {
		success: "Succeeded",
		failure: "Failed",
		running: "In progress",
		queued: "Queued",
		skipped: "Skipped",
		cancelled: "Cancelled",
	},
	search: "Search logs",
	matches: "{index} of {count}",
	noMatches: "No results",
	previousMatch: "Previous match",
	nextMatch: "Next match",
	showTimestamps: "Show timestamps",
	hideTimestamps: "Hide timestamps",
	jumpToLatest: "Jump to latest",
	refresh: "Refresh to see the latest lines",
};

/** The app's own words, by screen. */
export const COPY = {
	app: "Delta",
	org: "sdxc",
	repo: "delta",
	user: "Sergio Xalambrí",
	handle: "sergiodxa",
	about:
		"The code-hosting demo on sdxc.dev, built from @sdxc/ui. You're reading its source: every file, commit and blame line comes from git.",
	topics: ["remix", "code-host", "sdxc-ui", "demo"],
	nav: {
		dashboard: "Dashboard",
		repositories: "Repositories",
	},
	tabs: {
		label: "Repository",
		code: "Code",
		commits: "Commits",
		actions: "Actions",
		more: "More",
	},
	crumbs: "Breadcrumb",
	files: {
		title: "Files",
		tree: "Files",
		filter: "Go to file",
		back: "Files",
		name: "Name",
		lastCommit: "Last commit message",
		updated: "Last commit date",
		parent: "Parent folder",
		list: "Files and folders",
	},
	file: {
		meta: (lines: number, loc: number, size: string) => `${lines} lines (${loc} loc) · ${size}`,
		raw: "Raw",
		code: "Code",
		blame: "Blame",
		view: "File view",
		older: "Older",
		newer: "Newer",
		permalink: "Permalink",
	},
	refs: {
		branches: "Branches",
		default: "default",
		pinned: (sha: string) => `Pinned at ${sha}`,
	},
	latest: {
		label: "Latest commit",
		history: "History",
		commits: (count: number, capped: boolean) =>
			`${count}${capped ? "+" : ""} ${count === 1 ? "Commit" : "Commits"}`,
	},
	readme: "README",
	aboutTitle: "About",
	find: {
		title: "Go to file",
		label: "Find a file",
		placeholder: "Type a file name",
		submit: "Find",
		matches: (count: number) => `${count} ${count === 1 ? "file matches" : "files match"}`,
		none: "No file matches",
		noneHint: "Check the spelling, or type fewer letters: matching skips over the rest.",
	},
	commits: {
		title: "Commits",
		on: (day: string) => `Commits on ${day}`,
		authored: "authored",
		and: "and",
		copy: "Copy full SHA",
		copied: "Copied",
		capped: (limit: number) => `Showing the latest ${limit} commits that touch Delta.`,
		shallowTitle: "No history in this build",
		shallowHint:
			"This copy of Delta was built from a shallow clone, so git had no commits to read. Every file is still here.",
		emptyTitle: "No commits yet",
		emptyHint: "Delta's history starts with the commit that adds its first file.",
	},
	commit: {
		title: (sha: string) => `Commit ${sha}`,
		backToCommits: "Back to commits",
		files: "Changed files",
		filesChanged: (count: number) => `${count} ${count === 1 ? "file" : "files"} changed`,
		binary: "Binary",
		summary: (files: number, additions: number, deletions: number) =>
			`${files} changed ${files === 1 ? "file" : "files"} with ${additions} ${additions === 1 ? "addition" : "additions"} and ${deletions} ${deletions === 1 ? "deletion" : "deletions"}`,
		loadDiff: "Load diff",
		diffs: "Changes",
		missingTitle: "This commit isn't in Delta's build",
		missingHint:
			"The build keeps the latest commits that touch Delta. Older ones keep only their name and date.",
	},
	notInBuild: {
		title: "Files at this commit aren't in the build",
		hint: "Delta carries its files at the deployed commit only. Open the same path on main instead.",
		action: "View on main",
	},
	dashboard: {
		title: "Dashboard",
		description: "Your repositories and what changed in them.",
		repositories: "Repositories",
		recent: "Recent commits",
		all: "View all commits",
		files: (count: number) => `${count} ${count === 1 ? "file" : "files"}`,
		updated: "Updated",
	},
	actions: {
		title: "Actions",
		description: "Every workflow run on sdxc/delta, newest first.",
		list: "Workflow runs",
		search: "Filter workflow runs",
		searchPlaceholder: "Filter by commit message",
		workflow: "Workflow",
		status: "Status",
		branch: "Branch",
		actor: "Actor",
		statuses: {
			success: "Success",
			failure: "Failure",
			in_progress: "In progress",
			cancelled: "Cancelled",
		},
		events: {
			push: (sha: string, actor: string) => `Commit ${sha} pushed by ${actor}`,
			pull_request: (pr: number, actor: string) => `Pull request #${pr} synchronize by ${actor}`,
			schedule: () => "Scheduled",
			workflow_dispatch: (actor: string) => `Manually run by ${actor}`,
		},
		runs: (count: number) => `${count} workflow ${count === 1 ? "run" : "runs"}`,
		duration: "Run time",
		started: "Started",
		refreshOff: "Off",
		every: (seconds: number) => `${seconds}s`,
		noneTitle: "No runs match",
		noneHint: "Try another workflow or status, or clear the filters to see every run.",
		clear: "Clear filters",
		emptyTitle: "No workflow runs yet",
		emptyHint: "Runs appear here once the history has a commit to build.",
	},
	run: {
		summary: "Summary",
		jobs: "Jobs",
		triggered: "Triggered via",
		events: {
			push: "push",
			pull_request: "pull request",
			schedule: "schedule",
			workflow_dispatch: "manual run",
		},
		status: "Status",
		duration: "Total duration",
		artifacts: "Artifacts",
		artifactsNone: "None kept",
		annotations: "Annotations",
		annotationsCount: (errors: number, warnings: number) =>
			[
				errors > 0 ? `${errors} ${errors === 1 ? "error" : "errors"}` : "",
				warnings > 0 ? `${warnings} ${warnings === 1 ? "warning" : "warnings"}` : "",
			]
				.filter(Boolean)
				.join(" and "),
		outdated: "Outdated: the cited lines changed since this run",
		matrix: (name: string, done: number, total: number) =>
			`Matrix: ${name} · ${done} of ${total} ${total === 1 ? "job" : "jobs"} completed`,
		graph: "Job graph",
		on: (event: string) => `on: ${event}`,
		keptFor: "Kept for 14 days",
		viewJob: "View job",
		jobNav: "Jobs in this run",
		runningFor: "Running for",
		queued: "Waiting for a runner",
		queuedHint:
			"This job starts once a runner picks it up. Its log streams here from the first line.",
		skipped: "This job was skipped",
		skippedHint: "A job it needs failed, so it never ran. Open the failed job to see why.",
		warning: "Warning",
		backToRun: "Summary",
	},
	notFound: {
		title: "Nothing lives at this address",
		hint: "The file may have moved, or the link is mistyped. The code is one click away.",
		action: "Go to the code",
	},
	reset: "Reset the demo",
	keys: {
		goCode: "Go to Code",
		goCommits: "Go to Commits",
		goDashboard: "Go to Dashboard",
		goToFile: "Go to file",
		blame: "Switch to blame",
		code: "Switch to code",
	},
} as const;
