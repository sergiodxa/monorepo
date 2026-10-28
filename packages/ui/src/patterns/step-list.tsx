/**
 * Numbered marketing steps for a “how it works” band. Counters are CSS-driven
 * so the list stays pure markup; titles and descriptions stay on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { counterIncrement, counterReset, pseudoContent, raw } from "@sdxc/u/general";
import {
	absolute,
	container,
	gap,
	grid,
	gridTemplate,
	inlineFlex,
	items,
	justify,
	relative,
	repeat,
	vstack,
} from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, mbe } from "@sdxc/u/size";
import { after, before, not } from "@sdxc/u/state";
import { leading, pretty, text, textAlign, weight } from "@sdxc/u/typography";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/**
 * Prop types for {@link StepList} and its compound parts.
 */
export namespace StepList {
	/**
	 * Props accepted by {@link StepList}.
	 */
	export interface Props extends TagProps<"ol"> {
		/** {@link StepList.Item} children, numbered by CSS counters. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link StepList.Item}.
	 */
	export interface ItemProps extends Omit<TagProps<"li">, "title"> {
		/** Step title — rendered at the ambient heading depth. */
		title: RemixNode;
		/** Supporting copy under the title. */
		children: RemixNode;
	}
}

/**
 * Lays numbered steps in a responsive three-column track that collapses below
 * `lg`. Connector lines appear between items only when the track is wide.
 *
 * @param handle Runtime handle carrying the host `<ol>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <StepList>
 * 	<StepList.Item title={t("step.one")}>{t("step.one.body")}</StepList.Item>
 * 	<StepList.Item title={t("step.two")}>{t("step.two.body")}</StepList.Item>
 * </StepList>
 */
export function StepList(handle: Handle<StepList.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<ol
				{...rest}
				data-slot="step-list"
				mix={[
					container("ui-marketing-step-list"),
					counterReset("ui-marketing-step"),
					raw({ listStyle: "none", padding: "0", margin: "0" }),
					grid(),
					gap(8),
					gridTemplate({ columns: "minmax(0, 1fr)" }),
					at(
						"lg",
						"ui-marketing-step-list",
						gridTemplate({ columns: repeat(3, "minmax(0, 1fr)") }),
					),
					mix,
				]}
			/>
		);
	};
}

/**
 * One numbered step: a brand medallion, a title, and supporting copy.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the step's markup.
 */
StepList.Item = function StepListItem(handle: Handle<StepList.ItemProps>) {
	return () => {
		let { children, mix, title, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<li
				{...rest}
				data-slot="step-list-item"
				mix={[
					relative(),
					vstack({ align: "center", gap: 4 }),
					textAlign("center"),
					counterIncrement("ui-marketing-step"),
					before([
						pseudoContent("counter(ui-marketing-step)"),
						inlineFlex(),
						items("center"),
						justify("center"),
						is(12),
						bs(12),
						mbe(2),
						rounded("full"),
						bg("brand.solid"),
						fg("brand.onSolid"),
						text("xl"),
						weight("semibold"),
					]),
					not(
						":last-child",
						after([
							pseudoContent('""'),
							absolute(),
							raw({
								insetBlockStart: "1.5rem",
								insetInlineStart: "calc(50% + 2rem)",
								inlineSize: "calc(100% - 4rem)",
								blockSize: "2px",
								backgroundColor: "var(--ui-neutral-border)",
								display: "none",
							}),
							at("lg", "ui-marketing-step-list", raw({ display: "block" })),
						]),
					),
					mix,
				]}
			>
				<Tag
					data-slot="step-list-title"
					data-heading-level={resolved}
					mix={[m(0), text("xl"), weight("medium"), fg("neutral.emphasis")]}
				>
					{title}
				</Tag>
				<div mix={[text("base"), leading("relaxed"), pretty(), fg("neutral")]}>{children}</div>
			</li>
		);
	};
};
