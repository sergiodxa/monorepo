/**
 * Opens Confirm in a real browser: a plain confirm starts on Cancel, and the
 * type-to-confirm variant keeps its confirming control disabled until the phrase
 * matches exactly, locking again whenever the dialog closes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { Confirm } from "./confirm.js";

/** Mounts `node` and returns the dialog it renders, opened as a modal. */
async function open(node: JSX.Element): Promise<HTMLDialogElement> {
	let host = document.createElement("div");
	document.body.appendChild(host);
	render(node, { container: host });
	await new Promise((resolve) => requestAnimationFrame(resolve));
	let dialog = host.querySelector("dialog")!;
	dialog.showModal();
	return dialog;
}

/** The confirming control of `dialog`. */
function action(dialog: HTMLDialogElement): HTMLButtonElement {
	return dialog.querySelector<HTMLButtonElement>("[data-confirm-action]")!;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("Confirm", () => {
	test("starts on Cancel, so Enter on a plain confirm never deletes anything", async () => {
		let dialog = await open(
			<Confirm
				id="delete-monitor"
				title="Delete monitor?"
				description="api.acme.dev stops being checked and its history is deleted."
				confirmLabel="Delete monitor"
				cancelLabel="Cancel"
			/>,
		);

		expect(document.activeElement?.textContent).toBe("Cancel");
		expect(dialog.getAttribute("role")).toBe("alertdialog");
		expect(action(dialog).disabled).toBe(false);
	});

	test("holds the confirming control disabled until the phrase matches exactly", async () => {
		let dialog = await open(
			<Confirm
				id="delete-team"
				title="Delete team?"
				confirmLabel="Delete team"
				cancelLabel="Cancel"
				typeToConfirm={{ value: "acme (prod)", label: 'Type "acme (prod)" to confirm' }}
				form={{ action: "/teams/acme/delete" }}
			/>,
		);
		let input = dialog.querySelector("input")!;

		expect(document.activeElement).toBe(input);
		expect(action(dialog).disabled).toBe(true);
		expect(input.labels?.[0]?.textContent).toBe('Type "acme (prod)" to confirm');

		await userEvent.type(input, "acme (prod");
		expect(action(dialog).disabled).toBe(true);

		await userEvent.type(input, ")");
		expect(action(dialog).disabled).toBe(false);

		await userEvent.type(input, "!");
		expect(action(dialog).disabled).toBe(true);
	});

	test("lets the field's pattern refuse a mismatch when no script runs", async () => {
		let dialog = await open(
			<Confirm
				id="delete-team"
				title="Delete team?"
				confirmLabel="Delete team"
				cancelLabel="Cancel"
				typeToConfirm={{ value: "a.b", label: "Type a.b" }}
				form={{ action: "/teams/a/delete" }}
			/>,
		);
		let input = dialog.querySelector("input")!;

		input.value = "axb";
		expect(input.checkValidity()).toBe(false);
		input.value = "a.b";
		expect(input.checkValidity()).toBe(true);
	});

	test("clears the phrase and locks again when the dialog closes", async () => {
		let dialog = await open(
			<Confirm
				id="delete-team"
				title="Delete team?"
				confirmLabel="Delete team"
				cancelLabel="Cancel"
				typeToConfirm={{ value: "acme", label: 'Type "acme" to confirm' }}
			/>,
		);
		let input = dialog.querySelector("input")!;

		await userEvent.type(input, "acme");
		expect(action(dialog).disabled).toBe(false);

		let closed = new Promise((resolve) =>
			dialog.addEventListener("close", resolve, { once: true }),
		);
		dialog.close();
		await closed;

		expect(input.value).toBe("");
		expect(action(dialog).disabled).toBe(true);
	});
});
