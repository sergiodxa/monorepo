/**
 * Live preview island for `Resizable`. The component draws the panels, the handles and
 * the custom properties a layout reads; the drag itself is the consumer's to apply, so
 * the preview carries the same `resizeHandle(axis, session)` wiring a reader would write,
 * against one `ResizeSession` per group — a column beside a stacked pair, so both axes
 * are on screen at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { center } from "@sdxc/u/layout";
import { bs, is, maxIs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Resizable } from "@sdxc/ui";
import { ResizeSession } from "@sdxc/ui/behaviors";
import { resizeHandle } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
export const RESIZABLE_CODE = `// A session per group, since each one drags along its own axis.
let rowSession = new ResizeSession();
let columnSession = new ResizeSession();

<Resizable aria-label="Layout panes" data-resizable-group>
	<Resizable.Panel
		id="one"
		defaultSize={50}
		minSize={25}
		data-resizable-panel
		data-resizable-min="25"
		mix={[center(), weight("semibold")]}
	>
		One
	</Resizable.Panel>

	<Resizable.Handle
		aria-label="Resize the first pane"
		aria-controls="one stack"
		data-resizable-handle
		mix={[resizeHandle("horizontal", rowSession)]}
	/>

	<Resizable.Panel id="stack" defaultSize={50} minSize={25} data-resizable-panel>
		{/* A group nested in a panel splits that panel along the other axis; the
		    frame around it is the outer group's, so this one draws none of its own. */}
		<Resizable
			orientation="vertical"
			aria-label="Stacked panes"
			data-resizable-group
			style={{ border: "none", borderRadius: "0" }}
			mix={[bs("100%")]}
		>
			<Resizable.Panel
				id="two"
				defaultSize={25}
				minSize={15}
				data-resizable-panel
				data-resizable-min="15"
				mix={[center(), weight("semibold")]}
			>
				Two
			</Resizable.Panel>

			<Resizable.Handle
				aria-label="Resize the upper pane"
				aria-controls="two three"
				data-resizable-handle
				mix={[resizeHandle("vertical", columnSession)]}
			/>

			<Resizable.Panel
				id="three"
				defaultSize={75}
				minSize={15}
				data-resizable-panel
				data-resizable-min="15"
				mix={[center(), weight("semibold")]}
			>
				Three
			</Resizable.Panel>
		</Resizable>
	</Resizable.Panel>
</Resizable>`;

/** A pane beside a stacked pair, hydrated so both axes drag. */
export const ResizablePreview = clientEntry(import.meta.url, function ResizablePreview() {
	// A session per group, since each one drags along its own axis.
	let rowSession = new ResizeSession();
	let columnSession = new ResizeSession();

	return () => (
		<Resizable
			aria-label="Layout panes"
			data-resizable-group
			mix={[is("100%"), maxIs("32rem"), bs("12.5rem")]}
		>
			<Resizable.Panel
				id="preview-one"
				defaultSize={50}
				minSize={25}
				data-resizable-panel
				data-resizable-min="25"
				mix={[center(), text("sm"), weight("semibold")]}
			>
				One
			</Resizable.Panel>

			<Resizable.Handle
				aria-label="Resize the first pane"
				aria-controls="preview-one preview-stack"
				data-resizable-handle
				mix={[resizeHandle("horizontal", rowSession)]}
			/>

			<Resizable.Panel
				id="preview-stack"
				defaultSize={50}
				minSize={25}
				data-resizable-panel
				data-resizable-min="25"
			>
				{/* A group nested in a panel splits that panel along the other axis; the
					    frame around it is the outer group's, so this one draws none of its own. */}
				<Resizable
					orientation="vertical"
					aria-label="Stacked panes"
					data-resizable-group
					// An inline style settles the frame, since a mix entry's own cascade layer
					// is ordered by first appearance and the group's chrome may land after it.
					style={{ border: "none", borderRadius: "0" }}
					mix={[bs("100%")]}
				>
					<Resizable.Panel
						id="preview-two"
						defaultSize={25}
						minSize={15}
						data-resizable-panel
						data-resizable-min="15"
						mix={[center(), text("sm"), weight("semibold")]}
					>
						Two
					</Resizable.Panel>

					<Resizable.Handle
						aria-label="Resize the upper pane"
						aria-controls="preview-two preview-three"
						data-resizable-handle
						mix={[resizeHandle("vertical", columnSession)]}
					/>

					<Resizable.Panel
						id="preview-three"
						defaultSize={75}
						minSize={15}
						data-resizable-panel
						data-resizable-min="15"
						mix={[center(), text("sm"), weight("semibold")]}
					>
						Three
					</Resizable.Panel>
				</Resizable>
			</Resizable.Panel>
		</Resizable>
	);
});

export default { code: RESIZABLE_CODE, render: () => <ResizablePreview /> };
