/**
 * A usage-pricing calculator that needs no script: a GET form of the reader's numbers
 * beside the bill the server printed for them. Submitting reloads the page with the query,
 * and the page renders the new bill, so the answer is a URL a reader can share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";

import { Button } from "../components/button.js";
import { landingCtaChrome, landingSurface } from "../styles/landing.js";

/** Container the card declares, which its two columns query. */
const CONTAINER_NAME = "ui-usage-estimate";

/**
 * Prop types for {@link UsageEstimate}.
 */
export namespace UsageEstimate {
	/** One line of the bill. */
	export interface Row {
		label: RemixNode;
		/** The arithmetic behind the amount, such as `35 h × $0.36`. */
		detail?: RemixNode;
		/** The formatted amount, such as `$12.60`. */
		amount: RemixNode;
	}

	/**
	 * Props accepted by {@link UsageEstimate}.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/**
		 * Where the form submits, usually the page's own section anchor (`#pricing`), so the
		 * reloaded page opens on the new bill.
		 */
		action: string;
		/** The form's controls, named as the page reads them from its query. */
		fields: RemixNode;
		/** Label of the submit button. */
		submitLabel: RemixNode;
		/** Accessible name of the bill. Required — the library ships no copy. */
		billLabel: string;
		/** The bill's lines, in the order they add up. */
		rows: readonly Row[];
		/** The sum, set larger under a rule. */
		total: Row;
		/** A line under the total, such as what the price leaves out. */
		footnote?: RemixNode;
		/** The page's next step under the bill, such as its primary CTA. */
		cta?: RemixNode;
	}
}

/**
 * Renders the form and the bill on one raised card, side by side from a 40rem card and
 * stacked on a phone, the bill on a tinted sheet so it reads as the answer. Amounts sit
 * in one right-aligned column of tabular figures, so every row lines up with the total.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the calculator's markup.
 * @example
 * <UsageEstimate
 * 	action="#pricing"
 * 	fields={<TextField label="Hours a month" type="number" name="hours" defaultValue="40" />}
 * 	submitLabel="Estimate"
 * 	billLabel="Estimated monthly bill"
 * 	rows={[{ label: "Recorded hours", detail: "35 h × $0.36", amount: "$12.60" }]}
 * 	total={{ label: "Per month", amount: "$12.60" }}
 * />
 */
export function UsageEstimate(handle: Handle<UsageEstimate.Props>) {
	return () => {
		let { action, billLabel, cta, fields, footnote, mix, rows, submitLabel, total, ...rest } =
			handle.props;

		return (
			<div
				{...rest}
				data-slot="usage-estimate"
				mix={mergeMix([landingSurface(), container(CONTAINER_NAME)], mix)}
			>
				<div
					mix={[
						raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)" }),
						at(
							"40rem",
							CONTAINER_NAME,
							raw({ gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)" }),
						),
					]}
				>
					<form
						method="get"
						action={action}
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								alignItems: "stretch",
								gap: "1.25rem",
								padding: "1.5rem",
							}),
						]}
					>
						{fields}
						<Button type="submit" color="neutral" variant="surface" mix={[landingCtaChrome()]}>
							{submitLabel}
						</Button>
					</form>
					<div
						data-slot="usage-estimate-bill"
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "1rem",
								padding: "1.5rem",
								backgroundColor: "color-mix(in oklch, CanvasText 3%, transparent)",
								borderStartEndRadius: "inherit",
								borderEndEndRadius: "inherit",
								borderEndStartRadius: "inherit",
								boxShadow: "inset 0 1px 0 var(--ui-landing-hairline)",
							}),
							at(
								"40rem",
								CONTAINER_NAME,
								raw({
									borderEndStartRadius: "0",
									boxShadow: "inset 1px 0 0 var(--ui-landing-hairline)",
								}),
							),
						]}
					>
						<table
							aria-label={billLabel}
							mix={[
								raw({
									inlineSize: "100%",
									borderCollapse: "collapse",
									fontVariantNumeric: "tabular-nums",
									fontSize: "0.9375rem",
								}),
							]}
						>
							<tbody>
								{rows.map((row) => (
									<BillRow row={row} />
								))}
							</tbody>
							<tfoot>
								<BillRow row={total} total />
							</tfoot>
						</table>
						{footnote === undefined ? null : (
							<p
								mix={[
									raw({
										margin: "0",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg-muted)",
										textWrap: "pretty",
									}),
								]}
							>
								{footnote}
							</p>
						)}
						{cta === undefined ? null : (
							<div mix={[raw({ display: "grid", marginBlockStart: "auto" })]}>{cta}</div>
						)}
					</div>
				</div>
			</div>
		);
	};
}

/** Props {@link BillRow} reads. */
interface BillRowProps {
	row: UsageEstimate.Row;
	/** The sum row: larger, emphasised, and ruled off from the rows above. */
	total?: boolean;
}

/**
 * One line of the bill: the label with its arithmetic under it, and the amount pinned to
 * the end. The total's cells carry the rule, so it spans the table's full width.
 */
function BillRow(handle: Handle<BillRowProps>) {
	return () => {
		let { row, total = false } = handle.props;
		let cell = raw({
			paddingBlock: total ? "0.875rem 0" : "0.5rem",
			verticalAlign: "baseline",
			borderBlockStart: total ? "1px solid var(--ui-neutral-border-strong)" : "0",
		});

		return (
			<tr data-total={total ? "" : undefined}>
				<th
					scope="row"
					mix={[
						cell,
						raw({
							textAlign: "start",
							fontWeight: total ? "600" : "400",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{row.label}
					{row.detail === undefined ? null : (
						<span
							mix={[
								raw({
									display: "block",
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.75rem",
									fontWeight: "400",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{row.detail}
						</span>
					)}
				</th>
				<td
					mix={[
						cell,
						raw({
							textAlign: "end",
							whiteSpace: "nowrap",
							paddingInlineStart: "1rem",
							fontSize: total ? "1.75rem" : "inherit",
							fontWeight: total ? "600" : "400",
							letterSpacing: total ? "-0.02em" : "normal",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{row.amount}
				</td>
			</tr>
		);
	};
}
