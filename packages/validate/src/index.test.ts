import { describe, expect, test } from "bun:test";

import { isSuccess, isFailure } from "@pkg/result";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { z } from "zod";

import { validate, ValidationError } from "./index";

// Define schemas using Zod
let userSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Invalid email format"),
});

let _stringSchema = z.object({
	value: z.string(),
});

let _numberSchema = z.object({
	value: z.number(),
});

let asyncSchema = z.object({
	value: z.string().refine(
		async (val) => {
			// Simulate async validation
			await new Promise((resolve) => setTimeout(resolve, 1));
			return val.length > 0;
		},
		{ message: "Value must not be empty" },
	),
});

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
				expect(result.error.issues[0].message).toBe("Invalid email format");
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
				expect(result.error.issues[0].message).toBe("Invalid JSON in request body");
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
				expect(result.error.issues[0].message).toBe("Invalid email format");
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
				expect(result.error.issues[0].message).toBe("Invalid email format");
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
				expect(result.error.issues[0].message).toBe("Invalid email format");
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
			// When you pass FormData to Request, it automatically sets
			// Content-Type: multipart/form-data with the correct boundary
			let formData = new FormData();
			formData.append("name", "Test");
			formData.append("email", "test@example.com");

			let request = new Request("https://example.com/submit", {
				method: "POST",
				body: formData,
			});

			// Verify the content-type was set automatically
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
				expect(result.error.issues[0].message).toContain("Unsupported content-type");
				expect(result.error.issues[0].message).toContain("text/plain");
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
				expect(result.error.issues[0].message).toContain("Unsupported content-type");
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
				expect(result.error.issues[0].message).toBe("Value must not be empty");
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
				// TypeScript should infer result.data as { name: string, email: string }
				let user: { name: string; email: string } = result.data;
				expect(user.name).toBe("Test");
				expect(user.email).toBe("test@example.com");
			}
		});
	});

	describe("schema transformations", () => {
		test("transforms data during validation", async () => {
			let transformSchema = z.object({
				email: z.string().email().toLowerCase(),
				age: z.string().transform(Number),
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
			let nestedSchema = z.object({
				user: z.object({
					name: z.string(),
					email: z.string().email(),
				}),
				preferences: z.object({
					newsletter: z.boolean(),
					theme: z.enum(["light", "dark"]),
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
			let nestedSchema = z.object({
				user: z.object({
					name: z.string(),
					email: z.string().email(),
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
			let optionalSchema = z.object({
				name: z.string(),
				email: z.string().email(),
				age: z.number().optional(),
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

	// `remix/data-schema/form-data`'s `object()` validates the raw `FormData`/
	// `URLSearchParams` source directly (it reads fields via `.get()`/`.getAll()`)
	// instead of a flattened plain object, unlike the Zod/core-`remix/data-schema`
	// schemas used everywhere else in this file. `validate()` must detect this and
	// retry with the raw source instead of always failing.
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
			// `email` is missing entirely.

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

	// Confirms the fix above didn't change behavior for schemas that already
	// succeed against the flattened plain object — this is core `remix/data-schema`
	// (not `form-data`), which, like Zod, expects a plain object rather than the raw
	// `FormData`/`URLSearchParams` source.
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
