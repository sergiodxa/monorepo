---
title: Accept PNG avatars and draw placeholders
description: Check an uploaded PNG's size before inflating it, decode it to prove it is an image, crop it square and store a clean copy, and draw an identicon from pixels for everyone who has not uploaded one.
section:
    title: Building Remix apps
    order: 4
order: 15
lastUpdated: 2026-10-25
outcomes:
    - "How to check an uploaded PNG's size before decoding it with `@sdxc/png`"
    - "How to crop an upload square and store a clean copy"
    - "How to draw an identicon from pixels for people with no upload"
---

An avatar upload is a file a stranger chose. The bytes may not be a PNG, may inflate into a
gigabyte of pixels, or may carry metadata the uploader never meant to publish. This guide checks
each of those, stores a square copy holding only pixels, and draws a placeholder for every
account without an upload.

[`@sdxc/png`](/api/png) decodes and encodes PNG in plain TypeScript, with no WebAssembly.
[`@sdxc/file-storage-r2`](/api/file-storage-r2) keeps the stored copies in an R2 bucket, and
[`@sdxc/crypto`](/api/crypto) hashes an account id into the placeholder's pattern.

```bash
npm add @sdxc/crypto @sdxc/file-storage-r2 @sdxc/http @sdxc/png @sdxc/result remix
```

## Read the size before decoding

A PNG states its width and height at a fixed place in its first chunk, so reading them answers
whether decoding is safe before any pixel is inflated.

> [!WARNING]
> `decode` refuses an image over 2²⁸ pixels on its own, but that is a gigabyte of RGBA, far more
> than a Worker's memory. Check the header against a limit of your own before decoding an
> upload, as `readAvatar` does.

```typescript {% title="app/services/avatars/read-avatar.ts" %}
import type { PNG } from "@sdxc/png";
import type { Result } from "@sdxc/result";

import { decode } from "@sdxc/png";
import { failure, isFailure, success } from "@sdxc/result";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 2048;
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export class AvatarError extends Error {
	override name = "AvatarError";

	constructor(
		readonly code: "too-large" | "not-png" | "too-many-pixels" | "unreadable",
		message: string,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

export async function readAvatar(
	file: File,
): Promise<Result<PNG.Image, AvatarError>> {
	if (file.size > MAX_BYTES) {
		return failure(
			new AvatarError("too-large", "The image is larger than 2 MB."),
		);
	}

	let bytes = new Uint8Array(await file.arrayBuffer());
	let size = headerSize(bytes);
	if (size === null)
		return failure(new AvatarError("not-png", "The file is not a PNG image."));
	if (size.width > MAX_SIDE || size.height > MAX_SIDE) {
		return failure(
			new AvatarError(
				"too-many-pixels",
				`The image is ${size.width}×${size.height}.`,
			),
		);
	}

	let image = await decode(bytes);
	if (isFailure(image)) {
		return failure(
			new AvatarError("unreadable", "The image is damaged.", {
				cause: image.error,
			}),
		);
	}
	return success(image.data);
}

function headerSize(bytes: Uint8Array): { width: number; height: number } | null {
	if (bytes.length < 24) return null;
	if (SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null;
	if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR") return null;
	let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}
```

A 2048 by 2048 image decodes into 16 MiB, which a Worker holds comfortably. A file that passes
the header check and is still broken fails in `decode`. Every PNG decodes to
`{ width, height, data }`, 8-bit RGBA with the top row first.

## Crop it square and store a clean copy

Pixel `(x, y)` starts at `(y * width + x) * 4`, so a centred square crop copies one run of bytes
per row:

```typescript {% title="app/services/avatars/crop-square.ts" %}
import type { PNG } from "@sdxc/png";

export function cropSquare(image: PNG.Image): PNG.Image {
	let side = Math.min(image.width, image.height);
	let left = Math.floor((image.width - side) / 2);
	let top = Math.floor((image.height - side) / 2);
	let data = new Uint8ClampedArray(side * side * 4);
	for (let row = 0; row < side; row++) {
		let start = ((top + row) * image.width + left) * 4;
		data.set(image.data.subarray(start, start + side * 4), row * side * 4);
	}
	return { width: side, height: side, data };
}
```

`encode` writes only the pixels and the text entries you pass, so the stored copy carries none of
the uploader's metadata:

```typescript {% title="app/http/controllers/account/avatar.ts" %}
import { redirect } from "@sdxc/http/response";
import { unprocessableEntity } from "@sdxc/http/response/html";
import { encode } from "@sdxc/png";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { avatars } from "~/app/models/avatars";
import { cropSquare } from "~/app/services/avatars/crop-square";
import { readAvatar } from "~/app/services/avatars/read-avatar";
import routes from "~/routes/web";

export default createAction(routes.account.avatar, async (ctx) => {
	let upload = ctx.formData.get("avatar");
	if (!(upload instanceof File))
		return unprocessableEntity("Choose a PNG image to upload.");

	let image = await readAvatar(upload);
	if (isFailure(image)) {
		ctx.log.warn("avatar.refused", { code: image.error.code });
		return unprocessableEntity(image.error.message);
	}

	let bytes = await encode(cropSquare(image.data));
	let file = new File([bytes.slice()], `${ctx.user.id}.png`, { type: "image/png" });
	await avatars().set(`avatars/${ctx.user.id}.png`, file);

	return redirect(routes.account.show.href(), { status: redirect.Status.SeeOther });
});
```

`ctx.user` is the signed-in account your auth middleware publishes. `avatars()` opens the
bucket:

```typescript {% title="app/models/avatars.ts" %}
import type { FileStorage } from "remix/file-storage";

import { R2FileStorage } from "@sdxc/file-storage-r2";
import { env } from "cloudflare:workers";

export function avatars(): FileStorage {
	return new R2FileStorage(env.AVATARS);
}
```

## Draw a placeholder from pixels

An identicon is a five-by-five grid mirrored left to right, whose cells and colour come from a
hash of the account id, so each account always gets the same one and nothing is stored:

```typescript {% title="app/services/avatars/identicon.ts" %}
import type { CryptoError } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { sha256 } from "@sdxc/crypto";
import { encode } from "@sdxc/png";
import { isFailure, success } from "@sdxc/result";

const CELL = 32;
const GRID = 5;
const SIDE = (GRID + 2) * CELL;
const BACKGROUND = [244, 244, 245, 255];
const COLORS = [
	[79, 70, 229, 255],
	[13, 148, 136, 255],
	[217, 70, 239, 255],
	[234, 88, 12, 255],
	[22, 163, 74, 255],
	[37, 99, 235, 255],
	[220, 38, 38, 255],
	[202, 138, 4, 255],
];

export async function identicon(
	seed: string,
): Promise<Result<Uint8Array, CryptoError>> {
	let digest = await sha256(seed);
	if (isFailure(digest)) return digest;
	let bits = digest.data;

	let data = new Uint8ClampedArray(SIDE * SIDE * 4);
	for (let offset = 0; offset < data.length; offset += 4)
		data.set(BACKGROUND, offset);

	let ink = COLORS[(bits[0] ?? 0) % COLORS.length] ?? BACKGROUND;
	for (let row = 0; row < GRID; row++) {
		for (let column = 0; column < 3; column++) {
			let bit = row * 3 + column;
			if ((((bits[1 + (bit >> 3)] ?? 0) >> (bit & 7)) & 1) === 0) continue;
			fillCell(data, column, row, ink);
			fillCell(data, GRID - 1 - column, row, ink);
		}
	}

	return success(await encode({ width: SIDE, height: SIDE, data }));
}

function fillCell(
	data: Uint8ClampedArray,
	column: number,
	row: number,
	rgba: number[],
) {
	let left = (column + 1) * CELL;
	let top = (row + 1) * CELL;
	for (let y = top; y < top + CELL; y++) {
		for (let x = left; x < left + CELL; x++) data.set(rgba, (y * SIDE + x) * 4);
	}
}
```

## Serve either one

One route answers every avatar: the stored upload when there is one, the identicon otherwise.

```typescript {% title="app/http/controllers/avatar.ts" %}
import { internalServerError } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { avatars } from "~/app/models/avatars";
import { identicon } from "~/app/services/avatars/identicon";
import routes from "~/routes/web";

const HEADERS = {
	"Content-Type": "image/png",
	"Cache-Control": "public, max-age=300",
};

export default createAction(routes.avatar, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);

	let stored = await avatars().get(`avatars/${id}.png`);
	if (stored) return new Response(stored.stream(), { headers: HEADERS });

	let placeholder = await identicon(id);
	if (isFailure(placeholder))
		return internalServerError("The avatar could not be drawn.");
	return new Response(placeholder.data.slice(), { headers: HEADERS });
});
```

`routes.avatar` is a route such as `/avatars/:id.png`; a pattern variable stops at the `.`, so
`id` arrives without the extension.

## Test on pixels

Decoding what your code encoded lets a test assert on pixels instead of compressed bytes:

```typescript {% title="app/services/avatars/identicon.test.ts" %}
import { decode } from "@sdxc/png";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { identicon } from "~/app/services/avatars/identicon";

test("an identicon is mirrored left to right", async () => {
	let image = unwrap(await decode(unwrap(await identicon("account-42"))));
	let pixel = (x: number, y: number) => [
		...image.data.subarray((y * 224 + x) * 4, (y * 224 + x) * 4 + 4),
	];

	for (let y = 48; y < 224; y += 32) {
		expect(pixel(48, y)).toEqual(pixel(175, y));
		expect(pixel(80, y)).toEqual(pixel(143, y));
	}
});
```

A second test rewrites the width a small PNG declares; the refusal names the size, which shows
`decode` never ran:

```typescript {% title="app/services/avatars/read-avatar.test.ts" %}
import { encode } from "@sdxc/png";
import { isFailure } from "@sdxc/result";
import { expect, test } from "vitest";

import { readAvatar } from "~/app/services/avatars/read-avatar";

test("refuses an oversized image before decoding it", async () => {
	let bytes = await encode({ width: 1, height: 1, data: new Uint8ClampedArray(4) });
	new DataView(bytes.buffer, bytes.byteOffset).setUint32(16, 4096);

	let result = await readAvatar(new File([bytes.slice()], "huge.png"));

	expect(isFailure(result) && result.error.code).toBe("too-many-pixels");
});
```

## Where to go next

- [Draw social card images](/docs/building-remix-apps/social-card-images) — drawing shapes and
  text onto a canvas that encodes to PNG.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — the form an upload
  posts from.
- [`@sdxc/png`](/api/png) — every encode option and decode error code.
