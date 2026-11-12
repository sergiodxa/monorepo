/**
 * Chorus's small shared pieces: its mark, the initials tile every person wears, the
 * generated scenes that stand in for photos, text with its mentions, tags and code linked,
 * and the compact counts and short times every post prints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { Person, Scene } from "~/resources/views/demo-apps/chorus/data";

import { findPerson, href } from "~/resources/views/demo-apps/chorus/data";

/** Counts as Chorus prints them: 940, 3.8K, 152K, 1.2M. */
const COMPACT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Dates older than a day, as a post's time prints them: "Nov 9". */
const SHORT_DATE = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/** The full date and time a post's time shows on hover. */
const FULL_DATE = new Intl.DateTimeFormat("en", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "UTC",
});

/** Splits post text into mentions, tags, inline code and links, keeping the text between. */
const TOKEN = /(@[a-z0-9_]+|#[A-Za-z][A-Za-z0-9_]*|`[^`]+`|https?:\/\/[^\s]+)/g;

/**
 * Prints a count compactly, as a reaction count or a follower count reads.
 *
 * @param count The exact count.
 * @returns "940", "3.8K", "1.2M".
 */
export function compact(count: number): string {
	return COMPACT.format(count);
}

/**
 * Prints how long ago something happened, as a timeline does: "now", "12m", "3h", then the
 * date.
 *
 * @param age Milliseconds since it happened.
 * @param at When it happened, for the date once a day has passed.
 */
export function shortAge(age: number, at: string): string {
	let minutes = Math.floor(age / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m`;
	let hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return SHORT_DATE.format(new Date(at));
}

/**
 * The full date a post's time names on hover and to a screen reader.
 *
 * @param at An ISO timestamp.
 */
export function fullDate(at: string): string {
	return `${FULL_DATE.format(new Date(at))} UTC`;
}

/** Chorus's mark: three rising voices, arcs of one colour, on a coral tile. */
export function ChorusMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 28;
		return (
			<svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
				<rect width="32" height="32" rx="10" fill="var(--ui-color-brand-600)" />
				<g fill="none" stroke="white" stroke-linecap="round" stroke-width="2.6">
					<path d="M9 21.5a4.5 4.5 0 0 1 0-9" />
					<path d="M15 24.5a8.5 8.5 0 0 1 0-17" opacity="0.85" />
					<path d="M21.5 27a11.5 11.5 0 0 1 0-22" opacity="0.6" />
				</g>
				<circle cx="10.5" cy="17" r="2.2" fill="white" />
			</svg>
		);
	};
}

namespace PersonAvatar {
	export interface Props {
		person: Person;
		/** Its side, in rem; when omitted it reads `--chorus-avatar` from its parent, else 2.5rem. */
		size?: number;
	}
}

/**
 * A person's initials on a tile tinted by their hue: a circle for a person, a rounded square
 * for an organisation. The name is beside it wherever it appears, so the tile is decorative.
 */
export function PersonAvatar(handle: Handle<PersonAvatar.Props>) {
	return () => {
		let { person, size } = handle.props;
		let sized = size === undefined ? "" : `; --chorus-avatar: ${size}rem`;
		return (
			<span
				aria-hidden="true"
				data-org={person.org ? "" : undefined}
				style={`--chorus-hue: ${person.hue}${sized}`}
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: "0",
						inlineSize: "var(--chorus-avatar, 2.5rem)",
						blockSize: "var(--chorus-avatar, 2.5rem)",
						borderRadius: "999px",
						fontSize: "calc(var(--chorus-avatar, 2.5rem) * 0.36)",
						fontWeight: "650",
						letterSpacing: "0.01em",
						background:
							"linear-gradient(140deg, oklch(0.9 0.06 var(--chorus-hue)), oklch(0.8 0.1 calc(var(--chorus-hue) + 30)))",
						color: "oklch(0.34 0.09 var(--chorus-hue))",
						userSelect: "none",
					}),
					when("&[data-org]", raw({ borderRadius: "28%" })),
					dark(
						raw({
							background:
								"linear-gradient(140deg, oklch(0.46 0.09 var(--chorus-hue)), oklch(0.36 0.08 calc(var(--chorus-hue) + 30)))",
							color: "oklch(0.94 0.04 var(--chorus-hue))",
						}),
					),
				]}
			>
				{person.initials}
			</span>
		);
	};
}

/**
 * One generated scene: shapes and gradients that stand in for a photo at any size, cropped
 * to fill their box like a photo would. Each is a landscape at 16:9 at heart.
 */
export function SceneArt(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { scene } = handle.props;
		return (
			<svg
				viewBox="0 0 320 180"
				preserveAspectRatio="xMidYMid slice"
				aria-hidden="true"
				mix={[raw({ display: "block", inlineSize: "100%", blockSize: "100%" })]}
			>
				{sceneShapes(scene)}
			</svg>
		);
	};
}

/** The stars of the night sky, placed once so every render draws the same sky. */
const STARS = Array.from({ length: 46 }, (_, index) => ({
	x: (index * 67) % 320,
	y: (index * 29) % 110,
	r: index % 5 === 0 ? 1.3 : 0.7,
}));

/** The shapes each scene draws inside its 320×180 box. */
function sceneShapes(scene: Scene): RemixNode {
	switch (scene) {
		case "night-sky":
			return (
				<>
					<defs>
						<linearGradient id="chorus-sky" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0" stop-color="#0b1030" />
							<stop offset="0.7" stop-color="#26306b" />
							<stop offset="1" stop-color="#4b3f78" />
						</linearGradient>
					</defs>
					<rect width="320" height="180" fill="url(#chorus-sky)" />
					{STARS.map((star) => (
						<circle cx={star.x} cy={star.y} r={star.r} fill="white" opacity="0.85" />
					))}
					<path d="M210 20 L262 66" stroke="white" stroke-width="1.4" opacity="0.9" />
					<path d="M90 30 L128 60" stroke="#c9d6ff" stroke-width="1.1" opacity="0.8" />
					<path d="M250 12 L280 36" stroke="#ffe7c2" stroke-width="1" opacity="0.8" />
					<path d="M0 140 Q60 108 120 130 T240 120 T320 132 V180 H0Z" fill="#090c1e" />
					<rect y="150" width="320" height="30" fill="#141a3d" opacity="0.9" />
				</>
			);
		case "dunes":
			return (
				<>
					<rect width="320" height="180" fill="#f2c48d" />
					<path d="M0 70 Q80 40 160 80 T320 60 V180 H0Z" fill="#e39a55" />
					<path d="M0 110 Q90 80 170 120 T320 100 V180 H0Z" fill="#c8662f" />
					<path d="M0 150 Q100 120 200 160 T320 140 V180 H0Z" fill="#8f3f1f" />
				</>
			);
		case "harbor":
			return (
				<>
					<rect width="320" height="180" fill="#bfe1e6" />
					<circle cx="250" cy="52" r="22" fill="#fff4d6" />
					<rect y="110" width="320" height="70" fill="#3f8ea0" />
					<path d="M0 118 H320" stroke="#e8f6f7" stroke-width="2" opacity="0.6" />
					<path d="M40 110 L60 70 L80 110Z" fill="#f7f3ea" />
					<rect x="38" y="108" width="46" height="8" rx="3" fill="#1f4b5a" />
					<path d="M150 110 L162 84 L174 110Z" fill="#f7f3ea" opacity="0.8" />
					<rect x="148" y="108" width="30" height="6" rx="3" fill="#1f4b5a" />
				</>
			);
		case "plates":
			return (
				<>
					<rect width="320" height="180" fill="#3b2418" />
					<circle cx="80" cy="96" r="52" fill="#efe6d8" />
					<circle cx="80" cy="96" r="34" fill="#8e1f1b" />
					<circle cx="70" cy="88" r="6" fill="#5c8a3a" />
					<circle cx="92" cy="104" r="4" fill="#5c8a3a" />
					<circle cx="200" cy="74" r="40" fill="#efe6d8" />
					<circle cx="200" cy="74" r="25" fill="#c46a1e" />
					<circle cx="270" cy="140" r="34" fill="#efe6d8" />
					<circle cx="270" cy="140" r="20" fill="#3a1f14" />
				</>
			);
		case "rails":
			return (
				<>
					<rect width="320" height="180" fill="#1b2a3a" />
					<circle cx="160" cy="70" r="40" fill="#f2a65a" opacity="0.5" />
					<path d="M140 80 L40 180 M180 80 L280 180" stroke="#c7d3de" stroke-width="3" />
					{[96, 116, 140, 168].map((y, index) => (
						<path
							d={`M${150 - (y - 80) * 0.95} ${y} H${170 + (y - 80) * 0.95}`}
							stroke="#7f8c99"
							stroke-width={2 + index}
						/>
					))}
					<rect y="70" width="320" height="10" fill="#0f1822" />
				</>
			);
		case "sketch":
			return (
				<>
					<rect width="320" height="180" fill="#f7f1e6" />
					<ellipse cx="170" cy="112" rx="70" ry="44" fill="#b9a58c" opacity="0.55" />
					<circle cx="120" cy="82" r="30" fill="#8a6f55" opacity="0.8" />
					<circle cx="110" cy="76" r="4" fill="#1d1712" />
					<circle cx="132" cy="76" r="4" fill="#1d1712" />
					<path
						d="M92 90 L60 84 M92 96 L58 98 M148 90 L182 84"
						stroke="#1d1712"
						stroke-width="1.3"
					/>
					<rect x="200" y="70" width="60" height="80" rx="10" fill="#d8e3e8" opacity="0.8" />
					<path
						d="M60 150 C120 140 220 160 280 148"
						stroke="#1d1712"
						stroke-width="1.5"
						fill="none"
					/>
				</>
			);
		case "forest":
			return (
				<>
					<rect width="320" height="180" fill="#d7e6d2" />
					<rect y="120" width="320" height="60" fill="#a9c6c4" />
					{[20, 70, 120, 230, 280].map((x, index) => (
						<path
							d={`M${x} 130 L${x + 22} ${50 + index * 6} L${x + 44} 130Z`}
							fill={index % 2 === 0 ? "#2f5d46" : "#3f7656"}
						/>
					))}
					<path
						d="M150 180 C170 150 190 140 200 120"
						stroke="#efe8d6"
						stroke-width="10"
						fill="none"
					/>
				</>
			);
		case "chart":
			return (
				<>
					<rect width="320" height="180" fill="#eef3ee" />
					{[38, 58, 50, 84, 96, 120, 138].map((height, index) => (
						<rect
							x={34 + index * 38}
							y={150 - height}
							width="24"
							height={height}
							rx="4"
							fill={index === 6 ? "#2e8b57" : "#9cc3a8"}
						/>
					))}
					<path d="M20 150 H300" stroke="#466b54" stroke-width="2" />
				</>
			);
	}
}

namespace RichText {
	export interface Props {
		text: string;
	}
}

/**
 * Post text with each known `@handle` linked to its profile, each `#tag` to a search,
 * `` `code` `` set in mono and each address linked. An unknown handle stays text.
 */
export function RichText(handle: Handle<RichText.Props>) {
	return () => (
		<>
			{handle.props.text.split(TOKEN).map((part, index) => {
				if (index % 2 === 0) return part;
				if (part.startsWith("@")) {
					let person = findPerson(part.slice(1));
					return person ? (
						<a href={href(`u/${person.handle}`)} data-rmx-prefetch="intent" mix={[inlineLink()]}>
							{part}
						</a>
					) : (
						part
					);
				}
				if (part.startsWith("#")) {
					return (
						<a href={href(`explore?q=${encodeURIComponent(part)}`)} mix={[inlineLink()]}>
							{part}
						</a>
					);
				}
				if (part.startsWith("`")) {
					return (
						<code
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.9em",
									paddingInline: "0.25em",
									borderRadius: "0.3em",
									backgroundColor: "var(--ui-neutral-bg-tint-hover)",
								}),
							]}
						>
							{part.slice(1, -1)}
						</code>
					);
				}
				return (
					<a href={part} rel="noopener" mix={[inlineLink(), raw({ wordBreak: "break-all" })]}>
						{part.replace(/^https?:\/\//, "")}
					</a>
				);
			})}
		</>
	);
}

/** A link inside post text: brand coloured, underlined on hover, above the post's own link. */
function inlineLink() {
	return [
		raw({
			position: "relative",
			zIndex: "1",
			color: "var(--ui-brand-fg)",
			textDecoration: "none",
		}),
		when("&:hover", raw({ textDecoration: "underline" })),
	];
}
