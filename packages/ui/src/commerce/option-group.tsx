/**
 * Priced choices for something being ordered: a group is a fieldset of radios when one pick
 * is required, or of checkboxes up to a limit when the picks are extras, each with what it
 * adds to the price. Its island reprices the form live and holds each group to its limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { clientEntry } from "remix/component";

/** Prop types for {@link OptionGroup} and {@link OptionsLive}. */
export namespace OptionGroup {
	/** One pick. */
	export interface Choice {
		/** The value the form posts. */
		value: string;
		label: string;
		/** What it adds, in the currency's minor units; `0` for a pick included in the price. */
		price: number;
		/** The price as the reader sees it, such as "+$0.50"; nothing is drawn when unset. */
		priceLabel?: string;
	}

	/** Props accepted by {@link OptionGroup}; the host is a `<fieldset>`. */
	export interface Props extends Omit<TagProps<"fieldset">, "children" | "name"> {
		/** The field every pick posts as. */
		name: string;
		title: string;
		/** A line under the title, such as "Pick one" or "Optional, up to 3". */
		hint?: string;
		/** Takes exactly one pick, drawn as radios; otherwise checkboxes. */
		required?: boolean;
		/** How many checkboxes may be ticked; ignored when `required`. @default 1 */
		max?: number;
		choices: Choice[];
		/** The values ticked at first. */
		defaultValue?: string[];
		/** The badge a required group carries, such as "Required". */
		requiredLabel?: string;
	}

	/** Props {@link OptionsLive} serializes for hydration. */
	export type LiveProps = {
		/** The id of the form whose total follows its picks. */
		form: string;
		/** The ISO 4217 code totals are written in, such as "USD". */
		currency: string;
		/** The locale totals are written in; the reader's own when unset. */
		locale?: string;
	};
}

/**
 * Renders a group: its title, hint and Required badge in the legend, then one row per pick
 * with its price at the end. Every input carries `data-price`, which {@link OptionsLive} sums.
 *
 * @example
 * <OptionGroup name="tortilla" title="Tortilla" hint="Pick one" required requiredLabel="Required" choices={[{ value: "corn", label: "Blue corn", price: 0 }, { value: "flour", label: "Flour", price: 50, priceLabel: "+$0.50" }]} />
 */
export function OptionGroup(handle: Handle<OptionGroup.Props>) {
	return () => {
		let {
			choices,
			defaultValue = [],
			hint,
			max = 1,
			mix,
			name,
			required = false,
			requiredLabel,
			title,
			...rest
		} = handle.props;
		return (
			<fieldset
				{...rest}
				data-slot="option-group"
				data-max={required ? undefined : String(max)}
				mix={mergeMix(
					[raw({ display: "grid", gap: "0.25rem", margin: "0", padding: "0", border: "0" })],
					mix,
				)}
			>
				<legend
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "0.75rem",
							inlineSize: "100%",
							padding: "0",
							marginBlockEnd: "0.375rem",
						}),
					]}
				>
					<span mix={[raw({ display: "grid", gap: "0.0625rem" })]}>
						<span
							mix={[
								raw({
									fontSize: "1rem",
									fontWeight: "750",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{title}
						</span>
						{hint === undefined ? null : (
							<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
								{hint}
							</span>
						)}
					</span>
					{required && requiredLabel !== undefined ? (
						<span
							data-slot="option-group-required"
							mix={[
								raw({
									flexShrink: "0",
									paddingInline: "0.5rem",
									paddingBlock: "0.125rem",
									borderRadius: "999px",
									fontSize: "0.75rem",
									fontWeight: "700",
									color: "var(--ui-neutral-fg-on-solid)",
									backgroundColor: "var(--ui-neutral-bg-solid)",
								}),
							]}
						>
							{requiredLabel}
						</span>
					) : null}
				</legend>
				{choices.map((choice, index) => (
					<label
						data-slot="option-group-choice"
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "1.25rem minmax(0, 1fr) auto",
								alignItems: "center",
								gap: "0.75rem",
								minBlockSize: "2.75rem",
								paddingInline: "0.25rem",
								borderBlockEnd:
									"1px solid var(--ui-neutral-border-subtle, var(--ui-neutral-border))",
								cursor: "pointer",
								"&:has(input:disabled)": { opacity: "0.5", cursor: "not-allowed" },
								"& input": {
									inlineSize: "1.125rem",
									blockSize: "1.125rem",
									margin: "0",
									accentColor: "var(--ui-color-brand-600)",
								},
							}),
						]}
					>
						<input
							type={required ? "radio" : "checkbox"}
							name={name}
							value={choice.value}
							data-price={String(choice.price)}
							checked={defaultValue.includes(choice.value) ? true : undefined}
							required={required && index === 0 ? true : undefined}
						/>
						<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>{choice.label}</span>
						<span
							mix={[
								raw({
									fontSize: "0.875rem",
									fontVariantNumeric: "tabular-nums",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{choice.priceLabel ?? ""}
						</span>
					</label>
				))}
			</fieldset>
		);
	};
}

/**
 * Writes an amount in minor units in a currency, with the currency's own number of decimals.
 *
 * @example formatMinor(1150, "USD", "en-US") // "$11.50"
 */
function formatMinor(minor: number, currency: string, locale: string | undefined): string {
	let format = new Intl.NumberFormat(locale, { style: "currency", currency });
	let digits = format.resolvedOptions().maximumFractionDigits ?? 2;
	return format.format(minor / 10 ** digits);
}

/** Prices one form as it stands and holds each optional group to its limit. */
function reprice(form: HTMLFormElement, props: OptionGroup.LiveProps) {
	let base = Number(form.dataset.base ?? "0");
	let picks = [...form.querySelectorAll<HTMLInputElement>("input[data-price]:checked")].reduce(
		(sum, input) => sum + Number(input.dataset.price ?? "0"),
		0,
	);
	let field = form.querySelector<HTMLInputElement>("input[data-options-qty-field]");
	let max = Number(field?.max || "99");
	let qty = field === null ? 1 : Math.min(Math.max(Number(field.value) || 1, 1), max);
	for (let total of form.querySelectorAll<HTMLElement>("[data-options-total]")) {
		total.textContent = formatMinor((base + picks) * qty, props.currency, props.locale);
	}
	for (let count of form.querySelectorAll<HTMLElement>("[data-options-qty]")) {
		count.textContent = String(qty);
	}
	for (let group of form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-max]")) {
		let limit = Number(group.dataset.max ?? "0");
		let boxes = [...group.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
		let full = boxes.filter((box) => box.checked).length >= limit;
		for (let box of boxes) box.disabled = full && !box.checked;
	}
}

/**
 * The island behind an options form. Each change reprices `[data-options-total]`: the
 * form's `data-base` plus every ticked `data-price`, times its `data-options-qty-field`. It
 * also stops an optional group at its limit and closes an enclosing dialog as the form posts.
 */
export const OptionsLive: EntryComponent<OptionGroup.LiveProps> = clientEntry(
	"@sdxc/ui/commerce/option-group#OptionsLive",
	function OptionsLive(handle: Handle<OptionGroup.LiveProps>) {
		handle.queueTask(() => {
			let form = document.getElementById(handle.props.form);
			if (!(form instanceof HTMLFormElement) || handle.signal.aborted) return;
			let target = form;
			let update = () => reprice(target, handle.props);
			target.addEventListener("input", update, { signal: handle.signal });
			target.addEventListener("change", update, { signal: handle.signal });
			target.addEventListener(
				"submit",
				() => {
					let dialog = target.closest("dialog");
					if (dialog !== null) queueMicrotask(() => dialog.close());
				},
				{ signal: handle.signal },
			);
			update();
		});
		return () => <span hidden data-slot="options-live" />;
	},
);
