/**
 * Bocado's food art: one flat, original illustration per kind of dish, drawn in SVG with a
 * soft shadow under it like a sticker on a tray, plus the patterned backdrop a restaurant's
 * hero and card sit on. Every picture in the app comes from here, so no photo is ever needed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { Dish, Restaurant } from "./data";

/** Colours the art shares, so every dish reads as one set. */
const INK = "oklch(0.3 0.04 40)";

/** The shapes of one dish inside a 120 × 120 drawing. */
function dishShapes(dish: Dish): RemixNode {
	switch (dish) {
		case "taco":
			return (
				<>
					<path d="M18 78a42 42 0 0 1 84 0Z" fill="oklch(0.86 0.12 85)" />
					<path
						d="M26 74c6-14 14-20 22-18s10-10 18-9 12 9 18 8 12 8 12 19Z"
						fill="oklch(0.62 0.17 145)"
					/>
					<circle cx="44" cy="62" r="6" fill="oklch(0.62 0.2 30)" />
					<circle cx="64" cy="56" r="5.5" fill="oklch(0.62 0.2 30)" />
					<circle cx="80" cy="64" r="5" fill="oklch(0.62 0.2 30)" />
					<path
						d="M38 70h14M58 66h10M74 72h12"
						stroke="oklch(0.95 0.03 95)"
						stroke-width="3.5"
						stroke-linecap="round"
					/>
					<path
						d="M18 78a42 42 0 0 1 84 0"
						fill="none"
						stroke="oklch(0.74 0.13 70)"
						stroke-width="5"
					/>
				</>
			);
		case "ramen":
			return (
				<>
					<path d="M14 58h92a46 40 0 0 1-92 0Z" fill="oklch(0.58 0.17 25)" />
					<ellipse cx="60" cy="58" rx="46" ry="12" fill="oklch(0.88 0.08 75)" />
					<path
						d="M30 58q8-8 16 0t16 0 16 0 14 0"
						fill="none"
						stroke="oklch(0.95 0.08 95)"
						stroke-width="3"
					/>
					<circle cx="46" cy="55" r="7" fill="oklch(0.97 0.01 90)" />
					<circle cx="46" cy="55" r="3.6" fill="oklch(0.8 0.16 75)" />
					<rect x="62" y="49" width="16" height="9" rx="4" fill="oklch(0.7 0.09 45)" />
					<path d="M72 34 92 8M80 36l18-24" stroke={INK} stroke-width="3" stroke-linecap="round" />
					<path d="M20 70h80" stroke="oklch(0.5 0.15 25)" stroke-width="2" stroke-dasharray="4 5" />
				</>
			);
		case "pizza":
			return (
				<>
					<circle cx="60" cy="60" r="46" fill="oklch(0.78 0.12 70)" />
					<circle cx="60" cy="60" r="38" fill="oklch(0.6 0.19 32)" />
					<circle cx="46" cy="46" r="8" fill="oklch(0.96 0.03 95)" />
					<circle cx="74" cy="52" r="7" fill="oklch(0.96 0.03 95)" />
					<circle cx="56" cy="76" r="8" fill="oklch(0.96 0.03 95)" />
					<circle cx="78" cy="74" r="5" fill="oklch(0.45 0.16 25)" />
					<circle cx="40" cy="66" r="5" fill="oklch(0.45 0.16 25)" />
					<path
						d="M62 40c4-4 8-4 10 0-4 2-7 2-10 0ZM44 60c4-4 8-4 10 0-4 2-7 2-10 0Z"
						fill="oklch(0.6 0.16 145)"
					/>
					<path
						d="M60 14v92M14 60h92M28 28l64 64M92 28l-64 64"
						stroke="oklch(0.7 0.12 60)"
						stroke-width="1.4"
						opacity="0.6"
					/>
				</>
			);
		case "burger":
			return (
				<>
					<path d="M22 52a38 26 0 0 1 76 0Z" fill="oklch(0.74 0.14 65)" />
					<circle cx="46" cy="38" r="1.8" fill="oklch(0.96 0.03 90)" />
					<circle cx="60" cy="33" r="1.8" fill="oklch(0.96 0.03 90)" />
					<circle cx="74" cy="39" r="1.8" fill="oklch(0.96 0.03 90)" />
					<path
						d="M18 56q10 8 20 0t21 0 21 0 22 0"
						fill="none"
						stroke="oklch(0.65 0.18 140)"
						stroke-width="6"
						stroke-linecap="round"
					/>
					<path d="M22 60h76l-6 8H28Z" fill="oklch(0.86 0.15 90)" />
					<rect x="20" y="66" width="80" height="12" rx="6" fill="oklch(0.38 0.07 40)" />
					<rect x="24" y="80" width="72" height="14" rx="7" fill="oklch(0.74 0.14 65)" />
				</>
			);
		case "bowl":
			return (
				<>
					<path d="M14 54h92a46 44 0 0 1-92 0Z" fill="oklch(0.95 0.02 95)" />
					<ellipse cx="60" cy="54" rx="46" ry="14" fill="oklch(0.82 0.06 90)" />
					<path d="M28 54q10-14 24-6" fill="oklch(0.62 0.15 145)" />
					<path d="M30 52c4-9 14-12 20-6-6 6-14 8-20 6Z" fill="oklch(0.6 0.15 150)" />
					<circle cx="62" cy="48" r="7" fill="oklch(0.75 0.15 60)" />
					<circle cx="80" cy="52" r="6" fill="oklch(0.62 0.2 25)" />
					<path
						d="M70 58c6-3 14-3 20 0"
						stroke="oklch(0.52 0.14 330)"
						stroke-width="4"
						stroke-linecap="round"
					/>
					<path
						d="M44 58h12"
						stroke="oklch(0.85 0.12 95)"
						stroke-width="5"
						stroke-linecap="round"
					/>
					<path d="M18 66h84" stroke="oklch(0.85 0.03 90)" stroke-width="2" />
				</>
			);
		case "dumpling":
			return (
				<>
					<ellipse cx="60" cy="78" rx="46" ry="14" fill="oklch(0.62 0.1 70)" />
					<ellipse cx="60" cy="76" rx="40" ry="10" fill="oklch(0.74 0.09 75)" />
					<path d="M24 72c0-18 12-28 22-28s20 10 20 28Z" fill="oklch(0.96 0.02 90)" />
					<path d="M54 72c0-20 14-32 26-32s22 12 22 32Z" fill="oklch(0.97 0.02 90)" />
					<path
						d="M34 50l4 6M42 46v7M50 50l-4 6M70 44l4 7M80 41v8M90 45l-4 7"
						stroke="oklch(0.82 0.04 80)"
						stroke-width="2.4"
						stroke-linecap="round"
					/>
					<path
						d="M34 30q4-6 0-12M60 26q4-6 0-12M84 28q4-6 0-12"
						stroke="oklch(0.85 0.01 90)"
						stroke-width="2.4"
						fill="none"
						stroke-linecap="round"
					/>
				</>
			);
		case "arepa":
			return (
				<>
					<ellipse cx="60" cy="72" rx="40" ry="20" fill="oklch(0.84 0.12 85)" />
					<path d="M24 64q18-14 36-6t36 6" fill="oklch(0.6 0.15 145)" />
					<path
						d="M26 66c10-6 24-6 34 0s24 6 34 0"
						stroke="oklch(0.95 0.03 95)"
						stroke-width="7"
						stroke-linecap="round"
						fill="none"
					/>
					<ellipse cx="60" cy="52" rx="38" ry="18" fill="oklch(0.86 0.12 88)" />
					<circle cx="44" cy="48" r="2.5" fill="oklch(0.7 0.13 60)" />
					<circle cx="66" cy="44" r="2.5" fill="oklch(0.7 0.13 60)" />
					<circle cx="78" cy="54" r="2.5" fill="oklch(0.7 0.13 60)" />
					<circle cx="54" cy="58" r="2.5" fill="oklch(0.7 0.13 60)" />
				</>
			);
		case "curry":
			return (
				<>
					<ellipse cx="60" cy="64" rx="48" ry="34" fill="oklch(0.55 0.08 60)" />
					<ellipse cx="60" cy="60" rx="42" ry="28" fill="oklch(0.65 0.17 50)" />
					<path
						d="M30 58q8-6 16 0t16 0 16 0 14 0"
						fill="none"
						stroke="oklch(0.9 0.05 80)"
						stroke-width="3"
					/>
					<rect x="38" y="50" width="12" height="10" rx="3" fill="oklch(0.85 0.06 70)" />
					<rect x="64" y="58" width="13" height="10" rx="3" fill="oklch(0.85 0.06 70)" />
					<path
						d="M52 44c3-4 7-4 9 0-3 2-6 2-9 0ZM78 48c3-4 7-4 9 0-3 2-6 2-9 0Z"
						fill="oklch(0.6 0.16 145)"
					/>
					<path
						d="M84 22c10 0 14 8 10 14"
						stroke="oklch(0.9 0.02 90)"
						stroke-width="3"
						fill="none"
						stroke-linecap="round"
					/>
				</>
			);
		case "pastry":
			return (
				<>
					<path
						d="M16 70c6-24 20-34 44-34s38 10 44 34c-14 10-30 14-44 14s-30-4-44-14Z"
						fill="oklch(0.74 0.14 65)"
					/>
					<path
						d="M34 48c4 10 4 22 0 32M50 40c4 12 4 30 0 44M70 40c-4 12-4 30 0 44M86 48c-4 10-4 22 0 32"
						stroke="oklch(0.6 0.13 55)"
						stroke-width="3"
						fill="none"
						stroke-linecap="round"
					/>
					<path
						d="M24 62c10-14 22-20 36-20"
						stroke="oklch(0.86 0.1 80)"
						stroke-width="3"
						fill="none"
						stroke-linecap="round"
					/>
				</>
			);
		case "icecream":
			return (
				<>
					<path d="M42 62h36L60 108Z" fill="oklch(0.78 0.12 70)" />
					<path
						d="M46 70l26 10M44 82l20 8M74 70 50 82"
						stroke="oklch(0.65 0.12 60)"
						stroke-width="2"
					/>
					<circle cx="48" cy="54" r="15" fill="oklch(0.82 0.1 350)" />
					<circle cx="72" cy="54" r="15" fill="oklch(0.9 0.08 95)" />
					<circle cx="60" cy="36" r="16" fill="oklch(0.55 0.1 40)" />
					<circle cx="60" cy="18" r="5" fill="oklch(0.6 0.22 25)" />
					<path
						d="M52 32h4M64 38h4M58 42h3"
						stroke="oklch(0.92 0.08 95)"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
				</>
			);
		case "chicken":
			return (
				<>
					<ellipse cx="60" cy="80" rx="46" ry="14" fill="oklch(0.9 0.02 90)" />
					<path
						d="M28 74c-4-24 12-42 34-42 20 0 34 14 32 34-2 10-10 14-20 14H40c-6 0-11-2-12-6Z"
						fill="oklch(0.66 0.15 55)"
					/>
					<path
						d="M40 56c8-10 22-14 34-8"
						stroke="oklch(0.78 0.12 70)"
						stroke-width="4"
						fill="none"
						stroke-linecap="round"
					/>
					<path
						d="M86 44 102 30"
						stroke="oklch(0.92 0.03 90)"
						stroke-width="7"
						stroke-linecap="round"
					/>
					<circle cx="104" cy="28" r="5" fill="oklch(0.92 0.03 90)" />
					<path
						d="M48 70h6M62 66h6M74 70h5"
						stroke="oklch(0.45 0.12 40)"
						stroke-width="3"
						stroke-linecap="round"
					/>
				</>
			);
		case "falafel":
			return (
				<>
					<path d="M18 56a42 42 0 0 0 84 0Z" fill="oklch(0.88 0.06 85)" />
					<path d="M18 56a42 42 0 0 1 84 0" fill="oklch(0.92 0.05 88)" />
					<circle cx="40" cy="48" r="10" fill="oklch(0.5 0.1 70)" />
					<circle cx="60" cy="42" r="10" fill="oklch(0.46 0.1 75)" />
					<circle cx="80" cy="48" r="10" fill="oklch(0.5 0.1 70)" />
					<path
						d="M30 60c10-4 50-4 60 0"
						stroke="oklch(0.62 0.15 145)"
						stroke-width="6"
						stroke-linecap="round"
					/>
					<path
						d="M34 66c10 3 42 3 52 0"
						stroke="oklch(0.62 0.18 350)"
						stroke-width="4"
						stroke-linecap="round"
					/>
				</>
			);
		case "drink":
			return (
				<>
					<path d="M38 30h44l-6 74H44Z" fill="oklch(0.9 0.03 220)" opacity="0.9" />
					<path d="M41 48h38l-4 54H45Z" fill="oklch(0.66 0.18 0)" />
					<rect
						x="48"
						y="56"
						width="10"
						height="10"
						rx="2"
						fill="oklch(0.96 0.02 220)"
						opacity="0.8"
					/>
					<rect
						x="62"
						y="66"
						width="10"
						height="10"
						rx="2"
						fill="oklch(0.96 0.02 220)"
						opacity="0.8"
					/>
					<path
						d="M66 30 76 8"
						stroke="oklch(0.92 0.02 90)"
						stroke-width="4"
						stroke-linecap="round"
					/>
					<circle cx="84" cy="34" r="9" fill="oklch(0.78 0.18 130)" />
					<circle cx="84" cy="34" r="5" fill="oklch(0.88 0.14 130)" />
				</>
			);
		case "fries":
			return (
				<>
					<path
						d="M44 38 40 70M54 30l-2 40M64 28v42M74 32l2 38M84 40l-2 30M48 34l-6 36M70 26l2 44"
						stroke="oklch(0.86 0.15 90)"
						stroke-width="7"
						stroke-linecap="round"
					/>
					<path d="M32 58h56l-8 48H40Z" fill="oklch(0.6 0.2 25)" />
					<path
						d="M44 74c6 6 26 6 32 0"
						stroke="oklch(0.96 0.02 90)"
						stroke-width="4"
						fill="none"
						stroke-linecap="round"
					/>
				</>
			);
		case "coffee":
			return (
				<>
					<ellipse cx="60" cy="96" rx="40" ry="8" fill="oklch(0.92 0.02 90)" />
					<path d="M30 46h56l-6 46H36Z" fill="oklch(0.96 0.01 90)" />
					<path
						d="M86 54h6a10 10 0 0 1 0 20h-8"
						stroke="oklch(0.96 0.01 90)"
						stroke-width="6"
						fill="none"
					/>
					<ellipse cx="58" cy="46" rx="28" ry="6" fill="oklch(0.55 0.08 55)" />
					<path d="M52 46c4-4 8-4 12 0-4 2-8 2-12 0Z" fill="oklch(0.92 0.04 80)" />
					<path
						d="M48 32q4-6 0-12M62 30q4-6 0-12"
						stroke="oklch(0.85 0.01 90)"
						stroke-width="2.4"
						fill="none"
						stroke-linecap="round"
					/>
				</>
			);
		case "cake":
			return (
				<>
					<path d="M20 80 60 40l40 40Z" fill="oklch(0.94 0.04 90)" />
					<path d="M20 80h80v18H20Z" fill="oklch(0.7 0.1 55)" />
					<path d="M20 86h80" stroke="oklch(0.94 0.04 90)" stroke-width="4" />
					<path
						d="M20 80 60 40l40 40"
						fill="none"
						stroke="oklch(0.5 0.08 50)"
						stroke-width="4"
						stroke-linejoin="round"
					/>
					<circle cx="60" cy="36" r="6" fill="oklch(0.6 0.2 20)" />
				</>
			);
	}
}

namespace DishArt {
	export interface Props {
		dish: Dish;
		/** A fixed size in rem, or `fill` for the width of its box. Default: `fill`. */
		size?: number | "fill";
	}
}

/**
 * One dish, drawn as a flat sticker with a soft shadow under it. It is decoration: the dish's
 * name always sits beside it as text.
 */
export function DishArt(handle: Handle<DishArt.Props>) {
	return () => {
		let { dish, size = "fill" } = handle.props;
		let side = size === "fill" ? "100%" : `${size}rem`;
		return (
			<svg
				viewBox="0 0 120 120"
				aria-hidden="true"
				data-dish={dish}
				mix={[raw({ display: "block", inlineSize: side, blockSize: side, overflow: "visible" })]}
			>
				<ellipse cx="60" cy="108" rx="40" ry="6" fill="rgb(0 0 0 / 0.12)" />
				{dishShapes(dish)}
			</svg>
		);
	};
}

namespace Backdrop {
	export interface Props {
		restaurant: Restaurant;
		children?: RemixNode;
	}
}

/**
 * A restaurant's tinted panel with a scatter of small dots and dashes in its accent, which its
 * card and hero sit on. The pattern is drawn by gradients, so it scales to any box.
 */
export function Backdrop(handle: Handle<Backdrop.Props>) {
	return () => {
		let [ground, accent] = handle.props.restaurant.tones;
		return (
			<div
				data-backdrop=""
				mix={[
					raw({
						position: "relative",
						display: "grid",
						placeItems: "center",
						inlineSize: "100%",
						blockSize: "100%",
						overflow: "clip",
						backgroundColor: ground,
						backgroundImage: [
							`radial-gradient(circle at 20% 30%, color-mix(in oklch, ${accent} 30%, transparent) 0 3px, transparent 4px)`,
							`radial-gradient(circle at 70% 80%, color-mix(in oklch, ${accent} 24%, transparent) 0 2px, transparent 3px)`,
							`linear-gradient(135deg, transparent 46%, color-mix(in oklch, ${accent} 16%, transparent) 46% 54%, transparent 54%)`,
						].join(", "),
						backgroundSize: "44px 44px, 30px 30px, 38px 38px",
						color: "oklch(0.25 0.03 40)",
					}),
				]}
			>
				{handle.props.children}
			</div>
		);
	};
}
