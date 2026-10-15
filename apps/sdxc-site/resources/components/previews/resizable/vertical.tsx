/**
 * Live example island for a vertical `Resizable`: an editor stacked over its terminal,
 * split by a handle that drags up and down. The drag is `resizeHandle()` feeding a
 * `ResizeSession`, which runs in the browser, so the example hydrates for the handle to move.
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

/** The source the page shows, matching the markup below. */
const CODE = `let session = new ResizeSession();

<Resizable
	orientation="vertical"
	aria-label="Editor panes"
	data-resizable-group
	mix={[is("100%"), maxIs("28rem"), bs("16rem")]}
>
	<Resizable.Panel
		id="editor"
		defaultSize={60}
		minSize={20}
		data-resizable-panel
		data-resizable-min="20"
		mix={[center(), text("sm"), weight("semibold")]}
	>
		Editor
	</Resizable.Panel>

	<Resizable.Handle
		aria-label="Resize the terminal"
		aria-controls="editor terminal"
		data-resizable-handle
		mix={[resizeHandle("vertical", session)]}
	/>

	<Resizable.Panel
		id="terminal"
		defaultSize={40}
		minSize={20}
		data-resizable-panel
		data-resizable-min="20"
		mix={[center(), text("sm"), weight("semibold")]}
	>
		Terminal
	</Resizable.Panel>
</Resizable>`;

/** An editor over a terminal, hydrated so the handle between them drags. */
export const VerticalResizable = clientEntry(import.meta.url, function VerticalResizable() {
	let session = new ResizeSession();

	return () => (
		<Resizable
			orientation="vertical"
			aria-label="Editor panes"
			data-resizable-group
			mix={[is("100%"), maxIs("28rem"), bs("16rem")]}
		>
			<Resizable.Panel
				id="example-resizable-vertical-editor"
				defaultSize={60}
				minSize={20}
				data-resizable-panel
				data-resizable-min="20"
				mix={[center(), text("sm"), weight("semibold")]}
			>
				Editor
			</Resizable.Panel>

			<Resizable.Handle
				aria-label="Resize the terminal"
				aria-controls="example-resizable-vertical-editor example-resizable-vertical-terminal"
				data-resizable-handle
				mix={[resizeHandle("vertical", session)]}
			/>

			<Resizable.Panel
				id="example-resizable-vertical-terminal"
				defaultSize={40}
				minSize={20}
				data-resizable-panel
				data-resizable-min="20"
				mix={[center(), text("sm"), weight("semibold")]}
			>
				Terminal
			</Resizable.Panel>
		</Resizable>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Vertical split",
	code: CODE,
	render: () => <VerticalResizable />,
};
