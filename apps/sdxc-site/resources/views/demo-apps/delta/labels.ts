/**
 * Every string Delta shows or announces, in one place the way a real code host keeps its
 * translations: one name per screen and ref, Verb + Noun buttons, and counts phrased the
 * same in the header, the file list and the commits list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppShell } from "@sdxc/ui/app/app-shell";
import type { CodeView } from "@sdxc/ui/app/code-view";
import type { CommandPalette } from "@sdxc/ui/app/command-palette";
import type { FilterMenu } from "@sdxc/ui/app/filter-menu";
import type { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
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
		notifications: "Notifications",
		repositories: "Repositories",
		organization: "Organization",
	},
	tabs: {
		label: "Repository",
		code: "Code",
		commits: "Commits",
		issues: "Issues",
		pulls: "Pull requests",
		actions: "Actions",
		settings: "Settings",
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
		comingTitle: "The diff view lands next",
		comingHint:
			"This commit is real, and so is its patch in the build. Its line-by-line diff is the next screen Delta adds.",
		backToCommits: "Back to commits",
		files: "Changed files",
		filesChanged: (count: number) => `${count} ${count === 1 ? "file" : "files"} changed`,
		binary: "Binary",
		missingTitle: "This commit isn't in Delta's build",
		missingHint:
			"The build keeps the latest commits that touch Delta. Older ones keep only their name and date.",
	},
	notInBuild: {
		title: "Files at this commit aren't in the build",
		hint: "Delta carries its files at the deployed commit only. Open the same path on main instead.",
		action: "View on main",
	},
	coming: {
		issues: "Issues",
		pulls: "Pull requests",
		actions: "Actions",
		settings: "Repository settings",
		notifications: "Notifications",
		org: "sdxc",
		title: "This screen is on its way",
		hint: "Delta grows one screen at a time. The code, the file view and the commits are ready to browse now.",
		action: "Browse the code",
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
	notFound: {
		title: "Nothing lives at this address",
		hint: "The file may have moved, or the link is mistyped. The code is one click away.",
		action: "Go to the code",
	},
	reset: "Reset the demo",
	keys: {
		goCode: "Go to Code",
		goCommits: "Go to Commits",
		goIssues: "Go to Issues",
		goPulls: "Go to Pull requests",
		goActions: "Go to Actions",
		goDashboard: "Go to Dashboard",
		goToFile: "Go to file",
		blame: "Switch to blame",
		code: "Switch to code",
	},
} as const;
