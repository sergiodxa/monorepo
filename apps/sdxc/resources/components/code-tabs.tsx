/**
 * The `code-tabs` and `code-tab` pair: a strip of labels over a set of snippets, with
 * no script involved. Each tab is a radio input paired with its own label and panel;
 * the wrapper around the three is `display: contents`, so the labels line up as one
 * strip while the panel stays a CSS sibling of the input that reveals it.
 *
 * The strip is a `<form>` because a radio group is scoped to its form owner: two sets
 * of tabs on one page then answer to their own labels rather than to each other's.
 *
 * A strip that names an option group opens on the option the reader last chose, and a
 * strip with no name opens on the tab the author marked and is remembered nowhere:
 * two sets of samples are rarely the same question asked twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { basis, flex, flexWrap, gap, hidden } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { precededBy } from "@sdxc/u/state";
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
	handle.context.set({ name: handle.props.name, selected: handle.props.selected });

	return () => handle.props.children;
}

/** Renders the strip every `code-tab` inside it lays itself into. */
export default function CodeTabs(handle: Handle<CodeTabs.Props>) {
	return () => {
		let { children, name } = handle.props;
		let selected = name ? selectedOption(handle.context.get(OptionGroupScope), name) : undefined;

		return (
			<form data-option-group={name} mix={[flex(), flexWrap("wrap"), gap(2)]}>
				<CodeTabScope name={name} selected={selected}>
					{children}
				</CodeTabScope>
				{name ? <OptionGroupSync group={name} /> : null}
			</form>
		);
	};
}

/** Renders one tab: its control, its label in the strip, and its panel below. */
export function CodeTab(handle: Handle<CodeTabs.TabProps>) {
	return () => {
		let { children, label, selected } = handle.props;
		let strip = handle.context.get(CodeTabScope);
		let inputId = `${handle.id}-tab`;

		return (
			<div mix={[raw({ display: "contents" })]}>
				<input
					type="radio"
					name={RADIO_GROUP}
					id={inputId}
					data-option-value={strip?.name ? label : undefined}
					defaultChecked={strip?.name ? strip.selected === label : selected}
					mix={[visuallyHidden()]}
				/>
				<label
					htmlFor={inputId}
					mix={[
						raw({ order: -1 }),
						p(1.5, 3),
						rounded("md"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg("neutral.bg-tint"),
						fg("neutral"),
						text("sm"),
						weight("medium"),
						cursor("pointer"),
						transition("background-color, border-color, color"),
						precededBy("input:checked", [bg("brand.tint"), fg("brand"), border("brand.border")]),
						precededBy("input:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					]}
				>
					{label}
				</label>
				<div
					mix={[basis("100%"), hidden(), precededBy("input:checked", raw({ display: "block" }))]}
				>
					{children}
				</div>
			</div>
		);
	};
}
