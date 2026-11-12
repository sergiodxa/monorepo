/**
 * Every string Tern hands a component through its `labels`, in one place, so the words a
 * person reads in every chat stay consistent: Verb + Noun buttons and past-tense toasts that
 * echo them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppShell } from "@sdxc/ui/app/app-shell";
import type { CommandPalette } from "@sdxc/ui/app/command-palette";
import type { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import type { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import type { SplitView } from "@sdxc/ui/app/split-view";

/** The shell's landmark, skip link, phone menu and collapse toggle. */
export const SHELL_LABELS: AppShell.Labels = {
	nav: "Chats",
	skip: "Skip to chat",
	menu: "Open chats",
	close: "Close chats",
	collapse: "Collapse sidebar",
};

/** The conversation and canvas split. */
export const SPLIT_LABELS: SplitView.Labels = { resizeList: "Resize chat", back: "Chat" };

/** The command palette's chrome. */
export const PALETTE_LABELS: CommandPalette.Labels = {
	title: "Search chats",
	open: "Search chats",
	placeholder: "Search chats and commands…",
	recent: "Recent",
	noResults: "No chats match",
	noResultsHint: "Try a word from the conversation.",
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

/** The settings section nav. */
export const SETTINGS_LABELS: SettingsLayout.Labels = { nav: "Settings", back: "Settings" };

/** The composer's buttons and field. */
export const COMPOSER_LABELS = {
	field: "Message Tern",
	placeholder: "Ask Tern anything",
	attach: "Attach files",
	send: "Send message",
	stop: "Stop response",
} as const;

/** The per-message actions. */
export const MESSAGE_LABELS = {
	copy: "Copy message",
	copied: "Copied",
	edit: "Edit message",
	regenerate: "Regenerate response",
	good: "Good response",
	bad: "Bad response",
	failed: "Failed",
	stopped: "You stopped this response.",
} as const;
