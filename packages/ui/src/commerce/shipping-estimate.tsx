/**
 * "What will shipping cost?" on a cart page: a GET form taking a postcode, then each way the
 * order could travel with its arrival date and price. The answer lives in the URL, so the
 * estimate survives a reload and a shared link without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

import { Button } from "../components/button.js";
import { Input } from "../components/input.js";

/** Prop types for {@link ShippingEstimate}. */
export namespace ShippingEstimate {
	/** One way the order could travel. */
	export interface Option {
		id: string;
		/** Such as "Standard" or "Express courier". */
		label: RemixNode;
		/** When it would arrive, such as "Arrives Tue 24 Nov". */
		arrives: RemixNode;
		/** What it costs, formatted, or "Free". */
		price: RemixNode;
	}

	/** The words the estimate carries. */
	export interface Labels {
		/** The field's label, such as "Postcode". */
		field: string;
		submit: string;
		/** The group's heading, such as "Estimate shipping". */
		heading: string;
	}

	/** Props accepted by {@link ShippingEstimate}; the host is a `<div role="group">`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The page the form reads back, usually the cart itself. */
		action: string;
		/** @default "postcode" */
		name?: string;
		/** The postcode the options answer. */
		value?: string;
		/** Why the postcode gave no options; the field is marked invalid and described by it. */
		error?: RemixNode;
		/** Hidden fields the query keeps, such as the country. */
		fields?: Record<string, string>;
		options?: Option[];
		labels: Labels;
	}
}

/**
 * Renders the heading, the one-field form and, once a postcode is answered, the options as a
 * list with the price end-aligned in tabular figures.
 *
 * @example
 * <ShippingEstimate action="/cart" value="SW1A 1AA" options={[{ id: "std", label: "Standard", arrives: "Arrives Tue 24 Nov", price: "£4.95" }]} labels={{ field: "Postcode", submit: "Estimate", heading: "Estimate shipping" }} />
 */
export function ShippingEstimate(handle: Handle<ShippingEstimate.Props>) {
	return () => {
		let {
			action,
			error,
			fields = {},
			id,
			labels,
			mix,
			name = "postcode",
			options = [],
			value,
			...rest
		} = handle.props;
		let base = id ?? handle.id;
		let headingId = `${base}-heading`;
		let inputId = `${base}-field`;
		let errorId = `${base}-error`;
		let hasError = error !== undefined && error !== null && error !== false;
		return (
			<div
				{...rest}
				id={id}
				role="group"
				aria-labelledby={headingId}
				data-slot="shipping-estimate"
				mix={mergeMix([raw({ display: "grid", gap: "0.75rem" })], mix)}
			>
				<p
					id={headingId}
					mix={[
						raw({
							margin: "0",
							fontSize: "0.875rem",
							fontWeight: "650",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{labels.heading}
				</p>
				<form method="get" action={action} mix={[raw({ display: "grid", gap: "0.375rem" })]}>
					{Object.entries(fields).map(([field, fieldValue]) => (
						<input type="hidden" name={field} value={fieldValue} />
					))}
					<label
						htmlFor={inputId}
						mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						{labels.field}
					</label>
					<div mix={[raw({ display: "flex", gap: "0.5rem" })]}>
						<Input
							id={inputId}
							name={name}
							value={value ?? ""}
							autocomplete="postal-code"
							aria-invalid={hasError ? "true" : undefined}
							aria-describedby={hasError ? errorId : undefined}
							mix={[raw({ flex: "1 1 auto", minInlineSize: "0" })]}
						/>
						<Button type="submit" variant="outline">
							{labels.submit}
						</Button>
					</div>
					{hasError ? (
						<p
							id={errorId}
							data-slot="shipping-estimate-error"
							mix={[raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-danger-fg)" })]}
						>
							{error}
						</p>
					) : null}
				</form>
				{options.length === 0 ? null : (
					<ul
						data-slot="shipping-estimate-options"
						mix={[raw({ margin: "0", padding: "0", listStyle: "none" })]}
					>
						{options.map((option) => (
							<li
								data-option={option.id}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "minmax(0, 1fr) auto",
										columnGap: "1rem",
										alignItems: "baseline",
										paddingBlock: "0.625rem",
										borderBlockEnd: "1px solid var(--ui-neutral-border)",
										"&:last-child": { borderBlockEnd: "0" },
									}),
								]}
							>
								<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
									<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
										{option.label}
									</span>
									<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
										{option.arrives}
									</span>
								</span>
								<span
									data-slot="shipping-estimate-price"
									mix={[raw({ fontWeight: "600", fontVariantNumeric: "tabular-nums" })]}
								>
									{option.price}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		);
	};
}
