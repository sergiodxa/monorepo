/**
 * The Foundations of `@sdxc/ui/chat`: what the conversation parts are for, the structure,
 * scrolling and accessibility rules they share, and each variable the namespace reads,
 * with the fallback its components declare.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Foundations } from "~/resources/content/foundations";

const CHAT: Foundations = {
	module: "chat",
	slug: "chat-foundations",
	title: "Chat foundations",
	summary:
		"What @sdxc/ui/chat is for, the structure and scrolling rules its parts share, and every variable it reads.",
	importPath: "@sdxc/ui/chat",
	source: "ui/src/chat/message.tsx",
	intro: [
		"A conversation: a scrolling log, one row per turn with avatar, header and footer, bubbles, inline markers and attachment cards.",
		"Everything is server HTML; following the latest message and opening an attachment are mixins you add where the thread updates live.",
	],
	reachFor: [
		"A support inbox, a team thread or any log of messages between people.",
		"An assistant's conversation, with streamed replies and Markdown inside the bubbles.",
		"Any feed where new entries arrive at the bottom and a reader may scroll back.",
	],
	ideas: [
		{
			title: "Structure",
			body: "`Message` is an `article` on a grid filled by `data-slot`; the namespace renders no headings.",
		},
		{
			title: "Container layout",
			body: "`Message`, `MessageScroller` and `Attachment` reflow on their own width, wherever the thread sits.",
		},
		{
			title: "Direction",
			body: "Bubble corners and margins are logical properties, so end-aligned bubbles mirror in RTL.",
		},
		{
			title: "Scrolling",
			body: "`messageFollow` keeps the log at the latest turn until the reader scrolls away; instant under reduced motion.",
		},
		{
			title: "Accessibility",
			body: 'The log is `role="log"` with `aria-busy` for streaming; reactions are a labelled group.',
		},
		{ title: "Markdown", body: 'Wrap a reply in `<Typeset preset="chat">`: 15px on a 1.5 line.' },
	],
	roles:
		"Reads the neutral and brand roles, danger for a failed bubble, and all five roles through Marker's color.",
	variables: [
		{
			title: "Spacing and measure",
			lead: "None is declared in `theme.css`; set any of them on an ancestor of the thread.",
			variables: [
				{
					name: "--ui-message-gap",
					default: "0.75rem",
					controls: "Gap between a message's avatar and its header and content.",
				},
				{
					name: "--ui-message-row-gap",
					default: "0.25rem",
					controls: "Gap between a message's header, content and footer.",
				},
				{
					name: "--ui-message-content-max-size",
					default: "36rem",
					controls: "Widest a turn's content grows, its reading measure.",
				},
				{
					name: "--ui-message-group-gap",
					default: "0.125rem",
					controls: "Gap between consecutive messages in a Message.Group.",
				},
				{
					name: "--ui-marker-gap",
					default: "0.375rem",
					controls: "Gap between a `Marker`'s icon, label and rules.",
				},
				{
					name: "--ui-message-scroller-anchor-offset",
					default: "0px",
					controls: "Space a scrolled-to turn leaves above itself, to clear an overlay.",
				},
				{
					name: "--ui-separator-thickness",
					default: "1px",
					controls: "Thickness of a separator `Marker`'s rules.",
				},
			],
		},
		{
			title: "Shape and elevation",
			lead: "Read through `@sdxc/u`'s `rounded()` and `shadow()`; each default is the fallback an app overrides by declaring the variable.",
			variables: [
				{
					name: "--ui-radius-xs",
					default: "0.125rem",
					controls:
						"The tight corner where a bubble meets its sender's edge or a grouped neighbour.",
				},
				{
					name: "--ui-radius-md",
					default: "0.375rem",
					controls: "Corners of a `Marker` and an attachment's media.",
				},
				{
					name: "--ui-radius-lg",
					default: "0.5rem",
					controls: "Corners of the scroller's frame and an attachment card.",
				},
				{ name: "--ui-radius-xl", default: "0.75rem", controls: "Corners of a bubble." },
				{
					name: "--ui-shadow-md",
					default: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
					controls: "Elevation of the jump-to-latest button.",
				},
				{
					name: "--ui-bg",
					default: "var(--ui-neutral-bg-tint, Canvas)",
					controls: "Opaque fill of the jump-to-latest button.",
				},
			],
		},
		{
			title: "Set by the components",
			variables: [
				{
					name: "--ui-bubble-reactions-justify",
					default: "set by Bubble from align",
					controls: "Which side a bubble's reactions row lines up with.",
				},
			],
		},
	],
};

export default CHAT;
