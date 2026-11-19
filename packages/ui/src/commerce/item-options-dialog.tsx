/**
 * The dialog an item opens before it goes in the cart: its picture, name and description,
 * its option groups, a quantity and an add button carrying the running price. It is a native
 * `<dialog>`, a sheet from the bottom on a phone and centred from a tablet up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { XIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { OptionsLive } from "./option-group.js";

/** From here the dialog is centred rather than a bottom sheet. */
const WIDE = "(min-width: 48rem)";

/** Prop types for {@link ItemOptionsDialog}. */
export namespace ItemOptionsDialog {
	/** Props accepted by {@link ItemOptionsDialog}. */
	export interface Props {
		/** The dialog's id, which the item's button names with `commandfor`. */
		id: string;
		/** Where the form posts. */
		action: string;
		title: string;
		description?: RemixNode;
		/** The item's price as the reader sees it, under the description. */
		price?: RemixNode;
		/** Tags beside the price, such as dietary badges. */
		badges?: RemixNode;
		/** A picture across the top, such as the dish. */
		media?: RemixNode;
		/** The colour behind the picture. */
		mediaBackground?: string;
		/** The item's base price in minor units, which the running total starts from. */
		base: number;
		/** The ISO 4217 code totals are written in. */
		currency: string;
		locale?: string;
		/** Hidden fields the post carries, such as the item id and the page to return to. */
		fields?: Record<string, string>;
		/** The {@link OptionGroup}s. */
		children?: RemixNode;
		/** A quantity field; omitted, the item is added one at a time. */
		quantity?: { label: string; name?: string; max?: number };
		/** A note above the add button, such as a warning that the cart will be replaced. */
		notice?: RemixNode;
		/**
		 * The add button's words before the price, such as "Add to cart". Put a
		 * `<span data-options-qty>1</span>` in it to show the quantity live.
		 */
		submitLabel: RemixNode;
		/** The total the button shows before any pick, already formatted. */
		total: string;
		/** Keeps the item from being added, such as while the shop is closed. */
		disabled?: boolean;
		/** The close button's name, such as "Close". */
		closeLabel: string;
	}
}

/**
 * Renders the dialog, its form and its {@link OptionsLive} island. Without script the form
 * still posts every pick; the button shows the base total until the server prices it.
 *
 * @example
 * <ItemOptionsDialog id="item-tacos" action="/cart/add" title="Al pastor trio" base={1150} currency="USD" total="$11.50" submitLabel="Add to cart" closeLabel="Close">
 * 	<OptionGroup name="tortilla" title="Tortilla" required choices={choices} />
 * </ItemOptionsDialog>
 */
export function ItemOptionsDialog(handle: Handle<ItemOptionsDialog.Props>) {
	return () => {
		let props = handle.props;
		let formId = `${props.id}-form`;
		return (
			<dialog
				id={props.id}
				closedby="any"
				aria-labelledby={`${props.id}-title`}
				data-slot="item-options-dialog"
				mix={[
					raw({
						inlineSize: "100%",
						maxInlineSize: "100%",
						maxBlockSize: "92dvh",
						margin: "auto auto 0",
						padding: "0",
						border: "0",
						borderRadius: "1.25rem 1.25rem 0 0",
						color: "var(--ui-neutral-fg)",
						backgroundColor: "var(--ui-bg-raised, var(--ui-bg))",
						boxShadow: "0 -12px 40px -12px rgb(0 0 0 / 0.35)",
						overflow: "hidden",
						"&::backdrop": { backgroundColor: "rgb(10 6 8 / 0.5)", backdropFilter: "blur(2px)" },
						"&[open]": { display: "flex", flexDirection: "column" },
						"@keyframes ui-item-options-in": {
							from: { translate: "0 2rem", opacity: "0" },
							to: { translate: "0 0", opacity: "1" },
						},
						"&[open]:modal": {
							animation: "ui-item-options-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
						},
						[`@media ${WIDE}`]: {
							inlineSize: "min(34rem, calc(100vw - 2rem))",
							maxBlockSize: "min(88dvh, 52rem)",
							margin: "auto",
							borderRadius: "1.25rem",
						},
					}),
					motionReduce(raw({ "&[open]:modal": { animation: "none" } })),
				]}
			>
				<form
					id={formId}
					method="post"
					action={props.action}
					data-base={String(props.base)}
					mix={[
						raw({ display: "flex", flexDirection: "column", flex: "1 1 auto", minBlockSize: "0" }),
					]}
				>
					{Object.entries(props.fields ?? {}).map(([name, value]) => (
						<input type="hidden" name={name} value={value} />
					))}
					<div mix={[raw({ flex: "1 1 auto", overflowY: "auto", overscrollBehavior: "contain" })]}>
						<div
							mix={[
								raw({
									position: "relative",
									display: "grid",
									placeItems: "center",
									minBlockSize: props.media === undefined ? "3.5rem" : "11rem",
									backgroundColor: props.mediaBackground ?? "var(--ui-neutral-bg-subtle)",
									"& > [data-slot=item-options-media]": { inlineSize: "9rem" },
								}),
							]}
						>
							{props.media === undefined ? null : (
								<span data-slot="item-options-media">{props.media}</span>
							)}
							<button
								type="button"
								commandfor={props.id}
								command="close"
								aria-label={props.closeLabel}
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "0.75rem",
										insetInlineEnd: "0.75rem",
										display: "grid",
										placeItems: "center",
										inlineSize: "2.5rem",
										blockSize: "2.5rem",
										padding: "0",
										border: "0",
										borderRadius: "999px",
										color: "oklch(0.25 0.02 40)",
										backgroundColor: "rgb(255 255 255 / 0.85)",
										cursor: "pointer",
									}),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
								]}
							>
								<XIcon aria-hidden="true" size={18} />
							</button>
						</div>
						<div mix={[raw({ display: "grid", gap: "1.5rem", padding: "1.25rem 1.25rem 1.5rem" })]}>
							<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
								<h2
									id={`${props.id}-title`}
									mix={[
										raw({
											margin: "0",
											fontSize: "1.375rem",
											fontWeight: "800",
											letterSpacing: "-0.02em",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									{props.title}
								</h2>
								{props.description === undefined ? null : (
									<p mix={[raw({ margin: "0", lineHeight: "1.5" })]}>{props.description}</p>
								)}
								{props.price === undefined && props.badges === undefined ? null : (
									<p
										mix={[
											raw({
												display: "flex",
												alignItems: "center",
												gap: "0.5rem",
												margin: "0",
												fontWeight: "650",
											}),
										]}
									>
										{props.price}
										{props.badges}
									</p>
								)}
							</div>
							{props.children}
							{props.quantity === undefined ? null : (
								<label
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "1rem",
										}),
									]}
								>
									<span mix={[raw({ fontWeight: "750", color: "var(--ui-neutral-fg-emphasis)" })]}>
										{props.quantity.label}
									</span>
									<input
										type="number"
										name={props.quantity.name ?? "qty"}
										value="1"
										min="1"
										max={String(props.quantity.max ?? 20)}
										inputmode="numeric"
										data-options-qty-field=""
										mix={[
											raw({
												inlineSize: "5rem",
												blockSize: "2.5rem",
												paddingInline: "0.75rem",
												boxSizing: "border-box",
												border: "1px solid var(--ui-neutral-border)",
												borderRadius: "0.75rem",
												font: "inherit",
												fontWeight: "700",
												textAlign: "center",
												color: "var(--ui-neutral-fg-emphasis)",
												backgroundColor: "var(--ui-bg)",
											}),
											when(
												"&:focus",
												raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "1px" }),
											),
										]}
									/>
								</label>
							)}
						</div>
					</div>
					<div
						mix={[
							raw({
								display: "grid",
								gap: "0.625rem",
								padding: "0.875rem 1.25rem calc(0.875rem + env(safe-area-inset-bottom, 0px))",
								borderBlockStart: "1px solid var(--ui-neutral-border)",
							}),
						]}
					>
						{props.notice === undefined ? null : (
							<div
								data-slot="item-options-notice"
								mix={[raw({ fontSize: "0.875rem", lineHeight: "1.4" })]}
							>
								{props.notice}
							</div>
						)}
						<button
							type="submit"
							disabled={props.disabled}
							data-slot="item-options-submit"
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "1rem",
									inlineSize: "100%",
									blockSize: "3.25rem",
									paddingInline: "1.25rem",
									border: "0",
									borderRadius: "999px",
									font: "inherit",
									fontSize: "1rem",
									fontWeight: "750",
									color: "var(--ui-brand-fg-on-solid, white)",
									backgroundColor: "var(--ui-brand-bg-solid)",
									cursor: "pointer",
								}),
								when(
									"&:hover",
									raw({
										backgroundColor: "var(--ui-brand-bg-solid-hover, var(--ui-brand-bg-solid))",
									}),
								),
								when(
									"&:focus-visible",
									raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
								),
								when("&:disabled", raw({ opacity: "0.5", cursor: "not-allowed" })),
							]}
						>
							<span>{props.submitLabel}</span>
							<span data-options-total="" mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
								{props.total}
							</span>
						</button>
					</div>
				</form>
				<OptionsLive form={formId} currency={props.currency} locale={props.locale} />
			</dialog>
		);
	};
}
