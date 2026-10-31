/**
 * The `code-tabs` and `code-tab` pair: a strip of labels over a set of snippets, with no
 * script involved. Every panel shares one grid cell, so the strip is as tall as its
 * tallest snippet whichever tab is checked, and switching never moves the layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition, visibility } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { flex, flexCol, flexWrap, gap, grid, gridArea, grow } from "@sdxc/u/layout";
import { minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { OptionGroupName } from "~/app/services/option-groups";
import type { MarkdownProps } from "~/resources/components/markdown-props";

import { selectedOption } from "~/app/services/option-groups";
import OptionGroupScope, { OptionGroupSync } from "~/resources/components/option-groups";

/** Shared by every radio inside one strip, which the form owner scopes to that strip. */
const RADIO_GROUP = "code-tab";

namespace CodeTabs {
	export interface Props extends MarkdownProps {
		/**
		 * The axis these tabs offer, where they offer one every other strip on the site
		 * offers too. A named strip labels its tabs with that group's options.
		 */
		name?: OptionGroupName;
	}

	export interface TabProps extends MarkdownProps {
		/** What the tab reads as in the strip. */
		label: string;
		/** Marks the panel an unnamed strip opens on; write it on exactly one tab. */
		selected?: boolean;
	}
}

namespace CodeTabScope {
	/** What a tab reads off the strip it sits in. */
	export interface Value {
		/** The axis the strip named, where it named one. */
		name: OptionGroupName | undefined;
		/** The option a named strip opens on. */
		selected: string | undefined;
		/** Which half of the tab this pass renders: its label in the strip, or its panel. */
		part: "label" | "panel";
		/** The tab's position in the strip, which pairs its panel with its label. */
		index: number;
	}

	export interface Props extends Value {
		children: RemixNode;
	}
}

/**
 * Carries what the strip decided to the tabs inside it, which reach it by this
 * component rather than by the strip so the strip itself stays the shape a markdown
 * tag is rendered through.
 */
function CodeTabScope(handle: Handle<CodeTabScope.Props, CodeTabScope.Value>) {
	return () => {
		let { children, index, name, part, selected } = handle.props;
		handle.context.set({ index, name, part, selected });
		return children;
	};
}

/**
 * Renders the strip: every `code-tab` inside it is rendered twice, once for its label in
 * the wrapping row of labels and once for its panel in the stack beneath, where all
 * panels share one grid cell and the checked one is the only one shown.
 */
export default function CodeTabs(handle: Handle<CodeTabs.Props>) {
	return () => {
		let { children, name } = handle.props;
		let selected = name ? selectedOption(handle.context.get(OptionGroupScope), name) : undefined;
		let tabs = tabsOf(children);

		return (
			<form data-option-group={name} mix={[grid(), gap(2)]}>
				<div mix={[flex(), flexWrap("wrap"), gap(2)]}>
					{tabs.map((tab, index) => (
						<CodeTabScope key={index} name={name} selected={selected} part="label" index={index}>
							{tab}
						</CodeTabScope>
					))}
				</div>
				<div mix={[grid(), minIs(0)]}>
					{tabs.map((tab, index) => (
						<CodeTabScope key={index} name={name} selected={selected} part="panel" index={index}>
							{tab}
						</CodeTabScope>
					))}
				</div>
				{name ? <OptionGroupSync group={name} /> : null}
			</form>
		);
	};
}

/**
 * The tabs a strip's markdown wrote, in order. The whitespace between two tags carries
 * nothing a reader sees, and dropping it keeps each tab's index its place in the strip.
 */
function tabsOf(children: RemixNode): RemixNode[] {
	if (Array.isArray(children)) return children.flatMap((child: RemixNode) => tabsOf(child));
	return typeof children === "object" && children !== null ? [children] : [];
}

/**
 * Renders one half of a tab, as the strip's pass asks: the label holding the control, or
 * the panel. The control sits inside its label, so the pair needs no id to find each
 * other — an id is only unique within one render, and two strips on a page would share
 * them. A panel stays laid out while hidden, which is what sizes the stack to the
 * tallest snippet; `visibility: hidden` keeps it out of the accessibility tree and the
 * tab order, and its last block stretches so every snippet's frame ends at one edge.
 */
export function CodeTab(handle: Handle<CodeTabs.TabProps>) {
	return () => {
		let { children, label, selected } = handle.props;
		let strip = handle.context.get(CodeTabScope);

		if (strip?.part === "panel") {
			return (
				<div
					mix={[
						gridArea("1 / 1"),
						flex(),
						flexCol(),
						minIs(0),
						visibility("hidden"),
						when("& > :last-child", grow()),
						when(
							`:is(div:has(> label:nth-child(${strip.index + 1}) > input:checked)) + div > &`,
							visibility("visible"),
						),
					]}
				>
					{children}
				</div>
			);
		}

		return (
			<label
				mix={[
					p(1.5, 3),
					rounded("md"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					bg("neutral.bg-tint"),
					fg("neutral"),
					text("sm"),
					weight("medium"),
					cursor("pointer"),
					transition("background-color, border-color, color"),
					when("&:has(input:checked)", [bg("brand.tint"), fg("brand"), border("brand.border")]),
					when("&:has(input:focus-visible)", outline({ color: "brand.ring", offset: 2 })),
				]}
			>
				<input
					type="radio"
					name={RADIO_GROUP}
					data-option-value={strip?.name ? label : undefined}
					defaultChecked={strip?.name ? strip.selected === label : selected}
					mix={[visuallyHidden()]}
				/>
				{label}
			</label>
		);
	};
}
