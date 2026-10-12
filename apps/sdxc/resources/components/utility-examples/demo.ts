/**
 * Decoration for the `@sdxc/u` examples: the boxes, stripes and placeholders an example
 * draws so the utility it documents has something to act on. The code a page prints
 * shows every `demo.*` call as `...`, so the reader sees only the utility being taught.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { combine, raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { font, leading, text, textAlign, weight } from "@sdxc/u/typography";

/**
 * The solid brand block most examples act on, with its label set in the mono face.
 * It sets no size, spacing or position, so whichever of those the example documents
 * is the only one in play.
 */
export function box() {
	return combine([
		bg("brand.solid"),
		fg("brand.onSolid"),
		rounded("md"),
		font("mono"),
		text("sm"),
		weight("semibold"),
		textAlign("center"),
	]);
}

/**
 * A labelled box with room of its own around the label, for content sitting inside the
 * space a utility reserves. Its padding is decoration, so place it on an element no
 * spacing utility of the example also sets.
 */
export function block() {
	return combine([box(), p(3, 4)]);
}

/**
 * Diagonal stripes in the brand tint, which mark space a utility reserves: the padding
 * around a box, the track a `max-width` leaves empty, the gap between two items.
 */
export function stripes() {
	return combine([
		rounded("md"),
		raw({
			backgroundImage:
				"repeating-linear-gradient(-45deg, var(--ui-brand-border) 0 1px, transparent 1px 8px)",
			outline: "1px solid var(--ui-brand-border)",
			outlineOffset: "-1px",
		}),
	]);
}

/**
 * Neutral stripes, for the space an example leaves empty on purpose rather than the
 * space the utility reserves.
 */
export function track() {
	return combine([
		rounded("md"),
		raw({
			backgroundImage:
				"repeating-linear-gradient(-45deg, var(--ui-neutral-border) 0 1px, transparent 1px 8px)",
			outline: "1px solid var(--ui-neutral-border)",
			outlineOffset: "-1px",
		}),
	]);
}

/** A card on the page's surface, padded, for examples that need a container to live in. */
export function panel() {
	return combine([
		bg(),
		fg(),
		border({ color: "neutral.border", width: 1, style: "solid" }),
		rounded("lg"),
		p(4),
	]);
}

/** A colorful backdrop, for effects that read only against something other than flat color. */
export function gradient() {
	return combine([
		rounded("lg"),
		raw({
			backgroundImage:
				"linear-gradient(135deg, oklch(0.7 0.17 275), oklch(0.68 0.2 320) 55%, oklch(0.75 0.16 20))",
		}),
	]);
}

/**
 * A stand-in photograph: a landscape drawn in gradients, so a filter, a blend mode or an
 * object fit has detail, color and contrast to change.
 */
export function photo() {
	return combine([
		rounded("lg"),
		raw({
			backgroundColor: "oklch(0.75 0.1 230)",
			backgroundImage: [
				"radial-gradient(circle at 75% 28%, oklch(0.95 0.12 90) 0 9%, transparent 9.5%)",
				"linear-gradient(160deg, transparent 55%, oklch(0.45 0.12 150) 55.5%)",
				"linear-gradient(200deg, transparent 62%, oklch(0.55 0.13 140) 62.5%)",
				"linear-gradient(180deg, oklch(0.72 0.12 240), oklch(0.88 0.08 60))",
			].join(", "),
		}),
	]);
}

/** A row of items, wrapping, with room between them. */
export function row() {
	return combine([hstack({ gap: 4, align: "center", justify: "center" }), flexWrap()]);
}

/** A column of items stretched to the example's width, with room between them. */
export function stack() {
	return combine([vstack({ gap: 4, align: "stretch" }), is("100%")]);
}

/** A small mono label under or beside an item, naming the call that drew it. */
export function caption() {
	return combine([font("mono"), text("xs"), fg("neutral.muted")]);
}

/** A run of body copy, for the typography and text examples. */
export function prose() {
	return combine([fg("neutral.emphasis"), text("base"), leading("relaxed")]);
}

/** A raised card, for examples about what sits on top of something else. */
export function card() {
	return combine([
		bg(),
		fg(),
		border({ color: "neutral.border", width: 1, style: "solid" }),
		rounded("lg"),
		shadow("md"),
		p(4),
	]);
}

/**
 * A fixed square brand tile with its label centred, for the transform examples: its size
 * matches the `track()` it sits in, so the stripes left uncovered mark where it started.
 */
export function tile() {
	return combine([
		bg("brand.solid"),
		fg("brand.onSolid"),
		rounded("md"),
		font("mono"),
		text("xs"),
		weight("semibold"),
		textAlign("center"),
		p(2),
		raw({
			display: "grid",
			placeItems: "center",
			inlineSize: "6rem",
			blockSize: "6rem",
			overflowWrap: "anywhere",
		}),
	]);
}

/**
 * A wrapping row with wide gaps and padding, for items a transform moves or grows past
 * their own box, so a neighbour never sits under them.
 */
export function gallery() {
	return combine([hstack({ gap: 12, align: "center", justify: "center" }), flexWrap(), p(6)]);
}

/**
 * A labelled swatch that paints no color of its own, for the color examples: the
 * `bg()`, `fg()`, `border()` or `surface()` call beside it is the only paint in play.
 */
export function swatch() {
	return combine([
		rounded("md"),
		font("mono"),
		text("xs"),
		weight("semibold"),
		textAlign("center"),
		p(3, 4),
	]);
}

/**
 * A text field's frame on the page's surface, for examples about what a field paints
 * inside it — its caret, its autofill or its outline. It sets no caret, shadow or outline.
 */
export function field() {
	return combine([
		bg(),
		fg(),
		border({ color: "neutral.border", width: 1, style: "solid" }),
		rounded("md"),
		text("sm"),
		p(2, 3),
	]);
}

/**
 * A brand fill with its label centred and no radius, size or padding of its own, for the
 * sizing and shape examples: whichever dimension or corner the example sets is the only
 * one that shapes it.
 */
export function fill() {
	return combine([
		bg("brand.solid"),
		fg("brand.onSolid"),
		font("mono"),
		text("sm"),
		weight("semibold"),
		textAlign("center"),
		raw({ display: "grid", placeItems: "center" }),
	]);
}

/** The centred brand fill with the boxes' usual radius, for sizing examples that draw boxes. */
export function cell() {
	return combine([fill(), rounded("md")]);
}

/**
 * The page's surface with a border and a radius but no padding, for a container whose
 * padding the example sets itself.
 */
export function frame() {
	return combine([
		bg(),
		fg(),
		border({ color: "neutral.border", width: 1, style: "solid" }),
		rounded("lg"),
	]);
}

/**
 * Brand stripes that contain their children's margins, so the margin a child sets shows as
 * stripes around it instead of collapsing through to the parent's own edge.
 */
export function marginArea() {
	return combine([stripes(), raw({ display: "flow-root" })]);
}

/**
 * The address of a stand-in landscape photograph, wider than tall, with a tree on its left
 * and the sun on its right, so a crop or a position shows which part of it stays in frame.
 */
export function photoUrl() {
	let svg = [
		'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" preserveAspectRatio="none">',
		'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">',
		'<stop offset="0" stop-color="#5b8fd6"/><stop offset="1" stop-color="#f3d9a4"/>',
		"</linearGradient></defs>",
		'<rect width="640" height="400" fill="url(#s)"/>',
		'<circle cx="520" cy="96" r="44" fill="#ffe38a"/>',
		'<path d="M0 290 L150 170 L280 270 L420 150 L640 300 V400 H0 Z" fill="#5f8f6b"/>',
		'<path d="M0 330 Q320 270 640 340 V400 H0 Z" fill="#3f6e4c"/>',
		'<rect x="92" y="250" width="14" height="70" fill="#5a3d2b"/>',
		'<circle cx="99" cy="232" r="40" fill="#2f5a3a"/>',
		"</svg>",
	].join("");
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * A button's shape and type with no paint, border color or cursor, for the state examples:
 * the background, color or opacity the example sets, and what a state changes, are the
 * only ones in play.
 */
export function control() {
	return combine([
		rounded("md"),
		font("sans"),
		text("sm"),
		weight("semibold"),
		p(2, 4),
		border({ width: 0 }),
	]);
}

/**
 * A text field's shape with a border width but no border color or background, for the
 * state examples that repaint a field: the example sets both itself, so what a state
 * changes overrides them.
 */
export function input() {
	return combine([
		fg(),
		rounded("md"),
		font("sans"),
		text("sm"),
		p(2, 3),
		border({ width: 1, style: "solid" }),
	]);
}

/**
 * A fixed-size thumbnail that crops whatever image it holds to fill it, for the filter
 * examples: every image in a row is the same size, so only the filter tells them apart.
 */
export function thumb() {
	return combine([
		rounded("lg"),
		raw({ display: "block", inlineSize: "10rem", blockSize: "7rem", objectFit: "cover" }),
	]);
}

/**
 * The stand-in photograph at a fixed size with its content centred, for the backdrop
 * examples: a `pane()` laid over it has detail behind it for a backdrop filter to change.
 */
export function scene() {
	return combine([
		photo(),
		raw({ display: "grid", placeItems: "center", inlineSize: "13rem", blockSize: "9rem" }),
	]);
}

/**
 * A see-through pane with a light outline and a light label, laid over a `scene()` so the
 * backdrop filter on it changes only the part of the photograph it covers.
 */
export function pane() {
	return combine([
		rounded("md"),
		font("mono"),
		text("xs"),
		weight("semibold"),
		textAlign("center"),
		raw({
			display: "grid",
			placeItems: "center",
			inlineSize: "85%",
			blockSize: "60%",
			color: "white",
			outline: "1px solid oklch(1 0 0 / 0.6)",
			outlineOffset: "-1px",
			textShadow: "0 1px 2px oklch(0 0 0 / 0.5)",
		}),
	]);
}

/**
 * A sized inline icon filled with the brand color, for effects that follow an element's
 * rendered shape — a drop shadow traces the outline of the drawing itself.
 */
export function icon() {
	return combine([
		raw({ inlineSize: "5rem", blockSize: "5rem", fill: "var(--ui-brand-bg-solid)" }),
	]);
}

/**
 * A neutral, bordered button on the page's surface, for layout examples that need a
 * control to place — a toolbar action, an anchor for a tooltip — without drawing the eye.
 */
export function button() {
	return combine([
		bg(),
		fg(),
		border({ color: "neutral.border", width: 1, style: "solid" }),
		rounded("md"),
		font("sans"),
		text("sm"),
		weight("medium"),
		p(1.5, 3),
		raw({ cursor: "pointer" }),
	]);
}

/**
 * A border in the page's own color around an avatar, so overlapping avatars stay apart
 * where one covers the next.
 */
export function avatarRing() {
	return raw({ border: "2px solid var(--ui-bg, Canvas)" });
}

/**
 * An item stacked over its caption, centred, with no margin of its own, for a row of
 * drawings each named by the call under it; it fits a `<figure>` as well as a `<div>`.
 */
export function figure() {
	return combine([vstack({ gap: 2, align: "center" }), raw({ margin: 0 })]);
}

/**
 * The centred brand fill with padding and no radius, for the corner examples: the
 * `rounded()` or `roundedCorner()` call beside it is the only thing shaping its corners.
 */
export function shape() {
	return combine([fill(), p(4, 6)]);
}

/** A small brand dot, for examples that move or fade several identical items in a row. */
export function dot() {
	return combine([
		bg("brand.solid"),
		raw({ inlineSize: "1rem", blockSize: "1rem", borderRadius: "9999px" }),
	]);
}

/**
 * A see-through, outlined pane with no paint of its own, laid over a drawing so a backdrop
 * filter on it is the only thing changing what shows through.
 */
export function glass() {
	return combine([
		rounded("md"),
		raw({
			inlineSize: "8rem",
			blockSize: "6rem",
			outline: "1px dashed var(--ui-neutral-border-strong)",
			outlineOffset: "-1px",
		}),
	]);
}

/** A sized inline icon that keeps the paint its own markup gives it, for single-color assets. */
export function glyph() {
	return raw({ inlineSize: "5rem", blockSize: "5rem" });
}
