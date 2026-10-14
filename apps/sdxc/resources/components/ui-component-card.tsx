/**
 * One tile in the `@sdxc/ui` component explorer: a live frame of the pattern above its
 * name and a short line of what it is, so a reader scans faces the way they would scan a
 * gallery. The frame mounts only once the tile nears the viewport, so a long grid does
 * not open every preview at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { listStyle, pointerEvents, raw } from "@sdxc/u/general";
import { relative, vstack } from "@sdxc/u/layout";
import { clip, overflow } from "@sdxc/u/overflow";
import { bs, m, minBs, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, leading, lineClamp, overflowWrap, text, weight } from "@sdxc/u/typography";
import { Frame, clientEntry, ref } from "remix/component";

/**
 * How far ahead of the viewport a tile may sit before its frame mounts. Prefetching a
 * band keeps scrolling smooth without opening the whole catalogue at once.
 */
const PREFETCH_MARGIN = "160px 0px";

/** Fixed block size of the preview plane, so every tile shares one rhythm. */
const PREVIEW_HEIGHT = "10rem";

/**
 * Soft wash behind the live frame. Reads as a gallery plane rather than a blank cell,
 * and stays on the page's own tokens so theming still lands.
 */
const PREVIEW_WASH = {
	backgroundImage: [
		"radial-gradient(120% 90% at 0% 0%, color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent), transparent 55%)",
		"radial-gradient(90% 80% at 100% 100%, color-mix(in oklch, var(--ui-neutral-border) 55%, transparent), transparent 60%)",
		"linear-gradient(160deg, var(--ui-neutral-bg-tint), color-mix(in oklch, var(--ui-brand-bg-tint) 55%, var(--ui-neutral-bg-tint)))",
	].join(", "),
};

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type UiComponentCardProps = {
	href: string;
	name: string;
	description?: string;
	/** Frame URL for the component's live preview, when one exists. */
	previewSrc?: string;
};

/** Renders one linked explorer tile, mounting its live frame when it nears the viewport. */
export const UiComponentCard = clientEntry(
	import.meta.url,
	function UiComponentCard(handle: Handle<UiComponentCardProps>) {
		/** Whether the tile has entered the prefetch band and may mount its frame. */
		let revealed = false;

		let watch = ref((node, signal) => {
			if (!handle.props.previewSrc) return;

			let observer = new IntersectionObserver(
				(entries) => {
					if (!entries.some((entry) => entry.isIntersecting)) return;
					revealed = true;
					void handle.update();
					observer.disconnect();
				},
				{ rootMargin: PREFETCH_MARGIN },
			);

			observer.observe(node);
			signal.addEventListener("abort", () => observer.disconnect(), { once: true });
		});

		return () => {
			let { description, href, name, previewSrc } = handle.props;

			return (
				<li mix={[minIs(0), listStyle("none"), m(0)]}>
					<a
						href={href}
						mix={[
							vstack({ gap: 0, align: "stretch" }),
							minIs(0),
							bs("100%"),
							overflow("hidden"),
							rounded("xl"),
							border({ color: "neutral.border", width: 1, style: "solid" }),
							bg(),
							transition("border-color, background-color, box-shadow"),
							when("&:hover", [
								bg("neutral.tint"),
								border({ color: "neutral.border-strong", width: 1, style: "solid" }),
							]),
							when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						]}
					>
						<div
							aria-hidden="true"
							mix={[
								watch,
								relative(),
								clip(),
								minBs(PREVIEW_HEIGHT),
								bs(PREVIEW_HEIGHT),
								overflow("hidden"),
								bg("neutral.tint"),
								border({ color: "neutral.border", width: 0, style: "solid" }),
								raw({
									borderBlockEndWidth: "1px",
									...PREVIEW_WASH,
								}),
							]}
						>
							{revealed && previewSrc ? (
								<div mix={[bs("100%"), minIs(0), pointerEvents(), raw({ zoom: 0.92 })]}>
									<Frame src={previewSrc} />
								</div>
							) : null}
						</div>

						<div mix={[vstack({ gap: 1, align: "stretch" }), p(4), minIs(0), bg()]}>
							<code
								mix={[
									font("mono"),
									text("sm"),
									weight("semibold"),
									fg("neutral.emphasis"),
									overflowWrap("anywhere"),
								]}
							>
								{name}
							</code>
							{description ? (
								<span mix={[text("sm"), leading("relaxed"), fg("neutral"), lineClamp(2)]}>
									{description}
								</span>
							) : null}
						</div>
					</a>
				</li>
			);
		};
	},
);

export default UiComponentCard;
