/**
 * The framed message surface inside a conversational row's content slot,
 * sized to its own content up to a share of the row's width. Variants cover
 * tones from a solid fill to fully unframed, and `align` hugs either row
 * edge. `Bubble.Content`, `Bubble.Reactions`, and `Bubble.Group` compose the
 * turn's text, its reaction toggles, and multi-bubble runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw, vars } from "@pkg/u/general";
import { block, container, flex, flexWrap, gap, items, vstack } from "@pkg/u/layout";
import { maxIs, mbs, mie, mis, pb, pi, width } from "@pkg/u/size";
import { data, when } from "@pkg/u/state";
import { wordBreak } from "@pkg/u/typography";
import { attrs } from "remix/ui";

/**
 * Named container {@link Bubble} declares on its own host, so
 * {@link Bubble.Reactions} can measure the frame's own width and fall back to
 * a plain, non-overlapping row once that space runs out.
 */
const CONTAINER_NAME = "ui-bubble";

/** Visual weight {@link Bubble} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: Bubble.Variant = "default";

/** Edge of the row {@link Bubble} falls back to when `align` is omitted. */
const DEFAULT_ALIGN: Bubble.Align = "start";

/**
 * ARIA role applied to {@link Bubble.Reactions} through {@link attrs},
 * announcing the row as one related set of pressed toggles.
 */
const DEFAULT_REACTIONS_ROLE = "group";

/**
 * Prop types for {@link Bubble} and its compound parts.
 */
export namespace Bubble {
	/**
	 * Visual weight the frame renders with: solid `"default"`/`"secondary"` fills,
	 * soft `"muted"`/`"tinted"` tints, a bordered `"outline"`, an unframed
	 * `"ghost"`, and a solid danger fill for `"destructive"`.
	 */
	export type Variant =
		| "default"
		| "secondary"
		| "muted"
		| "tinted"
		| "outline"
		| "ghost"
		| "destructive";

	/**
	 * Edge of the row the frame hugs: `"start"` stays flush with the row's
	 * leading edge (flipping under `dir="rtl"`), `"end"` stays flush with the
	 * trailing edge, typically paired with the reader's own turns vs everyone else's.
	 */
	export type Align = "start" | "end";

	/**
	 * Props accepted by {@link Bubble}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Visual weight. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Edge of the row the frame hugs. Defaults to {@link DEFAULT_ALIGN}. */
		align?: Align;
		/** The frame's compound parts: {@link Bubble.Content}, an optional {@link Bubble.Reactions}, or any other content. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bubble.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/** The turn's text — plain, or wrapped in a typography layer for rendered markdown. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bubble.Reactions}. `aria-label` is required so
	 * assistive technology has an accessible name to announce for this row.
	 */
	export interface ReactionsProps extends Omit<TagProps<"div">, "aria-label"> {
		/** Accessible label describing the row as a set of reactions. */
		"aria-label": string;
		/** One or more already-pressed toggle controls, each scoped to a single reaction. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bubble.Group}.
	 */
	export interface GroupProps extends TagProps<"div"> {
		/** Two or more {@link Bubble} frames from the same turn, stacked into one run. */
		children: RemixNode;
	}
}

/**
 * Renders the frame, pushed to the edge `align` names via auto margins so it
 * aligns correctly regardless of its row's layout. Its nearest corner falls
 * back to a literal `0.125rem`, since `roundedCorner()` has no `"xs"` step.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the frame's markup.
 * @example
 * <Bubble align="end">
 * 	<Bubble.Content>{turn.text}</Bubble.Content>
 * </Bubble>
 * @example
 * <Bubble variant="muted" align="start">
 * 	<Bubble.Content>{turn.text}</Bubble.Content>
 * </Bubble>
 * @example
 * <Bubble variant="ghost" align="start">
 * 	<Bubble.Content>
 * 		<Typeset preset="chat">{renderedMarkdownHtml}</Typeset>
 * 	</Bubble.Content>
 * </Bubble>
 */
export function Bubble(handle: Handle<Bubble.Props>) {
	return () => {
		let { variant, align, children, mix, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let resolvedAlign = align ?? DEFAULT_ALIGN;

		return (
			<div
				{...rest}
				data-slot="bubble"
				data-variant={resolvedVariant}
				data-align={resolvedAlign}
				mix={[
					container(CONTAINER_NAME),
					block(),
					maxIs("80%"),
					rounded("xl"),
					border({ width: 1 }),
					border("transparent"),
					width("fit-content"),

					data("align", "start", [
						mie("auto"),
						raw({ borderEndStartRadius: "var(--ui-radius-xs, 0.125rem)" }),
						vars({ "ui-bubble-reactions-justify": "flex-start" }),
					]),
					data("align", "end", [
						mis("auto"),
						raw({ borderEndEndRadius: "var(--ui-radius-xs, 0.125rem)" }),
						vars({ "ui-bubble-reactions-justify": "flex-end" }),
					]),

					data("variant", "default", [bg("brand.solid"), fg("brand.onSolid")]),
					data("variant", "secondary", [bg("neutral.solid"), fg("neutral.onSolid")]),
					data("variant", "muted", [bg("neutral.tint"), fg("neutral.emphasis"), border("neutral")]),
					data("variant", "tinted", [bg("brand.tint"), fg("brand.emphasis"), border("brand")]),
					data("variant", "outline", [
						fg("neutral.emphasis"),
						border("neutral.strong"),
						bg("transparent"),
					]),
					data("variant", "ghost", [
						fg("neutral.emphasis"),
						maxIs("none"),
						mis(0),
						mie(0),
						bg("transparent"),
						border("transparent"),
						width("full"),
					]),
					data("variant", "destructive", [bg("danger.solid"), fg("danger.onSolid")]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders {@link Bubble.ContentProps.children} as the frame's padded text
 * slot, breaking long unbroken runs at the inline box edge and taking its
 * text color from the ancestor {@link Bubble}'s `variant` via CSS inheritance.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the text slot's markup.
 * @example
 * <Bubble.Content>{turn.text}</Bubble.Content>
 * @example
 * <Bubble.Content>
 * 	<p>{turn.summary}</p>
 * 	<Disclosure>
 * 		<Disclosure.Trigger>{t("message.showMore")}</Disclosure.Trigger>
 * 		<Disclosure.Panel>{turn.rest}</Disclosure.Panel>
 * 	</Disclosure>
 * </Bubble.Content>
 * @example
 * <Bubble.Content>
 * 	{turn.text}
 * 	<button popovertarget={`${turn.id}-meta`} aria-label={t("message.details")}>
 * 		<InfoIcon aria-hidden />
 * 	</button>
 * 	<Popover id={`${turn.id}-meta`} popover="hint" placement="top-end">
 * 		{t("message.model", { model: turn.model })}
 * 	</Popover>
 * </Bubble.Content>
 */
Bubble.Content = function BubbleContent(handle: Handle<Bubble.ContentProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="content"
				mix={[
					pb(2.5),
					pi(3.5),
					raw({
						fontSize: "0.9375rem",
						lineHeight: "1.5",
						overflowWrap: "break-word",
					}),
					wordBreak("break-word"),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Bubble.ReactionsProps.children} as a `role="group"` row: a
 * negative block-start margin pins it into the frame's lower padding, aligned
 * via the `--ui-bubble-reactions-justify` property the frame sets from `align`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the reaction row's markup.
 * @example
 * <Bubble.Reactions aria-label={t("message.reactions")}>
 * 	<ToggleButton
 * 		aria-pressed={reactions.thumbsUp}
 * 		aria-label={t("message.reactThumbsUp")}
 * 		size="sm"
 * 		name="reaction"
 * 		value="thumbs-up"
 * 	>
 * 		👍
 * 	</ToggleButton>
 * 	<ToggleButton
 * 		aria-pressed={reactions.heart}
 * 		aria-label={t("message.reactHeart")}
 * 		size="sm"
 * 		name="reaction"
 * 		value="heart"
 * 	>
 * 		❤️
 * 	</ToggleButton>
 * </Bubble.Reactions>
 */
Bubble.Reactions = function BubbleReactions(handle: Handle<Bubble.ReactionsProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="reactions"
				mix={[
					attrs({ role: DEFAULT_REACTIONS_ROLE }),
					flex(),
					flexWrap("wrap"),
					items("center"),
					gap(1),
					pi(0.5),
					mbs(-2),
					raw({ justifyContent: "var(--ui-bubble-reactions-justify, flex-start)" }),
					when(`@container ${CONTAINER_NAME} (max-width: 16rem)`, mbs("0.375rem")),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};

/**
 * Renders {@link Bubble.GroupProps.children} as a tightly spaced column of
 * consecutive {@link Bubble} frames, softening only the corners touching a
 * neighbor to a smaller radius, so the run reads as one continuous shape.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the run's markup.
 * @example
 * <Bubble.Group>
 * 	<Bubble align="end"><Bubble.Content>{turnOne.text}</Bubble.Content></Bubble>
 * 	<Bubble align="end"><Bubble.Content>{turnTwo.text}</Bubble.Content></Bubble>
 * </Bubble.Group>
 */
Bubble.Group = function BubbleGroup(handle: Handle<Bubble.GroupProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="group"
				mix={[
					vstack({ gap: 0.5 }),
					when('& > [data-slot="bubble"]:not(:first-child)', [
						raw({
							borderStartStartRadius: "var(--ui-radius-xs, 0.125rem)",
							borderStartEndRadius: "var(--ui-radius-xs, 0.125rem)",
						}),
					]),
					when('& > [data-slot="bubble"]:not(:last-child)', [
						raw({
							borderEndStartRadius: "var(--ui-radius-xs, 0.125rem)",
							borderEndEndRadius: "var(--ui-radius-xs, 0.125rem)",
						}),
					]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
