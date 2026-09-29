/**
 * The `split`, `split-copy` and `split-media` tags: a band laid out as prose on one side
 * and what the prose is about on the other — a code sample, a set of tabs. The columns
 * stack on a narrow screen with the copy first, since the sample only reads once the
 * copy has said what it shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, items, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { minIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

/** The check each item of a list in the copy is marked with, drawn as a mask the brand color fills. */
const CHECK_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center / contain no-repeat`;

/** Renders the two columns. */
export default function Split(handle: Handle<MarkdownProps>) {
	return () => (
		<div
			mix={[
				grid(),
				gap(12),
				/*
				 * Both columns start at the top, so switching a tab in the media column changes
				 * only what is below the strip, never where the strip itself sits.
				 */
				items("start"),
				gridTemplate({ columns: "minmax(0, 1fr)" }),
				media(
					"(min-width: 64rem)",
					gridTemplate({ columns: "minmax(0, 0.85fr) minmax(0, 1.15fr)" }),
				),
			]}
		>
			{handle.props.children}
		</div>
	);
}

/**
 * Renders the prose column. A list in it reads as the claims the column makes, so each
 * item is marked with a check rather than a bullet.
 */
export function SplitCopy(handle: Handle<MarkdownProps>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 6, align: "stretch" }),
				blocksUseGap(),
				text("lg"),
				leading("relaxed"),
				fg("neutral"),
				when(
					"& ul",
					raw({ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.625rem" }),
				),
				when(
					"& li",
					raw({ position: "relative", paddingInlineStart: "1.75rem", fontSize: "1rem" }),
				),
				when(
					"& li::before",
					raw({
						content: '""',
						position: "absolute",
						insetInlineStart: 0,
						insetBlockStart: "0.3em",
						inlineSize: "1rem",
						blockSize: "1rem",
						backgroundColor: "var(--ui-brand-fg)",
						mask: CHECK_MASK,
						WebkitMask: CHECK_MASK,
					}),
				),
			]}
		>
			{handle.props.children}
		</div>
	);
}

/**
 * Renders what the copy is about, sized to the column rather than to its own content. A
 * long sample scrolls inside its own block past a fixed height, so switching between the
 * samples of a tab strip never leaves one towering over the copy beside it.
 */
export function SplitMedia(handle: Handle<MarkdownProps>) {
	return () => (
		<div
			mix={[
				vstack({ gap: 4, align: "stretch" }),
				blocksUseGap(),
				minIs(0),
				text("base"),
				when("& pre", raw({ maxBlockSize: "22rem", overflowY: "auto" })),
			]}
		>
			{handle.props.children}
		</div>
	);
}
