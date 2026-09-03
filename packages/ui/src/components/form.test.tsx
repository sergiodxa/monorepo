/**
 * Tests for the path {@link Form}'s `issues` takes to reach a field: the
 * parse-then-re-render pattern passes `issues` alone, so a field must find
 * its own message through form context or show no error. Covers lookup by
 * `name`, an explicit `errorMessage` override, the aria wiring, and the
 * `autofocus` on the first invalid field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Form as FormNamespace } from "./form.js";

import { Form } from "./form.js";
import { TextField } from "./text-field.js";

/**
 * Strips the `<style>` block `renderToString` emits ahead of the markup: the
 * field's own stylesheet mentions `[aria-invalid="true"]` as a selector, so a
 * negative assertion has to look at the rendered elements alone.
 *
 * @param html A full `renderToString` result.
 * @returns Just the markup that follows the emitted styles.
 */
function markup(html: string): string {
	return html.slice(html.indexOf("</head>") + 1);
}

/** Issues standing in for a failed `parseSafe` over an email/password form. */
const ISSUES: ReadonlyArray<FormNamespace.Issue> = [
	{ message: "Enter a valid email", path: ["email"] },
	{ message: "Password is too short", path: ["password"] },
];

describe(Form.name, () => {
	test("hands each field its own message from issues alone, with no per-field prop", async () => {
		let html = await renderToString(
			<Form method="post" issues={ISSUES}>
				<TextField name="email" type="email" label="Email" />
				<TextField name="password" type="password" label="Password" />
			</Form>,
		);

		expect(html).toContain("Enter a valid email");
		expect(html).toContain("Password is too short");
	});

	test("marks a field found in issues invalid and points its aria-describedby at the message", async () => {
		let html = await renderToString(
			<Form method="post" issues={ISSUES}>
				<TextField name="email" type="email" label="Email" />
			</Form>,
		);

		expect(markup(html)).toContain('aria-invalid="true"');
		expect(html).toContain("-error");
		expect(html).toContain("aria-describedby");
	});

	test("gives autofocus to the first invalid field only", async () => {
		let html = await renderToString(
			<Form method="post" issues={ISSUES}>
				<TextField name="email" type="email" label="Email" />
				<TextField name="password" type="password" label="Password" />
			</Form>,
		);

		expect(markup(html).match(/autofocus/gi)).toHaveLength(1);
		expect(html.indexOf("autofocus")).toBeLessThan(html.indexOf('type="password"'));
	});

	test("leaves a field with no matching issue untouched", async () => {
		let html = await renderToString(
			<Form method="post" issues={ISSUES}>
				<TextField name="nickname" label="Nickname" />
			</Form>,
		);

		expect(html).not.toContain("Enter a valid email");
		expect(markup(html)).not.toContain('aria-invalid="true"');
		expect(markup(html)).not.toContain("autofocus");
	});

	test("renders no error and no autofocus for a form with no issues at all", async () => {
		let html = await renderToString(
			<Form method="post">
				<TextField name="email" type="email" label="Email" />
			</Form>,
		);

		expect(markup(html)).not.toContain('aria-invalid="true"');
		expect(markup(html)).not.toContain("autofocus");
	});

	test("lets an explicit errorMessage win over the one issues holds for that field", async () => {
		let html = await renderToString(
			<Form method="post" issues={ISSUES}>
				<TextField name="email" type="email" label="Email" errorMessage="That address is taken" />
			</Form>,
		);

		expect(html).toContain("That address is taken");
		expect(html).not.toContain("Enter a valid email");
	});

	test("lets an explicit autoFocus win over the first-invalid default", async () => {
		let html = await renderToString(
			<Form method="post" issues={ISSUES}>
				<TextField name="email" type="email" label="Email" autoFocus={false} />
			</Form>,
		);

		expect(markup(html)).not.toContain("autofocus");
	});
});

describe("a field outside any Form", () => {
	test("still renders its own errorMessage, and does not fail the lookup it can't satisfy", async () => {
		let html = await renderToString(
			<TextField name="email" type="email" label="Email" errorMessage="Enter a valid email" />,
		);

		expect(html).toContain("Enter a valid email");
		expect(markup(html)).toContain('aria-invalid="true"');
	});

	test("renders nothing extra when it has no message of its own", async () => {
		let html = await renderToString(<TextField name="email" type="email" label="Email" />);

		expect(markup(html)).not.toContain('aria-invalid="true"');
		expect(markup(html)).not.toContain("autofocus");
	});
});
