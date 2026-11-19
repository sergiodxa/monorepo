/**
 * A drawn payment card face: the issuer's mark, a chip or a "Virtual" tag, the masked
 * number, holder, expiry and network word, at the ID-1 card ratio. Its type scales with
 * its width, and a frozen card frosts over with a label, so the state reads at a glance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { NfcIcon, SnowflakeIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { font, tabularNums, weight } from "@sdxc/u/typography";

/** The width-to-height ratio of a bank card (ISO/IEC 7810 ID-1, 85.60 × 53.98 mm). */
const CARD_RATIO = "85.6 / 53.98";

/** The gradient each tone paints, from the theme's own scales. */
const TONE_BACKGROUND: Record<PaymentCard.Tone, string> = {
	brand:
		"linear-gradient(135deg, var(--ui-color-brand-500, #c2410c), var(--ui-color-brand-800, #7c2d12))",
	ink: "linear-gradient(135deg, var(--ui-color-neutral-800, #27272a), var(--ui-color-neutral-950, #09090b))",
	neutral:
		"linear-gradient(135deg, var(--ui-color-neutral-200, #e4e4e7), var(--ui-color-neutral-400, #a1a1aa))",
};

/** Prop types for {@link PaymentCard}. */
export namespace PaymentCard {
	/** The face's paint: the brand scale, near-black ink, or a light neutral metal. */
	export type Tone = "brand" | "ink" | "neutral";

	/** Props accepted by {@link PaymentCard}. */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** The card's accessible name, such as "Everyday debit card ending 4821". */
		label: string;
		/** The issuer's mark or name, top left. */
		brand: RemixNode;
		/** The last four digits; the rest of the number is drawn as dots and never passed. */
		last4: string;
		/** The cardholder's name as printed. */
		holder: string;
		/** The expiry as printed, `MM/YY`. */
		expires: string;
		/** The network or product word, bottom right, such as "debit". */
		network: string;
		/** `virtual` swaps the chip for a "Virtual" tag. @default "physical" */
		kind?: "physical" | "virtual";
		/** The tag a virtual card shows. @default "Virtual" */
		virtualLabel?: string;
		/** @default "brand" */
		tone?: Tone;
		/** Frosts the face and shows {@link frozenLabel}. @default false */
		frozen?: boolean;
		/** @default "Frozen" */
		frozenLabel?: string;
		/** The printed label before the expiry. @default "Exp" */
		expiresLabel?: string;
	}
}

/**
 * Renders the card face. Sizes are in container units, so the same card fits a phone's
 * carousel and a desktop column, and the masked number never wraps.
 *
 * @example <PaymentCard label="Everyday card ending 4821" brand="Tuppence" last4="4821" holder="Noor Halvorsen" expires="09/29" network="debit" />
 * @example <PaymentCard label="Online card ending 0937" brand="Tuppence" last4="0937" holder="Noor Halvorsen" expires="03/27" network="debit" kind="virtual" tone="ink" frozen />
 */
export function PaymentCard(handle: Handle<PaymentCard.Props>) {
	return () => {
		let {
			label,
			brand,
			last4,
			holder,
			expires,
			network,
			kind = "physical",
			virtualLabel = "Virtual",
			tone = "brand",
			frozen = false,
			frozenLabel = "Frozen",
			expiresLabel = "Exp",
			mix,
			...rest
		} = handle.props;
		return (
			<div
				role="group"
				aria-label={frozen ? `${label}, ${frozenLabel.toLowerCase()}` : label}
				{...rest}
				data-slot="payment-card"
				data-tone={tone}
				data-kind={kind}
				data-frozen={frozen ? "" : undefined}
				mix={mergeMix(
					[
						raw({
							containerType: "inline-size",
							position: "relative",
							isolation: "isolate",
							inlineSize: "100%",
							maxInlineSize: "var(--ui-payment-card-max, 26rem)",
							aspectRatio: CARD_RATIO,
							overflow: "hidden",
							borderRadius: "var(--ui-payment-card-radius, 1rem)",
							background: `var(--ui-payment-card-bg, ${TONE_BACKGROUND[tone]})`,
							color: tone === "neutral" ? "var(--ui-color-neutral-900, #18181b)" : "white",
							boxShadow:
								"0 1px 0 rgb(255 255 255 / 0.18) inset, 0 12px 28px -14px rgb(0 0 0 / 0.45)",
							userSelect: "none",
						}),
					],
					mix,
				)}
			>
				<CardPattern />
				<div
					data-slot="payment-card-face"
					mix={[
						raw({
							position: "absolute",
							inset: "0",
							display: "grid",
							gridTemplateRows: "auto 1fr auto auto",
							padding: "6.5cqi 7cqi",
							gap: "2cqi",
							transition: "filter 240ms ease",
						}),
						when(
							"[data-frozen] > &",
							raw({ filter: "grayscale(0.85) blur(1.5px)", opacity: "0.75" }),
						),
						motionReduce(raw({ transition: "none" })),
					]}
				>
					<div
						mix={raw({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							fontSize: "5cqi",
						})}
					>
						<span data-slot="payment-card-brand" mix={weight("semibold")}>
							{brand}
						</span>
						{kind === "virtual" ? (
							<span
								data-slot="payment-card-virtual"
								mix={raw({
									fontSize: "3.4cqi",
									paddingBlock: "0.6cqi",
									paddingInline: "2.4cqi",
									borderRadius: "999px",
									border: "1px solid currentcolor",
									opacity: "0.85",
									letterSpacing: "0.06em",
									textTransform: "uppercase",
								})}
							>
								{virtualLabel}
							</span>
						) : (
							<NfcIcon
								size={20}
								aria-hidden="true"
								mix={raw({ inlineSize: "6cqi", blockSize: "6cqi", opacity: "0.8" })}
							/>
						)}
					</div>
					<div mix={raw({ alignSelf: "center" })}>{kind === "physical" ? <Chip /> : null}</div>
					<div
						data-slot="payment-card-number"
						mix={[
							font("mono"),
							tabularNums(),
							raw({ fontSize: "6.2cqi", letterSpacing: "0.08em", whiteSpace: "nowrap" }),
						]}
					>
						<span aria-hidden="true">•••• •••• •••• </span>
						<span mix={visuallyHidden()}>ending </span>
						{last4}
					</div>
					<div
						mix={raw({
							display: "flex",
							alignItems: "flex-end",
							justifyContent: "space-between",
							gap: "3cqi",
							fontSize: "3.6cqi",
						})}
					>
						<span
							data-slot="payment-card-holder"
							mix={raw({
								textTransform: "uppercase",
								letterSpacing: "0.08em",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							})}
						>
							{holder}
						</span>
						<span mix={raw({ display: "flex", alignItems: "baseline", gap: "4cqi", flex: "none" })}>
							<span data-slot="payment-card-expires" mix={tabularNums()}>
								<span mix={raw({ opacity: "0.7", marginInlineEnd: "1.2cqi" })}>{expiresLabel}</span>
								{expires}
							</span>
							<span
								data-slot="payment-card-network"
								mix={[
									weight("bold"),
									raw({ fontSize: "5.4cqi", fontStyle: "italic", letterSpacing: "-0.01em" }),
								]}
							>
								{network}
							</span>
						</span>
					</div>
				</div>
				{frozen ? (
					<div
						data-slot="payment-card-frozen"
						mix={raw({
							position: "absolute",
							inset: "0",
							display: "grid",
							placeItems: "center",
							alignContent: "center",
							gap: "1.5cqi",
							fontSize: "4.6cqi",
							fontWeight: "600",
							color: "white",
							background:
								"linear-gradient(160deg, rgb(219 234 254 / 0.38), rgb(148 163 184 / 0.32))",
							textShadow: "0 1px 2px rgb(0 0 0 / 0.35)",
						})}
					>
						<SnowflakeIcon
							size={28}
							aria-hidden="true"
							mix={raw({ inlineSize: "9cqi", blockSize: "9cqi" })}
						/>
						<span aria-hidden="true">{frozenLabel}</span>
					</div>
				) : null}
			</div>
		);
	};
}

/** The chip, drawn as a gold square with its contact lines, a third of the card's height. */
function Chip() {
	return () => (
		<svg
			viewBox="0 0 40 30"
			aria-hidden="true"
			data-slot="payment-card-chip"
			mix={raw({ display: "block", inlineSize: "13cqi", blockSize: "auto" })}
		>
			<rect x="0.5" y="0.5" width="39" height="29" rx="5" fill="#e2c178" />
			<path
				d="M0 10 H13 M0 20 H13 M27 10 H40 M27 20 H40 M13 0 V30 M27 0 V30 M13 15 H27"
				stroke="rgb(120 80 20 / 0.45)"
				stroke-width="1"
				fill="none"
			/>
		</svg>
	);
}

/** Wide concentric arcs at the far edge, a quiet guilloche that makes the face read as printed. */
function CardPattern() {
	return () => (
		<svg
			viewBox="0 0 160 100"
			preserveAspectRatio="xMaxYMid slice"
			aria-hidden="true"
			mix={raw({
				position: "absolute",
				inset: "0",
				inlineSize: "100%",
				blockSize: "100%",
				opacity: "0.16",
				pointerEvents: "none",
			})}
		>
			{[18, 30, 42, 54, 66, 78, 90].map((radius) => (
				<circle cx="150" cy="18" r={radius} fill="none" stroke="currentColor" stroke-width="0.6" />
			))}
		</svg>
	);
}
