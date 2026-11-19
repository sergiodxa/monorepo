/**
 * The options a product comes in, such as colour, size and format, where every option is a
 * link to the product page with that option chosen. The server stays the source of the
 * selection, the page works without script, and a frame target swaps it in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/** Prop types for {@link VariantPicker} and its compound parts. */
export namespace VariantPicker {
	/** Props accepted by {@link VariantPicker}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		children: RemixNode;
		/** A frame's name every option link loads into, so choosing swaps that frame in place. */
		target?: string;
	}

	/** What the picker shares with its options. */
	export interface Context {
		target?: string;
	}

	/** Props accepted by {@link VariantPicker.Axis}. */
	export interface AxisProps {
		/** The axis's name, such as "Colour". */
		label: RemixNode;
		/** The current choice's name, shown after the label. */
		value?: RemixNode;
		/** Content at the row's end, such as a "Size guide" link. */
		aside?: RemixNode;
		children: RemixNode;
	}

	/** Props accepted by {@link VariantPicker.Swatch}. */
	export interface SwatchProps {
		href: string;
		/** The colour's name; it is the link's accessible name and tooltip. */
		name: string;
		/** Any CSS colour or gradient. */
		color: string;
		selected?: boolean;
		/** Strikes the swatch through; it still links, so its page can offer a notice. */
		unavailable?: boolean;
		/** Added to the accessible name when unavailable, such as "sold out". */
		unavailableLabel?: string;
	}

	/** Props accepted by {@link VariantPicker.Choice}. */
	export interface ChoiceProps {
		href: string;
		label: RemixNode;
		/** A second line in a card, such as its price or "Instant download". */
		detail?: RemixNode;
		/** A small line under a card's detail, such as "Only 2 left". */
		note?: RemixNode;
		selected?: boolean;
		/** Strikes the choice through; it still links, so its page can offer a notice. */
		unavailable?: boolean;
		/** Read after the label when unavailable, such as "sold out". */
		unavailableLabel?: string;
		/** A compact pill for sizes, or a card for formats with a detail line. @default "pill" */
		variant?: "pill" | "card";
	}
}

/**
 * Reads the target the nearest picker set; an option outside a picker loads normally.
 *
 * @param handle Runtime handle of the option performing the lookup.
 */
function readTarget(handle: Handle<unknown, any>): string | undefined {
	let context = handle.context.get(VariantPicker) as VariantPicker.Context | undefined;
	return context?.target;
}

/**
 * Renders the picker, a column of axes. Its `target` reaches every option link as
 * `data-rmx-target`, so a choice reloads that frame in place: the page keeps its scroll and
 * the address changes to the variant without a new history entry per pick.
 *
 * @example
 * <VariantPicker target="product"><VariantPicker.Axis label="Size" value="50×70"><VariantPicker.Choice href="?size=50x70" label="50×70" selected /></VariantPicker.Axis></VariantPicker>
 */
export function VariantPicker(handle: Handle<VariantPicker.Props, VariantPicker.Context>) {
	return () => {
		let { children, mix, target, ...rest } = handle.props;
		handle.context.set({ target });
		return (
			<div
				{...rest}
				data-slot="variant-picker"
				mix={mergeMix([raw({ display: "grid", gap: "1.25rem" })], mix)}
			>
				{children}
			</div>
		);
	};
}

/**
 * Renders one axis: a row with its label, the current choice and an aside, over the options
 * in a group named by that row.
 *
 * @example <VariantPicker.Axis label="Frame" value="Oak" aside={<a href="/frames">About frames</a>}>…</VariantPicker.Axis>
 */
VariantPicker.Axis = function VariantPickerAxis(handle: Handle<VariantPicker.AxisProps>) {
	return () => {
		let { aside, children, label, value } = handle.props;
		let labelId = `${handle.id}-label`;
		return (
			<div data-slot="variant-picker-axis" mix={[raw({ display: "grid", gap: "0.625rem" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "0.75rem",
							fontSize: "0.875rem",
						}),
					]}
				>
					<span id={labelId}>
						<span mix={[raw({ fontWeight: "650", color: "var(--ui-neutral-fg-emphasis)" })]}>
							{label}
						</span>
						{value === undefined ? null : (
							<span
								data-slot="variant-picker-value"
								mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}
							>
								{": "}
								{value}
							</span>
						)}
					</span>
					{aside === undefined ? null : <span>{aside}</span>}
				</div>
				<div
					role="group"
					aria-labelledby={labelId}
					mix={[raw({ display: "flex", flexWrap: "wrap", gap: "0.5rem" })]}
				>
					{children}
				</div>
			</div>
		);
	};
};

/**
 * Renders a round colour swatch as a link, ringed when selected and struck diagonally when
 * unavailable. The name is its accessible name and its tooltip.
 *
 * @example <VariantPicker.Swatch href="?frame=oak" name="Oak" color="#b58a5a" selected />
 */
VariantPicker.Swatch = function VariantPickerSwatch(handle: Handle<VariantPicker.SwatchProps>) {
	return () => {
		let {
			color,
			href,
			name,
			selected = false,
			unavailable = false,
			unavailableLabel,
		} = handle.props;
		let target = readTarget(handle);
		let accessibleName =
			unavailable && unavailableLabel !== undefined ? `${name}, ${unavailableLabel}` : name;
		return (
			<a
				href={href}
				title={name}
				aria-label={accessibleName}
				aria-current={selected ? "true" : undefined}
				data-rmx-target={target}
				data-rmx-reset-scroll={target === undefined ? undefined : "false"}
				data-rmx-history={target === undefined ? undefined : "replace"}
				data-unavailable={unavailable ? "" : undefined}
				data-slot="variant-picker-swatch"
				mix={[
					raw({
						position: "relative",
						display: "inline-block",
						inlineSize: "2.25rem",
						blockSize: "2.25rem",
						borderRadius: "999px",
						boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.14)",
						cursor: "pointer",
					}),
					when(
						"&[aria-current='true']",
						raw({
							outline: "2px solid var(--ui-neutral-fg-emphasis)",
							outlineOffset: "2px",
						}),
					),
					when(
						"&:hover:not([aria-current='true'])",
						raw({ outline: "1px solid var(--ui-neutral-border-strong)", outlineOffset: "2px" }),
					),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "3px" }),
					),
					when(
						"&[data-unavailable]::after",
						raw({
							content: '""',
							position: "absolute",
							inset: "0",
							borderRadius: "inherit",
							background:
								"linear-gradient(to top right, transparent calc(50% - 1px), var(--ui-bg, white) calc(50% - 1px), var(--ui-bg, white) calc(50% + 1px), transparent calc(50% + 1px))",
							opacity: "0.9",
						}),
					),
				]}
				style={{ background: color }}
			/>
		);
	};
};

/**
 * Renders a choice as a link: a pill for a size, or a card with a detail and note for a
 * format. A card stands at least 44px tall, so it is an easy target on a phone.
 *
 * @example <VariantPicker.Choice href="?size=a2" label="A2" />
 * @example <VariantPicker.Choice variant="card" href="?format=digital" label="Digital" detail="Instant download" />
 */
VariantPicker.Choice = function VariantPickerChoice(handle: Handle<VariantPicker.ChoiceProps>) {
	return () => {
		let {
			detail,
			href,
			label,
			note,
			selected = false,
			unavailable = false,
			unavailableLabel,
			variant = "pill",
		} = handle.props;
		let target = readTarget(handle);
		let card = variant === "card";
		return (
			<a
				href={href}
				aria-current={selected ? "true" : undefined}
				data-rmx-target={target}
				data-rmx-reset-scroll={target === undefined ? undefined : "false"}
				data-rmx-history={target === undefined ? undefined : "replace"}
				data-unavailable={unavailable ? "" : undefined}
				data-variant={variant}
				data-slot="variant-picker-choice"
				mix={[
					raw({
						display: card ? "grid" : "inline-flex",
						alignItems: "center",
						alignContent: "center",
						justifyContent: card ? "start" : "center",
						gap: "0.125rem",
						boxSizing: "border-box",
						minInlineSize: card ? "9rem" : "3rem",
						minBlockSize: card ? "2.75rem" : "2.5rem",
						flex: card ? "1 1 9rem" : "0 0 auto",
						paddingInline: card ? "0.875rem" : "1rem",
						paddingBlock: card ? "0.625rem" : "0",
						borderRadius: card ? "var(--ui-radius-md, 0.5rem)" : "999px",
						fontSize: "0.875rem",
						color: "var(--ui-neutral-fg-emphasis)",
						textDecoration: "none",
						boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
						"&:hover": { boxShadow: "inset 0 0 0 1px var(--ui-neutral-border-strong)" },
						"&[data-unavailable]": { color: "var(--ui-neutral-fg-muted)" },
						"&[aria-current='true']": {
							boxShadow: "inset 0 0 0 2px var(--ui-neutral-fg-emphasis)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
						},
					}),
					when(
						"&:focus-visible",
						raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
					),
					when(
						"&[data-unavailable] [data-slot='variant-picker-choice-label']",
						raw({ textDecoration: "line-through" }),
					),
				]}
			>
				<span
					data-slot="variant-picker-choice-label"
					mix={[raw({ fontWeight: card ? "650" : "500" })]}
				>
					{label}
				</span>
				{unavailable && unavailableLabel !== undefined ? (
					<span mix={[visuallyHidden()]}>{`, ${unavailableLabel}`}</span>
				) : null}
				{card && detail !== undefined ? (
					<span
						data-slot="variant-picker-choice-detail"
						mix={[
							raw({
								fontSize: "0.8125rem",
								fontVariantNumeric: "tabular-nums",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{detail}
					</span>
				) : null}
				{card && note !== undefined ? (
					<span
						data-slot="variant-picker-choice-note"
						mix={[raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						{note}
					</span>
				) : null}
			</a>
		);
	};
};
