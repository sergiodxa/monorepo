/**
 * Live preview for `LandingHero`: the default band — a linked quiet eyebrow, display title,
 * lead, actions, a note, a proof row and a staged status board below — then the
 * product-led layout with the board beside the copy over slowly turning rings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { is } from "@sdxc/u/size";
import { Button, HeadingScope, LinkButton, LogoCloud } from "@sdxc/ui";
import { LandingHero, ProductFrame } from "@sdxc/ui/patterns";
import { marketingCtaChrome, marketingSlowSpin } from "@sdxc/ui/styles";

import { StatusBoard, Wordmark, WORDMARKS } from "~/resources/components/demo-media";

/** Radii of the rings the product-led hero turns behind its media, in a 100-unit box. */
const RINGS = [20, 30, 40, 49] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<LandingHero
	eyebrow="Status pages are here"
	eyebrowHref="/examples/changelog/status-pages"
	title="Know it is down before your users do"
	description={
		<>
			Checks from six regions, alerts that only fire when <strong>two regions agree</strong>,
			and a status page your customers trust.
		</>
	}
	actions={
		<>
			<Button color="brand" mix={[marketingCtaChrome()]}>Start free</Button>
			<LinkButton href="/examples/pricing" variant="surface" mix={[marketingCtaChrome()]}>
				See pricing
			</LinkButton>
		</>
	}
	note="Five monitors free, no card required."
	proof={<LogoCloud muted>{marks}</LogoCloud>}
	media={
		<ProductFrame stage="panel" lights title="Status" url="status.example.com">
			<StatusBoard />
		</ProductFrame>
	}
/>

<LandingHero
	mediaPlacement="end"
	tone="plain"
	eyebrow="New"
	eyebrowVariant="pill"
	title="Every outage, explained in one page"
	description="…"
	actions={…}
	backdrop={<svg mix={[marketingSlowSpin()]}>{rings}</svg>}
	media={…}
/>`;

/**
 * Concentric hairline rings for the product-led hero's backdrop; the hero hides them from
 * assistive technology and `marketingSlowSpin()` stops their turn under reduced motion.
 *
 * @param _handle Runtime handle; the rings take no props.
 * @returns The render function producing the rings.
 */
function Rings(_handle: Handle<Record<string, never>>) {
	return () => (
		<svg
			viewBox="0 0 100 100"
			fill="none"
			stroke="currentColor"
			stroke-width="0.15"
			mix={[is("full"), fg("neutral.muted"), marketingSlowSpin()]}
		>
			{RINGS.map((radius) => (
				<circle key={radius} cx="50" cy="50" r={radius} stroke-dasharray="0.6 1.2" />
			))}
		</svg>
	);
}

/** What the preview registry reads: the source to show, and the heroes to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<LandingHero
				eyebrow="Status pages are here"
				eyebrowHref="/examples/changelog/status-pages"
				title="Know it is down before your users do"
				description={
					<>
						Checks from six regions, alerts that only fire when <strong>two regions agree</strong>,
						and a status page your customers trust.
					</>
				}
				actions={
					<>
						<Button color="brand" mix={[marketingCtaChrome()]}>
							Start free
						</Button>
						<LinkButton href="/examples/pricing" variant="surface" mix={[marketingCtaChrome()]}>
							See pricing
						</LinkButton>
					</>
				}
				note="Five monitors free, no card required."
				proof={
					<LogoCloud muted>
						{WORDMARKS.slice(0, 4).map((mark) => (
							<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
						))}
					</LogoCloud>
				}
				media={
					<ProductFrame stage="panel" lights title="Status" url="status.example.com">
						<StatusBoard />
					</ProductFrame>
				}
			/>
			<LandingHero
				mediaPlacement="end"
				tone="plain"
				eyebrow="New"
				eyebrowVariant="pill"
				title="Every outage, explained in one page"
				description={
					<>
						Incidents post themselves from the monitors that caught them, so customers read{" "}
						<strong>what broke and when it is fixed</strong> without opening a ticket.
					</>
				}
				actions={
					<>
						<Button color="brand" mix={[marketingCtaChrome()]}>
							Publish a status page
						</Button>
						<LinkButton href="/examples/status" variant="surface" mix={[marketingCtaChrome()]}>
							See a live one
						</LinkButton>
					</>
				}
				backdrop={<Rings />}
				media={
					<ProductFrame stage="panel" lights title="Status" url="status.example.com">
						<StatusBoard />
					</ProductFrame>
				}
			/>
		</HeadingScope>
	),
};
