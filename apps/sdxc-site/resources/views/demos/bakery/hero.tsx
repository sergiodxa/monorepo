/**
 * Hollyhock's first viewport: the door sign as the eyebrow, read from the bakery's own clock
 * at the moment the page was asked for, the promise of warm bread, the pickup call, and the
 * shop front drawn on a gingham cloth with its door sign turned the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { LinkButton } from "@sdxc/ui";
import { AccentText, LandingHero } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { Status } from "~/resources/views/demos/bakery/hours";

import { gingham, Storefront } from "~/resources/views/demos/bakery/art";
import { formatOpening, openingStatus } from "~/resources/views/demos/bakery/hours";

/** The dot and chip colours for each state of the door sign. */
const SIGN_COLOURS: Record<Status["state"], { dot: string; tint: string; darkTint: string }> = {
	open: {
		dot: "oklch(0.62 0.14 150)",
		tint: "oklch(0.94 0.05 150)",
		darkTint: "oklch(0.32 0.06 150)",
	},
	"closing-soon": {
		dot: "oklch(0.72 0.15 75)",
		tint: "oklch(0.95 0.06 85)",
		darkTint: "oklch(0.34 0.06 75)",
	},
	closed: {
		dot: "oklch(0.58 0.16 20)",
		tint: "oklch(0.94 0.03 30)",
		darkTint: "oklch(0.32 0.05 25)",
	},
};

/**
 * The sign on the door as a chip: a coloured dot, the state in bold and the rest of the
 * sentence. It is rendered on the server from the bakery's clock, so it is right with no
 * script and in the bakery's time zone wherever the reader is.
 *
 * @param handle Runtime handle carrying the status to show.
 * @returns The render function producing the chip.
 */
export function OpenSign(handle: Handle<{ status: Status }>) {
	return () => {
		let { status } = handle.props;
		let colours = SIGN_COLOURS[status.state];
		return (
			<span
				data-slot="open-sign"
				data-state={status.state}
				mix={[
					raw({
						display: "inline-flex",
						alignItems: "center",
						flexWrap: "wrap",
						gap: "0.25rem 0.5rem",
						paddingBlock: "0.375rem",
						paddingInline: "0.75rem",
						borderRadius: "0.75rem",
						backgroundColor: colours.tint,
						color: "var(--ui-neutral-fg-emphasis)",
						fontSize: "0.9375rem",
						fontWeight: "500",
						lineHeight: "1.3",
					}),
					dark(raw({ backgroundColor: colours.darkTint })),
				]}
			>
				<span
					aria-hidden="true"
					mix={[
						raw({
							inlineSize: "0.625rem",
							blockSize: "0.625rem",
							borderRadius: "9999px",
							backgroundColor: colours.dot,
							boxShadow: `0 0 0 3px color-mix(in oklch, ${colours.dot} 25%, transparent)`,
						}),
					]}
				/>
				<strong mix={[raw({ fontWeight: "800" })]}>{status.label}</strong>
				<span aria-hidden="true">·</span>
				<span>{status.detail}</span>
			</span>
		);
	};
}

/**
 * The hero band: the door sign, the promise, the lead, the two calls and a line on getting
 * in, beside the shop front on its gingham cloth.
 *
 * @param handle Runtime handle carrying the instant the page was asked for.
 * @returns The render function producing the hero.
 */
export function Hero(handle: Handle<{ now: Date }>) {
	return () => {
		let status = openingStatus(handle.props.now);
		let today = status.today.opening;
		let chalk = today ? formatOpening(today) : "Closed today";
		let doorOpen = status.state !== "closed";

		return (
			<LandingHero
				id="top"
				tone="plain"
				mediaPlacement="end"
				entrance
				eyebrow={<OpenSign status={status} />}
				eyebrowVariant="mono"
				title={
					<>
						Warm bread on Alder Street, <AccentText variant="swash">out by seven</AccentText>
					</>
				}
				description={
					<>
						Hollyhock is the corner bakery by Linden Park. We bake sourdough, buns and pies through
						the night and sell them warm until they run out,{" "}
						<strong>usually by mid-afternoon</strong>.
					</>
				}
				actions={
					<>
						<LinkButton href="#order" color="brand" mix={[landingCtaChrome()]}>
							Order for pickup
						</LinkButton>
						<LinkButton href="#today" variant="surface" mix={[landingCtaChrome()]}>
							See today's bake
						</LinkButton>
					</>
				}
				note="Step-free front door · Six parking spaces out back · Dogs welcome on the porch"
				media={
					<div
						mix={[
							gingham("var(--ui-color-brand-500)", "1.5rem"),
							raw({
								padding: "clamp(1rem, 4cqi, 2.5rem)",
								borderRadius: "var(--ui-landing-radius-frame)",
								backgroundColor: "var(--ui-color-brand-50)",
								boxShadow:
									"inset 0 0 0 2px color-mix(in oklch, var(--ui-color-brand-500) 30%, transparent)",
							}),
							dark(raw({ backgroundColor: "var(--ui-color-brand-950)" })),
						]}
					>
						<Storefront open={doorOpen} chalk={chalk} />
					</div>
				}
			/>
		);
	};
}
