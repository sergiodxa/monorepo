/**
 * The filters beside a product listing as one GET form: collapsible groups of checkboxes
 * with counts, switches, a price range with buckets, and the applied filters as removable
 * chips. It submits with an Apply button; once script runs, each change submits on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	EntryComponent,
	Handle,
	MixinFactory,
	Props as TagProps,
	RemixNode,
} from "remix/component";

import { ChevronDownIcon, XIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry, createMixin } from "remix/component";

/** Marks a control that only matters without script, such as an Apply button. */
const NO_SCRIPT_ATTRIBUTE = "data-auto-submit-hide";

/** Marks a form already submitting on change, so a second marker inside it adds no listener. */
const LIVE_ATTRIBUTE = "data-auto-submit";

/** Prop types for {@link FacetFilters} and its compound parts. */
export namespace FacetFilters {
	/** The words the form's controls are named by. */
	export interface Labels {
		/** The submit button shown until script runs, such as "Apply". */
		apply: string;
	}

	/** Props accepted by {@link FacetFilters}; the host is a `<form method="get">`. */
	export interface Props extends Omit<TagProps<"form">, "children" | "method" | "action"> {
		/** The listing page the filters submit to. */
		action: string;
		/** Query fields the form carries unchanged, such as the search and the sort. */
		keep?: Record<string, string>;
		children: RemixNode;
		labels: Labels;
	}

	/** Props accepted by {@link FacetFilters.Group}. */
	export interface GroupProps {
		title: RemixNode;
		/** @default true */
		open?: boolean;
		children: RemixNode;
	}

	/** Props accepted by {@link FacetFilters.Check}. */
	export interface CheckProps {
		name: string;
		value: string;
		label: RemixNode;
		/** How many results this value has with the other filters applied. */
		count: number;
		checked?: boolean;
		/** A colour dot before the label, as any CSS colour or gradient. */
		swatch?: string;
	}

	/** Props accepted by {@link FacetFilters.Toggle}. */
	export interface ToggleProps {
		/** The field that posts `1` while on. */
		name: string;
		label: RemixNode;
		count: number;
		checked?: boolean;
	}

	/** One price bucket, a link to the listing with that range applied. */
	export interface Bucket {
		label: RemixNode;
		href: string;
		count: number;
		selected: boolean;
	}

	/** Props accepted by {@link FacetFilters.Range}. */
	export interface RangeProps {
		minName: string;
		maxName: string;
		min?: number | null;
		max?: number | null;
		/** The two fields' labels, such as "Min" and "Max". */
		labels: { min: string; max: string };
		/** A symbol before each figure, such as "$". */
		prefix?: string;
		buckets?: Bucket[];
	}

	/** One applied filter, a link to the listing without it. */
	export interface Chip {
		label: RemixNode;
		href: string;
	}

	/** Props accepted by {@link FacetFilters.Applied}. */
	export interface AppliedProps {
		chips: Chip[];
		/** A link to the listing with every filter removed. */
		clear?: { label: string; href: string };
		/** The row's accessible name, such as "Applied filters". */
		label: string;
	}

	/** Props {@link AutoSubmit} serializes for hydration; it reads its place in the page. */
	export type AutoSubmitProps = Record<never, never>;
}

/**
 * Renders the form: the kept fields, the groups, then the Apply button, which hides once
 * {@link AutoSubmit} takes over submitting.
 *
 * @example
 * <FacetFilters action="/shop" keep={{ sort: "new" }} labels={{ apply: "Apply" }}><FacetFilters.Group title="Colour">…</FacetFilters.Group></FacetFilters>
 */
export function FacetFilters(handle: Handle<FacetFilters.Props>) {
	return () => {
		let { action, children, keep = {}, labels, mix, ...rest } = handle.props;
		return (
			<form
				{...rest}
				method="get"
				action={action}
				data-slot="facet-filters"
				mix={mergeMix([raw({ display: "grid", gap: "0" })], mix)}
			>
				{Object.entries(keep).map(([name, value]) => (
					<input type="hidden" name={name} value={value} />
				))}
				<AutoSubmit />
				{children}
				<button
					type="submit"
					data-auto-submit-hide=""
					data-slot="facet-filters-apply"
					mix={[
						raw({
							justifySelf: "start",
							marginBlockStart: "1rem",
							minBlockSize: "2.5rem",
							paddingInline: "1.25rem",
							border: "0",
							borderRadius: "999px",
							font: "inherit",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-on-solid)",
							backgroundColor: "var(--ui-neutral-bg-solid)",
							cursor: "pointer",
						}),
						when("&[hidden]", raw({ display: "none" })),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
						),
					]}
				>
					{labels.apply}
				</button>
			</form>
		);
	};
}

/**
 * Renders a group as a `<details>` whose summary row carries the title and a chevron, open
 * unless `open` is false.
 *
 * @example <FacetFilters.Group title="Size">…</FacetFilters.Group>
 */
FacetFilters.Group = function FacetFiltersGroup(handle: Handle<FacetFilters.GroupProps>) {
	return () => {
		let { children, open = true, title } = handle.props;
		return (
			<details
				open={open}
				data-slot="facet-filters-group"
				mix={[
					raw({
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
						"&[open] [data-slot='facet-filters-chevron']": { rotate: "180deg" },
					}),
				]}
			>
				<summary
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.75rem",
							minBlockSize: "2.75rem",
							fontSize: "0.875rem",
							fontWeight: "650",
							color: "var(--ui-neutral-fg-emphasis)",
							listStyle: "none",
							cursor: "pointer",
							"&::-webkit-details-marker": { display: "none" },
						}),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
						),
					]}
				>
					{title}
					<span
						data-slot="facet-filters-chevron"
						mix={[
							raw({ display: "inline-grid", transition: "rotate 160ms ease" }),
							motionReduce(raw({ transition: "none" })),
						]}
					>
						<ChevronDownIcon size={16} aria-hidden="true" />
					</span>
				</summary>
				<div mix={[raw({ display: "grid", gap: "0.125rem", paddingBlockEnd: "0.875rem" })]}>
					{children}
				</div>
			</details>
		);
	};
};

/** A row of a group: control, label and count, at least 36px tall. */
function rowStyles() {
	return [
		raw({
			display: "grid",
			gridTemplateColumns: "auto minmax(0, 1fr) auto",
			alignItems: "center",
			gap: "0.625rem",
			minBlockSize: "2.25rem",
			fontSize: "0.875rem",
			color: "var(--ui-neutral-fg)",
			cursor: "pointer",
			"& input": { margin: "0", accentColor: "var(--ui-neutral-fg-emphasis)" },
		}),
		when("&[data-empty]", raw({ color: "var(--ui-neutral-fg-muted)" })),
		when("&:has(input:disabled)", raw({ cursor: "not-allowed", opacity: "0.55" })),
	];
}

/** A result count at a row's end, in tabular figures so a column of counts lines up. */
function Count(handle: Handle<{ value: number }>) {
	return () => (
		<span
			data-slot="facet-filters-count"
			mix={[
				raw({
					fontSize: "0.8125rem",
					fontVariantNumeric: "tabular-nums",
					color: "var(--ui-neutral-fg-muted)",
				}),
			]}
		>
			{handle.props.value}
		</span>
	);
}

/**
 * Renders a checkbox row. A value with no results stays enabled while checked, so the
 * shopper can still clear it, and is disabled otherwise.
 *
 * @example <FacetFilters.Check name="colour" value="blue" label="Blue" count={12} swatch="#3b6fd8" />
 */
FacetFilters.Check = function FacetFiltersCheck(handle: Handle<FacetFilters.CheckProps>) {
	return () => {
		let { checked = false, count, label, name, swatch, value } = handle.props;
		let empty = count === 0;
		return (
			<label data-slot="facet-filters-check" data-empty={empty ? "" : undefined} mix={rowStyles()}>
				<input
					type="checkbox"
					name={name}
					value={value}
					checked={checked}
					disabled={empty && !checked}
					mix={[raw({ inlineSize: "1rem", blockSize: "1rem" })]}
				/>
				<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.5rem" })]}>
					{swatch === undefined ? null : (
						<span
							aria-hidden="true"
							data-slot="facet-filters-swatch"
							style={{ background: swatch }}
							mix={[
								raw({
									flexShrink: "0",
									inlineSize: "0.875rem",
									blockSize: "0.875rem",
									borderRadius: "999px",
									boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.14)",
								}),
							]}
						/>
					)}
					{label}
				</span>
				<Count value={count} />
			</label>
		);
	};
};

/**
 * Renders an on/off filter as a switch-styled checkbox that posts `1` while on.
 *
 * @example <FacetFilters.Toggle name="in_stock" label="In stock" count={84} checked />
 */
FacetFilters.Toggle = function FacetFiltersToggle(handle: Handle<FacetFilters.ToggleProps>) {
	return () => {
		let { checked = false, count, label, name } = handle.props;
		return (
			<label data-slot="facet-filters-toggle" mix={rowStyles()}>
				<input
					type="checkbox"
					name={name}
					value="1"
					checked={checked}
					mix={[
						raw({
							appearance: "none",
							position: "relative",
							inlineSize: "2rem",
							blockSize: "1.125rem",
							borderRadius: "999px",
							backgroundColor: "var(--ui-neutral-border-strong)",
							transition: "background-color 160ms ease",
							cursor: "inherit",
							"&::before": {
								content: '""',
								position: "absolute",
								insetBlockStart: "0.125rem",
								insetInlineStart: "0.125rem",
								inlineSize: "0.875rem",
								blockSize: "0.875rem",
								borderRadius: "999px",
								backgroundColor: "white",
								transition: "translate 160ms ease",
							},
							"&:checked": { backgroundColor: "var(--ui-neutral-fg-emphasis)" },
							"&:checked::before": { translate: "0.875rem 0" },
						}),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
						),
						motionReduce(raw({ transition: "none", "&::before": { transition: "none" } })),
					]}
				/>
				<span>{label}</span>
				<Count value={count} />
			</label>
		);
	};
};

/**
 * Renders two number fields side by side, then the bucket links with their counts. The
 * fields submit on `change`, so typing a figure does not reload the listing per keystroke.
 *
 * @example <FacetFilters.Range minName="min" maxName="max" min={20} max={null} prefix="$" labels={{ min: "Min", max: "Max" }} />
 */
FacetFilters.Range = function FacetFiltersRange(handle: Handle<FacetFilters.RangeProps>) {
	return () => {
		let { buckets = [], labels, max, maxName, min, minName, prefix } = handle.props;
		let fields = [
			{ name: minName, value: min, label: labels.min },
			{ name: maxName, value: max, label: labels.max },
		];
		return (
			<div data-slot="facet-filters-range" mix={[raw({ display: "grid", gap: "0.625rem" })]}>
				<div mix={[raw({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" })]}>
					{fields.map((field) => (
						<label mix={[raw({ display: "grid", gap: "0.25rem", fontSize: "0.75rem" })]}>
							<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{field.label}</span>
							<span
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										gap: "0.25rem",
										minBlockSize: "2.25rem",
										paddingInline: "0.625rem",
										borderRadius: "var(--ui-radius-md, 0.5rem)",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
										"&:focus-within": { boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" },
									}),
								]}
							>
								{prefix === undefined ? null : (
									<span aria-hidden="true" mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>
										{prefix}
									</span>
								)}
								<input
									type="number"
									inputMode="numeric"
									min="0"
									name={field.name}
									value={
										field.value === null || field.value === undefined ? "" : String(field.value)
									}
									mix={[
										raw({
											inlineSize: "100%",
											minInlineSize: "0",
											border: "0",
											padding: "0",
											font: "inherit",
											fontSize: "0.875rem",
											fontVariantNumeric: "tabular-nums",
											color: "var(--ui-neutral-fg-emphasis)",
											background: "none",
											outline: "none",
										}),
									]}
								/>
							</span>
						</label>
					))}
				</div>
				{buckets.length === 0 ? null : (
					<ul mix={[raw({ display: "grid", margin: "0", padding: "0", listStyle: "none" })]}>
						{buckets.map((bucket) => (
							<li>
								<a
									href={bucket.href}
									aria-current={bucket.selected ? "true" : undefined}
									data-slot="facet-filters-bucket"
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "0.75rem",
											minBlockSize: "2rem",
											fontSize: "0.875rem",
											color: "var(--ui-neutral-fg)",
											textDecoration: "none",
										}),
										when("&:hover", raw({ textDecoration: "underline" })),
										when(
											"&[aria-current='true']",
											raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" }),
										),
										when(
											"&:focus-visible",
											raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
										),
									]}
								>
									<span>{bucket.label}</span>
									<Count value={bucket.count} />
								</a>
							</li>
						))}
					</ul>
				)}
			</div>
		);
	};
};

/**
 * Renders the applied filters as a row of chips, each a link to the listing without that
 * filter, then a "Clear all" link. It renders nothing when no filter is applied.
 *
 * @example <FacetFilters.Applied label="Applied filters" chips={[{ label: "Blue", href: "/shop" }]} clear={{ label: "Clear all", href: "/shop" }} />
 */
FacetFilters.Applied = function FacetFiltersApplied(handle: Handle<FacetFilters.AppliedProps>) {
	return () => {
		let { chips, clear, label } = handle.props;
		if (chips.length === 0) return null;
		return (
			<ul
				aria-label={label}
				data-slot="facet-filters-applied"
				mix={[
					raw({
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: "0.5rem",
						margin: "0",
						padding: "0",
						listStyle: "none",
					}),
				]}
			>
				{chips.map((chip) => (
					<li>
						<a
							href={chip.href}
							data-slot="facet-filters-chip"
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.375rem",
									minBlockSize: "2rem",
									paddingInline: "0.75rem 0.5rem",
									borderRadius: "999px",
									fontSize: "0.8125rem",
									color: "var(--ui-neutral-fg-emphasis)",
									textDecoration: "none",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								}),
								when(
									"&:hover",
									raw({ boxShadow: "inset 0 0 0 1px var(--ui-neutral-border-strong)" }),
								),
								when(
									"&:focus-visible",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
							]}
						>
							{chip.label}
							<XIcon size={14} aria-hidden="true" />
						</a>
					</li>
				))}
				{clear === undefined ? null : (
					<li>
						<a
							href={clear.href}
							data-slot="facet-filters-clear"
							mix={[
								raw({
									fontSize: "0.8125rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
									textUnderlineOffset: "0.2em",
								}),
							]}
						>
							{clear.label}
						</a>
					</li>
				)}
			</ul>
		);
	};
};

/**
 * Submits a form on every `change` inside its host's form (or, outside one, inside its
 * parent), through `requestSubmit()` so validation and submit listeners still run, and hides
 * that form's no-script controls, such as an Apply button.
 *
 * @example <span hidden mix={[autoSubmit()]} />
 */
export const autoSubmit: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	handle.addEventListener("insert", (event) => {
		let marker = event.node;
		let scope: HTMLElement | null = marker.closest("form") ?? marker.parentElement;
		if (scope === null) return;
		for (let control of scope.querySelectorAll<HTMLElement>(`[${NO_SCRIPT_ATTRIBUTE}]`)) {
			control.hidden = true;
		}
		if (scope.hasAttribute(LIVE_ATTRIBUTE)) return;
		let live = scope;
		live.setAttribute(LIVE_ATTRIBUTE, "");
		handle.signal.addEventListener("abort", () => live.removeAttribute(LIVE_ATTRIBUTE));
		scope.addEventListener(
			"change",
			(change) => {
				let field = change.target;
				if (
					!(field instanceof HTMLInputElement) &&
					!(field instanceof HTMLSelectElement) &&
					!(field instanceof HTMLTextAreaElement)
				) {
					return;
				}
				field.form?.requestSubmit();
			},
			{ signal: handle.signal },
		);
		scope.addEventListener("formdata", (event) => dropBlankFields(event.formData), {
			signal: handle.signal,
		});
	});
});

/**
 * Leaves blank fields out of a submission, so an open-ended range writes `?price_max=25`
 * rather than `?price_min=&price_max=25`; a blank field reads as absent either way.
 */
function dropBlankFields(data: FormData) {
	let blank = new Set<string>();
	for (let [name, value] of data) if (value === "") blank.add(name);
	for (let name of blank) {
		if (data.getAll(name).every((entry) => entry === "")) data.delete(name);
	}
}

/**
 * Loads {@link autoSubmit} on a server-rendered page: rendered inside a form, or beside a
 * control that names its form, it submits that form on each change. It loads from
 * `@sdxc/ui/commerce/facet-filters`; {@link FacetFilters} and SortSelect render it.
 */
export const AutoSubmit: EntryComponent<FacetFilters.AutoSubmitProps> = clientEntry(
	"@sdxc/ui/commerce/facet-filters#AutoSubmit",
	function AutoSubmit() {
		return () => <span hidden data-slot="auto-submit" mix={[autoSubmit()]} />;
	},
);
