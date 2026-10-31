/**
 * Numbered steps for a docs procedure: a ringed counter beside each step and a hairline
 * running from under it toward the next. Counters and the rail are CSS on a plain `<ol>`,
 * and every step title is a real heading, so the page outline and its TOC list each step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import {
	counterIncrement,
	counterReset,
	listStyle,
	mergeMix,
	pseudoContent,
	raw,
} from "@sdxc/u/general";
import { absolute, inlineFlex, items, justify, relative, vstack } from "@sdxc/u/layout";
import { m, minIs, p } from "@sdxc/u/size";
import { after, before, not } from "@sdxc/u/state";
import { balance, leading, tabularNums, text, weight } from "@sdxc/u/typography";

import type { HeadingLevel } from "./heading-scope.js";

import {
	HeadingScope,
	readAmbientLevel,
	resolveHeadingLevel,
	TAG_BY_LEVEL,
} from "./heading-scope.js";

/** Diameter of a step's counter; the title's first line is as tall so the two centre. */
const COUNTER_SIZE = "1.75rem";

/** Space the rail leaves under one counter and above the next. */
const RAIL_GAP = "0.375rem";

/** Depth step titles take when nothing above the list sets one: sections of a page's `<h1>`. */
const FALLBACK_LEVEL: HeadingLevel = 2;

/** Hairline the counter ring and the rail draw with. */
const HAIRLINE = "var(--ui-neutral-border, color-mix(in oklch, CanvasText 16%, transparent))";

/**
 * Prop types for {@link Steps} and {@link Steps.Item}.
 */
export namespace Steps {
	/** Native `<ol>` attributes plus the depth the step titles render at. */
	export interface Props extends TagProps<"ol"> {
		/**
		 * Heading depth of every step title. Defaults to one level past the nearest
		 * `HeadingScope`, or `2` where no scope wraps the list.
		 */
		level?: HeadingLevel;
		/** {@link Steps.Item} children, numbered in order by CSS counters. */
		children: RemixNode;
	}

	/** Native `<li>` attributes plus the step's heading and its optional anchor. */
	export interface ItemProps extends Omit<TagProps<"li">, "title" | "id"> {
		/** What the reader does in this step, rendered as a heading. */
		title: RemixNode;
		/** Id on the title heading, so a table of contents or a link can target the step. */
		id?: string;
		/** Instructions, commands and code for the step. */
		children?: RemixNode;
	}
}

/**
 * Renders the ordered list and the heading scope its titles read. Each step pads its
 * own end instead of the list using a gap, so the rail spans the whole distance between
 * one counter and the next.
 *
 * @param handle Runtime handle carrying the host `<ol>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <Steps>
 * 	<Steps.Item id="add-a-monitor" title={t("quickstart.add")}>{t("quickstart.add.body")}</Steps.Item>
 * 	<Steps.Item title={t("quickstart.alerts")}>{t("quickstart.alerts.body")}</Steps.Item>
 * </Steps>
 */
export function Steps(handle: Handle<Steps.Props>) {
	return () => {
		let { children, level, mix, ...rest } = handle.props;
		let ambient = readAmbientLevel(handle);
		let resolved =
			level ?? (ambient === undefined ? FALLBACK_LEVEL : ((ambient + 1) as HeadingLevel));

		return (
			<HeadingScope level={resolveHeadingLevel(handle, resolved)}>
				<ol
					{...rest}
					data-slot="steps"
					mix={mergeMix(
						[counterReset("ui-docs-step"), listStyle("none"), m(0), p(0), minIs(0)],
						mix,
					)}
				>
					{children}
				</ol>
			</HeadingScope>
		);
	};
}

/**
 * The counter disc: a step number centred in a ring drawn as a 1px inset shadow, so the
 * ring adds nothing to the disc's 28px box.
 */
function counter() {
	return before([
		pseudoContent("counter(ui-docs-step)"),
		absolute(),
		raw({
			insetBlockStart: "0",
			insetInlineStart: "0",
			inlineSize: COUNTER_SIZE,
			blockSize: COUNTER_SIZE,
		}),
		inlineFlex(),
		items("center"),
		justify("center"),
		rounded("full"),
		raw({ boxShadow: `inset 0 0 0 1px ${HAIRLINE}` }),
		fg("neutral.emphasis"),
		text("sm"),
		weight("semibold"),
		tabularNums(),
	]);
}

/**
 * The rail under a counter: a 1px line centred on the disc that starts a gap below it and
 * ends a gap above the next step, which begins where this step's padding ends.
 */
function rail() {
	return not(
		":last-child",
		after([
			pseudoContent('""'),
			absolute(),
			raw({
				insetBlockStart: `calc(${COUNTER_SIZE} + ${RAIL_GAP})`,
				insetBlockEnd: RAIL_GAP,
				insetInlineStart: `calc(${COUNTER_SIZE} / 2 - 0.5px)`,
				inlineSize: "1px",
				backgroundColor: HAIRLINE,
			}),
		]),
	);
}

/**
 * One step: the counter and rail in the inline-start gutter, the title heading beside the
 * counter, and the step's content under the title. Content can shrink below its widest
 * line, so a long code block scrolls inside its own box.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the step's markup.
 */
Steps.Item = function StepsItem(handle: Handle<Steps.ItemProps>) {
	return () => {
		let { children, id, mix, title, ...rest } = handle.props;
		let level = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[level];

		return (
			<li
				{...rest}
				data-slot="steps-item"
				mix={mergeMix(
					[
						relative(),
						counterIncrement("ui-docs-step"),
						raw({ paddingInlineStart: `calc(${COUNTER_SIZE} + 1rem)` }),
						not(":last-child", raw({ paddingBlockEnd: "2rem" })),
						minIs(0),
						vstack({ gap: 3, align: "stretch" }),
						counter(),
						rail(),
					],
					mix,
				)}
			>
				<Tag
					id={id}
					data-slot="steps-title"
					data-heading-level={level}
					mix={[
						m(0),
						text("base"),
						raw({ lineHeight: COUNTER_SIZE }),
						weight("semibold"),
						balance(),
						fg("neutral.emphasis"),
					]}
				>
					{title}
				</Tag>
				{children === undefined || children === null ? null : (
					<div
						data-slot="steps-content"
						mix={[minIs(0), vstack({ gap: 3, align: "stretch" }), leading("relaxed")]}
					>
						{children}
					</div>
				)}
			</li>
		);
	};
};
