/**
 * The challenge card drawn the way the app draws it, face and back, from the geometry and
 * colours of its SwiftUI code, plus the app's four-point sparkle. Light enough to render in
 * the browser too, so the playable card on the landing draws the same card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { is, m } from "@sdxc/u/size";
import { weight } from "@sdxc/u/typography";

/**
 * The app's four-point sparkle, as `CardStackView` draws it: four cubic arcs pinched toward
 * the centre, each with both control points 18% of the radius off it.
 *
 * @param cx The centre's x.
 * @param cy The centre's y.
 * @param r The distance from the centre to each point.
 * @returns The SVG path data.
 */
export function sparklePath(cx: number, cy: number, r: number): string {
	let k = r * 0.18;
	return [
		`M${cx} ${cy - r}`,
		`C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}`,
		`C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}`,
		`C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}`,
		`C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z`,
	].join(" ");
}

/** The ornament colours, as the app's gradient stops run: violet into coral into gold. */
const RIBBON_STOPS = ["var(--encore-violet)", "var(--encore-coral)", "var(--encore-gold)"];

/**
 * The four corner flourishes of a card face, in the card's 320 × 460 points: each a ribbon of
 * two cubic curves entering from the edge, with a sparkle beside it.
 */
function faceFlourishes() {
	let ribbons: Array<{ key: string; d: string; sparkle: string; tone: string; flip: boolean }> = [];
	for (let side of [-1, 1]) {
		for (let vertical of [-1, 1]) {
			let y = vertical > 0 ? 28 : 432;
			let x = (offset: number) => 160 + offset * side;
			let d = [
				`M${x(146)} ${y}`,
				`C${x(88)} ${y + 12 * vertical} ${x(142)} ${y + 46 * vertical} ${x(104)} ${y + 66 * vertical}`,
				`C${x(74)} ${y + 76 * vertical} ${x(110)} ${y + 98 * vertical} ${x(132)} ${y + 92 * vertical}`,
			].join(" ");
			ribbons.push({
				key: `${side}${vertical}`,
				d,
				sparkle: sparklePath(x(112), y + 30 * vertical, 7),
				tone: side < 0 ? "var(--encore-pink)" : "var(--encore-gold)",
				flip: vertical < 0,
			});
		}
	}
	return ribbons;
}

/** The sparse sparkles along a card face's edges: point, radius and colour. */
const EDGE_MARKS = [
	[48, 145, 4, "var(--encore-coral)"],
	[272, 145, 4, "var(--encore-violet)"],
	[42, 230, 5, "var(--encore-gold)"],
	[278, 230, 5, "var(--encore-gold)"],
	[48, 315, 4, "var(--encore-violet)"],
	[272, 315, 4, "var(--encore-coral)"],
] as const;

/** Props of a drawn card. */
export interface PlayingCardProps {
	/** The small capitals at the top of the face; generated challenges carry none. */
	title?: string;
	/** The challenge in the middle of the face; omitted for a face-down card. */
	prompt?: string;
	/** Draws the card back instead of its face. */
	faceDown?: boolean;
}

/**
 * A challenge card drawn as the app draws it: 320 × 460 points with 20-point corners, a warm
 * face (plum in dark) with ribbon flourishes cropped into its corners, a calm field in the
 * middle for the prompt, sparkles along the edges and a thin gold inner frame; or the ornate
 * plum back. It scales to its column, its type with it, so it reads the same at any size.
 *
 * @param handle Runtime handle carrying the card's words and which side shows.
 * @returns The render function producing the card.
 */
export function PlayingCard(handle: Handle<PlayingCardProps>) {
	return () => {
		let { faceDown, prompt, title } = handle.props;
		let id = `encore-card-${handle.id}`;

		return (
			<div
				mix={[
					is("full"),
					raw({
						containerType: "inline-size",
						position: "relative",
						aspectRatio: "320 / 460",
						borderRadius: "6.25% / 4.35%",
						overflow: "hidden",
						background: faceDown ? "var(--encore-card-back)" : "var(--encore-card-face)",
						boxShadow: "0 0 0 1px var(--encore-card-border), var(--encore-card-shadow)",
						color: "var(--encore-card-ink)",
						fontFamily: "var(--encore-font-card)",
					}),
				]}
			>
				{faceDown ? <CardBack id={id} /> : <CardFace id={id} />}
				{prompt && !faceDown ? (
					<div
						mix={[
							raw({
								position: "absolute",
								inset: "0",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								paddingBlockStart: "6cqi",
								paddingInline: "10cqi",
								textAlign: "center",
							}),
						]}
					>
						<p
							mix={[
								m(0),
								weight("semibold"),
								raw({
									minBlockSize: "1.4em",
									fontSize: "4cqi",
									letterSpacing: "0.2em",
									textTransform: "uppercase",
									color: "var(--encore-card-muted)",
								}),
							]}
						>
							{title ?? ""}
						</p>
						<p
							mix={[
								m(0),
								raw({
									marginBlock: "auto",
									fontSize: "7cqi",
									fontWeight: "500",
									lineHeight: "1.3",
									textWrap: "balance",
								}),
							]}
						>
							{prompt}
						</p>
					</div>
				) : null}
			</div>
		);
	};
}

/**
 * The ornaments of a card face, scaled with it: the reading field's glow, the four corner
 * ribbons and their sparkles, the edge sparkles and the gold inner frame. Decorative.
 *
 * @param handle Runtime handle carrying an id unique to the card, for its gradient.
 * @returns The render function producing the ornaments.
 */
function CardFace(handle: Handle<{ id: string }>) {
	return () => {
		let id = handle.props.id;
		return (
			<svg
				viewBox="0 0 320 460"
				aria-hidden="true"
				preserveAspectRatio="none"
				mix={[raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" })]}
			>
				<defs>
					<radialGradient
						id={`${id}-field`}
						cx="160"
						cy="230"
						r="178"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0.25" stopColor="var(--encore-card-field)" />
						<stop offset="1" stopColor="var(--encore-card-field)" stopOpacity="0" />
					</radialGradient>
					{faceFlourishes().map((ribbon) => (
						<linearGradient
							key={ribbon.key}
							id={`${id}-ribbon-${ribbon.key}`}
							x1="0"
							x2="0"
							y1={ribbon.flip ? "1" : "0"}
							y2={ribbon.flip ? "0" : "1"}
						>
							{RIBBON_STOPS.map((color, index) => (
								<stop key={color} offset={index / 2} stopColor={color} />
							))}
						</linearGradient>
					))}
				</defs>
				<rect x="0" y="0" width="320" height="460" fill={`url(#${id}-field)`} />
				<g mix={[raw({ opacity: "var(--encore-flourish-opacity)" })]}>
					{faceFlourishes().map((ribbon) => (
						<g key={ribbon.key}>
							<path
								d={ribbon.d}
								fill="none"
								stroke={`url(#${id}-ribbon-${ribbon.key})`}
								strokeWidth={9}
								strokeLinecap="round"
							/>
							<path d={ribbon.sparkle} fill={ribbon.tone} />
						</g>
					))}
					{EDGE_MARKS.map(([x, y, r, color]) => (
						<path key={`${x}-${y}`} d={sparklePath(x, y, r)} fill={color} />
					))}
				</g>
				<rect
					x="12"
					y="12"
					width="296"
					height="436"
					rx="13"
					fill="none"
					stroke="var(--encore-gold)"
					strokeWidth={1.5}
					mix={[raw({ opacity: "var(--encore-frame-opacity)" })]}
				/>
			</svg>
		);
	};
}

/**
 * The card back, drawn from the app's own code-native pattern: mirrored ribbons, an applause
 * burst of eighteen rays around a gold sparkle, a dotted ring, small sparkles and a double
 * frame, on the plum gradient. Decorative.
 *
 * @param handle Runtime handle carrying an id unique to the card, for its gradients.
 * @returns The render function producing the back.
 */
function CardBack(handle: Handle<{ id: string }>) {
	return () => {
		let id = handle.props.id;
		let rays = Array.from({ length: 18 }, (_, index) => {
			let angle = (index * Math.PI * 2) / 18;
			let outer = index % 2 === 0 ? 68 : 56;
			return {
				key: index,
				d: `M${160 + Math.cos(angle) * 28} ${230 + Math.sin(angle) * 28}L${160 + Math.cos(angle) * outer} ${230 + Math.sin(angle) * outer}`,
				color: index % 3 === 0 ? "var(--encore-gold)" : "var(--encore-coral)",
				width: index % 2 === 0 ? 7 : 4,
			};
		});
		let ribbons = [-1, 1].map((side) => {
			let x = (offset: number) => 160 + offset * side;
			return {
				key: side,
				outer: `M${x(112)} 42 C${x(30)} 82 ${x(144)} 142 ${x(88)} 222 C${x(22)} 306 ${x(146)} 342 ${x(110)} 418`,
				inner: `M${x(50)} 54 C${x(112)} 92 ${x(8)} 148 ${x(48)} 204 C${x(106)} 266 ${x(4)} 338 ${x(52)} 406`,
			};
		});
		let sparkles = [
			[62, 88, 8, "var(--encore-coral)"],
			[258, 88, 8, "var(--encore-coral)"],
			[82, 172, 6, "var(--encore-gold)"],
			[238, 172, 6, "var(--encore-gold)"],
			[68, 292, 7, "var(--encore-pink)"],
			[252, 292, 7, "var(--encore-pink)"],
			[102, 370, 8, "var(--encore-violet)"],
			[218, 370, 8, "var(--encore-violet)"],
			[160, 112, 7, "var(--encore-gold)"],
			[160, 348, 7, "var(--encore-gold)"],
		] as const;

		return (
			<svg
				viewBox="0 0 320 460"
				aria-hidden="true"
				preserveAspectRatio="none"
				mix={[raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" })]}
			>
				<defs>
					<linearGradient id={`${id}-back`} x1="0" x2="0" y1="0" y2="1">
						{RIBBON_STOPS.map((color, index) => (
							<stop key={color} offset={index / 2} stopColor={color} />
						))}
					</linearGradient>
				</defs>
				{ribbons.map((ribbon) => (
					<g key={ribbon.key}>
						<path
							d={ribbon.outer}
							fill="none"
							stroke={`url(#${id}-back)`}
							strokeWidth={14}
							strokeLinecap="round"
						/>
						<path
							d={ribbon.inner}
							fill="none"
							stroke="var(--encore-pink)"
							strokeWidth={6}
							strokeLinecap="round"
							opacity={0.85}
						/>
					</g>
				))}
				{rays.map((ray) => (
					<path
						key={ray.key}
						d={ray.d}
						stroke={ray.color}
						strokeWidth={ray.width}
						strokeLinecap="round"
					/>
				))}
				<path d={sparklePath(160, 230, 17)} fill="var(--encore-gold)" />
				<circle
					cx="160"
					cy="230"
					r="79"
					fill="none"
					stroke="var(--encore-violet)"
					strokeWidth={2}
					strokeDasharray="2 8"
					opacity={0.28}
				/>
				{sparkles.map(([x, y, r, color]) => (
					<path key={`${x}-${y}`} d={sparklePath(x, y, r)} fill={color} />
				))}
				<rect
					x="12"
					y="12"
					width="296"
					height="436"
					rx="13"
					fill="none"
					stroke="var(--encore-gold)"
					strokeWidth={2}
					opacity={0.9}
				/>
				<rect
					x="18"
					y="18"
					width="284"
					height="424"
					rx="10"
					fill="none"
					stroke="var(--encore-violet)"
					strokeWidth={1}
					opacity={0.65}
				/>
			</svg>
		);
	};
}
