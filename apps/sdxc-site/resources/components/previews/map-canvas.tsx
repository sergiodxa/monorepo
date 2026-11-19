/**
 * Live preview for `MapCanvas`: a small drawn coastal town with a bay, a park and a few roads,
 * four nightly prices pinned over it with one selected, and a courier part-way along a route.
 * The art is plain SVG drawn in the stage's 400 by 300 space.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { MapCanvas } from "@sdxc/ui/map/map-canvas";

/** The source the page shows, matching the markup below apart from the drawn town. */
const CODE = `<MapCanvas label="Stays in Porto Novo" art={<Town />}>
	<MapCanvas.Route d={route} done={0.6} />
	<MapCanvas.Marker route={route} progress={0.6} />
	{stays.map((stay) => (
		<MapCanvas.Pin
			x={stay.x}
			y={stay.y}
			label={stay.price}
			href={\`/stays/\${stay.id}\`}
			mapKey={stay.id}
			current={stay.id === selected}
		/>
	))}
</MapCanvas>`;

/** The courier's way from the harbour up to the hill. */
const ROUTE = "M70 236 C110 220 130 196 160 186 S230 170 262 132 S300 84 334 70";

/** The stays pinned on the town, the second one selected. */
const STAYS = [
	{ id: "harbour", x: 96, y: 208, price: "$182" },
	{ id: "square", x: 196, y: 150, price: "$240" },
	{ id: "park", x: 118, y: 92, price: "$95" },
	{ id: "hill", x: 318, y: 58, price: "$310" },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "36rem", marginInline: "auto" })]}>
			<MapCanvas
				label="Stays in Porto Novo"
				art={
					<>
						<rect width="400" height="300" mix={[raw({ fill: "oklch(0.96 0.012 95)" })]} />
						<path
							d="M0 252 C60 236 90 268 150 270 S250 244 300 262 S370 300 400 288 L400 300 L0 300 Z"
							mix={[raw({ fill: "oklch(0.86 0.06 230)" })]}
						/>
						<path
							d="M0 268 C70 256 100 282 160 284 S260 262 320 278 S380 296 400 290 L400 300 L0 300 Z"
							mix={[raw({ fill: "oklch(0.8 0.08 230)" })]}
						/>
						<rect
							x="70"
							y="56"
							width="96"
							height="64"
							rx="14"
							mix={[raw({ fill: "oklch(0.88 0.08 145)" })]}
						/>
						<circle cx="100" cy="82" r="9" mix={[raw({ fill: "oklch(0.8 0.1 145)" })]} />
						<circle cx="136" cy="96" r="12" mix={[raw({ fill: "oklch(0.8 0.1 145)" })]} />
						<g
							mix={[
								raw({
									fill: "none",
									stroke: "white",
									strokeLinecap: "round",
								}),
							]}
						>
							<path d="M0 170 C100 160 180 176 400 140" stroke-width="12" />
							<path d="M210 0 C200 90 214 200 196 252" stroke-width="10" />
							<path d="M40 40 L380 30" stroke-width="7" />
							<path d="M300 0 C310 80 290 180 330 262" stroke-width="7" />
							<path d="M20 224 C80 206 140 214 200 212" stroke-width="6" />
						</g>
					</>
				}
			>
				<MapCanvas.Route d={ROUTE} done={0.6} />
				<MapCanvas.Marker route={ROUTE} progress={0.6} />
				{STAYS.map((stay) => (
					<MapCanvas.Pin
						x={stay.x}
						y={stay.y}
						label={stay.price}
						href={`#${stay.id}`}
						mapKey={stay.id}
						current={stay.id === "square"}
					/>
				))}
			</MapCanvas>
		</div>
	),
};
