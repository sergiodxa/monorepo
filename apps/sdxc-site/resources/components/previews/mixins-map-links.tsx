/**
 * Live demo for `mapLinks()`: a list of stays beside their pins on a drawn map, where pointing
 * at or focusing a row lights its pin and the reverse, all run by one hidden `MapCanvasSync`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { mapLink } from "@sdxc/ui/map";
import { MapCanvas, MapCanvasSync } from "@sdxc/ui/map/map-canvas";

/** The stays listed and pinned, each keyed by the id its row and pin share. */
const STAYS = [
	{ id: "harbour", name: "Harbour loft", x: 96, y: 196, price: "$182" },
	{ id: "square", name: "Square studio", x: 206, y: 132, price: "$240" },
	{ id: "hill", name: "Hill cabin", x: 316, y: 70, price: "$310" },
];

/** The source the page shows, matching the markup below apart from the drawn town. */
const CODE = `<ul>
	{stays.map((stay) => (
		<li mix={[mapLink(stay.id)]}>
			<a href={\`/stays/\${stay.id}\`}>{stay.name}</a>
		</li>
	))}
</ul>
<MapCanvas label="Stays in Porto Novo" art={<Town />}>
	{stays.map((stay) => (
		<MapCanvas.Pin x={stay.x} y={stay.y} label={stay.price} mapKey={stay.id} />
	))}
</MapCanvas>
{/* One island links every data-map-key row and pin on the page through mapLinks(). */}
<MapCanvasSync />`;

/** A row and pin pair per stay, linked by their shared key once the sync host loads. */
function render() {
	return (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))",
					gap: "1rem",
					alignItems: "center",
					inlineSize: "100%",
					maxInlineSize: "40rem",
					marginInline: "auto",
				}),
			]}
		>
			<ul mix={[raw({ display: "grid", gap: "0.5rem", margin: "0", padding: "0" })]}>
				{STAYS.map((stay) => (
					<li
						mix={[
							mapLink(stay.id),
							raw({
								listStyle: "none",
								borderRadius: "0.625rem",
								border: "1px solid var(--ui-neutral-border)",
								transition: "background-color 150ms, border-color 150ms",
								"&[data-highlighted]": {
									borderColor: "var(--ui-brand-border, CanvasText)",
									backgroundColor: "var(--ui-brand-bg, transparent)",
								},
							}),
						]}
					>
						<a
							href={`#${stay.id}`}
							mix={[
								raw({
									display: "flex",
									justifyContent: "space-between",
									gap: "0.75rem",
									padding: "0.625rem 0.75rem",
									color: "inherit",
									textDecoration: "none",
								}),
							]}
						>
							<span>{stay.name}</span>
							<strong>{stay.price}</strong>
						</a>
					</li>
				))}
			</ul>
			<MapCanvas
				label="Stays in Porto Novo"
				art={
					<>
						<rect width="400" height="300" mix={[raw({ fill: "oklch(0.96 0.012 95)" })]} />
						<path
							d="M0 252 C60 236 90 268 150 270 S250 244 300 262 S370 300 400 288 L400 300 L0 300 Z"
							mix={[raw({ fill: "oklch(0.86 0.06 230)" })]}
						/>
						<g mix={[raw({ fill: "none", stroke: "white", strokeLinecap: "round" })]}>
							<path d="M0 170 C100 160 180 176 400 140" stroke-width="12" />
							<path d="M210 0 C200 90 214 200 196 252" stroke-width="10" />
							<path d="M40 40 L380 30" stroke-width="7" />
						</g>
					</>
				}
			>
				{STAYS.map((stay) => (
					<MapCanvas.Pin
						x={stay.x}
						y={stay.y}
						label={stay.price}
						href={`#${stay.id}`}
						mapKey={stay.id}
					/>
				))}
			</MapCanvas>
			<MapCanvasSync />
		</div>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default { code: CODE, render };
