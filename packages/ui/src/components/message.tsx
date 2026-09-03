/**
 * A single conversational turn in a message log: a row composing a
 * bottom-anchored avatar, a header for the sender's identity and timing, a
 * content slot for the message's own surface, and an optional footer for its
 * actions. Compound parts lay out entirely through CSS grid areas keyed off
 * each part's `data-slot`, so the avatar's vertical anchor and the footer's
 * presence never need to be tracked as state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { fg } from "@sdxc/u/color";
import {
	container,
	flex,
	flexWrap,
	gap,
	grid,
	gridArea,
	gridTemplate,
	hstack,
	items,
	justify,
	relative,
	self,
	vstack,
} from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { maxIs, minIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { fontSize, weight } from "@sdxc/u/typography";

/**
 * Named container {@link Message} declares on its own host, so
 * {@link Message.Header} can query the row's own width instead of the
 * page's, matching whether it renders full-page or in a narrower panel.
 */
const CONTAINER_NAME = "ui-message";

/**
 * Prop types for {@link Message} and its compound parts.
 */
export namespace Message {
	/**
	 * Props accepted by {@link Message}.
	 */
	export interface Props extends TagProps<"article"> {
		/** The row's compound parts: {@link Message.Avatar}, {@link Message.Header}, {@link Message.Content}, and an optional {@link Message.Footer}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Message.Avatar}.
	 */
	export interface AvatarProps extends TagProps<"div"> {
		/** An Avatar instance identifying the message's sender. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Message.Header}.
	 */
	export interface HeaderProps extends TagProps<"header"> {
		/** The sender's name, typically followed by a timestamp. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Message.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/** The message's own surface — a Bubble, an attachment card, or any other rendered turn content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Message.Footer}.
	 */
	export interface FooterProps extends TagProps<"footer"> {
		/** The row's actions, typically a copy Button and a like Button. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Message.Group}.
	 */
	export interface GroupProps extends TagProps<"div"> {
		/** A run of consecutive {@link Message} rows sharing the same sender. */
		children: RemixNode;
	}
}

/**
 * Renders the message row as a two-column grid whose `"avatar"` area spans only the
 * header and content rows, anchoring {@link Message.Avatar} to the bottom edge
 * of {@link Message.Content}, regardless of whether {@link Message.Footer} renders.
 *
 * @param handle Runtime handle carrying the host `<article>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <Message>
 * 	<Message.Avatar>
 * 		<Avatar>
 * 			<Avatar.Image src={sender.avatarUrl} alt={sender.name} />
 * 			<Avatar.Fallback>{sender.initials}</Avatar.Fallback>
 * 		</Avatar>
 * 	</Message.Avatar>
 * 	<Message.Header>
 * 		<strong>{sender.name}</strong>
 * 		<time dateTime={message.sentAt}>{formattedTime}</time>
 * 	</Message.Header>
 * 	<Message.Content>
 * 		<Bubble>{message.text}</Bubble>
 * 	</Message.Content>
 * 	<Message.Footer>
 * 		<Button
 * 			aria-label={t("message.copy")}
 * 			commandfor={`${message.id}-text`}
 * 			command={COPY_COMMAND}
 * 			mix={copyToClipboard()}
 * 		>
 * 			<CopyIcon />
 * 		</Button>
 * 		<Button aria-label={t("message.like")} onClick={likeMessage}>
 * 			<ThumbsUpIcon />
 * 		</Button>
 * 	</Message.Footer>
 * </Message>
 */
export function Message(handle: Handle<Message.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<article
				{...rest}
				data-slot="message"
				mix={[
					relative(),
					grid(),
					gap("var(--ui-message-row-gap, 0.25rem)", "var(--ui-message-gap, 0.75rem)"),
					container(CONTAINER_NAME),
					gridTemplate({
						columns: "auto 1fr",
						areas: `"avatar header" "avatar content" ". footer"`,
					}),
					when('& > [data-slot="avatar"]', [gridArea("avatar"), self("end")]),
					when('& > [data-slot="header"]', gridArea("header")),
					when('& > [data-slot="content"]', gridArea("content")),
					when('& > [data-slot="footer"]', gridArea("footer")),
					mix,
				]}
			>
				{children}
			</article>
		);
	};
}

/**
 * Renders {@link Message.AvatarProps.children} as the row's avatar slot,
 * aligned to the `"avatar"` area's block-end edge so it tracks the bottom
 * edge of {@link Message.Content}. Nest an Avatar instance inside it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the avatar slot's markup.
 * @example
 * <Message.Avatar>
 * 	<Avatar>
 * 		<Avatar.Image src={sender.avatarUrl} alt={sender.name} />
 * 		<Avatar.Fallback>{sender.initials}</Avatar.Fallback>
 * 	</Avatar>
 * </Message.Avatar>
 */
Message.Avatar = function MessageAvatar(handle: Handle<Message.AvatarProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div {...rest} data-slot="avatar" mix={[flex(), mix]}>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Message.HeaderProps.children} as the row's identity line,
 * wrapping until the `ui-message` container passes `26rem`, then settling
 * onto one row with the sender's name first and later children as secondary metadata.
 *
 * @param handle Runtime handle carrying the host `<header>`'s props.
 * @returns The render function producing the identity line's markup.
 * @example
 * <Message.Header>
 * 	<strong>{sender.name}</strong>
 * 	<time dateTime={message.sentAt}>{formattedTime}</time>
 * </Message.Header>
 */
Message.Header = function MessageHeader(handle: Handle<Message.HeaderProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<header
				{...rest}
				data-slot="header"
				mix={[
					flex(),
					flexWrap("wrap"),
					items("baseline"),
					gap("0.125rem", "0.5rem"),
					when("& > :first-child", [fontSize("sm"), weight("semibold"), fg("neutral.emphasis")]),
					when("& > :not(:first-child)", [fontSize("xs"), fg("neutral.muted")]),
					at("26rem", CONTAINER_NAME, [flexWrap("nowrap"), justify("between")]),
					mix,
				]}
			>
				{children}
			</header>
		);
	};
};

/**
 * Renders {@link Message.ContentProps.children} as the row's content slot,
 * capped to a comfortable reading measure and never narrower than its grid
 * area. Nest a Bubble, attachment card, or other turn content inside it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the content slot's markup.
 * @example
 * <Message.Content>
 * 	<Bubble>{message.text}</Bubble>
 * </Message.Content>
 */
Message.Content = function MessageContent(handle: Handle<Message.ContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="content"
				mix={[
					vstack({ gap: "0.375rem" }),
					minIs("0"),
					maxIs("var(--ui-message-content-max-size, 36rem)"),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Message.FooterProps.children} as the row's action slot,
 * occupying the grid's `"footer"` area beneath {@link Message.Content} and
 * never reached by {@link Message.Avatar}'s bottom anchor.
 *
 * @param handle Runtime handle carrying the host `<footer>`'s props.
 * @returns The render function producing the action slot's markup.
 * @example
 * <Message.Footer>
 * 	<Button
 * 		aria-label={t("message.copy")}
 * 		commandfor={`${message.id}-text`}
 * 		command={COPY_COMMAND}
 * 		mix={copyToClipboard()}
 * 	>
 * 		<CopyIcon />
 * 	</Button>
 * 	<Button aria-label={t("message.like")} onClick={likeMessage}>
 * 		<ThumbsUpIcon />
 * 	</Button>
 * </Message.Footer>
 */
Message.Footer = function MessageFooter(handle: Handle<Message.FooterProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<footer {...rest} data-slot="footer" mix={[hstack({ align: "center", gap: "0.25rem" }), mix]}>
				{children}
			</footer>
		);
	};
};

/**
 * Renders {@link Message.GroupProps.children} as a run of consecutive
 * {@link Message} rows sharing the same sender, stacked with a hairline gap
 * that reads as one continuous turn.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the group's markup.
 * @example
 * <Message.Group>
 * 	<Message>
 * 		<Message.Header>{sender.name}</Message.Header>
 * 		<Message.Content><Bubble>{firstReply.text}</Bubble></Message.Content>
 * 	</Message>
 * 	<Message>
 * 		<Message.Avatar>
 * 			<Avatar>
 * 				<Avatar.Image src={sender.avatarUrl} alt={sender.name} />
 * 				<Avatar.Fallback>{sender.initials}</Avatar.Fallback>
 * 			</Avatar>
 * 		</Message.Avatar>
 * 		<Message.Content><Bubble>{secondReply.text}</Bubble></Message.Content>
 * 	</Message>
 * </Message.Group>
 */
Message.Group = function MessageGroup(handle: Handle<Message.GroupProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group"
				mix={[vstack({ gap: "var(--ui-message-group-gap, 0.125rem)" }), mix]}
			>
				{children}
			</div>
		);
	};
};
