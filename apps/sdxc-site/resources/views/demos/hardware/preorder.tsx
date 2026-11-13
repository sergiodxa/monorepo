/**
 * The preorder on the dark stage: the price, the deposit, the open batch filling up beside
 * the batches around it, and the form. The form submits by GET to this page and the server
 * answers with the reservation it read, so ordering works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { Button, Link } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { Order } from "~/resources/views/demos/hardware/order";
import type { Batch } from "~/resources/views/demos/hardware/preorder-data";

import { FINISHES } from "~/resources/views/demos/hardware/finish";
import { LAYOUTS, SWITCHES } from "~/resources/views/demos/hardware/order";
import { BATCHES, PREORDER, PREORDER_FORM } from "~/resources/views/demos/hardware/preorder-data";
import { stage, STAGE_CLASS } from "~/resources/views/demos/hardware/stage";

namespace Preorder {
	export interface Props {
		/** The reservation the URL carried, which pre-checks the form and may confirm it. */
		order: Order;
	}
}

/** A small uppercase label over a group of the form or a figure. */
const LABEL = {
	fontSize: "0.75rem",
	fontWeight: "600",
	letterSpacing: "0.14em",
	textTransform: "uppercase",
	color: "var(--ui-neutral-fg-muted)",
} as const;

/**
 * Renders the band: terms and batches on one side, the form or its confirmation on the
 * other, side by side from the `lg` container up.
 *
 * @param handle Runtime handle carrying the order read from the URL.
 * @returns The render function producing the band.
 */
export default function Preorder(handle: Handle<Preorder.Props>) {
	return () => {
		let { order } = handle.props;
		return (
			<LandingSection
				id="preorder"
				class={STAGE_CLASS}
				tone="plain"
				spacing="normal"
				mix={[stage()]}
			>
				<LandingHeader
					eyebrow="10 · Preorder"
					description={`Reserve with a ${PREORDER.deposit} deposit. The rest is charged when your board leaves the shop, and the deposit comes back in full if you cancel before then.`}
				>
					{`Batch ${PREORDER.batch} ships ${PREORDER.ships}`}
				</LandingHeader>
				<div
					mix={[
						raw({ display: "grid", gap: "2.5rem", paddingBlockStart: "1rem" }),
						at("lg", raw({ gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "start" })),
					]}
				>
					<Terms />
					{order.reserved ? <Confirmation order={order} /> : <OrderForm order={order} />}
				</div>
			</LandingSection>
		);
	};
}

/**
 * The price, the open batch's fill as a meter, and every batch of the year with its state.
 *
 * @returns The render function producing the terms.
 */
function Terms() {
	return () => (
		<div mix={[raw({ display: "grid", gap: "2rem" })]}>
			<div>
				<span mix={[raw(LABEL)]}>Strata Two</span>
				<p
					mix={[
						raw({
							margin: "0.25rem 0 0",
							fontSize: "clamp(3rem, 8vw, 4.5rem)",
							fontWeight: "600",
							letterSpacing: "-0.045em",
							lineHeight: "1",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					{PREORDER.price}
				</p>
				<p
					mix={[
						raw({ margin: "0.5rem 0 0", color: "var(--ui-neutral-fg)", fontSize: "0.9375rem" }),
					]}
				>
					Any finish, layout or switch. {PREORDER.deposit} today, refundable until it ships.
				</p>
			</div>
			<div mix={[raw({ display: "grid", gap: "0.625rem" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							justifyContent: "space-between",
							gap: "1rem",
							fontSize: "0.875rem",
							fontVariantNumeric: "tabular-nums",
						}),
					]}
				>
					<label for="strata-batch-meter">Batch {PREORDER.batch} reserved</label>
					<span>
						{PREORDER.reserved.toLocaleString("en")} of {PREORDER.units.toLocaleString("en")}
					</span>
				</div>
				<meter
					id="strata-batch-meter"
					min={0}
					max={PREORDER.units}
					value={PREORDER.reserved}
					mix={[
						raw({
							appearance: "none",
							inlineSize: "100%",
							blockSize: "0.375rem",
							border: "0",
							borderRadius: "9999px",
							backgroundColor: "oklch(1 0 0 / 0.1)",
							overflow: "hidden",
							"&::-webkit-meter-bar": {
								background: "oklch(1 0 0 / 0.1)",
								border: "0",
								borderRadius: "9999px",
								blockSize: "0.375rem",
							},
							"&::-webkit-meter-optimum-value": {
								background: "var(--ui-color-brand-500)",
								borderRadius: "9999px",
							},
							"&::-moz-meter-bar": { background: "var(--ui-color-brand-500)" },
						}),
					]}
				/>
			</div>
			<ol mix={[raw({ margin: "0", padding: "0", listStyle: "none", display: "grid" })]}>
				{BATCHES.map((batch) => (
					<li
						key={batch.number}
						aria-current={batch.state === "open" ? "true" : undefined}
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "5.5rem 1fr auto",
								gap: "1rem",
								paddingBlock: "0.75rem",
								borderBlockStart: "1px solid var(--ui-landing-hairline)",
								fontSize: "0.875rem",
								fontVariantNumeric: "tabular-nums",
								color:
									batch.state === "open"
										? "var(--ui-neutral-fg-emphasis)"
										: "var(--ui-neutral-fg-muted)",
								fontWeight: batch.state === "open" ? "600" : "400",
							}),
						]}
					>
						<span>Batch {batch.number}</span>
						<span>{batch.ships}</span>
						<span>{BATCH_STATE[batch.state](batch)}</span>
					</li>
				))}
			</ol>
		</div>
	);
}

/** What the batch list says about each batch, by its state. */
const BATCH_STATE: Record<Batch["state"], (batch: Batch) => string> = {
	shipped: () => "Shipped",
	"sold out": () => "Sold out",
	open: (batch) => `${(batch.units - batch.reserved).toLocaleString("en")} left`,
	next: () => "Next",
};

namespace Choice {
	export interface Props {
		name: string;
		value: string;
		title: string;
		detail: string;
		checked: boolean;
	}
}

/**
 * One option of the form as a chip: a visually hidden radio inside its label, so the chip
 * is the target and the group answers to the arrow keys.
 *
 * @param handle Runtime handle carrying the option.
 * @returns The render function producing the chip.
 */
function Choice(handle: Handle<Choice.Props>) {
	return () => {
		let { name, value, title, detail, checked } = handle.props;
		return (
			<label
				mix={[
					raw({
						display: "grid",
						gap: "0.125rem",
						paddingBlock: "0.75rem",
						paddingInline: "1rem",
						borderRadius: "12px",
						cursor: "pointer",
						boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
						"&:has(:checked)": { boxShadow: "inset 0 0 0 2px var(--ui-neutral-fg-emphasis)" },
						"&:has(:focus-visible)": {
							outline: "2px solid var(--ui-color-brand-500)",
							outlineOffset: "3px",
						},
					}),
				]}
			>
				<input
					type="radio"
					name={name}
					value={value}
					checked={checked}
					mix={[raw({ position: "absolute", opacity: "0", pointerEvents: "none" })]}
				/>
				<span mix={[raw({ fontWeight: "600", fontSize: "0.9375rem" })]}>{title}</span>
				<span mix={[raw({ fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}>
					{detail}
				</span>
			</label>
		);
	};
}

namespace OrderForm {
	export interface Props {
		order: Order;
	}
}

/**
 * The form. Its finish radios sit in the finishes band and join it through the `form`
 * attribute; here the chosen finish is named by CSS, so the summary follows the picker.
 *
 * @param handle Runtime handle carrying the choices to pre-check.
 * @returns The render function producing the form.
 */
function OrderForm(handle: Handle<OrderForm.Props>) {
	return () => {
		let { order } = handle.props;
		return (
			<form
				id={PREORDER_FORM}
				method="get"
				action="#preorder"
				mix={[
					raw({
						display: "grid",
						gap: "1.5rem",
						padding: "1.5rem",
						borderRadius: "var(--ui-landing-card-radius-outer)",
						backgroundColor: "var(--ui-surface-raised)",
						boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
					}),
				]}
			>
				<input type="hidden" name="reserve" value="1" />
				<div
					mix={[
						raw({
							display: "flex",
							justifyContent: "space-between",
							alignItems: "baseline",
							gap: "1rem",
							flexWrap: "wrap",
						}),
					]}
				>
					<span>
						<span mix={[raw({ ...LABEL, display: "block" })]}>Finish</span>
						{FINISHES.map((finish) => (
							<span
								key={finish.value}
								data-finish-name={finish.value}
								mix={[raw({ fontWeight: "600", fontSize: "1.0625rem" })]}
							>
								{finish.name}
							</span>
						))}
					</span>
					<Link href="#finishes" color="neutral" mix={[raw({ fontSize: "0.875rem" })]}>
						Change finish
					</Link>
				</div>
				<ChoiceGroup legend="Layout">
					{LAYOUTS.map((layout) => (
						<Choice
							key={layout.value}
							name="layout"
							value={layout.value}
							title={layout.name}
							detail={layout.detail}
							checked={order.layout === layout.value}
						/>
					))}
				</ChoiceGroup>
				<ChoiceGroup legend="Switches">
					{SWITCHES.map((option) => (
						<Choice
							key={option.value}
							name="switch"
							value={option.value}
							title={option.name}
							detail={option.detail}
							checked={order.switch === option.value}
						/>
					))}
				</ChoiceGroup>
				<Button type="submit" color="brand" mix={[landingCtaChrome(), raw({ inlineSize: "100%" })]}>
					Reserve in batch {PREORDER.batch} · {PREORDER.deposit} deposit
				</Button>
				<p
					mix={[
						raw({
							margin: "0",
							fontSize: "0.8125rem",
							color: "var(--ui-neutral-fg-muted)",
							textAlign: "center",
						}),
					]}
				>
					A demo: reserving shows the confirmation and charges nothing.
				</p>
			</form>
		);
	};
}

/**
 * A fieldset of two chips side by side under a small label.
 *
 * @param handle Runtime handle carrying the legend and the chips.
 * @returns The render function producing the group.
 */
function ChoiceGroup(handle: Handle<{ legend: string; children: RemixNode }>) {
	return () => (
		<fieldset
			mix={[
				raw({
					margin: "0",
					padding: "0",
					border: "0",
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "0.5rem",
				}),
			]}
		>
			<legend mix={[raw({ ...LABEL, padding: "0", marginBlockEnd: "0.5rem" })]}>
				{handle.props.legend}
			</legend>
			{handle.props.children}
		</fieldset>
	);
}

namespace Confirmation {
	export interface Props {
		order: Order;
	}
}

/**
 * What the reader reserved, read back from the URL, with a way to change it.
 *
 * @param handle Runtime handle carrying the submitted order.
 * @returns The render function producing the confirmation.
 */
function Confirmation(handle: Handle<Confirmation.Props>) {
	return () => {
		let { order } = handle.props;
		let finish = FINISHES.find((item) => item.value === order.finish);
		let layout = LAYOUTS.find((item) => item.value === order.layout);
		let switchType = SWITCHES.find((item) => item.value === order.switch);
		return (
			<div
				role="status"
				data-slot="strata-reservation"
				mix={[
					raw({
						display: "grid",
						gap: "1rem",
						padding: "1.5rem",
						borderRadius: "var(--ui-landing-card-radius-outer)",
						backgroundColor: "var(--ui-surface-raised)",
						boxShadow: "inset 0 0 0 2px var(--ui-color-brand-500)",
					}),
				]}
			>
				<span mix={[raw(LABEL)]}>Reserved in batch {PREORDER.batch}</span>
				<p
					mix={[
						raw({ margin: "0", fontSize: "1.5rem", fontWeight: "600", letterSpacing: "-0.02em" }),
					]}
				>
					Strata Two in {finish?.name}, {layout?.name}, {switchType?.name} switches
				</p>
				<p
					mix={[
						raw({
							margin: "0",
							color: "var(--ui-neutral-fg)",
							fontSize: "0.9375rem",
							lineHeight: "1.5",
						}),
					]}
				>
					It ships {PREORDER.ships}. On a real store the {PREORDER.deposit} deposit would be taken
					now; this demo has charged nothing.
				</p>
				<Link
					href={`?finish=${order.finish}#preorder`}
					color="neutral"
					mix={[raw({ fontSize: "0.875rem" })]}
				>
					Change the reservation
				</Link>
			</div>
		);
	};
}
