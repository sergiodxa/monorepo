/**
 * The pricing band: usage pricing as a calculator. With script the bill re-prices as the
 * reader types; without it the GET form reloads the page with the bill for the new query.
 * Either way every estimate is a URL a buyer can forward to whoever approves the spend.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { Label, LinkButton, NumberField, RadioGroup } from "@sdxc/ui";
import { LandingHeader, LandingSection, UsageEstimate } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import {
	estimate,
	FIRST_RATE_CENTS,
	FIRST_TIER_HOURS,
	formatCents,
	FREE_HOURS,
	MAX_HOURS,
	readEstimateInput,
	RETENTION_CENTS,
	RETENTION_LABELS,
	RETENTIONS,
	VOLUME_RATE_CENTS,
} from "~/resources/views/demos/ai/estimate";
import { renderNearView } from "~/resources/views/demos/near-view";

namespace MarginPricing {
	/** The page's URL, whose query holds the calculator's last submission. */
	export interface Props {
		url: URL;
	}
}

/**
 * Renders the rates in the lead and the calculator under it, its fields filled with the
 * submitted values (or the defaults) and its bill a live frame of {@link MarginBill}.
 *
 * @param handle Runtime handle carrying the requested URL.
 * @returns The render function producing the band.
 */
export default function MarginPricing(handle: Handle<MarginPricing.Props>) {
	return () => {
		let input = readEstimateInput(handle.props.url.searchParams);

		return (
			<LandingSection id="pricing" mix={[renderNearView(530, 925)]}>
				<LandingHeader
					eyebrow="Pricing"
					layout="split"
					description={
						<>
							The first {FREE_HOURS} hours each month are free. After that,{" "}
							{formatCents(FIRST_RATE_CENTS)} per recorded hour, and{" "}
							{formatCents(VOLUME_RATE_CENTS)} past {FIRST_TIER_HOURS}. <strong>No seats</strong>:
							everyone in the workspace reads, edits and assigns for free.
						</>
					}
				>
					Pay for hours recorded
				</LandingHeader>
				<UsageEstimate
					action="#pricing"
					submitLabel="Update the estimate"
					fields={
						<>
							<NumberField>
								<Label htmlFor="margin-hours">Recorded hours a month</Label>
								<NumberField.Group>
									<NumberField.Input
										id="margin-hours"
										name="hours"
										min={0}
										max={MAX_HOURS}
										step={1}
										defaultValue={input.hours}
									/>
								</NumberField.Group>
							</NumberField>
							<fieldset
								mix={[
									raw({
										display: "flex",
										flexDirection: "column",
										gap: "0.5rem",
										margin: "0",
										padding: "0",
										border: "0",
										minInlineSize: "0",
									}),
								]}
							>
								<legend
									mix={[
										raw({
											padding: "0",
											marginBlockEnd: "0.5rem",
											fontSize: "0.875rem",
											fontWeight: "500",
											color: "var(--ui-neutral-fg-emphasis)",
										}),
									]}
								>
									After the notes are written, the transcript is…
								</legend>
								<RadioGroup name="retention">
									{RETENTIONS.map((retention) => (
										<RadioGroup.Radio
											value={retention}
											defaultChecked={retention === input.retention}
										>
											{RETENTION_LABELS[retention]}
											{RETENTION_CENTS[retention] > 0
												? ` (+${formatCents(RETENTION_CENTS[retention])} / h)`
												: ""}
										</RadioGroup.Radio>
									))}
								</RadioGroup>
							</fieldset>
						</>
					}
					live={{
						frame: BILL_FRAME,
						src: `${handle.props.url.pathname}${handle.props.url.search}`,
					}}
				/>
			</LandingSection>
		);
	};
}

/** The bill frame's name, which `/demo/ai` answers with {@link MarginBill} alone. */
export const BILL_FRAME = "margin-bill";

namespace MarginBill {
	/** The address whose query names the hours and retention to price. */
	export interface Props {
		url: URL;
	}
}

/**
 * The month's bill for the query, computed on the server: the page inlines it, and a reader
 * typing in the calculator re-requests it alone through the bill frame.
 *
 * @param handle Runtime handle carrying the requested URL.
 * @returns The render function producing the bill.
 */
export function MarginBill(handle: Handle<MarginBill.Props>) {
	return () => {
		let input = readEstimateInput(handle.props.url.searchParams);
		let bill = estimate(input);
		return (
			<UsageEstimate.Bill
				label="Estimated monthly bill"
				rows={bill.rows.map((row) => ({
					label: row.label,
					detail: row.detail,
					amount: formatCents(row.cents),
				}))}
				total={{ label: `For ${input.hours} hours a month`, amount: formatCents(bill.totalCents) }}
				footnote="Billed monthly on hours actually recorded. Audio is deleted within 24 hours whatever you pick."
				cta={
					<LinkButton href="/examples/margin/sign-up" color="brand" mix={[landingCtaChrome()]}>
						Start with {FREE_HOURS} free hours
					</LinkButton>
				}
			/>
		);
	};
}
