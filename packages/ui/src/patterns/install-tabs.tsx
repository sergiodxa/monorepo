/**
 * Package-manager or language chooser plus a command row. Switching dialects
 * uses a radio group and CSS — no JavaScript — so the selected command stays
 * copyable with the platform alone. Every label and command string is a prop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { basis, flex, flexWrap, gap, hidden, items, justify } from "@sdxc/u/layout";
import { overflow, overflowX } from "@sdxc/u/overflow";
import { minIs, p } from "@sdxc/u/size";
import { precededBy, when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

/**
 * Prop types for {@link InstallTabs} and its compound parts.
 */
export namespace InstallTabs {
	/**
	 * Value {@link InstallTabs} provides so nested options share one radio name.
	 */
	export interface Context {
		/** Radio `name` every option in this strip writes. */
		name: string;
	}

	/**
	 * Props accepted by {@link InstallTabs}.
	 */
	export interface Props extends TagProps<"form"> {
		/**
		 * Shared `name` for the radio group that switches dialects. Required so
		 * multiple strips on one page stay independent.
		 */
		name: string;
		/** Accessible name for the strip. Required — the library ships no copy. */
		"aria-label": string;
		/** One or more {@link InstallTabs.Option} dialects. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link InstallTabs.Option}.
	 */
	export interface OptionProps extends TagProps<"div"> {
		/** Radio value written for this dialect. */
		value: string;
		/** Visible tab label for the dialect. */
		label: RemixNode;
		/**
		 * Marks this dialect as the initially selected one. Only one option in
		 * a strip should pass `defaultChecked`.
		 */
		defaultChecked?: boolean;
		/**
		 * Optional trailing control beside the command — typically a copy
		 * button the page supplies.
		 */
		actions?: RemixNode;
		/** Command or snippet shown when this dialect is selected. */
		children: RemixNode;
	}
}

/**
 * Renders a radio-driven dialect strip. Nest {@link InstallTabs.Option}
 * children; the checked option's command row reveals via CSS.
 *
 * @param handle Runtime handle carrying the host `<form>`'s props and providing
 * {@link InstallTabs.Context}.
 * @returns The render function producing the strip's markup.
 * @example
 * <InstallTabs name="pkg" aria-label={t("install.label")}>
 * 	<InstallTabs.Option value="bun" label="bun" defaultChecked>
 * 		bun add @sdxc/ui
 * 	</InstallTabs.Option>
 * 	<InstallTabs.Option value="npm" label="npm">
 * 		npm add @sdxc/ui
 * 	</InstallTabs.Option>
 * </InstallTabs>
 */
export function InstallTabs(handle: Handle<InstallTabs.Props, InstallTabs.Context>) {
	return () => {
		let { mix, name, ...rest } = handle.props;

		handle.context.set({ name });

		return (
			<form
				{...rest}
				data-slot="install-tabs"
				data-name={name}
				mix={[
					flex(),
					flexWrap("wrap"),
					overflow("hidden"),
					rounded("lg"),
					border({ color: "neutral", width: 1, style: "solid" }),
					bg(),
					mix,
				]}
			/>
		);
	};
}

/**
 * One dialect: a radio, its label, and a command row that shows when checked.
 * The command row keys off the adjacent `input:checked + label + &` chain so a
 * checked earlier dialect never reveals a later row.
 *
 * @param handle Runtime handle carrying the option's props.
 * @returns The render function producing the option's markup.
 */
InstallTabs.Option = function InstallTabsOption(handle: Handle<InstallTabs.OptionProps>) {
	return () => {
		let { actions, children, defaultChecked, label, mix, value, ...rest } = handle.props;
		let context = handle.context.get(InstallTabs) as InstallTabs.Context | undefined;
		let groupName = context?.name ?? "install-tabs";
		let inputId = `${groupName}-${value}`;
		let valueId = `${inputId}-value`;

		return (
			<div
				{...rest}
				data-slot="install-tabs-option"
				data-value={value}
				mix={[raw({ display: "contents" }), mix]}
			>
				<input
					type="radio"
					name={groupName}
					id={inputId}
					value={value}
					defaultChecked={defaultChecked}
					mix={[visuallyHidden()]}
				/>
				<label
					htmlFor={inputId}
					mix={[
						raw({ order: -1 }),
						p(2, 3),
						fg("neutral"),
						text("sm"),
						weight("medium"),
						cursor("pointer"),
						borderEdge("block-end", { color: "transparent", width: 2, style: "solid" }),
						transition("color, border-color"),
						precededBy("input:checked", [
							fg("brand"),
							borderEdge("block-end", { color: "brand", width: 2, style: "solid" }),
						]),
						precededBy("input:focus-visible", outline({ color: "brand.ring", offset: -2 })),
					]}
				>
					{label}
				</label>
				<div
					mix={[
						basis("100%"),
						hidden(),
						items("center"),
						justify("between"),
						gap(3),
						p(2, 2, 2, 3),
						borderEdge("block-start", {
							color: "neutral",
							width: 1,
							style: "solid",
						}),
						when(":is(input:checked) + label + &", raw({ display: "flex" })),
					]}
				>
					<code
						id={valueId}
						mix={[font("mono"), text("sm"), fg("neutral.emphasis"), minIs(0), overflowX("auto")]}
					>
						{children}
					</code>
					{actions}
				</div>
			</div>
		);
	};
};
