/**
 * The home page's pricing estimate: a GET form of monitors and their check intervals beside
 * the bill the server printed for them, so the estimate works without script and its URL
 * reproduces the same bill. The "How pricing works" steps sit under it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grid, hstack, vstack } from "@sdxc/u/layout";
import { m, maxIs, p, pis } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";
import { Button, Heading, Input, Label } from "@sdxc/ui";
import { UsageEstimate } from "@sdxc/ui/landing";

import type { PricingEstimate } from "~/app/services/pricing-estimate";

import {
	ADD_PARAM,
	MAX_INTERVAL_MINUTES,
	MAX_MONITORS,
	MIN_INTERVAL_MINUTES,
	MONITOR_PARAM,
	REMOVE_PARAM,
} from "~/app/services/pricing-estimate";
import { INCLUDED_PINGS, PRICE_PER_BLOCK_USD } from "~/config/pricing";
import routes from "~/routes/web";

namespace PricingEstimateView {
	export interface Props {
		estimate: PricingEstimate;
		t: Translate;
		/** The pricing figures the copy quotes, already formatted for `locale`. */
		values: Record<string, string>;
		/** The section anchor the form submits to, so the reloaded page opens on the bill. */
		action: string;
	}
}

/** The bill frame's name, which the home page's route answers with {@link PricingBill} alone. */
export const PRICING_BILL_FRAME = "pricing-bill";

/** The "How pricing works" steps, in reading order. */
const STEPS = ["first", "second", "third", "fourth"] as const;

/** The home page with the estimate's intervals as its query, where the live bill first loads. */
function billSrc(estimate: PricingEstimate): string {
	let query = new URLSearchParams(
		estimate.intervals.map((minutes) => [MONITOR_PARAM, String(minutes)]),
	);
	return `${routes.home.href()}?${query}`;
}

/**
 * Renders the estimate and the pricing steps. The form's first control is a hidden copy of
 * Update, so Enter in an interval updates the bill rather than pressing the first monitor's
 * Remove, which comes earlier in the form than the visible Update button.
 */
export default function PricingEstimateView(handle: Handle<PricingEstimateView.Props>) {
	return () => {
		let { estimate, t, values, action } = handle.props;
		let { intervals } = estimate;
		let canRemove = intervals.length > 1;

		return (
			<div mix={[vstack({ gap: 10, align: "stretch" })]}>
				<UsageEstimate
					action={action}
					submitLabel={t("landing.pricing.estimate.submit")}
					fields={
						<>
							<button type="submit" tabIndex={-1} aria-hidden="true" mix={[visuallyHidden()]}>
								{t("landing.pricing.estimate.submit")}
							</button>
							<div mix={[vstack({ gap: 1, align: "stretch" })]}>
								<Heading level={3} mix={[m(0), fontSize("lg"), weight(600)]}>
									{t("landing.pricing.estimate.title")}
								</Heading>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{t("landing.pricing.estimate.description", values)}
								</p>
							</div>
							<ol mix={[vstack({ gap: 3, align: "stretch" }), m(0), p(0), pis(0)]}>
								{intervals.map((minutes, index) => {
									let id = `pricing-monitor-${index}`;
									return (
										<li
											key={id}
											mix={[hstack({ gap: 2, align: "end" }), raw({ listStyle: "none" })]}
										>
											<Label mix={[vstack({ gap: 1, align: "stretch" }), raw({ flexGrow: "1" })]}>
												<span mix={[fontSize("sm")]}>
													{t("landing.pricing.estimate.monitor", { index: index + 1 })}
												</span>
												<span mix={[hstack({ gap: 2, align: "center" })]}>
													<Input
														id={id}
														type="number"
														name={MONITOR_PARAM}
														min={MIN_INTERVAL_MINUTES}
														max={MAX_INTERVAL_MINUTES}
														step={1}
														inputMode="numeric"
														defaultValue={String(minutes)}
														mix={[maxIs("8rem")]}
													/>
													<span mix={[fontSize("sm"), fg("neutral.muted")]}>
														{t("landing.pricing.estimate.minutes")}
													</span>
												</span>
											</Label>
											{canRemove ? (
												<Button
													type="submit"
													name={REMOVE_PARAM}
													value={String(index)}
													formNoValidate
													variant="ghost"
													color="neutral"
													size="sm"
												>
													{t("landing.pricing.estimate.remove", { index: index + 1 })}
												</Button>
											) : null}
										</li>
									);
								})}
							</ol>
							{intervals.length < MAX_MONITORS ? (
								<Button
									type="submit"
									name={ADD_PARAM}
									value="1"
									formNoValidate
									variant="outline"
									color="neutral"
									size="sm"
								>
									{t("landing.pricing.estimate.add")}
								</Button>
							) : null}
						</>
					}
					live={{ frame: PRICING_BILL_FRAME, src: billSrc(estimate) }}
				/>

				<div mix={[vstack({ gap: 4, align: "stretch" })]}>
					<Heading level={3} mix={[m(0), fontSize("lg"), weight(600)]}>
						{t("landing.pricing.howItWorks.title")}
					</Heading>
					<ol
						mix={[
							grid(),
							raw({ gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))", gap: "1.25rem" }),
							m(0),
							pis(5),
						]}
					>
						{STEPS.map((step) => (
							<li key={step} mix={[vstack({ gap: 1, align: "stretch" })]}>
								<strong>{t(`landing.pricing.howItWorks.list.${step}.title`, values)}</strong>
								<span mix={[fontSize("sm"), fg("neutral.muted")]}>
									{t(`landing.pricing.howItWorks.list.${step}.description`, values)}
								</span>
							</li>
						))}
					</ol>
				</div>
			</div>
		);
	};
}

/** Props {@link PricingBill} reads. */
interface PricingBillProps {
	estimate: PricingEstimate;
	t: Translate;
	locale: string;
}

/**
 * The bill for one estimate: the subscription with its included pings, the extra pings in
 * whole blocks, and the month's total. The page prints it inline, and answers the bill frame's
 * request with it alone, so a changed interval re-prices without a page load.
 */
export function PricingBill(handle: Handle<PricingBillProps>) {
	return () => {
		let { estimate, t, locale } = handle.props;
		let count = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
		let money = new Intl.NumberFormat(locale, {
			style: "currency",
			currency: "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		});
		let { cost, pings } = estimate;

		return (
			<UsageEstimate.Bill
				label={t("landing.pricing.estimate.bill")}
				rows={[
					{
						label: t("landing.pricing.estimate.subscription"),
						detail: t("landing.pricing.estimate.subscriptionDetail", {
							included: count.format(INCLUDED_PINGS),
						}),
						amount: money.format(cost.totalUsd - cost.additionalCostUsd),
					},
					{
						label: t("landing.pricing.estimate.extra"),
						detail:
							cost.billedBlocks === 0
								? t("landing.pricing.estimate.extraNone", { pings: count.format(pings) })
								: t("landing.pricing.estimate.extraDetail", {
										over: count.format(cost.additionalPings),
										blocks: cost.billedBlocks,
										blockPrice: money.format(PRICE_PER_BLOCK_USD),
									}),
						amount: money.format(cost.additionalCostUsd),
					},
				]}
				total={{
					label: t("landing.pricing.estimate.total"),
					detail: t("landing.pricing.estimate.totalDetail", { pings: count.format(pings) }),
					amount: money.format(cost.totalUsd),
				}}
				footnote={t("landing.pricing.estimate.footnote")}
			/>
		);
	};
}
