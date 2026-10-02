/**
 * Live preview island for `RadioGroup`. The group submits and enforces its single choice
 * natively, and `aria-checked` is what does not follow live checkedness on its own, so
 * every option's input carries `ariaChecked()`. The example is the shape a checkout
 * really uses: rich option rows with a price and an estimate, plus a compact inline set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { has } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Header, RadioGroup } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The shipping options the checkout offers, in the order it lists them. */
const METHODS = [
	{ value: "standard", label: "Standard", price: "Free", eta: "Arrives in 5–7 days" },
	{ value: "express", label: "Express", price: "$12", eta: "Arrives in 2 days" },
	{ value: "overnight", label: "Overnight", price: "$28", eta: "Arrives tomorrow" },
	{
		value: "pickup",
		label: "Store pickup",
		price: "Free",
		eta: "Unavailable in your region",
		disabled: true,
	},
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<div mix={[vstack({ gap: 6, align: "stretch" })]}>
	<div mix={[vstack({ gap: 2, align: "stretch" })]}>
		<Header mix={[m(0)]}>Shipping method</Header>
		<RadioGroup aria-label="Shipping method" name="shippingMethod">
			{METHODS.map((method) => (
				<RadioGroup.Radio
					key={method.value}
					value={method.value}
					required
					defaultChecked={method.value === "express"}
					disabled={method.disabled}
					parts={{ input: [ariaChecked()] }}
					mix={[
						p(3),
						rounded("md"),
						border({ color: "neutral.border", width: 1 }),
						has("input:checked", [border("brand.ring"), bg("brand.tint")]),
					]}
				>
					<span mix={[vstack({ gap: 0.5, align: "start" })]}>
						<span mix={[text("sm"), weight("medium")]}>
							{method.label} · {method.price}
						</span>
						<span mix={[text("xs")]}>{method.eta}</span>
					</span>
				</RadioGroup.Radio>
			))}
		</RadioGroup>
	</div>

	<div mix={[vstack({ gap: 2, align: "stretch" })]}>
		<Header mix={[m(0)]}>Gift wrapping</Header>
		<RadioGroup aria-label="Gift wrapping" name="giftWrap" orientation="horizontal">
			<RadioGroup.Radio value="none" defaultChecked parts={{ input: [ariaChecked()] }}>
				None
			</RadioGroup.Radio>
			<RadioGroup.Radio value="paper" parts={{ input: [ariaChecked()] }}>
				Paper
			</RadioGroup.Radio>
			<RadioGroup.Radio value="box" parts={{ input: [ariaChecked()] }}>
				Gift box
			</RadioGroup.Radio>
		</RadioGroup>
	</div>
</div>`;

/** A checkout's two choices, hydrated so `aria-checked` tracks the live selection. */
export const RadioGroupPreview = clientEntry(
	"/resources/components/previews/radio-group.tsx#RadioGroupPreview",
	function RadioGroupPreview() {
		return () => (
			<div mix={[vstack({ gap: 6, align: "stretch" }), is("22rem")]}>
				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Header mix={[m(0)]}>Shipping method</Header>
					<RadioGroup aria-label="Shipping method" name="shippingMethod">
						{METHODS.map((method) => (
							<RadioGroup.Radio
								key={method.value}
								value={method.value}
								required
								defaultChecked={method.value === "express"}
								disabled={method.disabled}
								parts={{ input: [ariaChecked()] }}
								mix={[
									p(3),
									rounded("md"),
									border({ color: "neutral.border", width: 1 }),
									has("input:checked", [border("brand.ring"), bg("brand.tint")]),
								]}
							>
								<span mix={[vstack({ gap: 0.5, align: "start" })]}>
									<span mix={[text("sm"), weight("medium"), fg("neutral.emphasis")]}>
										{`${method.label} · ${method.price}`}
									</span>
									<span mix={[text("xs"), fg("neutral.muted")]}>{method.eta}</span>
								</span>
							</RadioGroup.Radio>
						))}
					</RadioGroup>
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Header mix={[m(0)]}>Gift wrapping</Header>
					<RadioGroup aria-label="Gift wrapping" name="giftWrap" orientation="horizontal">
						<RadioGroup.Radio value="none" defaultChecked parts={{ input: [ariaChecked()] }}>
							None
						</RadioGroup.Radio>
						<RadioGroup.Radio value="paper" parts={{ input: [ariaChecked()] }}>
							Paper
						</RadioGroup.Radio>
						<RadioGroup.Radio value="box" parts={{ input: [ariaChecked()] }}>
							Gift box
						</RadioGroup.Radio>
					</RadioGroup>
				</div>
			</div>
		);
	},
);

export default { code: CODE, render: () => <RadioGroupPreview /> };
