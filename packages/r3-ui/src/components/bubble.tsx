/**
 * The framed message surface nested inside a conversational row's content
 * slot — the visible shape carrying a single turn's text, sized to its own
 * content up to a share of the row's available width instead of stretching
 * edge to edge. Seven variants cover the tones a turn can carry, from a
 * solid emphasized fill down to a fully unframed one, and an `align`
 * attribute hugs the frame to either edge of the row so a back-and-forth
 * conversation reads as two interleaved columns. `Bubble.Content` holds the
 * turn's text, `Bubble.Reactions` lays a row of already-pressed toggle
 * controls across the frame's lower edge, and `Bubble.Group` stacks several
 * bubbles from the same turn into one tightly spaced run, softening the
 * corners where consecutive frames touch.
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
import { attrs } from "remix/ui";

/**
 * Named container {@link Bubble} declares on its own host, so
 * {@link Bubble.Reactions} can tell how much of the frame's own width it has
 * to lay chips across and fall back to a plain, non-overlapping row once
 * that space runs out.
 */
const CONTAINER_NAME = "ui-bubble";

/** Visual weight {@link Bubble} falls back to when `variant` is omitted. */
const DEFAULT_VARIANT: Bubble.Variant = "default";

/** Edge of the row {@link Bubble} falls back to when `align` is omitted. */
const DEFAULT_ALIGN: Bubble.Align = "start";

/**
 * ARIA role applied to {@link Bubble.Reactions} through {@link attrs},
 * announcing the row as one related set of pressed toggles rather than a
 * handful of unrelated buttons.
 */
const DEFAULT_REACTIONS_ROLE = "group";

/**
 * Prop types for {@link Bubble} and its compound parts.
 */
export namespace Bubble {
	/**
	 * Visual weight the frame renders with: `"default"` and `"secondary"` fill
	 * solid in the primary and neutral tones, `"muted"` and `"tinted"` shade a
	 * soft neutral or primary background behind a matching subtle border,
	 * `"outline"` keeps a transparent fill behind a strong border, `"ghost"`
	 * drops both fill and border for running text that reads as unframed, and
	 * `"destructive"` fills solid in the danger tone for a turn that failed to
	 * send or was retracted.
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
	 * Edge of the row the frame hugs: `"start"` keeps it flush with the row's
	 * leading edge (flipping under `dir="rtl"`), `"end"` keeps it flush with
	 * the trailing edge. A consumer typically pairs one edge with the
	 * reader's own turns and the other with everyone else's.
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
	 * Props accepted by {@link Bubble.Reactions}. `aria-label` is required,
	 * since the row otherwise carries no accessible name of its own for
	 * assistive technology to announce.
	 */
	export interface ReactionsProps extends Omit<TagProps<"div">, "aria-label"> {
		/** Accessible label describing the row as a set of reactions, not a bare group of buttons. */
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
 * Renders the frame itself: a `<div>` sized to hug its own content up to
 * eighty percent of its row's available width, colored and shaped through
 * the `data-variant` and `data-align` attribute contract. The auto-margin
 * alignment trick pushes the frame against whichever edge `align` names —
 * `marginInlineEnd: auto` for `"start"`, `marginInlineStart: auto` for
 * `"end"` — so the frame lands flush against that edge whether its row is a
 * plain block container or a flex column, with no cooperation needed from
 * the row itself. The corner nearest that same edge, on the frame's
 * lower side, rounds by a smaller radius than the other three, reading as a
 * faint point toward whatever sits beside the row. `"ghost"` drops the
 * eighty-percent cap and the auto margins entirely, filling its row edge to
 * edge for long-form text meant to read as unframed running copy rather than
 * a distinct shape.
 *
 * The frame declares the `ui-bubble` named container so {@link Bubble.Reactions}
 * can adapt to its own rendered width, and carries a `--ui-bubble-reactions-justify`
 * custom property set by `align`, which that same part reads to line its
 * chips up under the same edge the frame itself hugs.
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
						// `roundedCorner()`'s radius scale has no "xs" step, and passing
						// an arbitrary name falls back to `0px` instead of this
						// component's own `0.125rem` — see final report for the gap.
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
					data("variant", "tinted", [
						bg("brand.tint"),
						fg("brand.emphasis"),
						border("brand"),
					]),
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
 * slot: a `<div>` sized for a comfortable reading measure at chat scale,
 * breaking long unbroken runs (a URL, a token) at the inline box edge
 * instead of overflowing it. Its own text color comes from the ancestor
 * {@link Bubble}'s `variant` through ordinary CSS inheritance rather than
 * reading the attribute itself.
 *
 * A message long enough to want collapsing composes a `Disclosure` around
 * the overflowing portion, and a message carrying metadata worth showing on
 * demand — a model name, a token count, an edit timestamp — composes a
 * `Popover` triggered from a control inside this slot, rather than either
 * pattern being built into this component.
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
						wordBreak: "break-word",
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
 * Renders {@link Bubble.ReactionsProps.children} as a `role="group"` row
 * anchored to the ancestor {@link Bubble}'s lower edge: a negative
 * block-start margin lifts the row up into the frame's own bottom padding so
 * its chips read as pinned to the corner rather than sitting fully below it,
 * and `justify-content` reads the `--ui-bubble-reactions-justify` custom
 * property the frame sets from its own `align`, lining the row up under the
 * same edge the frame hugs. Once the frame's own `ui-bubble` container
 * narrows past a short-message width, the row drops back into normal flow
 * with a small gap instead, so a wrapped second row of chips never climbs
 * back up over the frame's text.
 *
 * Every chip inside is an independently pressed `ToggleButton` carrying its
 * own `aria-pressed`, `name`, and `value` for one reaction each — this part
 * contributes only the shared layout and the anchor to the frame's edge,
 * with no reaction state of its own.
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
 * Renders {@link Bubble.GroupProps.children} as a single tightly spaced
 * column of consecutive {@link Bubble} frames from the same turn: a small
 * gap between them, with the touching corners at each shared edge softened
 * to a smaller radius so the run reads as one continuous shape rather than a
 * stack of separate frames. Each frame keeps its own `variant` and `align`
 * entirely on its own — the outermost corners of the first and last frame
 * stay whatever those props already draw, since only the corners actually
 * touching a neighbor ever change.
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
