/**
 * A − count + control for how many of something a cart holds, where each button is a form
 * post naming the new count, so it works without script and the server stays the source of
 * truth. At one, − becomes a bin that posts zero, which a cart reads as "remove".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { MinusIcon, PlusIcon, TrashIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/** Prop types for {@link QuantityStepper}. */
export namespace QuantityStepper {
	/** What each button says to assistive tech, such as "One fewer Al pastor trio". */
	export interface Labels {
		fewer: string;
		more: string;
		/** The − button's name at a count of one, when it posts zero. */
		remove: string;
		/** The count's name, such as "2 of Al pastor trio". */
		count: string;
	}

	/** Props accepted by {@link QuantityStepper}; the host is a `<form>`. */
	export interface Props extends Omit<TagProps<"form">, "children" | "method"> {
		/** Where the form posts. */
		action: string;
		/** The count now. */
		value: number;
		/** The field the new count posts as. @default "qty" */
		name?: string;
		/** The most the count may reach; + is disabled there. @default 99 */
		max?: number;
		/** Hidden fields the post carries, such as the line's index and the page to return to. */
		fields?: Record<string, string>;
		labels: Labels;
	}
}

/** A stepper's round button. */
function stepButton() {
	return [
		raw({
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "2rem",
			blockSize: "2rem",
			padding: "0",
			border: "0",
			borderRadius: "999px",
			color: "var(--ui-neutral-fg-emphasis)",
			backgroundColor: "var(--ui-neutral-bg-subtle)",
			cursor: "pointer",
			"& > svg": { inlineSize: "0.9375rem", blockSize: "0.9375rem" },
		}),
		when(
			"&:hover",
			raw({ backgroundColor: "var(--ui-neutral-bg-muted, var(--ui-neutral-bg-subtle))" }),
		),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
		),
		when("&:disabled", raw({ opacity: "0.4", cursor: "not-allowed" })),
	];
}

/**
 * Renders the stepper as a pill-shaped form of two submit buttons around the count.
 *
 * @example
 * <QuantityStepper action="/cart/line" value={2} fields={{ line: "0" }} labels={{ fewer: "One fewer taco", more: "One more taco", remove: "Remove taco", count: "2 tacos" }} />
 */
export function QuantityStepper(handle: Handle<QuantityStepper.Props>) {
	return () => {
		let { action, fields = {}, labels, max = 99, mix, name = "qty", value, ...rest } = handle.props;
		return (
			<form
				{...rest}
				method="post"
				action={action}
				data-slot="quantity-stepper"
				mix={mergeMix(
					[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.25rem",
							padding: "0.125rem",
							borderRadius: "999px",
							boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
						}),
					],
					mix,
				)}
			>
				{Object.entries(fields).map(([field, fieldValue]) => (
					<input type="hidden" name={field} value={fieldValue} />
				))}
				<button
					type="submit"
					name={name}
					value={String(value - 1)}
					aria-label={value <= 1 ? labels.remove : labels.fewer}
					data-slot="quantity-stepper-fewer"
					mix={stepButton()}
				>
					{value <= 1 ? <TrashIcon aria-hidden="true" /> : <MinusIcon aria-hidden="true" />}
				</button>
				<output
					aria-label={labels.count}
					mix={[
						raw({
							minInlineSize: "1.5rem",
							textAlign: "center",
							fontWeight: "700",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					{value}
				</output>
				<button
					type="submit"
					name={name}
					value={String(value + 1)}
					aria-label={labels.more}
					disabled={value >= max}
					data-slot="quantity-stepper-more"
					mix={stepButton()}
				>
					<PlusIcon aria-hidden="true" />
				</button>
			</form>
		);
	};
}
