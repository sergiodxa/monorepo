/**
 * Every string Relay hands a component through its `labels`, in one place, so the words a
 * person reads hundreds of times a day stay consistent: Verb + Noun buttons, past-tense
 * toasts that echo them, and one name for each mailbox wherever it appears.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppShell } from "@sdxc/ui/app/app-shell";
import type { CommandPalette } from "@sdxc/ui/app/command-palette";
import type { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import type { FilterBar } from "@sdxc/ui/app/filter-bar";
import type { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import type { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import type { SplitView } from "@sdxc/ui/app/split-view";
import type { ViewOptions } from "@sdxc/ui/app/view-options";

/** The shell's landmark, skip link, phone menu and collapse toggle. */
export const SHELL_LABELS: AppShell.Labels = {
	nav: "Relay",
	skip: "Skip to content",
	menu: "Open navigation",
	close: "Close navigation",
	collapse: "Collapse sidebar",
};

/** The inbox's resize handle and the phone back link. */
export const SPLIT_LABELS: SplitView.Labels = {
	resizeList: "Resize conversations",
	back: "Conversations",
};

/** The command palette's chrome. */
export const PALETTE_LABELS: CommandPalette.Labels = {
	title: "Command menu",
	open: "Open command menu",
	placeholder: "Search conversations, contacts or commands…",
	recent: "Recent",
	noResults: "Nothing matches",
	noResultsHint: "Try a person, a company or a subject.",
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

/** The contacts toolbar. */
export const FILTER_LABELS: FilterBar.Labels = {
	toolbar: "Filter contacts",
	tabs: "Contact lists",
	filters: "Filters",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
	options: "View",
};

/** The contacts display popover. */
export const VIEW_OPTIONS_LABELS: ViewOptions.Labels = {
	trigger: "Display",
	layout: "Layout",
	grouping: "Grouping",
	ordering: "Ordering",
	density: "Density",
	properties: "Properties",
	apply: "Apply",
	setDefault: "Set as default",
};

/** The contact peek sheet. */
export const SHEET_LABELS: DetailSheet.Labels = {
	close: "Close",
	copyLink: "Copy link",
	linkCopied: "Link copied",
	previous: "Previous contact",
	next: "Next contact",
	position: "Contact",
};

/** The settings section nav. */
export const SETTINGS_LABELS: SettingsLayout.Labels = { nav: "Settings", back: "Settings" };

/** The read and star toggles' names and their failure word. */
export const TOGGLE_LABELS = {
	star: "Star conversation",
	read: "Mark as read",
	failed: "Failed",
} as const;
