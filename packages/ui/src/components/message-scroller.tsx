/**
 * A scrollable frame for a conversational message log. Its viewport reuses
 * the same scrollbar treatment every scrolling surface in this catalog
 * shares and fades its own edges to hint at history above and replies still
 * below; its content region announces newly appended rows through the ARIA
 * log role; each row carries the message id and anchor data a scroll-follow
 * behavior reads; and a static jump-to-latest control sits ready for that
 * same behavior to reveal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { border } from "@pkg/u/color";
import { rounded, shadow } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import {
	absolute,
	container,
	flex,
	flexCol,
	gap,
	insIe,
	insIs,
	inset,
	justify,
	relative,
} from "@pkg/u/layout";
import { pb, pi } from "@pkg/u/size";
import { z } from "@pkg/u/stacking";
import { when } from "@pkg/u/state";
import { translateProperty } from "@pkg/u/transform";
import { attrs } from "remix/ui";

import { Button } from "./button";
import { ScrollArea } from "./scroll-area";

/**
 * Named container {@link MessageScroller} declares on its own host, so
 * {@link MessageScroller.Button} can adapt its own placement to the frame's
 * width instead of the page's.
 */
const CONTAINER_NAME = "ui-message-scroller";

/**
 * Container width under which {@link MessageScroller.Button} switches from a
 * centered floating pill to a bar stretched across the frame's own inline
 * size.
 */
const BUTTON_NARROW_QUERY = `@container ${CONTAINER_NAME} (max-width: 28rem)`;

/**
 * `role="log"` applied to {@link MessageScroller.Content} through
 * {@link attrs} unless a consumer supplies its own `role` — the ARIA log
 * role's own implicit `aria-live="polite"` behavior is what announces each
 * newly appended row.
 */
const DEFAULT_CONTENT_ROLE = "log";

/**
 * `aria-relevant="additions"` applied to {@link MessageScroller.Content}
 * through {@link attrs} unless a consumer overrides it, so assistive
 * technology announces newly appended rows without restating rows that
 * merely scroll out of view.
 */
const DEFAULT_CONTENT_ARIA_RELEVANT = "additions";

/** Semantic color role {@link MessageScroller.Button} falls back to when `color` is omitted. */
const DEFAULT_BUTTON_COLOR: Button.Color = "brand";

/** Visual weight {@link MessageScroller.Button} falls back to when `variant` is omitted. */
const DEFAULT_BUTTON_VARIANT: Button.Variant = "solid";

/** Size variant {@link MessageScroller.Button} falls back to when `size` is omitted. */
const DEFAULT_BUTTON_SIZE: Button.Size = "sm";

/**
 * `hidden` applied to {@link MessageScroller.Button} when a consumer omits
 * it: the control starts absent from rendering and the accessibility tree
 * until a paired scroll-follow behavior reveals it.
 */
const DEFAULT_BUTTON_HIDDEN = true;

/**
 * Prop types for {@link MessageScroller} and its compound parts.
 */
export namespace MessageScroller {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * Size the frame through `mix` — a fixed block size, or a flexed one
	 * inside a taller layout — since {@link MessageScroller.Viewport} fills
	 * whatever block size this host resolves to.
	 */
	export interface Props extends TagProps<"div"> {
		/** The frame's compound parts: {@link MessageScroller.Viewport} and, optionally, {@link MessageScroller.Button}. */
		children: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ViewportProps extends TagProps<"div"> {
		/** {@link MessageScroller.Content}, scrolling inside the viewport. */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/**
		 * Marks the log as busy while a row inside it is still being written
		 * to — a reply still streaming in, for instance — forwarded to the
		 * host's native `aria-busy` attribute unchanged. Clear it once the row
		 * settles.
		 */
		"aria-busy"?: TagProps<"div">["aria-busy"];
		/** The {@link MessageScroller.Item} rows to render in document order. */
		children?: RemixNode;
	}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ItemProps extends TagProps<"div"> {
		/**
		 * Stable id of the message this row renders, mirrored onto the host's
		 * `data-message-id` attribute so a scroll-follow behavior can find,
		 * measure, and scroll to this exact row without parsing `children`.
		 */
		messageId: string;
		/**
		 * Marks this row as a candidate anchor point — typically the first row
		 * of a new turn — mirrored onto the host's `data-scroll-anchor`
		 * attribute so a scroll-follow behavior can tell which rows are worth
		 * anchoring the viewport to while older history prepends above them.
		 * Defaults to `false`: most rows carry no anchor.
		 */
		scrollAnchor?: boolean;
		/** The row's own content, typically a conversational row composed inside it. */
		children?: RemixNode;
	}

	/**
	 * Every {@link Button.Props} field, unchanged, except `hidden` gains its
	 * own default instead of the platform's implicit `false`.
	 */
	export interface ButtonProps extends Button.Props {
		/**
		 * Whether the control is absent from rendering and the accessibility
		 * tree. Defaults to `true`. A paired scroll-follow behavior clears this
		 * attribute directly as the reader scrolls away from the live edge and
		 * sets it again once they return to it or press the control; without
		 * that behavior attached, the control simply stays absent.
		 */
		hidden?: boolean;
	}
}

/**
 * Renders the frame's root host: a bordered, rounded, relatively positioned
 * `<div>` that declares the `ui-message-scroller` named container so
 * {@link MessageScroller.Button} can adapt its own placement to the frame's
 * width rather than the page's. Holds still on its own: every row already
 * renders in document order inside {@link MessageScroller.Content}, so the
 * conversation reads correctly and scrolls through the browser's own native
 * behavior before any behavior is attached.
 *
 * This compound has no separate provider part. A consumer's hydrated island
 * constructs the paired scroll-follow model and shares it through
 * `handle.context` instead, the same mechanism this catalog's other
 * multi-part compounds use to hand shared state down to their own nested
 * parts.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the frame's markup.
 * @example
 * <MessageScroller mix={css({ blockSize: "32rem" })}>
 * 	<MessageScroller.Viewport>
 * 		<MessageScroller.Content aria-busy={isStreaming}>
 * 			<MessageScroller.Item messageId={turn.id} scrollAnchor>
 * 				{turn.content}
 * 			</MessageScroller.Item>
 * 		</MessageScroller.Content>
 * 	</MessageScroller.Viewport>
 * 	<MessageScroller.Button aria-label={t("chat.jumpToLatest")} />
 * </MessageScroller>
 */
export function MessageScroller(handle: Handle<MessageScroller.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="message-scroller"
				mix={[
					rounded("lg"),
					border({ color: "neutral", width: 1 }),
					relative(),
					container(CONTAINER_NAME),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders the frame's scrolling surface as {@link ScrollArea.Viewport}
 * itself, fixed to the block axis: the same thin, inset native scrollbar
 * treatment every scrolling surface in this catalog shares. Holds still on
 * its own — compose the `scrollFade()` animation factory from the animation
 * layer through `mix` to fade this viewport's own edges, hinting at history
 * above and replies still below whenever either edge has more to reveal.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the viewport's markup.
 * @example
 * <MessageScroller.Viewport mix={scrollFade({ axis: "block" })}>
 * 	<MessageScroller.Content>...</MessageScroller.Content>
 * </MessageScroller.Viewport>
 */
MessageScroller.Viewport = function MessageScrollerViewport(
	handle: Handle<MessageScroller.ViewportProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <ScrollArea.Viewport {...rest} orientation="vertical" mix={mix} />;
	};
};

/**
 * Renders the frame's live region: a `<div>` carrying the ARIA log role,
 * stacking its {@link MessageScroller.Item} rows in a column with a
 * consistent gap between them. The log role's own implicit live-region
 * behavior is what announces each row {@link MessageScroller.Item} adds, and
 * `aria-relevant="additions"` keeps that announcement scoped to newly
 * appended rows rather than restating rows that merely scroll out of view.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the log region's markup.
 * @example
 * <MessageScroller.Content aria-busy={isStreaming}>
 * 	<MessageScroller.Item messageId={turn.id}>{turn.content}</MessageScroller.Item>
 * </MessageScroller.Content>
 */
MessageScroller.Content = function MessageScrollerContent(
	handle: Handle<MessageScroller.ContentProps>,
) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="content"
				mix={[
					attrs({ role: DEFAULT_CONTENT_ROLE, "aria-relevant": DEFAULT_CONTENT_ARIA_RELEVANT }),
					flex(),
					flexCol(),
					gap(4),
					pb(4),
					pi(4),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders a single message row: a `<div>` mirroring `messageId` onto its own
 * `data-message-id` attribute and, when `scrollAnchor` is set, an empty
 * `data-scroll-anchor` attribute — the two hooks a scroll-follow behavior
 * reads to find, measure, and anchor rows without parsing `children`. Carries
 * a `scroll-margin-block-start` custom property so a native `scrollIntoView`
 * call lands the row a comfortable distance below the viewport's own
 * block-start edge instead of flush against it.
 *
 * In dev mode, a row rendered without a `messageId` logs a `console.warn`,
 * since a scroll-follow behavior matching against it would otherwise have
 * nothing to compare it to.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <MessageScroller.Item messageId={turn.id} scrollAnchor={turn.startsNewTurn}>
 * 	{turn.content}
 * </MessageScroller.Item>
 */
MessageScroller.Item = function MessageScrollerItem(handle: Handle<MessageScroller.ItemProps>) {
	return () => {
		let { messageId, scrollAnchor, children, mix, ...rest } = handle.props;

		if (import.meta.env.DEV && !messageId) {
			console.warn(
				'MessageScroller.Item: needs a "messageId" — a scroll-follow behavior matches rows against this instead of parsing rendered children.',
			);
		}

		return (
			<div
				{...rest}
				data-slot="item"
				data-message-id={messageId}
				data-scroll-anchor={scrollAnchor || undefined}
				mix={[
					raw({
						scrollMarginBlockStart: "var(--ui-message-scroller-anchor-offset, 0px)",
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders a static jump-to-latest control as {@link Button}: absolutely
 * positioned over the frame's block-end edge, centered as a floating pill
 * while the frame's own named container stays wide, and stretched
 * edge-to-edge once that container narrows past `28rem`. Starts `hidden` —
 * absent from rendering and the accessibility tree — until a paired
 * scroll-follow behavior clears the attribute as the reader scrolls away
 * from the live edge. Compose `fade()` or `zoom()` from the animation layer
 * through `mix`, with `when: ":not([hidden])"`, for its own reveal and
 * dismiss motion; this component holds still on its own.
 *
 * @param handle Runtime handle carrying the host `<button>`'s props.
 * @returns The render function producing the control's markup.
 * @example
 * <MessageScroller.Button aria-label={t("chat.jumpToLatest")}>
 * 	{t("chat.jumpToLatest")}
 * </MessageScroller.Button>
 */
MessageScroller.Button = function MessageScrollerButton(
	handle: Handle<MessageScroller.ButtonProps>,
) {
	return () => {
		let { hidden, color, variant, size, mix, ...rest } = handle.props;

		return (
			<Button
				{...rest}
				type="button"
				color={color ?? DEFAULT_BUTTON_COLOR}
				variant={variant ?? DEFAULT_BUTTON_VARIANT}
				size={size ?? DEFAULT_BUTTON_SIZE}
				hidden={hidden ?? DEFAULT_BUTTON_HIDDEN}
				data-slot="jump-button"
				mix={[
					z(1),
					absolute(),
					inset("auto", "auto", "1rem", "50%"),
					shadow("lg"),
					translateProperty("-50% 0"),
					when(BUTTON_NARROW_QUERY, [
						justify("center"),
						insIs("1rem"),
						insIe("1rem"),
						translateProperty("0 0"),
					]),
					mix,
				]}
			/>
		);
	};
};
