/**
 * Live preview island for `ToggleButton`. A native `<button>` has no on/off state,
 * so the rendered `aria-pressed` never moves without the `pressToggle()` wiring this
 * preview carries. The example is a map's layer controls: three toggles a reader can
 * see take effect, since the group reads each button's live pressed state as the
 * click bubbles past the mixin that just flipped it, and lists the layers drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { CloudIcon, MapPinIcon, RouteIcon } from "@sdxc/icons";
import { hstack, vstack } from "@sdxc/u/layout";
import { Group, Text, ToggleButton } from "@sdxc/ui";
import { pressToggle } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/ui";

/** The layers the controls switch, so the toggles differ by more than their glyph. */
const LAYERS = [
	{ id: "pins", label: "Places" },
	{ id: "routes", label: "Routes" },
	{ id: "weather", label: "Weather" },
];

/** The source the page shows, matching the markup below. */
const TOGGLE_BUTTON_CODE = `// The click reaches the group after the mixin has flipped the button it started on.
<Group aria-label="Map layers" mix={[on<HTMLDivElement, "click">("click", readPressed)]}>
	{layers.map((layer) => (
		<ToggleButton
			key={layer.id}
			aria-pressed={pressed.has(layer.label) ? "true" : "false"}
			aria-label={layer.label}
			variant="outline"
			mix={[pressToggle()]}
		>
			<MapPinIcon />
		</ToggleButton>
	))}
</Group>
<Text>Drawing: {[...pressed].join(", ")}</Text>`;

/** Three layer toggles that flip, hydrated so each press has somewhere to write. */
export const ToggleButtonPreview = clientEntry(
	"/resources/components/previews/toggle-button.tsx#ToggleButtonPreview",
	function ToggleButtonPreview(handle: Handle) {
		let pressed = new Set(["Places", "Routes"]);

		/** Reads the pressed button's own `aria-pressed`, already flipped by the mixin. */
		function readPressed(event: Event) {
			let target = event.target;
			if (!(target instanceof Element)) return;

			let button = target.closest("button");
			let label = button?.getAttribute("aria-label");
			if (!button || label === null || label === undefined) return;

			if (button.getAttribute("aria-pressed") === "true") pressed.add(label);
			else pressed.delete(label);

			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 3, align: "center" })]}>
				<Group
					aria-label="Map layers"
					mix={[
						hstack({ gap: 2, align: "center" }),
						on<HTMLDivElement, "click">("click", readPressed),
					]}
				>
					{LAYERS.map((layer) => (
						<ToggleButton
							key={layer.id}
							aria-pressed={pressed.has(layer.label) ? "true" : "false"}
							aria-label={layer.label}
							variant="outline"
							mix={[pressToggle()]}
						>
							{layer.id === "pins" ? (
								<MapPinIcon />
							) : layer.id === "routes" ? (
								<RouteIcon />
							) : (
								<CloudIcon />
							)}
						</ToggleButton>
					))}
				</Group>
				<Text>
					{pressed.size === 0 ? "No layers drawn" : `Drawing: ${[...pressed].join(", ")}`}
				</Text>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TOGGLE_BUTTON_CODE, render: () => <ToggleButtonPreview /> };
