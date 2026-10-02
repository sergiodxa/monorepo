/**
 * Live preview island for `Select`. The example is the customizable-select layout —
 * a trigger, a value slot and grouped options — rather than the bare field it falls
 * back to, so the styled picker is what a reader sees wherever the browser resolves
 * `appearance: base-select`. Reacting to the choice is the consumer's, so the island
 * listens for the change where it bubbles and reports the region's own latency.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Label, Select, Text } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** Every region the picker offers, grouped the way the field groups them. */
const REGIONS: Record<string, { code: string; city: string; latency: string }[]> = {
	Americas: [
		{ code: "iad", city: "Washington, D.C.", latency: "28 ms" },
		{ code: "sjc", city: "San José", latency: "64 ms" },
		{ code: "gru", city: "São Paulo", latency: "112 ms" },
	],
	Europe: [
		{ code: "cdg", city: "Paris", latency: "91 ms" },
		{ code: "fra", city: "Frankfurt", latency: "96 ms" },
	],
	Asia: [{ code: "nrt", city: "Tokyo", latency: "148 ms" }],
};

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SELECT_CODE = `// The change bubbles, so the listener sits on the wrapper the field renders into.
<div mix={[on<HTMLDivElement, "change">("change", readRegion)]}>
	<Label htmlFor="preview-region">Primary region</Label>
	<Select id="preview-region" name="region" color="brand">
		<Select.Trigger>
			<Select.Value />
		</Select.Trigger>
		{Object.entries(regions).map(([group, entries]) => (
			<Select.Group key={group} label={group}>
				{entries.map((entry) => (
					<Select.Option key={entry.code} value={entry.code} selected={entry.code === code}>
						{entry.city}
					</Select.Option>
				))}
			</Select.Group>
		))}
	</Select>
	<Text>Median latency from Madrid: {selected.latency}</Text>
</div>`;

/** A grouped region picker, hydrated so the readout follows the selection. */
export const SelectPreview = clientEntry(
	"/resources/components/previews/select.tsx#SelectPreview",
	function SelectPreview(handle: Handle) {
		let code = "cdg";

		/** Tracks the chosen region so the caption below names the right latency. */
		function readRegion(event: Event) {
			let target = event.target;
			if (!(target instanceof HTMLSelectElement)) return;

			code = target.value;
			void handle.update();
		}

		return () => {
			let selected = Object.values(REGIONS)
				.flat()
				.find((entry) => entry.code === code);

			return (
				<div
					mix={[
						vstack({ gap: 2, align: "stretch" }),
						is("20rem"),
						on<HTMLDivElement, "change">("change", readRegion),
					]}
				>
					<Label htmlFor="preview-region">Primary region</Label>
					<Select id="preview-region" name="region" color="brand">
						<Select.Trigger>
							<Select.Value />
						</Select.Trigger>
						{Object.entries(REGIONS).map(([group, entries]) => (
							<Select.Group key={group} label={group}>
								{entries.map((entry) => (
									<Select.Option key={entry.code} value={entry.code} selected={entry.code === code}>
										{entry.city}
									</Select.Option>
								))}
							</Select.Group>
						))}
					</Select>
					<Text>Median latency from Madrid: {selected?.latency ?? "—"}</Text>
				</div>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SELECT_CODE, render: () => <SelectPreview /> };
