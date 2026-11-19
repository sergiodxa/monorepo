/**
 * A run of messages one person sent in a row, laid out flat the way a team chat reads: the
 * first line carries the avatar, name and time, and each later line sits under it with its
 * time in the gutter on hover. Every line has a hover action bar, edits and threads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { gap, grid, hstack, inlineFlex, items, relative, vstack } from "@sdxc/u/layout";
import { media, motionReduce } from "@sdxc/u/responsive";
import { pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { fontSize, tabularNums, weight } from "@sdxc/u/typography";

/**
 * Width of the gutter every line keeps at its start, so a continuation line's text aligns
 * with the first line's text whatever the avatar's size.
 */
const GUTTER = "var(--ui-message-group-gutter, 2.5rem)";

/** Prop types for {@link MessageGroup} and its compound parts. */
export namespace MessageGroup {
	/** Props accepted by {@link MessageGroup}. */
	export interface Props extends TagProps<"div"> {
		/** One {@link MessageGroup.Item} per message, oldest first. */
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Item}. */
	export interface ItemProps extends TagProps<"article"> {
		/**
		 * Marks a message that names the reader, drawn with an accent edge and a warm tint so
		 * it stands out in a busy log.
		 */
		mentioned?: boolean;
		/** Marks the message the address or a thread panel points at. */
		current?: boolean;
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Avatar}. */
	export interface AvatarProps extends TagProps<"div"> {
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Header}. */
	export interface HeaderProps extends TagProps<"header"> {
		/** The sender's name first, then quieter metadata such as the time or a role. */
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Time}. */
	export interface TimeProps extends TagProps<"time"> {
		/** The short time, such as "10:42". */
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Content}. */
	export interface ContentProps extends TagProps<"div"> {
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Edited}. */
	export interface EditedProps extends TagProps<"span"> {
		/** The word shown, such as "(edited)". */
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Actions}. */
	export interface ActionsProps extends TagProps<"div"> {
		/** Small icon buttons; on a touch screen only the last one shows, so put a menu last. */
		children: RemixNode;
	}

	/** Props accepted by {@link MessageGroup.Thread}. */
	export interface ThreadProps extends Omit<TagProps<"a">, "children" | "href" | "role"> {
		href: string;
		/** Small avatars of the people who replied, overlapped at the start. */
		avatars?: RemixNode;
		/** The reply count and when the last one came, such as "3 replies · Last reply 2h ago". */
		children: RemixNode;
	}
}

/**
 * Renders the run's host. Lines inside share one gutter width, so the text column stays
 * straight from the first line to the last.
 *
 * @example
 * <MessageGroup>
 * 	<MessageGroup.Item id="m-1">
 * 		<MessageGroup.Avatar><Avatar size="md">…</Avatar></MessageGroup.Avatar>
 * 		<MessageGroup.Header><strong>Mira Okafor</strong><time dateTime="…">10:42</time></MessageGroup.Header>
 * 		<MessageGroup.Content>Shipped the new onboarding.</MessageGroup.Content>
 * 	</MessageGroup.Item>
 * 	<MessageGroup.Item id="m-2">
 * 		<MessageGroup.Time dateTime="…">10:43</MessageGroup.Time>
 * 		<MessageGroup.Content>Notes are in the doc.</MessageGroup.Content>
 * 	</MessageGroup.Item>
 * </MessageGroup>
 */
export function MessageGroup(handle: Handle<MessageGroup.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="message-group"
				mix={mergeMix([vstack({ gap: 0, align: "stretch" }), pb("0.25rem")], mix)}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders one message as a two-column line: the gutter (the avatar on the first line, the
 * hover time on later ones) and the content column under its header. The line tints on hover
 * and keyboard focus, and the action bar shows then; `:target` lines tint the way `current` does.
 */
MessageGroup.Item = function MessageGroupItem(handle: Handle<MessageGroup.ItemProps>) {
	return () => {
		let { children, mix, mentioned, current, ...rest } = handle.props;
		return (
			<article
				{...rest}
				data-slot="message-group-item"
				data-mentioned={mentioned ? "" : undefined}
				data-current={current ? "" : undefined}
				mix={mergeMix(
					[
						relative(),
						grid(),
						raw({
							gridTemplateColumns: `${GUTTER} minmax(0, 1fr)`,
							gridTemplateAreas: `"gutter header" "gutter content"`,
							columnGap: "var(--ui-message-group-gap, 0.75rem)",
							rowGap: "0.125rem",
							paddingBlock: "0.25rem",
							paddingInline: "var(--ui-message-group-inline-padding, 1.25rem)",
							scrollMarginBlock: "4rem",
							transition: "background-color 120ms",
						}),
						when('& > [data-slot="message-group-avatar"]', raw({ gridArea: "gutter" })),
						when('& > [data-slot="message-group-time"]', raw({ gridArea: "gutter" })),
						when('& > [data-slot="message-group-header"]', raw({ gridArea: "header" })),
						when('& > [data-slot="message-group-content"]', raw({ gridArea: "content" })),
						when(
							'&:not(:has(> [data-slot="message-group-header"])) > [data-slot="message-group-content"]',
							raw({ gridRow: "1 / span 2" }),
						),
						when(
							'&:first-child:has(> [data-slot="message-group-avatar"])',
							raw({ paddingBlockStart: "0.5rem" }),
						),
						when(
							"&:hover, &:focus-within",
							raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" }),
						),
						when(
							"&[data-mentioned]",
							raw({
								backgroundColor: "var(--ui-warning-bg-tint)",
								boxShadow: "inset 2px 0 0 var(--ui-warning-bg-solid)",
							}),
						),
						when(
							"&[data-current], &:target",
							raw({
								backgroundColor: "var(--ui-brand-bg-tint)",
								boxShadow: "inset 2px 0 0 var(--ui-brand-bg-solid)",
							}),
						),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				{children}
			</article>
		);
	};
};

/** Renders the first line's avatar at the top of the gutter. */
MessageGroup.Avatar = function MessageGroupAvatar(handle: Handle<MessageGroup.AvatarProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="message-group-avatar"
				mix={mergeMix(
					[inlineFlex(), raw({ alignSelf: "start", paddingBlockStart: "0.125rem" })],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

/** Renders the first line's name, time and any role chip on one baseline. */
MessageGroup.Header = function MessageGroupHeader(handle: Handle<MessageGroup.HeaderProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<header
				{...rest}
				data-slot="message-group-header"
				mix={mergeMix(
					[
						hstack({ gap: 2, align: "baseline" }),
						raw({ flexWrap: "wrap", minInlineSize: "0" }),
						when("& > :first-child", [
							fontSize("sm"),
							weight("bold"),
							fg("neutral.emphasis"),
							raw({ textDecoration: "none" }),
						]),
						when("& > time", [fontSize("xs"), fg("neutral.muted"), tabularNums()]),
					],
					mix,
				)}
			>
				{children}
			</header>
		);
	};
};

/**
 * Renders a later line's time in the gutter, hidden until the line is hovered or focused, so
 * a long run reads as one block while every time stays one glance away.
 */
MessageGroup.Time = function MessageGroupTime(handle: Handle<MessageGroup.TimeProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<time
				{...rest}
				data-slot="message-group-time"
				mix={mergeMix(
					[
						fontSize("xs"),
						fg("neutral.muted"),
						tabularNums(),
						raw({
							alignSelf: "start",
							justifySelf: "end",
							lineHeight: "1.5rem",
							fontSize: "0.6875rem",
							whiteSpace: "nowrap",
							opacity: "0",
						}),
						when(
							"[data-slot='message-group-item']:is(:hover, :focus-within) > &",
							raw({ opacity: "1" }),
						),
					],
					mix,
				)}
			>
				{children}
			</time>
		);
	};
};

/**
 * Renders the message's body column: its text, files, reactions and thread summary stacked.
 * Long words and links break at the column's edge rather than widening the log.
 */
MessageGroup.Content = function MessageGroupContent(handle: Handle<MessageGroup.ContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="message-group-content"
				mix={mergeMix(
					[
						vstack({ gap: "0.375rem", align: "stretch" }),
						raw({
							minInlineSize: "0",
							fontSize: "0.9375rem",
							lineHeight: "1.5rem",
							overflowWrap: "anywhere",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

/** Renders the quiet mark after a message's text that says it was changed after sending. */
MessageGroup.Edited = function MessageGroupEdited(handle: Handle<MessageGroup.EditedProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<span
				{...rest}
				data-slot="message-group-edited"
				mix={mergeMix(
					[fg("neutral.muted"), raw({ fontSize: "0.75rem", marginInlineStart: "0.25rem" })],
					mix,
				)}
			>
				{children}
			</span>
		);
	};
};

/**
 * Renders the line's action bar, floated over its top-end corner and shown while the line is
 * hovered or holds focus, so keyboard users reach every action by tabbing into the message.
 * On a touch screen the bar shows its last control at all times, so a menu there stays a tap away.
 */
MessageGroup.Actions = function MessageGroupActions(handle: Handle<MessageGroup.ActionsProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="message-group-actions"
				mix={mergeMix(
					[
						hstack({ gap: 0, align: "center" }),
						rounded("md"),
						raw({
							position: "absolute",
							insetBlockStart: "-0.875rem",
							insetInlineEnd: "1rem",
							padding: "0.125rem",
							backgroundColor: "var(--ui-bg)",
							border: "1px solid var(--ui-neutral-border)",
							boxShadow: "0 2px 6px -2px oklch(0 0 0 / 0.16)",
							opacity: "0",
							pointerEvents: "none",
							zIndex: "1",
							transition: "opacity 100ms",
							"& > form": { display: "contents" },
						}),
						when(
							"[data-slot='message-group-item']:is(:hover, :focus-within) > &",
							raw({ opacity: "1", pointerEvents: "auto" }),
						),
						media(
							"(hover: none)",
							raw({
								opacity: "1",
								pointerEvents: "auto",
								insetBlockStart: "0.125rem",
								insetInlineEnd: "0.5rem",
								border: "none",
								boxShadow: "none",
								backgroundColor: "transparent",
								"& > :not(:last-child)": { display: "none" },
							}),
						),
						motionReduce(raw({ transition: "none" })),
					],
					mix,
				)}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders the link under a message that opens its thread: the repliers' faces, the reply
 * count in the accent colour and when the last reply came, boxed on hover.
 */
MessageGroup.Thread = function MessageGroupThread(handle: Handle<MessageGroup.ThreadProps>) {
	return () => {
		let { children, avatars, href, mix, ...rest } = handle.props;
		return (
			<a
				{...rest}
				href={href}
				data-slot="message-group-thread"
				mix={mergeMix(
					[
						hstack({ gap: 2, align: "center" }),
						items("center"),
						gap(2),
						rounded("md"),
						pi("0.375rem"),
						pb("0.25rem"),
						fontSize("xs"),
						raw({
							alignSelf: "start",
							marginInlineStart: "-0.375rem",
							maxInlineSize: "100%",
							border: "1px solid transparent",
							color: "var(--ui-neutral-fg-muted)",
							textDecoration: "none",
							"& strong": { color: "var(--ui-brand-fg)", fontWeight: "700" },
						}),
						when(
							"&:hover",
							raw({
								borderColor: "var(--ui-neutral-border)",
								backgroundColor: "var(--ui-bg)",
							}),
						),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
						),
					],
					mix,
				)}
			>
				{avatars === undefined ? null : (
					<span mix={[inlineFlex(), raw({ "& > * + *": { marginInlineStart: "-0.25rem" } })]}>
						{avatars}
					</span>
				)}
				<span mix={[raw({ minInlineSize: "0" })]}>{children}</span>
			</a>
		);
	};
};
