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
import type { SaveStatusProps } from "@sdxc/ui/app/save-status";
import type { SelectionBar } from "@sdxc/ui/app/selection-bar";
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

/** The inbox's filter bar. */
export const INBOX_FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter notifications",
	tabs: "Notification views",
	filters: "Filters",
	options: "View",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
};

/** The bar the inbox's selection turns its footer into. */
export const INBOX_SELECTION_LABELS: SelectionBar.Labels = {
	toolbar: "Notifications",
	clear: "Clear selection",
	selected: "{count} selected",
	cleared: "Selection cleared",
	previous: "Previous page",
	next: "Next page",
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

/** The toolbar over a list of issues or pull requests. */
export const FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter the list",
	tabs: "States",
	filters: "Filters",
	options: "Sort",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
};

/** The bar a list's selection turns its footer into. */
export const SELECTION_LABELS: SelectionBar.Labels = {
	toolbar: "Selected issues",
	clear: "Clear selection",
	selected: "{count} selected",
	cleared: "Selection cleared",
	previous: "Previous page",
	next: "Next page",
};

/** The pickers a record's side panel edits its people, labels and milestone with. */
export const PICKER_LABELS = {
	assignees: {
		title: "Assign up to 10 people",
		filter: "Filter people",
		empty: "Nobody matches",
		more: "{count} more, refine your filter",
		save: "Save",
	},
	reviewers: {
		title: "Request up to 15 reviewers",
		filter: "Filter people",
		empty: "Nobody matches",
		more: "{count} more, refine your filter",
		save: "Save",
	},
	labels: {
		title: "Apply labels",
		filter: "Filter labels",
		empty: "No label matches",
		more: "{count} more, refine your filter",
		save: "Save",
	},
	milestone: {
		title: "Set milestone",
		filter: "Filter milestones",
		empty: "No milestone matches",
		more: "{count} more, refine your filter",
		save: "Save",
	},
} satisfies Record<string, FilterMenu.Labels>;

/** The quiet status a record's side panel says its saves with. */
export const SAVE_LABELS: SaveStatusProps["labels"] = {
	saving: "Saving…",
	saved: "Saved",
	failed: "Couldn't save",
	retry: "Retry",
	edited: "Edited {time}",
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
	},
	tabs: {
		label: "Repository",
		code: "Code",
		issues: "Issues",
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
	issues: {
		title: "Issues",
		search: "Search all issues",
		placeholder: "is:open label:bug author:mara",
		open: "Open",
		closed: "Closed",
		author: "Author",
		label: "Labels",
		assignee: "Assignees",
		noAssignee: "No assignee",
		sort: "Sort by",
		newest: "Newest",
		oldest: "Oldest",
		commented: "Most commented",
		updated: "Recently updated",
		list: "Issues",
		select: (number: number) => `Select issue #${number}`,
		opened: "opened",
		closedBy: "closed",
		by: "by",
		comments: (count: number) => `${count} ${count === 1 ? "comment" : "comments"}`,
		assignedTo: (names: string) => `Assigned to ${names}`,
		close: "Close",
		reopen: "Reopen",
		assignMe: "Assign to me",
		shown: (count: number) => `${count} ${count === 1 ? "issue" : "issues"}`,
		noneTitle: "No issues match",
		noneHint: "Try fewer filters, or search for a word in a title like diff.",
		emptyOpenTitle: "No open issues",
		emptyClosedTitle: "No closed issues",
		emptyHint: "Issues that land in this state show up here.",
		clear: "Clear filters",
		keys: {
			group: "Issues",
			next: "Next issue",
			previous: "Previous issue",
			open: "Open issue",
			toggle: "Select issue",
			selected: "Issue selected",
			deselected: "Issue deselected",
			search: "Search issues",
		},
	},
	issue: {
		title: (title: string, number: number) => `${title} · Issue #${number}`,
		open: "Open",
		closed: "Closed",
		notPlanned: "Closed as not planned",
		opened: "opened this issue",
		commented: "commented",
		comments: (count: number) => `${count} ${count === 1 ? "comment" : "comments"}`,
		you: "You",
		assignees: "Assignees",
		labels: "Labels",
		milestone: "Milestone",
		participants: "Participants",
		noAssignees: "No one assigned",
		noLabels: "None yet",
		noMilestone: "No milestone",
		editAssignees: "Edit assignees",
		editLabels: "Edit labels",
		editMilestone: "Edit milestone",
		suggestions: "Org members",
		repoLabels: "Labels",
		milestones: "Open milestones",
		clearMilestone: "No milestone",
		conversation: "Conversation",
		details: "Details",
		comment: "Comment",
		commentLabel: "Add a comment",
		commentPlaceholder: "Leave a comment",
		closeIssue: "Close issue",
		closeWithComment: "Close with comment",
		reopenIssue: "Reopen issue",
		events: {
			labeled: "added the",
			unlabeled: "removed the",
			label: "label",
			assigned: "assigned",
			selfAssigned: "self-assigned this",
			unassigned: "unassigned",
			milestoned: "added this to the",
			milestoneSuffix: "milestone",
			completed: "closed this as completed",
			notPlanned: "closed this as not planned",
			reopened: "reopened this",
			mentioned: "mentioned this issue in",
			renamed: "changed the title",
		},
	},
	cite: {
		line: (line: number) => `Line ${line}`,
		lines: (start: number, end: number) => `Lines ${start} to ${end}`,
		onMain: "in main",
		outdated: "Outdated",
		at: (sha: string) => `as of ${sha}`,
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
	inbox: {
		title: "Notifications",
		caughtUp: "You're all caught up.",
		unreadCount: (count: number) =>
			`${count} unread ${count === 1 ? "notification" : "notifications"}.`,
		views: { inbox: "Inbox", saved: "Saved", done: "Done" },
		reason: "Reason",
		reasons: {
			ci_activity: "CI activity",
			mention: "Mentioned",
			comment: "Comment",
			author: "Author",
		},
		groupBy: "Group by",
		byDate: "Date",
		byRepo: "Repository",
		groups: { today: "Today", yesterday: "Yesterday", week: "This week", older: "Older" },
		activity: {
			run: (label: string, state: "success" | "failure" | "cancelled" | "in_progress") =>
				`${label} ${{ success: "succeeded", failure: "failed", cancelled: "was cancelled", in_progress: "is running" }[state]}`,
			mention: (actor: string) => `${actor} mentioned you`,
			comment: (actor: string) => `${actor} commented`,
			author: (actor: string) => `${actor} commented on your commit`,
		},
		commit: "Commit",
		unread: "Unread. ",
		select: (title: string) => `Select ${title}`,
		done: "Done",
		undone: "Move to inbox",
		save: "Save",
		unsave: "Unsave",
		markRead: "Mark as read",
		moveToInbox: "Move to inbox",
		failed: "Couldn't save",
		shown: (count: number) => `${count} ${count === 1 ? "notification" : "notifications"}`,
		clear: "Clear filters",
		empty: {
			inbox: {
				title: "All caught up",
				hint: "Nothing needs you right now. New mentions, comments and failed runs land here.",
			},
			saved: {
				title: "Nothing saved",
				hint: "Save a notification to keep it here after you mark it done.",
			},
			done: {
				title: "Nothing done yet",
				hint: "Notifications you mark as done move here, so you can bring one back.",
			},
			filtered: {
				title: "No notifications for this reason",
				hint: "Try another reason, or clear the filter to see every notification in this view.",
			},
		},
		toasts: {
			done: "Marked as done",
			undo: "Undo",
			undone: "Moved back to inbox",
			read: "Marked as read",
			saved: "Saved for later",
		},
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
		goIssues: "Go to Issues",
		goDashboard: "Go to Dashboard",
		goToFile: "Go to file",
		blame: "Switch to blame",
		code: "Switch to code",
	},
} as const;
