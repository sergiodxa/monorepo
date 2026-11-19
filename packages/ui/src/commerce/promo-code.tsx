/**
 * The promo code box of a cart or checkout: a "Have a promo code?" disclosure holding a POST
 * form with one field, the server's error under it, and every code already applied as a chip
 * with its own remove button. It needs no script; the server answers each post.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon, TagIcon, XIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";

import { Button } from "../components/button.js";
import { Input } from "../components/input.js";

/** Prop types for {@link PromoCode}. */
export namespace PromoCode {
	/** The words the box carries. */
	export interface Labels {
		/** The disclosure's summary, such as "Have a promo code?". */
		toggle: string;
		/** The field's label, such as "Promo code". */
		field: string;
		apply: string;
		/** The remove button's name, followed by the code, such as "Remove". */
		remove: string;
	}

	/** A code the cart already carries. */
	export interface Applied {
		code: string;
		/** What it does, such as "10% off prints". */
		label: RemixNode;
		/** The POST form that takes it off. */
		remove: { action: string; fields?: Record<string, string> };
	}

	/** Props accepted by {@link PromoCode}; the host is a `<div>`. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Where the code posts. */
		action: string;
		/** @default "code" */
		name?: string;
		/** The code the reader last sent, kept in the field after an error. */
		value?: string;
		/** Why the server refused the code; the field is marked invalid and described by it. */
		error?: RemixNode;
		/** Hidden fields the post carries, such as the page to return to. */
		fields?: Record<string, string>;
		applied?: Applied[];
		labels: Labels;
	}
}

/** Writes each entry of `fields` as a hidden input. */
function HiddenFields(handle: Handle<{ fields?: Record<string, string> }>) {
	return () => (
		<>
			{Object.entries(handle.props.fields ?? {}).map(([name, value]) => (
				<input type="hidden" name={name} value={value} />
			))}
		</>
	);
}

/**
 * Renders the applied codes first, then the disclosure, open whenever the reader has typed a
 * code or the server refused one, so a failed post lands on the field with its error showing.
 *
 * @example
 * <PromoCode action="/cart/promo" error={state.error} value={state.code} applied={[{ code: "WALLS10", label: "10% off", remove: { action: "/cart/promo/remove", fields: { code: "WALLS10" } } }]} labels={{ toggle: "Have a promo code?", field: "Promo code", apply: "Apply", remove: "Remove" }} />
 */
export function PromoCode(handle: Handle<PromoCode.Props>) {
	return () => {
		let {
			action,
			applied = [],
			error,
			fields,
			id,
			labels,
			mix,
			name = "code",
			value,
			...rest
		} = handle.props;
		let base = id ?? handle.id;
		let inputId = `${base}-field`;
		let errorId = `${base}-error`;
		let hasError = error !== undefined && error !== null && error !== false;
		return (
			<div
				{...rest}
				id={id}
				data-slot="promo-code"
				mix={mergeMix([raw({ display: "grid", gap: "0.75rem" })], mix)}
			>
				{applied.length === 0 ? null : (
					<ul
						data-slot="promo-code-applied"
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								gap: "0.5rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
						]}
					>
						{applied.map((entry) => (
							<li
								data-code={entry.code}
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.375rem",
										paddingInlineStart: "0.625rem",
										borderRadius: "999px",
										fontSize: "0.8125rem",
										color: "var(--ui-success-fg-emphasis, var(--ui-success-fg))",
										backgroundColor: "var(--ui-success-bg-tint)",
										"& > svg": { flex: "none", inlineSize: "0.875rem", blockSize: "0.875rem" },
									}),
								]}
							>
								<TagIcon aria-hidden="true" />
								<span>
									<strong mix={[raw({ fontWeight: "700", letterSpacing: "0.02em" })]}>
										{entry.code}
									</strong>{" "}
									<span>{entry.label}</span>
								</span>
								<form
									method="post"
									action={entry.remove.action}
									mix={[raw({ display: "contents" })]}
								>
									<HiddenFields fields={entry.remove.fields} />
									<button
										type="submit"
										aria-label={`${labels.remove} ${entry.code}`}
										mix={[
											raw({
												display: "inline-grid",
												placeItems: "center",
												inlineSize: "1.75rem",
												blockSize: "1.75rem",
												padding: "0",
												border: "0",
												borderRadius: "999px",
												color: "inherit",
												backgroundColor: "transparent",
												cursor: "pointer",
												"& > svg": { inlineSize: "0.875rem", blockSize: "0.875rem" },
												"&:hover": { backgroundColor: "var(--ui-success-bg-tint-hover)" },
												"&:focus-visible": {
													outline: "2px solid var(--ui-brand-ring)",
													outlineOffset: "-2px",
												},
											}),
										]}
									>
										<XIcon aria-hidden="true" />
									</button>
								</form>
							</li>
						))}
					</ul>
				)}
				<details
					open={hasError || (value !== undefined && value !== "")}
					data-slot="promo-code-details"
					mix={[
						raw({
							"&[open] > summary svg": { rotate: "180deg" },
						}),
					]}
				>
					<summary
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								gap: "0.375rem",
								minBlockSize: "2.75rem",
								fontSize: "0.875rem",
								fontWeight: "600",
								color: "var(--ui-neutral-fg-emphasis)",
								cursor: "pointer",
								listStyle: "none",
								"&::-webkit-details-marker": { display: "none" },
								"& > svg": {
									inlineSize: "1rem",
									blockSize: "1rem",
									transition: "rotate 160ms ease",
								},
								"&:focus-visible": {
									outline: "2px solid var(--ui-brand-ring)",
									outlineOffset: "2px",
									borderRadius: "0.25rem",
								},
							}),
							motionReduce(raw({ "& > svg": { transition: "none" } })),
						]}
					>
						{labels.toggle}
						<ChevronDownIcon aria-hidden="true" />
					</summary>
					<form
						method="post"
						action={action}
						data-slot="promo-code-form"
						mix={[raw({ display: "grid", gap: "0.375rem", paddingBlockStart: "0.25rem" })]}
					>
						<HiddenFields fields={fields} />
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
								autocomplete="off"
								autocapitalize="characters"
								spellcheck={false}
								aria-invalid={hasError ? "true" : undefined}
								aria-describedby={hasError ? errorId : undefined}
								mix={[raw({ flex: "1 1 auto", minInlineSize: "0" })]}
							/>
							<Button type="submit" variant="outline">
								{labels.apply}
							</Button>
						</div>
						{hasError ? (
							<p
								id={errorId}
								data-slot="promo-code-error"
								mix={[
									raw({
										margin: "0",
										fontSize: "0.8125rem",
										color: "var(--ui-danger-fg)",
									}),
								]}
							>
								{error}
							</p>
						) : null}
					</form>
				</details>
			</div>
		);
	};
}
