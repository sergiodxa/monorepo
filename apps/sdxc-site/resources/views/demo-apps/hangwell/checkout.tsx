/**
 * The bag page and the checkout: lines with steppers and "save for later", a promo code, a
 * shipping estimate by postcode and the totals; then checkout in steps that follow the bag
 * (a bag of print files skips the address and shipping), with demo payment methods only and
 * no card fields anywhere. Every step is a form post that keeps what was typed on an error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode, Props as TagProps } from "remix/component";

import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Amount } from "@sdxc/ui";
import { Autocomplete } from "@sdxc/ui/autocomplete";
import { CartLine } from "@sdxc/ui/commerce/cart-line";
import { CheckoutLayout } from "@sdxc/ui/commerce/checkout-layout";
import { FulfilmentNote } from "@sdxc/ui/commerce/fulfilment-note";
import { OrderSummary } from "@sdxc/ui/commerce/order-summary";
import { PromoCode } from "@sdxc/ui/commerce/promo-code";
import { QuantityStepper } from "@sdxc/ui/commerce/quantity-stepper";
import { ShippingEstimate } from "@sdxc/ui/commerce/shipping-estimate";
import { LinkButton } from "@sdxc/ui/link-button";
import { StepIndicator } from "@sdxc/ui/step-indicator";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";

import type { CheckoutDraft, Line, Totals, Visitor } from "./state";

import { FramedArt, PosterArt } from "./art";
import {
	CITIES,
	COUNTRIES,
	CURRENCY,
	FREE_SHIPPING_FROM,
	LOCALE,
	PAYMENTS,
	POSTERS,
	SHIPPING,
	actionHref,
	addressLine,
	countryName,
	findPayment,
	findShipping,
	href,
	money,
	variantName,
} from "./data";
import { DemoNote, Gutter, PageTitle, Shelf, WALL } from "./parts";
import { addWorkingDays, shortDay } from "./product";
import { FreeShippingNote } from "./shell";
import { isPhysical, lineCount, linePoster, lineTotal, priceCart } from "./state";

/** A checkout step's id, which is also its path under `checkout/`. */
export type Step = "information" | "shipping" | "payment" | "review";

/** The steps a bag goes through: a bag of print files skips shipping. */
export function stepsFor(lines: Line[]): Step[] {
	return lines.some(isPhysical)
		? ["information", "shipping", "payment", "review"]
		: ["information", "payment", "review"];
}

/** The page path of a step. */
export function stepPage(step: Step): string {
	return step === "information" ? "checkout" : `checkout/${step}`;
}

/** Where a step stands against the open one. */
function stepState(at: number, open: number): StepIndicator.State {
	if (at < open) return "complete";
	return at === open ? "current" : "upcoming";
}

/** Each step's name in the step indicator. */
const STEP_NAMES: Record<Step, string> = {
	information: "Details",
	shipping: "Shipping",
	payment: "Payment",
	review: "Review",
};

/** A line's small picture: the framed print for a framed line, the print otherwise. */
function LineArt(handle: Handle<{ line: Line }>) {
	return () => {
		let { line } = handle.props;
		let poster = linePoster(line);
		return line.variant.format === "framed" ? (
			<FramedArt poster={poster} frame={line.variant.frame} mount={line.variant.mount} />
		) : (
			<PosterArt poster={poster} />
		);
	};
}

/** How a line arrives, in a few words. */
function arrivalNote(line: Line): string {
	if (!isPhysical(line)) return "Instant download";
	return line.variant.format === "framed"
		? "Ships flat in 5–8 days"
		: "Ships in a tube in 3–5 days";
}

/** What a line says under its name: the variant and how it arrives. */
function LineDetails(handle: Handle<{ line: Line }>) {
	return () => {
		let { line } = handle.props;
		let physical = isPhysical(line);
		return (
			<span mix={[raw({ display: "grid", gap: "0.25rem" })]}>
				<span>{variantName(linePoster(line), line.variant)}</span>
				<FulfilmentNote kind={physical ? "ships" : "download"}>{arrivalNote(line)}</FulfilmentNote>
			</span>
		);
	};
}

namespace TotalsBreakdown {
	export interface Props {
		totals: Totals;
		/** Whether shipping is chosen yet; before then it reads as "Calculated at checkout". */
		shippingChosen: boolean;
		method: string;
	}
}

/** The totals as a price breakdown: subtotal, discount, shipping, total and the VAT inside it. */
function TotalsBreakdown(handle: Handle<TotalsBreakdown.Props>) {
	return () => {
		let { method, shippingChosen, totals } = handle.props;
		let shipping = findShipping(method);
		return (
			<PriceBreakdown note={`Includes ${money(totals.vat)} VAT.`}>
				<PriceBreakdown.Line label="Subtotal" amount={money(totals.subtotal)} name="subtotal" />
				{totals.discount === 0 ? null : (
					<PriceBreakdown.Line
						label={totals.promo?.label ?? "Discount"}
						amount={money(totals.discount)}
						tone="discount"
						name="discount"
					/>
				)}
				{totals.shipping === null ? (
					<PriceBreakdown.Line label="Shipping" amount="None, it downloads" name="shipping" />
				) : null}
				{totals.shipping !== null && shippingChosen ? (
					<PriceBreakdown.Line
						label={`Shipping · ${shipping?.name ?? "Standard"}`}
						amount={totals.shipping === 0 ? "Free" : money(totals.shipping)}
						name="shipping"
					/>
				) : null}
				{totals.shipping === null || shippingChosen ? null : (
					<PriceBreakdown.Line
						label="Shipping"
						detail={
							totals.toFreeShipping === 0
								? "Standard is free"
								: `Free over ${money(FREE_SHIPPING_FROM)}`
						}
						amount={totals.shipping === 0 ? "Free" : `From ${money(totals.shipping)}`}
						name="shipping"
					/>
				)}
				{totals.oversize === 0 ? null : (
					<PriceBreakdown.Line
						label="Oversize parcel"
						detail="70 × 100 frames"
						amount={money(totals.oversize)}
						name="oversize"
					/>
				)}
				<PriceBreakdown.Total label="Total" amount={money(totals.total)} name="total" />
			</PriceBreakdown>
		);
	};
}

namespace CartPage {
	export interface Props {
		visitor: Visitor;
		url: URL;
		promoError?: { code: string; message: string };
	}
}

/** The bag page. */
export function CartPage(handle: Handle<CartPage.Props>) {
	return () => {
		let { promoError, url, visitor } = handle.props;
		let lines = visitor.lines;
		let picks = POSTERS.filter((poster) => !lines.some((line) => line.poster === poster.id)).slice(
			0,
			8,
		);
		if (lines.length === 0) {
			return (
				<Gutter>
					<PageTitle lead="Posters you add will wait here for a week.">Your bag is empty</PageTitle>
					<LinkButton href={href("shop")} color="brand">
						Browse posters
					</LinkButton>
					<Shelf
						id="hw-cart-picks"
						title="Start with a best seller"
						posters={picks}
						wish={visitor.wish}
						back="cart"
					/>
				</Gutter>
			);
		}
		let totals = priceCart(lines, visitor.promo, "standard");
		let postcode = url.searchParams.get("postcode") ?? "";
		let postcodeValid = /^[A-Za-z0-9 -]{3,10}$/.test(postcode.trim());
		let now = Date.now();
		return (
			<Gutter>
				<PageTitle>Your bag ({lineCount(lines)})</PageTitle>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "2rem",
							"@media (min-width: 56rem)": {
								gridTemplateColumns: "minmax(0, 1fr) 24rem",
								alignItems: "start",
							},
						}),
					]}
				>
					<div mix={[raw({ display: "grid", gap: "1rem", minInlineSize: "0" })]}>
						<FreeShippingNote visitor={visitor} />
						<ul
							mix={[
								raw({
									listStyle: "none",
									margin: "0",
									padding: "0",
									borderBlockStart: "1px solid var(--ui-neutral-border)",
								}),
							]}
						>
							{lines.map((line, index) => {
								let poster = linePoster(line);
								return (
									<CartLine
										id={`line-${index}`}
										name={
											<a
												href={href(`p/${poster.id}`)}
												mix={[
													raw({ color: "inherit", textDecoration: "none" }),
													when("&:hover", raw({ textDecoration: "underline" })),
												]}
											>
												{poster.title}
											</a>
										}
										details={
											<span mix={[raw({ display: "grid", gap: "0.375rem" })]}>
												<LineDetails line={line} />
												<form
													method="post"
													action={actionHref("cart/save")}
													mix={[raw({ margin: "0" })]}
												>
													<input type="hidden" name="line" value={String(index)} />
													<button
														type="submit"
														mix={[
															raw({
																padding: "0",
																border: "0",
																background: "none",
																font: "inherit",
																fontSize: "0.8125rem",
																color: "var(--ui-neutral-fg-muted)",
																textDecoration: "underline",
																cursor: "pointer",
															}),
														]}
													>
														Save for later
													</button>
												</form>
											</span>
										}
										price={
											<span mix={[raw({ display: "grid", justifyItems: "end", gap: "0.125rem" })]}>
												<Amount value={lineTotal(line)} currency={CURRENCY} locale={LOCALE} />
												{line.qty > 1 ? (
													<span
														mix={[
															raw({ fontSize: "0.75rem", color: "var(--ui-neutral-fg-muted)" }),
														]}
													>
														{money(lineTotal(line) / line.qty)} each
													</span>
												) : null}
											</span>
										}
										media={<LineArt line={line} />}
										mediaBackground={WALL}
										action={
											<QuantityStepper
												action={actionHref("cart/line")}
												value={line.qty}
												max={10}
												fields={{ line: String(index), back: "cart" }}
												labels={{
													fewer: `One fewer ${poster.title}`,
													more: `One more ${poster.title}`,
													remove: `Remove ${poster.title}`,
													count: `${line.qty} of ${poster.title}`,
												}}
											/>
										}
									/>
								);
							})}
						</ul>
					</div>
					<aside
						aria-label="Order summary"
						mix={[
							raw({
								display: "grid",
								gap: "1.25rem",
								padding: "1.5rem",
								borderRadius: "var(--ui-radius-lg)",
								backgroundColor: "var(--ui-neutral-bg-tint)",
								"@media (min-width: 56rem)": { position: "sticky", insetBlockStart: "5rem" },
							}),
						]}
					>
						<h2 mix={[raw({ margin: "0", fontSize: "1.25rem", fontWeight: "500" })]}>Summary</h2>
						<TotalsBreakdown totals={totals} shippingChosen={false} method="standard" />
						<PromoCode
							action={actionHref("cart/promo")}
							value={promoError?.code}
							error={promoError?.message}
							fields={{ back: "cart" }}
							applied={
								totals.promo === null
									? []
									: [
											{
												code: totals.promo.code,
												label: totals.promo.label,
												remove: {
													action: actionHref("cart/promo/remove"),
													fields: { back: "cart" },
												},
											},
										]
							}
							labels={{
								toggle: "Have a promo code?",
								field: "Promo code",
								apply: "Apply",
								remove: "Remove code",
							}}
						/>
						{lines.some(isPhysical) ? (
							<ShippingEstimate
								action={href("cart")}
								value={postcode}
								error={
									postcode !== "" && !postcodeValid ? "Enter a postcode like 4050-174." : undefined
								}
								options={
									postcode !== "" && postcodeValid
										? SHIPPING.map((method) => ({
												id: method.id,
												label: method.name,
												arrives:
													method.id === "pickup"
														? "Ready tomorrow in Porto"
														: `${shortDay(addWorkingDays(now, method.days[0]))} – ${shortDay(addWorkingDays(now, method.days[1]))}`,
												price:
													method.price === 0 ||
													(method.id === "standard" && totals.toFreeShipping === 0)
														? "Free"
														: money(method.price),
											}))
										: undefined
								}
								labels={{ field: "Postcode", submit: "Estimate", heading: "Delivery estimate" }}
							/>
						) : null}
						<LinkButton href={href("checkout")} color="brand" size="lg">
							Check out · {money(totals.total)}
						</LinkButton>
						<form
							method="post"
							action={actionHref("checkout/express")}
							mix={[raw({ margin: "0" })]}
						>
							<button
								type="submit"
								mix={[
									raw({
										inlineSize: "100%",
										blockSize: "3rem",
										border: "1px solid var(--ui-neutral-fg-emphasis)",
										borderRadius: "var(--ui-cta-radius)",
										background: "none",
										font: "inherit",
										fontWeight: "600",
										color: "inherit",
										cursor: "pointer",
									}),
								]}
							>
								Express checkout with Demo Pay
							</button>
						</form>
						<DemoNote>
							Checkout uses pretend payment methods and never asks for card details.
						</DemoNote>
					</aside>
				</div>
				<Shelf
					id="hw-cart-picks"
					title="Pairs well with"
					posters={picks}
					wish={visitor.wish}
					back="cart"
				/>
			</Gutter>
		);
	};
}

/** A checkout form's field errors and the values to show again, by field name. */
export interface StepErrors {
	fields: Record<string, string>;
	values: Partial<CheckoutDraft>;
}

namespace CheckoutPage {
	export interface Props {
		visitor: Visitor;
		step: Step;
		errors?: StepErrors;
	}
}

/** One step of checkout inside the shared two-column layout with the order summary. */
export function CheckoutPage(handle: Handle<CheckoutPage.Props>) {
	return () => {
		let { errors, step, visitor } = handle.props;
		let steps = stepsFor(visitor.lines);
		let index = steps.indexOf(step);
		let draft = { ...visitor.draft, ...errors?.values };
		let shippingChosen = index > steps.indexOf("shipping") && steps.includes("shipping");
		let totals = priceCart(visitor.lines, visitor.promo, draft.shipping);
		return (
			<Gutter>
				<h1
					mix={[
						raw({
							margin: "0",
							padding: "1.5rem 0 1rem",
							fontSize: "clamp(1.5rem, 3vw, 2rem)",
							fontWeight: "500",
						}),
					]}
				>
					Checkout
				</h1>
				<CheckoutLayout
					steps={
						<StepIndicator label="Checkout steps">
							{steps.map((entry, at) => (
								<StepIndicator.Step
									number={at + 1}
									state={stepState(at, index)}
									href={at < index ? href(stepPage(entry)) : undefined}
								>
									{STEP_NAMES[entry]}
								</StepIndicator.Step>
							))}
						</StepIndicator>
					}
					summary={
						<OrderSummary
							collapsible
							labels={{ show: "Show order summary", heading: "Order summary" }}
							total={<Amount value={totals.total} currency={CURRENCY} locale={LOCALE} />}
							lines={
								<ul mix={[raw({ listStyle: "none", margin: "0", padding: "0" })]}>
									{visitor.lines.map((line) => (
										<CartLine
											name={linePoster(line).title}
											details={<LineDetails line={line} />}
											price={<Amount value={lineTotal(line)} currency={CURRENCY} locale={LOCALE} />}
											media={<LineArt line={line} />}
											mediaBackground={WALL}
											action={
												line.qty > 1 ? (
													<span
														mix={[
															raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
														]}
													>
														× {line.qty}
													</span>
												) : undefined
											}
										/>
									))}
								</ul>
							}
							breakdown={
								<TotalsBreakdown
									totals={totals}
									shippingChosen={shippingChosen || step === "shipping"}
									method={draft.shipping}
								/>
							}
						/>
					}
				>
					{step === "information" ? (
						<InformationStep visitor={visitor} draft={draft} errors={errors?.fields ?? {}} />
					) : null}
					{step === "shipping" ? <ShippingStep draft={draft} totals={totals} /> : null}
					{step === "payment" ? (
						<PaymentStep draft={draft} errors={errors?.fields ?? {}} totals={totals} />
					) : null}
					{step === "review" ? (
						<ReviewStep visitor={visitor} draft={draft} totals={totals} />
					) : null}
				</CheckoutLayout>
			</Gutter>
		);
	};
}

/** The look of a text field across checkout. */
function fieldInput() {
	return [
		raw({
			inlineSize: "100%",
			boxSizing: "border-box",
			blockSize: "3rem",
			paddingInline: "0.875rem",
			border: "1px solid var(--ui-neutral-border)",
			borderRadius: "var(--ui-radius-md)",
			font: "inherit",
			color: "inherit",
			backgroundColor: "var(--ui-bg)",
			"&[aria-invalid='true']": { borderColor: "var(--ui-color-danger-600, oklch(0.55 0.2 25))" },
		}),
		when(
			"&:focus-visible",
			raw({ outline: "2px solid var(--ui-color-brand-600)", outlineOffset: "1px" }),
		),
	];
}

namespace Field {
	export interface Props {
		name: keyof CheckoutDraft;
		label: string;
		value: string;
		error?: string;
		type?: "text" | "email";
		autocomplete?: TagProps<"input">["autocomplete"];
		required?: boolean;
		span?: boolean;
	}
}

/** A labelled text field with its error under it, keeping what was typed. */
function Field(handle: Handle<Field.Props>) {
	return () => {
		let {
			autocomplete,
			error,
			label,
			name,
			required = true,
			span = true,
			type = "text",
			value,
		} = handle.props;
		let id = `hw-${name}`;
		let fieldProps = {
			id,
			name,
			value,
			required,
			autocomplete,
			"aria-invalid": error === undefined ? undefined : ("true" as const),
			"aria-describedby": error === undefined ? undefined : `${id}-error`,
		};
		return (
			<div mix={[raw({ display: "grid", gap: "0.375rem", gridColumn: span ? "1 / -1" : "auto" })]}>
				<label htmlFor={id} mix={[raw({ fontSize: "0.875rem", fontWeight: "500" })]}>
					{label}
					{required ? null : (
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontWeight: "400" })]}>
							{" "}
							(optional)
						</span>
					)}
				</label>
				{type === "email" ? (
					<input type="email" {...fieldProps} mix={fieldInput()} />
				) : (
					<input type="text" {...fieldProps} mix={fieldInput()} />
				)}
				{error === undefined ? null : (
					<p
						id={`${id}-error`}
						mix={[
							raw({
								margin: "0",
								fontSize: "0.8125rem",
								color: "var(--ui-color-danger-700, oklch(0.5 0.2 25))",
							}),
						]}
					>
						{error}
					</p>
				)}
			</div>
		);
	};
}

/** A step's primary button and the link back. */
function StepActions(handle: Handle<{ label: string; back?: { href: string; label: string } }>) {
	return () => (
		<div
			mix={[
				raw({
					display: "flex",
					flexWrap: "wrap-reverse",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "1rem",
					paddingBlockStart: "0.5rem",
				}),
			]}
		>
			{handle.props.back === undefined ? (
				<span />
			) : (
				<a href={handle.props.back.href} mix={[raw({ color: "inherit", fontWeight: "500" })]}>
					‹ {handle.props.back.label}
				</a>
			)}
			<button
				type="submit"
				mix={[
					raw({
						blockSize: "3.25rem",
						paddingInline: "1.75rem",
						border: "0",
						borderRadius: "var(--ui-cta-radius)",
						font: "inherit",
						fontWeight: "600",
						fontSize: "1.0625rem",
						color: "var(--ui-bg)",
						backgroundColor: "var(--ui-neutral-fg-emphasis)",
						cursor: "pointer",
						"@media (max-width: 40rem)": { inlineSize: "100%" },
					}),
					when(
						"&:hover",
						raw({ backgroundColor: "var(--ui-color-brand-700, oklch(0.5 0.17 30))" }),
					),
				]}
			>
				{handle.props.label}
			</button>
		</div>
	);
}

/** A form section's heading. */
function StepHeading(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<h2 mix={[raw({ margin: "0", fontSize: "1.25rem", fontWeight: "500" })]}>
			{handle.props.children}
		</h2>
	);
}

namespace InformationStep {
	export interface Props {
		visitor: Visitor;
		draft: CheckoutDraft;
		errors: Record<string, string>;
	}
}

/** Contact and, when something ships, the address; saved addresses fill it in one tap. */
function InformationStep(handle: Handle<InformationStep.Props>) {
	return () => {
		let { draft, errors, visitor } = handle.props;
		let ships = visitor.lines.some(isPhysical);
		return (
			<div mix={[raw({ display: "grid", gap: "1.5rem" })]}>
				{ships && visitor.addresses.length > 0 ? (
					<section aria-labelledby="hw-saved" mix={[raw({ display: "grid", gap: "0.75rem" })]}>
						<StepHeading>
							<span id="hw-saved">Ship to a saved address</span>
						</StepHeading>
						<div
							mix={[
								raw({
									display: "grid",
									gap: "0.5rem",
									gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
								}),
							]}
						>
							{visitor.addresses.map((address) => (
								<form
									method="post"
									action={actionHref("checkout/use-address")}
									mix={[raw({ margin: "0" })]}
								>
									<input type="hidden" name="address" value={address.id} />
									<button
										type="submit"
										aria-pressed={draft.line1 === address.line1 ? "true" : "false"}
										mix={[
											raw({
												inlineSize: "100%",
												textAlign: "start",
												padding: "0.875rem 1rem",
												border: "1px solid var(--ui-neutral-border)",
												borderRadius: "var(--ui-radius-md)",
												background: "var(--ui-bg)",
												font: "inherit",
												color: "inherit",
												cursor: "pointer",
												"&[aria-pressed='true']": {
													borderColor: "var(--ui-neutral-fg-emphasis)",
													boxShadow: "inset 0 0 0 1px var(--ui-neutral-fg-emphasis)",
												},
											}),
										]}
									>
										<strong mix={[raw({ display: "block", fontWeight: "600" })]}>
											{address.name}
										</strong>
										<span
											mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
										>
											{addressLine(address)}
										</span>
									</button>
								</form>
							))}
						</div>
					</section>
				) : null}
				<form
					method="post"
					action={actionHref("checkout/information")}
					mix={[raw({ display: "grid", gap: "1.5rem" })]}
					novalidate
				>
					<section mix={[raw({ display: "grid", gap: "0.75rem" })]}>
						<StepHeading>Contact</StepHeading>
						<Field
							name="email"
							label="Email"
							type="email"
							autocomplete="email"
							value={draft.email}
							error={errors.email}
						/>
						<p
							mix={[
								raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							{ships
								? "We send the receipt and tracking here."
								: "We send the receipt and your download links here."}
						</p>
					</section>
					{ships ? (
						<section
							mix={[
								raw({
									display: "grid",
									gap: "0.75rem",
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
								}),
							]}
						>
							<div mix={[raw({ gridColumn: "1 / -1" })]}>
								<StepHeading>Shipping address</StepHeading>
							</div>
							<Field
								name="name"
								label="Full name"
								autocomplete="name"
								value={draft.name}
								error={errors.name}
							/>
							<Field
								name="line1"
								label="Address"
								autocomplete="address-line1"
								value={draft.line1}
								error={errors.line1}
							/>
							<Field
								name="line2"
								label="Apartment, floor"
								autocomplete="address-line2"
								value={draft.line2}
								required={false}
							/>
							<div
								mix={[
									raw({
										display: "grid",
										gap: "0.375rem",
										"@media (max-width: 30rem)": { gridColumn: "1 / -1" },
									}),
								]}
							>
								<label htmlFor="hw-city" mix={[raw({ fontSize: "0.875rem", fontWeight: "500" })]}>
									City
								</label>
								<Autocomplete
									id="hw-city"
									name="city"
									required
									defaultValue={draft.city}
									options={CITIES.map((city) => ({ value: city, label: city }))}
									autocomplete="address-level2"
									aria-invalid={errors.city === undefined ? undefined : "true"}
								/>
								{errors.city === undefined ? null : (
									<p
										mix={[
											raw({
												margin: "0",
												fontSize: "0.8125rem",
												color: "var(--ui-color-danger-700, oklch(0.5 0.2 25))",
											}),
										]}
									>
										{errors.city}
									</p>
								)}
							</div>
							<Field
								name="postcode"
								label="Postcode"
								autocomplete="postal-code"
								value={draft.postcode}
								error={errors.postcode}
								span={false}
							/>
							<div mix={[raw({ display: "grid", gap: "0.375rem", gridColumn: "1 / -1" })]}>
								<label
									htmlFor="hw-country"
									mix={[raw({ fontSize: "0.875rem", fontWeight: "500" })]}
								>
									Country
								</label>
								<select id="hw-country" name="country" autocomplete="country" mix={fieldInput()}>
									{COUNTRIES.map((country) => (
										<option value={country.id} selected={draft.country === country.id}>
											{country.name}
										</option>
									))}
								</select>
							</div>
						</section>
					) : (
						<FulfilmentNote kind="download">
							Your bag only has print files, so there's nothing to ship.
						</FulfilmentNote>
					)}
					<StepActions
						label={ships ? "Continue to shipping" : "Continue to payment"}
						back={{ href: href("cart"), label: "Back to bag" }}
					/>
				</form>
			</div>
		);
	};
}

/** A radio card: a native radio with a title, a detail and something at the end. */
function RadioCard(
	handle: Handle<{
		name: string;
		value: string;
		checked: boolean;
		title: RemixNode;
		detail?: RemixNode;
		end?: RemixNode;
	}>,
) {
	return () => {
		let { checked, detail, end, name, title, value } = handle.props;
		return (
			<label
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "auto minmax(0, 1fr) auto",
						alignItems: "start",
						gap: "0.75rem",
						padding: "1rem",
						border: "1px solid var(--ui-neutral-border)",
						borderRadius: "var(--ui-radius-md)",
						cursor: "pointer",
						"&:has(:checked)": {
							borderColor: "var(--ui-neutral-fg-emphasis)",
							boxShadow: "inset 0 0 0 1px var(--ui-neutral-fg-emphasis)",
						},
						"& input": {
							marginBlockStart: "0.2rem",
							accentColor: "var(--ui-neutral-fg-emphasis)",
							inlineSize: "1.125rem",
							blockSize: "1.125rem",
						},
					}),
					when(
						"&:has(:focus-visible)",
						raw({ outline: "2px solid var(--ui-color-brand-600)", outlineOffset: "2px" }),
					),
				]}
			>
				<input type="radio" name={name} value={value} checked={checked} />
				<span mix={[raw({ display: "grid", gap: "0.25rem" })]}>
					<strong mix={[raw({ fontWeight: "600" })]}>{title}</strong>
					{detail === undefined ? null : (
						<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{detail}
						</span>
					)}
				</span>
				{end === undefined ? null : (
					<span mix={[raw({ fontWeight: "600", fontVariantNumeric: "tabular-nums" })]}>{end}</span>
				)}
			</label>
		);
	};
}

/** The shipping methods with their dates and prices. */
function ShippingStep(handle: Handle<{ draft: CheckoutDraft; totals: Totals }>) {
	return () => {
		let { draft, totals } = handle.props;
		let now = Date.now();
		return (
			<form
				method="post"
				action={actionHref("checkout/shipping")}
				mix={[raw({ display: "grid", gap: "1rem" })]}
			>
				<StepHeading>Shipping method</StepHeading>
				<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)", fontSize: "0.9375rem" })]}>
					To {draft.line1}, {draft.postcode} {draft.city}, {countryName(draft.country)}.{" "}
					<a href={href("checkout")} mix={[raw({ color: "inherit" })]}>
						Change
					</a>
				</p>
				<fieldset
					mix={[raw({ display: "grid", gap: "0.5rem", margin: "0", padding: "0", border: "0" })]}
				>
					<legend
						mix={[
							raw({
								position: "absolute",
								inlineSize: "1px",
								blockSize: "1px",
								overflow: "hidden",
								clipPath: "inset(50%)",
							}),
						]}
					>
						Shipping method
					</legend>
					{SHIPPING.map((method) => {
						let free =
							method.price === 0 || (method.id === "standard" && totals.toFreeShipping === 0);
						return (
							<RadioCard
								name="shipping"
								value={method.id}
								checked={draft.shipping === method.id}
								title={method.name}
								detail={
									<>
										{method.id === "pickup"
											? "Ready tomorrow"
											: `Arrives ${shortDay(addWorkingDays(now, method.days[0]))} – ${shortDay(addWorkingDays(now, method.days[1]))}`}{" "}
										· {method.detail}
									</>
								}
								end={free ? "Free" : money(method.price)}
							/>
						);
					})}
				</fieldset>
				{totals.oversize === 0 ? null : (
					<p
						mix={[raw({ margin: "0", fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						A 70 × 100 frame ships as an oversize parcel for {money(totals.oversize)} more, except
						for pickup.
					</p>
				)}
				<StepActions
					label="Continue to payment"
					back={{ href: href("checkout"), label: "Back to details" }}
				/>
			</form>
		);
	};
}

/** The demo payment methods, the gift card code and an order note. No card fields, ever. */
function PaymentStep(
	handle: Handle<{ draft: CheckoutDraft; errors: Record<string, string>; totals: Totals }>,
) {
	return () => {
		let { draft, errors, totals } = handle.props;
		let back = totals.shipping === null ? href("checkout") : href("checkout/shipping");
		return (
			<form
				method="post"
				action={actionHref("checkout/payment")}
				mix={[raw({ display: "grid", gap: "1rem" })]}
			>
				<StepHeading>Payment</StepHeading>
				<DemoNote />
				<fieldset
					mix={[raw({ display: "grid", gap: "0.5rem", margin: "0", padding: "0", border: "0" })]}
				>
					<legend
						mix={[
							raw({
								position: "absolute",
								inlineSize: "1px",
								blockSize: "1px",
								overflow: "hidden",
								clipPath: "inset(50%)",
							}),
						]}
					>
						Payment method
					</legend>
					{PAYMENTS.map((method) => (
						<RadioCard
							name="payment"
							value={method.id}
							checked={draft.payment === method.id}
							title={method.name}
							detail={method.detail}
						/>
					))}
				</fieldset>
				<Field
					name="gift"
					label="Gift card code, if paying by gift card"
					value={draft.gift}
					required={false}
					error={errors.gift}
				/>
				<div mix={[raw({ display: "grid", gap: "0.375rem" })]}>
					<label htmlFor="hw-note" mix={[raw({ fontSize: "0.875rem", fontWeight: "500" })]}>
						Note for the studio{" "}
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontWeight: "400" })]}>
							(optional)
						</span>
					</label>
					<textarea
						id="hw-note"
						name="note"
						rows={2}
						maxlength={200}
						mix={[
							raw({
								font: "inherit",
								padding: "0.75rem",
								border: "1px solid var(--ui-neutral-border)",
								borderRadius: "var(--ui-radius-md)",
								backgroundColor: "var(--ui-bg)",
								color: "inherit",
							}),
						]}
						defaultValue={draft.note}
					/>
				</div>
				<StepActions
					label="Review order"
					back={{
						href: back,
						label: totals.shipping === null ? "Back to details" : "Back to shipping",
					}}
				/>
			</form>
		);
	};
}

/** Everything once more, each with a way back to change it, then Place order. */
function ReviewStep(handle: Handle<{ visitor: Visitor; draft: CheckoutDraft; totals: Totals }>) {
	return () => {
		let { draft, totals, visitor } = handle.props;
		let ships = visitor.lines.some(isPhysical);
		let rows: { label: string; value: RemixNode; href: string }[] = [
			{ label: "Contact", value: draft.email, href: href("checkout") },
		];
		if (ships) {
			rows.push({
				label: "Ship to",
				value: `${draft.name}, ${draft.line1}${draft.line2 === "" ? "" : ` ${draft.line2}`}, ${draft.postcode} ${draft.city}, ${countryName(draft.country)}`,
				href: href("checkout"),
			});
			rows.push({
				label: "Method",
				value: `${findShipping(draft.shipping)?.name} · ${totals.shipping === 0 ? "Free" : money((totals.shipping ?? 0) + totals.oversize)}`,
				href: href("checkout/shipping"),
			});
		}
		rows.push({
			label: "Payment",
			value: findPayment(draft.payment)?.name ?? "",
			href: href("checkout/payment"),
		});
		return (
			<form
				method="post"
				action={actionHref("checkout/place")}
				mix={[raw({ display: "grid", gap: "1.25rem" })]}
				data-main-scroll-top=""
			>
				<StepHeading>Review your order</StepHeading>
				<dl
					mix={[
						raw({
							margin: "0",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-md)",
							"& > div": {
								display: "grid",
								gridTemplateColumns: "6rem minmax(0, 1fr) auto",
								gap: "0.75rem",
								padding: "0.875rem 1rem",
								alignItems: "baseline",
							},
							"& > div + div": { borderBlockStart: "1px solid var(--ui-neutral-border)" },
							"& dt": { color: "var(--ui-neutral-fg-muted)", fontSize: "0.875rem" },
							"& dd": { margin: "0" },
						}),
					]}
				>
					{rows.map((row) => (
						<div>
							<dt>{row.label}</dt>
							<dd>{row.value}</dd>
							<a href={row.href} mix={[raw({ color: "inherit", fontSize: "0.875rem" })]}>
								Change
								<span
									mix={[
										raw({
											position: "absolute",
											inlineSize: "1px",
											blockSize: "1px",
											overflow: "hidden",
											clipPath: "inset(50%)",
										}),
									]}
								>
									{" "}
									{row.label.toLowerCase()}
								</span>
							</a>
						</div>
					))}
				</dl>
				<DemoNote>
					Placing this order charges nothing and ships nothing. Print files become real
					(watermarked) downloads.
				</DemoNote>
				<StepActions
					label={`Place order · ${money(totals.total)}`}
					back={{ href: href("checkout/payment"), label: "Back to payment" }}
				/>
			</form>
		);
	};
}
