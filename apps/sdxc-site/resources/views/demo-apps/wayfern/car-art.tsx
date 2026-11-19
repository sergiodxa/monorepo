/**
 * Wayfern's drawn rental cars: a side view per body shape, painted in the class's hue, so each
 * offer card shows a car without photographs of a real make. The drawings are small inline SVG,
 * one per class, and scale to any card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import type { CarClass } from "./cars";

/** The body outline of each shape, drawn on a 240 by 110 canvas facing right. */
const BODIES: Record<CarClass["body"], string> = {
	hatch:
		"M22 78 C22 62 30 56 46 54 L70 52 C82 38 98 30 118 30 L150 30 C166 30 178 40 188 52 L208 56 C218 58 222 66 222 78 Z",
	sedan:
		"M14 78 C14 64 22 58 38 56 L64 54 C78 40 96 32 120 32 L148 32 C166 32 180 42 192 54 L214 58 C224 60 228 68 228 78 Z",
	wagon:
		"M14 78 C14 62 20 56 34 54 L56 52 C64 36 80 30 104 30 L176 30 C190 30 198 40 206 54 L216 58 C224 60 228 68 228 78 Z",
	suv: "M18 80 C18 60 24 52 40 50 L58 48 C66 30 82 22 106 22 L172 22 C186 22 196 32 204 48 L214 52 C224 54 226 64 226 80 Z",
	van: "M16 80 L16 40 C16 28 26 20 40 20 L170 20 C186 20 198 30 208 48 L216 54 C224 58 226 66 226 80 Z",
};

/** The windows of each shape, as one path. */
const WINDOWS: Record<CarClass["body"], string> = {
	hatch:
		"M78 52 C88 42 100 36 116 36 L132 36 L132 52 Z M138 36 L150 36 C160 36 170 42 178 52 L138 52 Z",
	sedan:
		"M74 54 C86 44 100 38 120 38 L134 38 L134 54 Z M140 38 L148 38 C162 38 172 44 182 54 L140 54 Z",
	wagon:
		"M66 52 C74 40 86 36 104 36 L130 36 L130 52 Z M136 36 L174 36 C184 36 190 42 196 52 L136 52 Z",
	suv: "M68 48 C76 34 88 28 106 28 L132 28 L132 48 Z M138 28 L170 28 C180 28 188 34 194 48 L138 48 Z",
	van: "M26 46 L26 32 C26 28 30 26 34 26 L90 26 L90 46 Z M96 26 L166 26 C178 26 186 34 194 46 L96 46 Z",
};

/** Where the wheels sit for each shape, as x centres. */
const WHEELS: Record<CarClass["body"], [number, number]> = {
	hatch: [62, 184],
	sedan: [58, 190],
	wagon: [56, 192],
	suv: [60, 190],
	van: [56, 192],
};

/** A car class drawn from the side, in its own hue, standing on a soft shadow. */
export function CarArt(handle: Handle<{ car: CarClass }>) {
	return () => {
		let { car } = handle.props;
		let paint = `oklch(0.62 0.13 ${car.hue})`;
		let shade = `oklch(0.48 0.12 ${car.hue})`;
		let [rear, front] = WHEELS[car.body];
		return (
			<svg
				viewBox="0 0 240 110"
				role="img"
				aria-label={`${car.name} car`}
				width="100%"
				height="100%"
			>
				<ellipse cx="122" cy="96" rx="104" ry="7" fill="rgb(0 0 0 / 0.12)" />
				<path d={BODIES[car.body]} fill={paint} />
				<path d={BODIES[car.body]} fill="none" stroke={shade} stroke-width="2" />
				<path d={WINDOWS[car.body]} fill="oklch(0.86 0.03 230)" />
				<rect x="20" y="72" width="204" height="8" rx="4" fill={shade} />
				<circle cx="214" cy="66" r="4" fill="oklch(0.95 0.08 90)" />
				{[rear, front].map((x) => (
					<g>
						<circle cx={x} cy="82" r="15" fill="oklch(0.25 0.01 250)" />
						<circle cx={x} cy="82" r="7" fill="oklch(0.78 0.01 250)" />
					</g>
				))}
			</svg>
		);
	};
}
