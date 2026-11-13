/**
 * Delta's small drawings: its mark, a river splitting and rejoining the way branches merge,
 * and a person's initials tile, tinted from their name so the same author keeps one colour
 * on every row without a photo of anyone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import { initials } from "./data";

/** Renders the mark: a brass tile with a branch splitting into two and meeting again. */
export function DeltaMark() {
	return () => (
		<svg
			viewBox="0 0 24 24"
			width="24"
			height="24"
			aria-hidden="true"
			mix={[raw({ display: "block", borderRadius: "0.3rem", flexShrink: 0 })]}
		>
			<rect width="24" height="24" rx="5" fill="var(--ui-brand-bg-solid)" />
			<path
				d="M12 4.5v4M12 8.5c-3.5 2-4 5-4 7.5M12 8.5c3.5 2 4 5 4 7.5M8 16c0 2 2 3.5 4 3.5s4-1.5 4-3.5"
				fill="none"
				stroke="var(--ui-brand-fg-on-solid, white)"
				stroke-width="1.75"
				stroke-linecap="round"
			/>
		</svg>
	);
}

/** A hue from 0 to 359 picked from a name, so one person always draws in one hue. */
function hueOf(name: string): number {
	let hash = 0;
	for (let index = 0; index < name.length; index++) {
		hash = (hash * 31 + name.charCodeAt(index)) % 360;
	}
	return hash;
}

namespace InitialsTile {
	export interface Props {
		name: string;
		/** Side in pixels. @default 20 */
		size?: number;
	}
}

/**
 * Renders a round tile with a person's initials, tinted from their name; the name beside it
 * carries the meaning, so the tile is decoration.
 */
export function InitialsTile(handle: Handle<InitialsTile.Props>) {
	return () => {
		let { name, size = 20 } = handle.props;
		let hue = hueOf(name);
		return (
			<span
				aria-hidden="true"
				data-slot="delta-avatar"
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: 0,
						inlineSize: `${size}px`,
						blockSize: `${size}px`,
						borderRadius: "999px",
						fontSize: `${Math.round(size * 0.42)}px`,
						fontWeight: 600,
						lineHeight: 1,
						letterSpacing: "0.02em",
						color: `light-dark(oklch(0.36 0.08 ${hue}), oklch(0.9 0.06 ${hue}))`,
						background: `light-dark(oklch(0.9 0.05 ${hue}), oklch(0.36 0.06 ${hue}))`,
					}),
				]}
			>
				{initials(name)}
			</span>
		);
	};
}
