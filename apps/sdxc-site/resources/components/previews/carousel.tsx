/**
 * Live preview island for `Carousel`. The component draws the scroll-snapping track and
 * the invoker buttons, and the track already scrolls and snaps by touch or trackpad with
 * no script. The commands those buttons dispatch need an answer, so the preview carries
 * the same `carouselControls()` wiring a reader would write on the viewport: it pages by a
 * slide, disables whichever button sits at an edge, and jumps to the slide a `--ui-goto`
 * button names through `data-slide`, matched against the `data-carousel-slide` markers.
 *
 * One slide fills the viewport and the track carries no gap, so paging by a viewport width
 * lands exactly on the next slide's snap point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { hstack, justify, vstack } from "@sdxc/u/layout";
import { bs, fit, is, m, maxIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Carousel } from "@sdxc/ui";
import { carouselControls } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** One screenshot in the tour: its poster, its heading and the line under it. */
const SLIDES = [
	{ id: "inbox", title: "Shared inbox", caption: "Every reply in one thread", hue: "%236366f1" },
	{
		id: "macros",
		title: "Macros",
		caption: "Answer the top twenty in a keystroke",
		hue: "%2306b6d4",
	},
	{ id: "sla", title: "SLA timers", caption: "See what is about to breach", hue: "%2316a34a" },
	{ id: "reports", title: "Reports", caption: "Volume, first response, backlog", hue: "%23f97316" },
	{
		id: "handoff",
		title: "Handoff",
		caption: "Move a case without losing context",
		hue: "%23db2777",
	},
];

/** A slide's poster, drawn as a data URI so a gallery demo fetches nothing. */
function poster(hue: string): string {
	return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='${hue}'/%3E%3Crect x='1' y='1.4' width='6' height='0.8' rx='0.4' fill='%23ffffff' fill-opacity='0.7'/%3E%3Crect x='1' y='3' width='14' height='5' rx='0.5' fill='%23ffffff' fill-opacity='0.18'/%3E%3C/svg%3E`;
}

/** The source the page shows, matching the markup below. */
const CODE = `<Carousel
	aria-label="Product tour"
	mix={[is("100%"), maxIs("32rem")]}
	style={{ "--ui-carousel-slide-size": "100%", "--ui-carousel-gap": "0px" }}
>
	<Carousel.Viewport id="preview-tour" mix={[carouselControls()]}>
		<Carousel.Track>
			{SLIDES.map((slide) => (
				<Carousel.Slide key={slide.id} data-carousel-slide aria-label={slide.title}>
					<figure mix={[vstack({ gap: 2, align: "stretch" }), m(0)]}>
						<img
							src={poster(slide.hue)}
							alt={\`\${slide.title} screenshot\`}
							mix={[is("100%"), bs("9rem"), fit("cover"), rounded("lg")]}
						/>
						<figcaption mix={[vstack({ gap: 0, align: "start" })]}>
							<span mix={[text("sm"), weight("medium")]}>{slide.title}</span>
							<span mix={[text("xs"), fg("neutral")]}>{slide.caption}</span>
						</figcaption>
					</figure>
				</Carousel.Slide>
			))}
		</Carousel.Track>
	</Carousel.Viewport>

	<Carousel.Controls mix={[justify("between")]}>
		<Carousel.Previous commandfor="preview-tour" aria-label="Previous slide" />

		<div mix={[hstack({ gap: 2, align: "center" })]}>
			{SLIDES.map((slide, index) => (
				<button
					key={slide.id}
					type="button"
					commandfor="preview-tour"
					command="--ui-goto"
					data-slide={String(index)}
					aria-label={\`Go to \${slide.title}\`}
					mix={[
						is("0.5rem"),
						bs("0.5rem"),
						m(0),
						rounded("full"),
						border({ width: 0 }),
						cursor("pointer"),
						// carouselControls() marks the dot naming the slide in view.
						when("&:not([aria-current])", bg("neutral.border-hover")),
						when("&[aria-current]", bg("neutral.solid")),
					]}
				/>
			))}
		</div>

		<Carousel.Next commandfor="preview-tour" aria-label="Next slide" />
	</Carousel.Controls>
</Carousel>`;

/** A five-slide product tour with paging and jump-to buttons, hydrated so both reach the track. */
export const CarouselPreview = clientEntry(import.meta.url, function CarouselPreview() {
	return () => (
		<Carousel
			aria-label="Product tour"
			mix={[is("100%"), maxIs("32rem")]}
			style={{ "--ui-carousel-slide-size": "100%", "--ui-carousel-gap": "0px" }}
		>
			<Carousel.Viewport id="preview-tour" mix={[carouselControls()]}>
				<Carousel.Track>
					{SLIDES.map((slide) => (
						<Carousel.Slide key={slide.id} data-carousel-slide aria-label={slide.title}>
							<figure mix={[vstack({ gap: 2, align: "stretch" }), m(0)]}>
								<img
									src={poster(slide.hue)}
									alt={`${slide.title} screenshot`}
									mix={[is("100%"), bs("9rem"), fit("cover"), rounded("lg")]}
								/>
								<figcaption mix={[vstack({ gap: 0, align: "start" })]}>
									<span mix={[text("sm"), weight("medium")]}>{slide.title}</span>
									<span mix={[text("xs"), fg("neutral")]}>{slide.caption}</span>
								</figcaption>
							</figure>
						</Carousel.Slide>
					))}
				</Carousel.Track>
			</Carousel.Viewport>

			<Carousel.Controls mix={[justify("between")]}>
				<Carousel.Previous commandfor="preview-tour" aria-label="Previous slide" />

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					{SLIDES.map((slide, index) => (
						<button
							key={slide.id}
							type="button"
							commandfor="preview-tour"
							command="--ui-goto"
							data-slide={String(index)}
							aria-label={`Go to ${slide.title}`}
							mix={[
								is("0.5rem"),
								bs("0.5rem"),
								m(0),
								rounded("full"),
								border({ width: 0 }),
								cursor("pointer"),
								transition("background-color", { duration: 150 }),
								/*
								 * `carouselControls()` marks the dot naming the slide in view, so the row
								 * reads as a position. The two states exclude each other, since a plain
								 * resting color beside a state rule can win its cascade layer and leave
								 * every dot looking the same.
								 */
								when("&:not([aria-current])", bg("neutral.border-hover")),
								when("&[aria-current]", bg("neutral.solid")),
							]}
						/>
					))}
				</div>

				<Carousel.Next commandfor="preview-tour" aria-label="Next slide" />
			</Carousel.Controls>
		</Carousel>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <CarouselPreview /> };
