/**
 * Live example island for a `ColorWheel` an admin can lock. The ring shape and its
 * angular drag arrive with `colorWheelDrag()`, which runs in the browser, and the lock
 * switch flips the wheel's `disabled` state, so the island holds both the hue and the lock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { font, text } from "@sdxc/u/typography";
import { ColorWheel, Label, Switch } from "@sdxc/ui";
import { colorWheelDrag } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `let hue = 210;
let isLocked = true;

<div mix={[hstack({ gap: 5, align: "center" })]}>
	<ColorWheel
		aria-label="Accent hue"
		value={hue}
		name="hue"
		disabled={isLocked}
		mix={[
			colorWheelDrag(),
			on<HTMLDivElement, "ui:color-wheel-change">("ui:color-wheel-change", (event) => {
				hue = event.hue;
				void handle.update();
			}),
		]}
	/>

	<div mix={[vstack({ gap: 2, align: "start" })]}>
		<Label>
			<Switch
				name="lockHue"
				checked={isLocked}
				mix={[
					on<HTMLInputElement, "change">("change", (event) => {
						isLocked = event.currentTarget.checked;
						void handle.update();
					}),
				]}
			/>
			Lock the accent hue
		</Label>
		<span mix={[font("mono"), text("sm"), fg("neutral")]}>{Math.round(hue)}°</span>
	</div>
</div>`;

/** A hue ring behind an admin lock, hydrated so the ring draws and the lock toggles it. */
export const ColorWheelLocked = clientEntry(
	import.meta.url,
	function ColorWheelLocked(handle: Handle) {
		let hue = 210;
		let isLocked = true;

		return () => (
			<div mix={[hstack({ gap: 5, align: "center" })]}>
				<ColorWheel
					aria-label="Accent hue"
					value={hue}
					name="hue"
					disabled={isLocked}
					mix={[
						colorWheelDrag(),
						on<HTMLDivElement, "ui:color-wheel-change">("ui:color-wheel-change", (event) => {
							hue = event.hue;
							void handle.update();
						}),
					]}
				/>

				<div mix={[vstack({ gap: 2, align: "start" })]}>
					<Label>
						<Switch
							name="lockHue"
							checked={isLocked}
							mix={[
								on<HTMLInputElement, "change">("change", (event) => {
									isLocked = event.currentTarget.checked;
									void handle.update();
								}),
							]}
						/>
						Lock the accent hue
					</Label>
					<span mix={[font("mono"), text("sm"), fg("neutral")]}>{Math.round(hue)}°</span>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Locked by an admin",
	code: CODE,
	render: () => <ColorWheelLocked />,
};
