/**
 * Live demo for `carouselSync()`: a carousel rendered on the server, with no island around its
 * viewport, whose arrows, dots and counter come alive once the hidden `CarouselSync` host loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Carousel, CarouselSync } from "@sdxc/ui";

/** The three rooms the carousel pages through, each drawn as a flat colour. */
const ROOMS = [
	{ id: "lounge", title: "Lounge", color: "oklch(0.78 0.08 60)" },
	{ id: "kitchen", title: "Kitchen", color: "oklch(0.76 0.07 150)" },
	{ id: "bedroom", title: "Bedroom", color: "oklch(0.74 0.07 260)" },
];

/** The source the page shows, matching the markup below apart from the slide art. */
const CODE = `<Carousel aria-label="Rooms" style={{ "--ui-carousel-slide-size": "100%" }}>
	<Carousel.Viewport id="rooms">
		<Carousel.Track>
			{rooms.map((room) => (
				<Carousel.Slide data-carousel-slide aria-label={room.title}>…</Carousel.Slide>
			))}
		</Carousel.Track>
	</Carousel.Viewport>
	<Carousel.Controls>
		<Carousel.Previous commandfor="rooms" aria-label="Previous room" />
		<Carousel.Next commandfor="rooms" aria-label="Next room" />
	</Carousel.Controls>
	{/* One hidden host runs the whole carousel with carouselSync(). */}
	<CarouselSync />
</Carousel>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<Carousel
			aria-label="Rooms"
			mix={[raw({ inlineSize: "100%", maxInlineSize: "28rem", marginInline: "auto" })]}
			style={{ "--ui-carousel-slide-size": "100%", "--ui-carousel-gap": "0px" }}
		>
			<Carousel.Viewport id="preview-carousel-sync">
				<Carousel.Track>
					{ROOMS.map((room) => (
						<Carousel.Slide data-carousel-slide aria-label={room.title}>
							<div
								mix={[
									raw({
										display: "grid",
										placeItems: "end start",
										blockSize: "9rem",
										padding: "0.75rem",
										borderRadius: "0.75rem",
										backgroundColor: room.color,
										color: "oklch(0.25 0.02 260)",
										fontWeight: "600",
									}),
								]}
							>
								{room.title}
							</div>
						</Carousel.Slide>
					))}
				</Carousel.Track>
			</Carousel.Viewport>
			<Carousel.Controls mix={[raw({ justifyContent: "space-between" })]}>
				<Carousel.Previous commandfor="preview-carousel-sync" aria-label="Previous room" />
				<Carousel.Next commandfor="preview-carousel-sync" aria-label="Next room" />
			</Carousel.Controls>
			<CarouselSync />
		</Carousel>
	),
};
