/**
 * Live example for a `TestimonialBand` that leads with one featured quote carrying a hard
 * number, then runs the other quotes in a snapping carousel, each linking its story.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TestimonialBand } from "@sdxc/ui/patterns";

import { Wordmark } from "~/resources/components/demo-media";

/** The carousel's quotes, as speaker, role, initials and quote. */
const QUOTES = [
	[
		"Ben Okafor",
		"SRE, Voltage",
		"BO",
		"Two regions have to agree before anyone is paged. That alone fixed our nights.",
	],
	[
		"Cai Lindqvist",
		"CTO, Layerline",
		"CL",
		"The status page loads while our app is down, which is the whole point.",
	],
	[
		"Dee Marsh",
		"Support lead, Fernway",
		"DM",
		"Support reads incidents without touching the alerting.",
	],
	[
		"Eli Park",
		"Platform, Quadrant",
		"EP",
		"Cron heartbeats caught a backup job that had been silent for a week.",
	],
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<TestimonialBand
	title="Teams that sleep through the night"
	layout="carousel"
	featured={
		<TestimonialBand.Quote
			variant="featured"
			logo={<img src={northwind} alt="Northwind" />}
			name="Ana Ruiz"
			jobTitle="VP Engineering, Northwind"
			href="/customers/northwind"
		>
			Alert noise fell <strong>by 83% in the first month</strong>, and nobody has been paged for a false positive since.
		</TestimonialBand.Quote>
	}
>
	<TestimonialBand.Quote name="Ben Okafor" jobTitle="SRE, Voltage" avatar="BO" href="/customers/voltage">…</TestimonialBand.Quote>
	…
</TestimonialBand>`;

/** What the preview registry reads: the title, the source to show, and the band to draw. */
export default {
	title: "Featured quote and carousel",
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<TestimonialBand
			title="Teams that sleep through the night"
			layout="carousel"
			featured={
				<TestimonialBand.Quote
					variant="featured"
					logo={<Wordmark name="Northwind" glyph="ring" />}
					name="Ana Ruiz"
					jobTitle="VP Engineering, Northwind"
					avatar="AR"
					href="#northwind"
				>
					Alert noise fell <strong>by 83% in the first month</strong>, and nobody has been paged for
					a false positive since.
				</TestimonialBand.Quote>
			}
		>
			{QUOTES.map(([name, jobTitle, initials, quote]) => (
				<TestimonialBand.Quote
					key={name}
					name={name}
					jobTitle={jobTitle}
					avatar={initials}
					href="#story"
				>
					{quote}
				</TestimonialBand.Quote>
			))}
		</TestimonialBand>
	),
};
