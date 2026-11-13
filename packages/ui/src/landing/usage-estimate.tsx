/**
 * A usage-pricing calculator that needs no script: a GET form of the reader's numbers
 * beside the bill the server printed for them. In live mode the bill is a named frame that an
 * island re-requests as the reader types, and without script the form still submits by GET.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { container, hidden } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { clientEntry, Frame } from "remix/component";

import { Button } from "../components/button.js";
import { landingCtaChrome, landingSurface } from "../styles/landing.js";

import { usageEstimateLive } from "./mixins/usage-estimate-live.js";

/** Container the card declares, which its two columns query. */
const CONTAINER_NAME = "ui-usage-estimate";

/** Milliseconds of quiet after the last input before a live bill is re-requested. */
const DEFAULT_DELAY = 250;

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

	/** Where a live bill is loaded from. */
	export interface Live {
		/**
		 * The bill frame's name. The page's route answers a request carrying it in
		 * `X-Remix-Target` with a {@link UsageEstimate.Bill} alone.
		 */
		frame: string;
		/** The address the bill first loads: the page's own, with the query the fields show. */
		src: string;
		/**
		 * Milliseconds of quiet after the last input before the bill is re-requested.
		 * @default 250
		 */
		delay?: number;
	}

	/** What every calculator takes: the form and where it submits. */
	interface FormProps extends Omit<TagProps<"div">, "children"> {
		/**
		 * Where the form submits, usually the page's own section anchor (`#pricing`), so the
		 * reloaded page opens on the new bill.
		 */
		action: string;
		/** The form's controls, named as the page reads them from its query. */
		fields: RemixNode;
		/** Label of the submit button. */
		submitLabel: RemixNode;
	}

	/** A calculator whose bill is printed into the page and changes on submit. */
	export interface StaticProps extends FormProps {
		/** The bill for the query the page rendered, a {@link UsageEstimate.Bill}. */
		bill: RemixNode;
		live?: undefined;
	}

	/** A calculator whose bill is a frame re-requested while the reader types. */
	export interface LiveProps extends FormProps {
		live: Live;
		bill?: undefined;
	}

	/**
	 * Props accepted by {@link UsageEstimate}: a printed `bill`, or a `live` frame that loads one.
	 */
	export type Props = StaticProps | LiveProps;

	/** Props accepted by {@link UsageEstimate.Bill}. */
	export interface BillProps {
		/** Accessible name of the bill. Required — the library ships no copy. */
		label: string;
		/** The bill's lines, in the order they add up. */
		rows: readonly Row[];
		/** The sum, set larger under a rule. */
		total: Row;
		/** A line under the total, such as what the price leaves out. */
		footnote?: RemixNode;
		/** The page's next step under the bill, such as its primary CTA. */
		cta?: RemixNode;
	}

	/** Props accepted by {@link UsageEstimateLive}. */
	export interface LiveIslandProps {
		frame: string;
		delay: number;
	}
}

/**
 * Renders the form and the bill on one raised card, side by side from a 40rem card and
 * stacked on a phone, the bill on a tinted sheet so it reads as the answer. In live mode the
 * sheet holds a blocking frame, so the server still inlines the bill and the form is unchanged.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the calculator's markup.
 * @example
 * <UsageEstimate
 * 	action="#pricing"
 * 	fields={<TextField label="Hours a month" type="number" name="hours" defaultValue="40" />}
 * 	submitLabel="Estimate"
 * 	live={{ frame: "pricing-bill", src: "/?hours=40" }}
 * />
 */
export function UsageEstimate(handle: Handle<UsageEstimate.Props>) {
	return () => {
		let { action, bill, fields, live, mix, submitLabel, ...rest } = handle.props;

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
						{live === undefined ? null : (
							<UsageEstimateLive frame={live.frame} delay={live.delay ?? DEFAULT_DELAY} />
						)}
					</form>
					<div
						data-slot="usage-estimate-sheet"
						mix={[
							raw({
								display: "grid",
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
						{live === undefined ? bill : <Frame name={live.frame} src={live.src} />}
					</div>
				</div>
			</div>
		);
	};
}

/**
 * The bill a calculator shows: its lines and total in one right-aligned column of tabular
 * figures, then the footnote and the CTA pinned to the sheet's foot. A live calculator's
 * route returns this alone for the frame's target. The total is a polite live region, so a
 * re-priced bill is announced by its sum.
 *
 * @param handle Runtime handle carrying the bill.
 * @returns The render function producing the bill.
 */
UsageEstimate.Bill = function UsageEstimateBill(handle: Handle<UsageEstimate.BillProps>) {
	return () => {
		let { cta, footnote, label, rows, total } = handle.props;

		return (
			<div
				data-slot="usage-estimate-bill"
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "1rem",
						minBlockSize: "100%",
					}),
				]}
			>
				<table
					aria-label={label}
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
					<tfoot aria-live="polite">
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
		);
	};
};

/**
 * The island a live calculator places in its form: it reloads the named bill frame for the
 * form's query as the reader types, and on submit, with the address following through
 * `replaceState`. Load `@sdxc/ui/landing/usage-estimate` in the browser entry.
 */
export const UsageEstimateLive: EntryComponent<UsageEstimate.LiveIslandProps> = clientEntry(
	"@sdxc/ui/landing/usage-estimate#UsageEstimateLive",
	function UsageEstimateLive(handle: Handle<UsageEstimate.LiveIslandProps>) {
		/** Reloads the bill frame from `src`; a frame missing from the page rejects. */
		let reload = async (src: string) => {
			let frame = handle.frames.get(handle.props.frame);
			if (frame === undefined) throw new Error(`No frame named ${handle.props.frame}`);
			await frame.reload({ src });
		};

		return () => (
			<span
				data-slot="usage-estimate-live"
				mix={[hidden(), usageEstimateLive({ reload, delay: handle.props.delay })]}
			/>
		);
	},
);

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
