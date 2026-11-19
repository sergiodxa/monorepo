/**
 * Every string Parley hands a component through its `labels`, in one place, so the words a
 * teammate reads stay consistent: Verb + Noun buttons and past-tense toasts that echo them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppShell } from "@sdxc/ui/app/app-shell";
import type { CommandPalette } from "@sdxc/ui/app/command-palette";
import type { KeyboardHelp } from "@sdxc/ui/app/keyboard-help";
import type { SplitView } from "@sdxc/ui/app/split-view";
import type { TypingIndicator } from "@sdxc/ui/chat/typing-indicator";

/** The shell's landmark, skip link, phone menu and collapse toggle. */
export const SHELL_LABELS: AppShell.Labels = {
	nav: "Channels and direct messages",
	skip: "Skip to conversation",
	menu: "Open channels",
	close: "Close channels",
	collapse: "Collapse sidebar",
};

/** The conversation and side panel split. */
export const SPLIT_LABELS: SplitView.Labels = {
	resizeList: "Resize conversation",
	back: "Conversation",
};

/** The quick switcher's chrome. */
export const PALETTE_LABELS: CommandPalette.Labels = {
	title: "Jump to",
	open: "Jump to a conversation",
	placeholder: "Jump to a channel, person or command…",
	recent: "Recent",
	noResults: "Nothing matches",
	noResultsHint: "Try a channel name or a teammate's first name.",
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

/** The typing line's sentences. */
export const TYPING_LABELS: TypingIndicator.Labels = {
	one: (name) => `${name} is typing…`,
	two: (first, second) => `${first} and ${second} are typing…`,
	many: (count) => `${count} people are typing…`,
};

/** The composer's field and controls. */
export const COMPOSER_LABELS = {
	attach: "Attach files",
	send: "Send message",
	emoji: "Insert emoji",
	emojiSearch: "Search emoji",
	emojiEmpty: "No emoji match",
	mentions: "People to mention",
	mentionsEmpty: "Nobody by that name",
	format: {
		bold: "Bold",
		italic: "Italic",
		strike: "Strikethrough",
		code: "Code",
		link: "Link",
		quote: "Quote",
		list: "Bulleted list",
	},
} as const;

/** The per-message actions. */
export const MESSAGE_LABELS = {
	actions: "Message actions",
	react: "Add reaction",
	reactSearch: "Search reactions",
	reply: "Reply in thread",
	more: "More actions",
	edit: "Edit message",
	delete: "Delete message",
	pin: "Pin to conversation",
	unpin: "Unpin from conversation",
	copyLink: "Copy link",
	reactions: "Reactions",
	edited: "(edited)",
	save: "Save",
	cancel: "Cancel",
} as const;
