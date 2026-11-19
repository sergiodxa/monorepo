/**
 * The order a product listing is sorted in, as a labelled native select that submits its
 * form the moment the shopper picks an order. It may sit outside that form by naming it, and
 * without script a small button beside it submits instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

import { Select } from "../components/select.js";

import { AutoSubmit } from "./facet-filters.js";

/** The no-script submit button's text when `submitLabel` is unset. */
const DEFAULT_SUBMIT_LABEL = "Apply";

/** Prop types for {@link SortSelect}. */
export namespace SortSelect {
	/** One order the listing can be sorted in. */
	export interface Option {
		value: string;
		label: string;
	}

	/** Props accepted by {@link SortSelect}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The query field the order submits as, such as "sort". */
		name: string;
		/** The order selected now. */
		value: string;
		options: Option[];
		/** The visible label, such as "Sort by". */
		label: string;
		/** The id of the form the select belongs to, when it sits outside that form. */
		form?: string;
		/** The button that submits without script. @default "Apply" */
		submitLabel?: string;
	}
}

/**
 * Renders the label and select in a row, with a submit button that hides once script runs.
 *
 * @example
 * <SortSelect form="filters" name="sort" value="new" label="Sort by" options={[{ value: "new", label: "Newest" }, { value: "price", label: "Price: low to high" }]} />
 */
export function SortSelect(handle: Handle<SortSelect.Props>) {
	return () => {
		let {
			form,
			label,
			mix,
			name,
			options,
			submitLabel = DEFAULT_SUBMIT_LABEL,
			value,
			...rest
		} = handle.props;
		let selectId = `${handle.id}-select`;
		return (
			<div
				{...rest}
				data-slot="sort-select"
				mix={mergeMix([raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })], mix)}
			>
				<label
					for={selectId}
					mix={[
						raw({
							flexShrink: "0",
							fontSize: "0.875rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{label}
				</label>
				<Select id={selectId} name={name} form={form} mix={[raw({ inlineSize: "auto" })]}>
					{options.map((option) => (
						<option value={option.value} selected={option.value === value}>
							{option.label}
						</option>
					))}
				</Select>
				<button
					type="submit"
					form={form}
					data-auto-submit-hide=""
					data-slot="sort-select-submit"
					mix={[
						raw({
							minBlockSize: "2.5rem",
							paddingInline: "0.875rem",
							border: "0",
							borderRadius: "var(--ui-radius-md, 0.5rem)",
							font: "inherit",
							fontSize: "0.875rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							cursor: "pointer",
						}),
					]}
				>
					{submitLabel}
				</button>
				<AutoSubmit />
			</div>
		);
	};
}
