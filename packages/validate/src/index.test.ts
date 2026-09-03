/**
 * Covers `validate()` across every input shape it accepts, including
 * `FormData`, `URLSearchParams`, `Request` bodies, and plain objects, plus
 * the two `FormData`-reading schema styles it must reconcile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";
import { describe, expect, test } from "vitest";

import { validate, ValidationError } from "./index.js";

/** Checks are plain objects, so a custom `message` is applied by spreading the factory's result instead of passing an argument to it. */
let userSchema = s.object({
	name: s.string().pipe({ ...minLength(1), message: "Name is required" }),
	email: s.string().pipe({ ...email(), message: "Invalid email format" }),
});

/**
 * `remix/data-schema` schemas are synchronous, so an async `.refine()` always
 * passes silently; hand-rolling the Standard Schema interface here exercises
 * the `result instanceof Promise` branches `validate()` supports.
 */
type AsyncInput = { value: string };

let asyncSchema: StandardSchemaV1<AsyncInput, AsyncInput> = {
	"~standard": {
		version: 1,
		vendor: "test",
		async validate(input) {
			await new Promise((resolve) => setTimeout(resolve, 1));

			let data = input as AsyncInput;

			if (typeof data?.value !== "string" || data.value.length === 0) {
				return { issues: [{ message: "Value must not be empty", path: ["value"] }] };
			}

			return { value: data };
		},
	},
};

describe("validate", () => {
	describe("with FormData", () => {
		test("validates successfully with valid data", async () => {
			let formData = new FormData();
			formData.append("name", "Alice");
			formData.append("email", "alice@example.com");

			let result = await validate(formData, userSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Alice");
				expect(result.data.email).toBe("alice@example.com");
			}
		});

		test("returns failure with invalid data", async () => {
			let formData = new FormData();
			formData.append("name", "Alice");
			formData.append("email", "not-an-email");

			let result = await validate(formData, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(ValidationError);
				expect(result.error.issues.length).toBeGreaterThan(0);
				expect(result.error.issues[0]?.message).toBe("Invalid email format");
			}
		});

		test("returns failure with missing fields", async () => {
			let formData = new FormData();
			formData.append("name", "Alice");

			let result = await validate(formData, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				let emailIssue = result.error.issues.find(
					(issue) => Array.isArray(issue.path) && issue.path.includes("email"),
				);
				expect(emailIssue).toBeDefined();
			}
		});

		test("returns failure with empty name", async () => {
			let formData = new FormData();
			formData.append("name", "");
			formData.append("email", "test@example.com");

			let result = await validate(formData, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				let nameIssue = result.error.issues.find(
					(issue) => Array.isArray(issue.path) && issue.path.includes("name"),
				);
				expect(nameIssue?.message).toBe("Name is required");
			}
		});
	});

	describe("with Request (FormData)", () => {
		test("validates FormData from Request", async () => {
			let formData = new FormData();
			formData.append("name", "Bob");
			formData.append("email", "bob@example.com");

			let request = new Request("https://example.com/submit", {
				method: "POST",
				body: formData,
			});

			let result = await validate(request, userSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Bob");
				expect(result.data.email).toBe("bob@example.com");
			}
		});

		test("handles validation errors from Request FormData", async () => {
			let formData = new FormData();
			formData.append("name", "Bob");
			formData.append("email", "invalid-email");

			let request = new Request("https://example.com/submit", {
				method: "POST",
				body: formData,
			});

			let result = await validate(request, userSchema);

			expect(isFailure(result)).toBe(true);
		});
	});

	describe("with Request (JSON)", () => {
		test("validates JSON from Request", async () => {
			let request = new Request("https://example.com/api", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Charlie",
					email: "charlie@example.com",
				}),
			});

			let result = await validate(request, userSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Charlie");
				expect(result.data.email).toBe("charlie@example.com");
			}
		});

		test("handles invalid JSON in Request", async () => {
			let request = new Request("https://example.com/api", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{ invalid json",
			});

			let result = await validate(request, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues[0]?.message).toBe("Invalid JSON in request body");
			}
		});

		test("validates with JSON content-type variations", async () => {
			let request = new Request("https://example.com/api", {
				method: "POST",
				headers: { "Content-Type": "application/json; charset=utf-8" },
				body: JSON.stringify({
					name: "Diana",
					email: "diana@example.com",
				}),
			});

			let result = await validate(request, userSchema);

			expect(isSuccess(result)).toBe(true);
		});

		test("handles validation errors from JSON Request", async () => {
			let request = new Request("https://example.com/api", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Eve",
					email: "not-an-email",
				}),
			});

			let result = await validate(request, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues[0]?.message).toBe("Invalid email format");
			}
		});
	});

	describe("with plain object", () => {
		test("validates plain objects", async () => {
			let data = {
				name: "Frank",
				email: "frank@example.com",
			};

			let result = await validate(data, userSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Frank");
				expect(result.data.email).toBe("frank@example.com");
			}
		});

		test("handles validation errors from plain objects", async () => {
			let data = {
				name: "Grace",
				email: "invalid",
			};

			let result = await validate(data, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues[0]?.message).toBe("Invalid email format");
			}
		});

		test("handles empty objects", async () => {
			let result = await validate({}, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues.length).toBeGreaterThan(0);
			}
		});
	});

	describe("with URLSearchParams", () => {
		test("validates URLSearchParams directly", async () => {
			let params = new URLSearchParams();
			params.append("name", "Alice");
			params.append("email", "alice@example.com");

			let result = await validate(params, userSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Alice");
				expect(result.data.email).toBe("alice@example.com");
			}
		});

		test("handles validation errors from URLSearchParams", async () => {
			let params = new URLSearchParams();
			params.append("name", "Bob");
			params.append("email", "invalid-email");

			let result = await validate(params, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues[0]?.message).toBe("Invalid email format");
			}
		});

		test("handles empty URLSearchParams", async () => {
			let params = new URLSearchParams();

			let result = await validate(params, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues.length).toBeGreaterThan(0);
			}
		});
	});

	describe("content-type validation", () => {
		test("handles multipart/form-data (auto-detected)", async () => {
			let formData = new FormData();
			formData.append("name", "Test");
			formData.append("email", "test@example.com");

			let request = new Request("https://example.com/submit", {
				method: "POST",
				body: formData,
			});

			let contentType = request.headers.get("content-type");
			expect(contentType).toContain("multipart/form-data");

			let result = await validate(request, userSchema);

			expect(isSuccess(result)).toBe(true);
		});

		test("handles application/x-www-form-urlencoded", async () => {
			let params = new URLSearchParams();
			params.append("name", "Test");
			params.append("email", "test@example.com");

			let request = new Request("https://example.com/submit", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params,
			});

			let result = await validate(request, userSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Test");
				expect(result.data.email).toBe("test@example.com");
			}
		});

		test("rejects unsupported content-types", async () => {
			let request = new Request("https://example.com/submit", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: "plain text",
			});

			let result = await validate(request, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues[0]?.message).toContain("Unsupported content-type");
				expect(result.error.issues[0]?.message).toContain("text/plain");
			}
		});

		test("rejects requests with no content-type", async () => {
			let request = new Request("https://example.com/submit", {
				method: "POST",
				body: "some body",
			});

			let result = await validate(request, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues[0]?.message).toContain("Unsupported content-type");
			}
		});
	});

	describe("async schemas", () => {
		test("handles async validation", async () => {
			let formData = new FormData();
			formData.append("value", "test");

			let result = await validate(formData, asyncSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.value).toBe("test");
			}
		});

		test("handles async validation failures", async () => {
			let formData = new FormData();
			formData.append("value", "");

			let result = await validate(formData, asyncSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error.issues[0]?.message).toBe("Value must not be empty");
			}
		});
	});

	describe("ValidationError", () => {
		test("creates error with issues", async () => {
			let formData = new FormData();
			let result = await validate(formData, userSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(result.error).toBeInstanceOf(ValidationError);
				expect(result.error.message).toBe("Validation Error");
				expect(Array.isArray(result.error.issues)).toBe(true);
			}
		});

		test("preserves issue structure", async () => {
			let formData = new FormData();
			formData.append("name", "Test");
			formData.append("email", "invalid");

			let result = await validate(formData, userSchema);

			if (isFailure(result)) {
				let emailIssue = result.error.issues.find((issue) => {
					return Array.isArray(issue.path) && issue.path.includes("email");
				});

				expect(emailIssue).toBeDefined();
				expect(emailIssue?.message).toBe("Invalid email format");
			}
		});
	});

	describe("type inference", () => {
		test("infers correct output type", async () => {
			let formData = new FormData();
			formData.append("name", "Test");
			formData.append("email", "test@example.com");

			let result = await validate(formData, userSchema);

			if (isSuccess(result)) {
				let user: { name: string; email: string } = result.data;
				expect(user.name).toBe("Test");
				expect(user.email).toBe("test@example.com");
			}
		});
	});

	describe("schema transformations", () => {
		test("transforms data during validation", async () => {
			let transformSchema = s.object({
				email: s
					.string()
					.pipe(email())
					.transform((value) => value.toLowerCase()),
				age: s.string().transform(Number),
			});

			let formData = new FormData();
			formData.append("email", "USER@EXAMPLE.COM");
			formData.append("age", "25");

			let result = await validate(formData, transformSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.email).toBe("user@example.com");
				expect(result.data.age).toBe(25);
			}
		});
	});

	describe("nested objects", () => {
		test("validates nested object structures", async () => {
			let nestedSchema = s.object({
				user: s.object({
					name: s.string(),
					email: s.string().pipe(email()),
				}),
				preferences: s.object({
					newsletter: s.boolean(),
					theme: s.enum_(["light", "dark"]),
				}),
			});

			let data = {
				user: {
					name: "Alice",
					email: "alice@example.com",
				},
				preferences: {
					newsletter: true,
					theme: "dark" as const,
				},
			};

			let result = await validate(data, nestedSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.user.name).toBe("Alice");
				expect(result.data.preferences.theme).toBe("dark");
			}
		});

		test("reports errors with nested paths", async () => {
			let nestedSchema = s.object({
				user: s.object({
					name: s.string(),
					email: s.string().pipe(email()),
				}),
			});

			let data = {
				user: {
					name: "Bob",
					email: "invalid-email",
				},
			};

			let result = await validate(data, nestedSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				let emailIssue = result.error.issues.find((issue) => {
					return (
						Array.isArray(issue.path) && issue.path.includes("user") && issue.path.includes("email")
					);
				});
				expect(emailIssue).toBeDefined();
			}
		});
	});

	describe("optional fields", () => {
		test("handles optional fields", async () => {
			let optionalSchema = s.object({
				name: s.string(),
				email: s.string().pipe(email()),
				age: s.optional(s.number()),
			});

			let formData = new FormData();
			formData.append("name", "Alice");
			formData.append("email", "alice@example.com");

			let result = await validate(formData, optionalSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Alice");
				expect(result.data.age).toBeUndefined();
			}
		});
	});

	/**
	 * `remix/data-schema/form-data`'s `object()` validates the raw `FormData`/
	 * `URLSearchParams` source directly, reading fields via `.get()`/`.getAll()`
	 * instead of a flattened plain object, so `validate()` must detect and retry.
	 */
	describe("with remix/data-schema/form-data schemas", () => {
		let formSchema = f.object({
			name: f.field(s.string()),
			email: f.field(s.string()),
		});

		test("validates successfully with valid FormData", async () => {
			let formData = new FormData();
			formData.append("name", "Alice");
			formData.append("email", "alice@example.com");

			let result = await validate(formData, formSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Alice");
				expect(result.data.email).toBe("alice@example.com");
			}
		});

		test("validates successfully with valid URLSearchParams", async () => {
			let params = new URLSearchParams();
			params.append("name", "Bob");
			params.append("email", "bob@example.com");

			let result = await validate(params, formSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Bob");
				expect(result.data.email).toBe("bob@example.com");
			}
		});

		test("returns the field-level failure, not the raw-source rejection, for missing data", async () => {
			let formData = new FormData();
			formData.append("name", "Alice");

			let result = await validate(formData, formSchema);

			expect(isFailure(result)).toBe(true);
			if (isFailure(result)) {
				expect(
					result.error.issues.some(
						(issue) => issue.message === "Expected FormData or URLSearchParams",
					),
				).toBe(false);
			}
		});

		test("does not silently succeed with empty data", async () => {
			let result = await validate(new FormData(), formSchema);

			expect(isFailure(result)).toBe(true);
		});
	});

	/**
	 * Confirms the raw-source retry added for `form-data` schemas leaves core
	 * `remix/data-schema` schemas, which validate a flattened plain object,
	 * succeeding exactly as before.
	 */
	describe("with core remix/data-schema (non-form-data) schemas", () => {
		let coreSchema = s.object({ name: s.string(), email: s.string() });

		test("validates successfully with valid FormData", async () => {
			let formData = new FormData();
			formData.append("name", "Carol");
			formData.append("email", "carol@example.com");

			let result = await validate(formData, coreSchema);

			expect(isSuccess(result)).toBe(true);
			if (isSuccess(result)) {
				expect(result.data.name).toBe("Carol");
				expect(result.data.email).toBe("carol@example.com");
			}
		});
	});
});
