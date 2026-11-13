/**
 * Ordering for pickup with no script: a plain form whose pickup days come from the
 * bakery's calendar (never today, never a holiday), posted to the site's example endpoint,
 * which sends the browser back here to the confirmation the address's `#order-placed` reveals.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { has, when } from "@sdxc/u/state";
import { Button, Input, Label, RadioGroup, Select, TextField } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { Drawing, gingham, scallopHem } from "~/resources/views/demos/bakery/art";
import { formatDate, formatOpening, pickupDays } from "~/resources/views/demos/bakery/hours";
import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * Where the form posts. The endpoint answers with a redirect to the page the order came from;
 * a redirect without a fragment keeps this one, so the browser lands on the confirmation.
 */
export const ORDER_ACTION = "/examples/bakery/order#order-placed";

/** What can be ordered ahead, with the field name each quantity posts under. */
const ORDERABLE = [
	{ field: "sourdough", name: "Country sourdough", price: "$9" },
	{ field: "rye", name: "Seeded rye", price: "$10" },
	{ field: "croissant", name: "Butter croissant", price: "$4.25" },
	{ field: "cardamom", name: "Cardamom bun", price: "$4.50" },
	{ field: "pie", name: "Pie of the season, whole", price: "$34" },
] as const;

/** The three parts of the day an order can be collected in. */
const PICKUP_WINDOWS = [
	{ value: "morning", label: "Morning", hint: "Until 11 am" },
	{ value: "midday", label: "Midday", hint: "11 am – 2 pm" },
	{ value: "afternoon", label: "Afternoon", hint: "2 pm – close" },
] as const;

/** The three steps between pressing the button and eating the bread. */
const STEPS = [
	{
		title: "Pick your bakes and a day",
		body: "Anything on this list, for any day we're open. We need the night before, so tomorrow is the soonest.",
		bake: "croissant",
	},
	{
		title: "We bake it with your name on",
		body: "Your order goes in the first batch and into a box with your name, so it can't sell out.",
		bake: "loaf",
	},
	{
		title: "Collect it at the counter",
		body: "Pay when you pick it up, by card or cash. If you're running late, we'll keep it until close.",
		bake: "cup",
	},
] as const;

/**
 * The order band: the form on a gingham-edged card beside the three steps of how pickup
 * works. The confirmation sits at the top of the card, hidden until the address targets it.
 *
 * @param handle Runtime handle carrying the instant the page was asked for.
 * @returns The render function producing the band.
 */
export function Order(handle: Handle<{ now: Date }>) {
	return () => {
		let days = pickupDays(handle.props.now);

		return (
			<LandingSection id="order" mix={[renderNearView(1000, 1900)]}>
				<LandingHeader
					eyebrow="Order for pickup"
					description={
						<>
							Tell us what you'd like and when. <strong>Pay when you collect</strong>, no account
							and no card details online.
						</>
					}
				>
					Save a loaf before it sells out
				</LandingHeader>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 24rem), 1fr))",
							gap: "clamp(1.5rem, 5cqi, 3.5rem)",
							alignItems: "start",
						}),
					]}
				>
					<div
						mix={[
							raw({
								borderRadius: "var(--ui-landing-card-radius-outer)",
								backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
								boxShadow: "var(--ui-shadow-surface)",
								overflow: "hidden",
							}),
						]}
					>
						<div
							aria-hidden="true"
							mix={[
								gingham("var(--ui-color-brand-500)", "0.75rem"),
								scallopHem("0.5rem"),
								raw({ blockSize: "2.25rem", backgroundColor: "var(--ui-color-brand-100)" }),
								dark(raw({ backgroundColor: "var(--ui-color-brand-900)" })),
							]}
						/>
						<OrderPlaced />
						<OrderForm days={days} />
					</div>
					<ol
						mix={[
							raw({
								listStyle: "none",
								margin: "0",
								padding: "0",
								display: "flex",
								flexDirection: "column",
								gap: "1.5rem",
								counterReset: "step",
							}),
						]}
					>
						{STEPS.map((step, index) => (
							<li
								key={step.title}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "5.5rem 1fr",
										gap: "1.25rem",
										alignItems: "center",
									}),
								]}
							>
								<Drawing bake={step.bake} />
								<span mix={[raw({ display: "flex", flexDirection: "column", gap: "0.25rem" })]}>
									<span
										mix={[
											raw({
												fontFamily: "var(--ui-font-display)",
												fontWeight: "700",
												fontSize: "1.25rem",
												color: "var(--ui-neutral-fg-emphasis)",
											}),
										]}
									>
										{index + 1}. {step.title}
									</span>
									<span mix={[raw({ color: "var(--ui-neutral-fg)", lineHeight: "1.5" })]}>
										{step.body}
									</span>
								</span>
							</li>
						))}
					</ol>
				</div>
			</LandingSection>
		);
	};
}

/**
 * The thank-you note, hidden until the address ends in `#order-placed`, which is where the
 * order's redirect lands. It carries focus-free `role="status"` so it is announced on arrival.
 *
 * @returns The render function producing the note.
 */
function OrderPlaced() {
	return () => (
		<div
			id="order-placed"
			role="status"
			data-slot="order-placed"
			mix={[
				raw({
					display: "none",
					margin: "1.5rem 1.5rem 0",
					padding: "1rem 1.25rem",
					borderRadius: "var(--ui-landing-card-radius-inner)",
					backgroundColor: "oklch(0.94 0.05 150)",
					color: "oklch(0.3 0.06 150)",
				}),
				dark(raw({ backgroundColor: "oklch(0.32 0.06 150)", color: "oklch(0.95 0.03 150)" })),
				when("&:target", raw({ display: "block" })),
			]}
		>
			<p mix={[raw({ margin: "0", fontWeight: "800" })]}>Thank you, your order is in.</p>
			<p mix={[raw({ margin: "0.25rem 0 0" })]}>
				It'll be boxed with your name and waiting at the counter. Pay when you collect. (This is a
				demo, so nothing was sent and no one is baking for you, sadly.)
			</p>
		</div>
	);
}

/**
 * The form itself: a quantity per bake, the pickup day and time, and a name and phone so we
 * know whose box it is. Every control is native, so it posts with no script.
 *
 * @param handle Runtime handle carrying the days an order can be collected.
 * @returns The render function producing the form.
 */
function OrderForm(handle: Handle<{ days: ReturnType<typeof pickupDays> }>) {
	return () => {
		let { days } = handle.props;
		return (
			<form
				method="post"
				action={ORDER_ACTION}
				data-slot="order-form"
				mix={[raw({ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1.5rem" })]}
			>
				<fieldset mix={[raw({ border: "0", margin: "0", padding: "0", minInlineSize: "0" })]}>
					<legend
						mix={[
							raw({
								padding: "0",
								marginBlockEnd: "0.75rem",
								fontWeight: "800",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						What would you like?
					</legend>
					<ul
						mix={[
							raw({
								listStyle: "none",
								margin: "0",
								padding: "0",
								display: "flex",
								flexDirection: "column",
								gap: "0.5rem",
							}),
						]}
					>
						{ORDERABLE.map((item) => (
							<li
								key={item.field}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "1fr auto 4.5rem",
										alignItems: "center",
										gap: "0.75rem",
									}),
								]}
							>
								<Label htmlFor={`order-${item.field}`}>{item.name}</Label>
								<span
									mix={[
										raw({
											fontVariantNumeric: "tabular-nums",
											color: "var(--ui-neutral-fg-muted)",
											fontSize: "0.9375rem",
										}),
									]}
								>
									{item.price}
								</span>
								<Input
									id={`order-${item.field}`}
									name={item.field}
									type="number"
									inputMode="numeric"
									min="0"
									max="12"
									defaultValue="0"
									mix={[raw({ textAlign: "end", fontVariantNumeric: "tabular-nums" })]}
								/>
							</li>
						))}
					</ul>
				</fieldset>

				<div mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })]}>
					<Label htmlFor="order-day">Pickup day</Label>
					<Select id="order-day" name="day" required>
						<Select.Trigger>
							<Select.Value />
						</Select.Trigger>
						{days.map((day, index) => (
							<Select.Option key={day.date} value={day.date} selected={index === 0}>
								{formatDate(day)}
								{day.opening ? ` · ${formatOpening(day.opening)}` : ""}
							</Select.Option>
						))}
					</Select>
				</div>

				<div mix={[raw({ display: "flex", flexDirection: "column", gap: "0.5rem" })]}>
					<span
						id="order-window-label"
						mix={[
							raw({
								fontWeight: "500",
								fontSize: "0.875rem",
								lineHeight: "1",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						Pickup time
					</span>
					<RadioGroup
						aria-labelledby="order-window-label"
						name="window"
						orientation="horizontal"
						mix={[raw({ flexWrap: "wrap", rowGap: "0.5rem", columnGap: "0.5rem" })]}
					>
						{PICKUP_WINDOWS.map((window, index) => (
							<RadioGroup.Radio
								key={window.value}
								value={window.value}
								defaultChecked={index === 0}
								mix={[
									raw({
										padding: "0.5rem 0.75rem",
										borderRadius: "0.75rem",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
									}),
									has(
										"input:checked",
										raw({
											boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)",
											backgroundColor: "var(--ui-brand-bg-tint)",
										}),
									),
								]}
							>
								<span mix={[raw({ display: "flex", flexDirection: "column" })]}>
									<span mix={[raw({ fontWeight: "700" })]}>{window.label}</span>
									<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
										{window.hint}
									</span>
								</span>
							</RadioGroup.Radio>
						))}
					</RadioGroup>
				</div>

				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
							gap: "1rem",
						}),
					]}
				>
					<TextField label="Your name" name="name" required autoComplete="name" />
					<TextField
						label="Phone"
						name="phone"
						type="tel"
						required
						autoComplete="tel"
						description="Only to text you if something sells out."
					/>
				</div>

				<Button type="submit" color="brand" mix={[landingCtaChrome()]}>
					Send my order
				</Button>
			</form>
		);
	};
}
