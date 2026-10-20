/**
 * Contained scroll-snap carousel for the `/browser-flows` examples section. The
 * viewport owns horizontal overflow so long monospace lines never widen the page;
 * each slide fills the viewport so Previous/Next (which page by `clientWidth`)
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { dark } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, minIs, p } from "@sdxc/u/size";
import { font, fontSize, leading, weight, whiteSpace } from "@sdxc/u/typography";
import { Carousel, Heading, HeadingScope } from "@sdxc/ui";
import { carouselControls } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** One example slide — plain strings so the island stays `SerializableProps`. */
type ExampleSlide = {
	key: string;
	title: string;
	description: string;
	source: string;
};

type BrowserFlowExamplesCarouselProps = {
	/** Accessible name for the carousel region. */
	label: string;
	previousLabel: string;
	nextLabel: string;
	examples: ExampleSlide[];
};

/** Stable viewport id Previous/Next target through `commandfor`. */
const VIEWPORT_ID = "browser-flow-examples";

/**
 * Renders the three click-through examples as snapped slides inside a viewport
 * whose inline overflow is the only horizontal scroll on the page.
 */
export const BrowserFlowExamplesCarousel = clientEntry(
	import.meta.url,
	function BrowserFlowExamplesCarousel(handle: Handle<BrowserFlowExamplesCarouselProps>) {
		return () => {
			let { label, previousLabel, nextLabel, examples } = handle.props;

			return (
				<Carousel
					aria-label={label}
					mix={[is("full"), minIs(0)]}
					style={{
						"--ui-carousel-slide-size": "100%",
						"--ui-carousel-gap": "0px",
						"--ui-carousel-padding": "0px",
					}}
				>
					<Carousel.Viewport id={VIEWPORT_ID} mix={[carouselControls(), minIs(0)]}>
						<Carousel.Track>
							{examples.map((example) => (
								<Carousel.Slide
									key={example.key}
									data-carousel-slide
									aria-label={example.title}
									mix={[
										minIs(0),
										raw({ maxInlineSize: "var(--ui-carousel-slide-size)" }),
										overflow("hidden"),
									]}
								>
									<article mix={[vstack({ gap: 4 }), bs("full")]}>
										<div mix={[vstack({ gap: 2 })]}>
											<HeadingScope level={3}>
												<Heading mix={[m(0), fontSize("lg"), weight(600)]}>{example.title}</Heading>
											</HeadingScope>
											<p mix={[m(0), fontSize("sm"), leading("relaxed"), fg("neutral")]}>
												{example.description}
											</p>
										</div>
										<pre
											mix={[
												m(0),
												p(5),
												rounded("xl"),
												bg("color.neutral.900"),
												dark(bg("color.neutral.950")),
												fg("color.neutral.100"),
												font("mono"),
												fontSize("xs"),
												leading("relaxed"),
												whiteSpace("pre"),
												overflow("auto"),
												is("full"),
												maxIs("full"),
											]}
										>
											<code>{example.source}</code>
										</pre>
									</article>
								</Carousel.Slide>
							))}
						</Carousel.Track>
					</Carousel.Viewport>
					<Carousel.Controls>
						<Carousel.Previous commandfor={VIEWPORT_ID} aria-label={previousLabel} />
						<Carousel.Next commandfor={VIEWPORT_ID} aria-label={nextLabel} />
					</Carousel.Controls>
				</Carousel>
			);
		};
	},
);

export default BrowserFlowExamplesCarousel;
