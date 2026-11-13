/**
 * Every string Cairn hands a component through its `labels`, in one place, so the words a
 * person reads all day stay the same on every screen: one name per state and view, Verb +
 * Noun buttons, and toasts that echo the button that caused them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppShell } from "@sdxc/ui/app/app-shell";
import type { CommandPalette } from "@sdxc/ui/app/command-palette";
import type { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import type { FilterBar } from "@sdxc/ui/app/filter-bar";
import type { Gantt } from "@sdxc/ui/app/gantt";
import type { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import type { SelectionBar } from "@sdxc/ui/app/selection-bar";
import type { SplitView } from "@sdxc/ui/app/split-view";
import type { ViewOptions } from "@sdxc/ui/app/view-options";

/** The shell's landmark, skip link, phone menu and collapse toggle. */
export const SHELL_LABELS: AppShell.Labels = {
	nav: "Cairn",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** The list and detail split's resize handle and phone back link. */
export const SPLIT_LABELS: SplitView.Labels = {
	resizeList: "Resize issues",
	back: "Issues",
};

/** The command menu's chrome. */
export const PALETTE_LABELS: CommandPalette.Labels = {
	title: "Command menu",
	open: "Open command menu",
	placeholder: "Search issues, projects or commands…",
	recent: "Recent",
	noResults: "Nothing matches",
	noResultsHint: "Try an issue id like WEB-140, a title or a project.",
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

/** The issue list's toolbar. */
export const FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter issues",
	tabs: "Issue lists",
	filters: "Filter",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
	options: "Display",
};

/** The display popover. */
export const VIEW_LABELS: ViewOptions.Labels = {
	trigger: "Display",
	layout: "Layout",
	grouping: "Grouping",
	ordering: "Ordering",
	density: "Density",
	properties: "Properties",
	apply: "Apply",
	setDefault: "Set as default",
};

/** The bulk bar. */
export const SELECTION_LABELS: SelectionBar.Labels = {
	toolbar: "Selected issues",
	clear: "Clear selection",
	selected: "{count} selected",
	cleared: "Selection cleared",
	previous: "Previous page",
	next: "Next page",
};

/** The issue sheet over the board. */
export const SHEET_LABELS: DetailSheet.Labels = {
	close: "Close",
	copyLink: "Copy link",
	linkCopied: "Link copied",
	previous: "Previous issue",
	next: "Next issue",
	position: "Issue",
};

/** The roadmap's axis and bar descriptions. */
export const ROADMAP_LABELS: Gantt.Labels = {
	today: "Today",
	schedule: "{start} to {end}",
	progress: "{percent} complete",
	projected: "projected to finish {date}",
	unscheduled: "No dates yet",
};

/** The save status beside an issue's title. */
export const SAVE_LABELS = {
	saving: "Saving…",
	saved: "Saved",
	failed: "Couldn't save",
	retry: "Retry",
	edited: "Edited {time}",
} as const;
