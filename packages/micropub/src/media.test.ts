/**
 * Exercises the media endpoint against Examples 18 and 19 of the Micropub W3C
 * Recommendation: one multipart part named `file`, checked for size and media type,
 * answered with `201 Created` and the file's URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Media } from "./media.js";

import { parseUpload, uploaded } from "./media.js";

import { MicropubRequestError } from "./index.js";

const ENDPOINT = "https://media.example.com/micropub";

/** A JPEG named as Example 18 names it. */
const SUNSET = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "sunset.jpg", {
	type: "image/jpeg",
});

/** A form holding `parts`. */
function formData(parts: [string, string | File][]): FormData {
	let data = new FormData();
	for (let [name, value] of parts) data.append(name, value);
	return data;
}

/** An upload request, authorized in the header unless `token` is `null`. */
function request(token: string | null = "xxxxxxxxx"): Request {
	let headers = new Headers();
	if (token !== null) headers.set("Authorization", `Bearer ${token}`);
	return new Request(ENDPOINT, { method: "POST", headers });
}

/** The error parsing produced, failing the test when parsing succeeds. */
function rejection(req: Request, options: Media.Options): MicropubRequestError {
	let result = parseUpload(req, options);
	if (!isFailure(result)) return expect.unreachable("Expected the upload to be rejected");
	return result.error;
}

describe(parseUpload, () => {
	test("Example 18: returns the file part and the header token", () => {
		let parsed = unwrap(
			parseUpload(request(), { formData: formData([["file", SUNSET]]), accept: ["image/*"] }),
		);

		expect(parsed.body.name).toBe("sunset.jpg");
		expect(parsed.accessToken).toBe("xxxxxxxxx");
	});

	test("reads access_token from the form", () => {
		let parsed = unwrap(
			parseUpload(request(null), {
				formData: formData([
					["file", SUNSET],
					["access_token", "form-token"],
				]),
				accept: ["image/jpeg"],
			}),
		);

		expect(parsed.accessToken).toBe("form-token");
	});

	test("matches a media type on its essence, ignoring case and parameters", () => {
		let file = new File(["x"], "a.png", { type: "Image/PNG; charset=binary" });

		expect(
			unwrap(
				parseUpload(request(), { formData: formData([["file", file]]), accept: ["image/png"] }),
			).body.name,
		).toBe("a.png");
	});

	test("accepts */* as any type", () => {
		let file = new File(["x"], "a.bin", { type: "application/octet-stream" });

		expect(
			unwrap(parseUpload(request(), { formData: formData([["file", file]]), accept: ["*/*"] })).body
				.name,
		).toBe("a.bin");
	});

	test("rejects a type the endpoint does not accept", () => {
		let gif = new File(["GIF89a"], "w3c-socialwg.gif", { type: "image/gif" });

		let error = rejection(request(), {
			formData: formData([["file", gif]]),
			accept: ["image/jpeg", "image/png"],
		});

		expect(error).toBeInstanceOf(MicropubRequestError);
		expect(error.message).toMatch(/image\/gif/);
	});

	test("rejects a file without a type unless everything is accepted", () => {
		let untyped = new File(["x"], "mystery");

		expect(
			rejection(request(), { formData: formData([["file", untyped]]), accept: ["image/*"] }),
		).toBeInstanceOf(MicropubRequestError);
	});

	test("rejects a file over maxBytes", () => {
		let error = rejection(request(), {
			formData: formData([["file", SUNSET]]),
			accept: ["image/*"],
			maxBytes: 2,
		});

		expect(error.message).toMatch(/2 bytes/);
	});

	test("rejects a form without a file part", () => {
		expect(
			rejection(request(), { formData: formData([["photo", SUNSET]]), accept: ["image/*"] })
				.message,
		).toMatch(/file/);
	});

	test("rejects a file part sent as text", () => {
		expect(
			rejection(request(), { formData: formData([["file", "sunset.jpg"]]), accept: ["image/*"] }),
		).toBeInstanceOf(MicropubRequestError);
	});

	test("rejects more than one file part", () => {
		expect(
			rejection(request(), {
				formData: formData([
					["file", SUNSET],
					["file", SUNSET],
				]),
				accept: ["image/*"],
			}).message,
		).toMatch(/one/);
	});

	test("rejects a token sent in both places", () => {
		expect(
			rejection(request("header"), {
				formData: formData([
					["file", SUNSET],
					["access_token", "body"],
				]),
				accept: ["image/*"],
			}).message,
		).toMatch(/both/);
	});
});

describe(uploaded, () => {
	test("Example 19: 201 with the file URL in Location", () => {
		let response = uploaded("https://media.example.com/file/ff176c461dd111e6b6ba3e1d05defe78.jpg");

		expect(response.status).toBe(201);
		expect(response.headers.get("Location")).toBe(
			"https://media.example.com/file/ff176c461dd111e6b6ba3e1d05defe78.jpg",
		);
	});
});
