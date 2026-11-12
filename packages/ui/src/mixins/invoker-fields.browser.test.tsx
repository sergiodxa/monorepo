/**
 * Tests for {@link invokerFields} in a real browser: a button carrying `name` and `value` opens a
 * dialog with that field preset, a plain opener leaves the defaults, and closing restores them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { invokerFields } from "./invoker-fields.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** Mounts two openers and a dialog whose form has a status select defaulting to Todo. */
function mount(): { dialog: HTMLDialogElement; status: HTMLSelectElement } {
	mounted = render(
		<div>
			<button id="plain" type="button" commandfor="create" command="show-modal">
				New
			</button>
			<button
				id="done"
				type="button"
				commandfor="create"
				command="show-modal"
				name="status"
				value="done"
			>
				New in Done
			</button>
			<dialog id="create">
				<span hidden mix={[invokerFields()]} />
				<form method="dialog">
					<select name="status">
						<option value="todo" selected>
							Todo
						</option>
						<option value="done">Done</option>
					</select>
				</form>
			</dialog>
		</div>,
	);
	return {
		dialog: document.querySelector<HTMLDialogElement>("#create")!,
		status: document.querySelector<HTMLSelectElement>("select")!,
	};
}

/** Lets the dialog's `close` event, which the browser queues, reach its listeners. */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("invokerFields", () => {
	test("presets the field the opening button names, then restores it once the dialog closes", async () => {
		let { dialog, status } = mount();

		document.querySelector<HTMLButtonElement>("#done")!.click();
		expect(dialog.open).toBe(true);
		expect(status.value).toBe("done");

		dialog.close();
		await settle();
		expect(status.value).toBe("todo");

		document.querySelector<HTMLButtonElement>("#plain")!.click();
		expect(status.value).toBe("todo");
	});
});
