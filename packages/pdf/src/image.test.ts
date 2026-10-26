import { encode } from "@sdxc/png";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

/**
 * Tests for embedded images: JPEG header parsing and pass-through, PNG decoding into RGB or
 * gray samples with a soft mask only for transparency, and how pages draw and list images.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { InspectedFile, InspectedObject } from "./inspect.js";

import { inflate, inspect, pageContents } from "./inspect.js";
import { PDF } from "./pdf.js";

/**
 * A JPEG with every segment a header reader needs and a placeholder scan: SOI, APP0, an
 * optional Adobe APP14, a start-of-frame, a scan header, a few entropy bytes and EOI.
 *
 * @param options - Frame dimensions, component count, frame marker, precision and APP14.
 */
function jpeg(
	options: {
		width?: number;
		height?: number;
		components?: number;
		frame?: number;
		precision?: number;
		adobe?: boolean;
	} = {},
): Uint8Array {
	let { width = 40, height = 20, components = 3, frame = 0xc0, precision = 8 } = options;
	let bytes = [0xff, 0xd8];
	bytes.push(0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0);
	if (options.adobe) {
		bytes.push(0xff, 0xee, 0x00, 0x0e, 0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, 0);
	}
	let length = 8 + components * 3;
	bytes.push(0xff, frame, length >> 8, length & 0xff, precision);
	bytes.push(height >> 8, height & 0xff, width >> 8, width & 0xff, components);
	for (let index = 0; index < components; index++) bytes.push(index + 1, 0x11, 0);
	bytes.push(0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00);
	bytes.push(0x12, 0x34, 0x56, 0xff, 0xd9);
	return new Uint8Array(bytes);
}

/**
 * A PNG file of solid pixels.
 *
 * @param width - Pixels across.
 * @param height - Pixels down.
 * @param rgba - The color every pixel gets.
 */
async function png(
	width: number,
	height: number,
	rgba: [number, number, number, number],
): Promise<Uint8Array> {
	let data = new Uint8ClampedArray(width * height * 4);
	for (let index = 0; index < data.length; index += 4) data.set(rgba, index);
	return encode({ width, height, data }, { alpha: "keep" });
}

/**
 * The image XObjects of a written file, masks included.
 *
 * @param file - An inspected file.
 */
function images(file: InspectedFile): InspectedObject[] {
	return [...file.objects.values()].filter((object) => object.head.includes("/Subtype /Image"));
}

/**
 * Writes a one-page document that draws the image once and answers the inspected file.
 *
 * @param bytes - The image file.
 */
async function drawn(bytes: Uint8Array): Promise<InspectedFile> {
	let pdf = new PDF();
	let image = unwrap(await pdf.image(bytes));
	pdf.page().image(image, { x: 0, y: 0, width: 100 });
	return inspect(await pdf.bytes());
}

describe("JPEG", () => {
	test("reads the frame size and passes the file through as DCTDecode", async () => {
		let bytes = jpeg({ width: 300, height: 150 });
		let image = unwrap(await new PDF().image(bytes));
		expect([image.width, image.height]).toEqual([300, 150]);

		let file = await drawn(bytes);
		let [object] = images(file);
		expect(object?.head).toContain("/Width 300 /Height 150");
		expect(object?.head).toContain("/ColorSpace /DeviceRGB /BitsPerComponent 8");
		expect(object?.head).toContain("/Filter /DCTDecode");
		expect(object?.head).not.toContain("/Decode");
		expect(object?.stream).toEqual(bytes);
		expect(file.xrefValid).toBe(true);
	});

	test("maps the component count to a color space", async () => {
		let gray = images(await drawn(jpeg({ components: 1 })))[0];
		expect(gray?.head).toContain("/ColorSpace /DeviceGray");
		let cmyk = images(await drawn(jpeg({ components: 4 })))[0];
		expect(cmyk?.head).toContain("/ColorSpace /DeviceCMYK");
		expect(cmyk?.head).not.toContain("/Decode");
	});

	test("inverts an Adobe CMYK JPEG with a Decode array", async () => {
		let [object] = images(await drawn(jpeg({ components: 4, adobe: true })));
		expect(object?.head).toContain("/Decode [1 0 1 0 1 0 1 0]");
		let [rgb] = images(await drawn(jpeg({ components: 3, adobe: true })));
		expect(rgb?.head).not.toContain("/Decode");
	});

	test("accepts a progressive frame", async () => {
		expect(isSuccess(await new PDF().image(jpeg({ frame: 0xc2 })))).toBe(true);
	});

	test("refuses frames PDF viewers cannot decode as unsupported", async () => {
		for (let options of [{ frame: 0xc9 }, { frame: 0xc3 }, { precision: 12 }, { components: 2 }]) {
			let result = await new PDF().image(jpeg(options));
			expect(isFailure(result) && result.error.code).toBe("unsupported-image");
		}
	});

	test("refuses a truncated or garbled file as invalid", async () => {
		let whole = jpeg();
		for (let bytes of [
			whole.subarray(0, 25),
			whole.subarray(0, 2),
			new Uint8Array([0xff, 0xd8, 0x00, 0x00]),
			new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08]),
		]) {
			let result = await new PDF().image(bytes);
			expect(isFailure(result) && result.error.code).toBe("invalid-image");
		}
	});
});

describe("PNG", () => {
	test("writes opaque pixels as RGB with no soft mask", async () => {
		let file = await drawn(await png(3, 2, [255, 0, 0, 255]));
		let objects = images(file);
		expect(objects).toHaveLength(1);
		let [object] = objects;
		expect(object?.head).toContain("/Width 3 /Height 2");
		expect(object?.head).toContain("/ColorSpace /DeviceRGB /BitsPerComponent 8");
		expect(object?.head).toContain("/Filter /FlateDecode");
		expect(object?.head).not.toContain("/SMask");
		expect([...(await inflate(object?.stream ?? new Uint8Array()))]).toEqual(
			Array.from({ length: 6 }, () => [255, 0, 0]).flat(),
		);
	});

	test("adds a DeviceGray soft mask holding the alpha channel", async () => {
		let file = await drawn(await png(2, 2, [0, 128, 255, 64]));
		let color = images(file).find((object) => object.head.includes("/SMask"));
		let ref = /\/SMask (\d+) 0 R/.exec(color?.head ?? "")?.[1];
		let mask = file.objects.get(Number(ref));
		expect(mask?.head).toContain("/Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8");
		expect(mask?.head).not.toContain("/SMask");
		expect([...(await inflate(mask?.stream ?? new Uint8Array()))]).toEqual([64, 64, 64, 64]);
		expect([...(await inflate(color?.stream ?? new Uint8Array()))]).toEqual(
			Array.from({ length: 4 }, () => [0, 128, 255]).flat(),
		);
		expect(file.xrefValid).toBe(true);
	});

	test("writes an all-gray image with one sample per pixel", async () => {
		let [object] = images(await drawn(await png(2, 1, [90, 90, 90, 255])));
		expect(object?.head).toContain("/ColorSpace /DeviceGray");
		expect([...(await inflate(object?.stream ?? new Uint8Array()))]).toEqual([90, 90]);
	});

	test("reports a corrupt PNG as invalid with the decoder's error as cause", async () => {
		let bytes = await png(4, 4, [1, 2, 3, 255]);
		let result = await new PDF().image(bytes.subarray(0, bytes.length - 20));
		expect(isFailure(result) && result.error.code).toBe("invalid-image");
		expect(isFailure(result) && result.error.cause).toBeInstanceOf(Error);
	});
});

test("refuses bytes that are neither JPEG nor PNG as unsupported", async () => {
	for (let bytes of [new Uint8Array(), new TextEncoder().encode("GIF89a")]) {
		let result = await new PDF().image(bytes);
		expect(isFailure(result) && result.error.code).toBe("unsupported-image");
	}
});

describe("drawing", () => {
	test("maps the image onto its box in PDF space, keeping the aspect ratio", async () => {
		let pdf = new PDF({ size: [600, 800] });
		let image = unwrap(await pdf.image(jpeg({ width: 400, height: 200 })));
		let page = pdf.page();
		page.image(image, { x: 50, y: 100, width: 300 });
		page.image(image, { x: 10, y: 20, width: 30, height: 40 });
		let [content] = await pageContents(inspect(await pdf.bytes()));
		expect(content).toBe("q 300 0 0 150 50 550 cm /Im1 Do Q\nq 30 0 0 40 10 740 cm /Im1 Do Q");
	});

	test("writes each image once and lists it in every page's XObject resources", async () => {
		let pdf = new PDF();
		let image = unwrap(await pdf.image(await png(2, 2, [0, 0, 0, 128])));
		let first = pdf.page();
		first.image(image, { x: 0, y: 0, width: 10 });
		first.image(image, { x: 20, y: 0, width: 10 });
		pdf.page().image(image, { x: 0, y: 0, width: 10 });
		let file = inspect(await pdf.bytes());

		let objects = images(file);
		expect(objects).toHaveLength(2);
		let ref = objects.find((object) => object.head.includes("/SMask"))?.id;
		let pages = [...file.objects.values()].filter((object) => /\/Type \/Page\b/.test(object.head));
		expect(pages).toHaveLength(2);
		for (let page of pages) expect(page.head).toContain(`/XObject << /Im1 ${ref} 0 R >>`);
	});

	test("leaves out an image no page draws", async () => {
		let pdf = new PDF();
		unwrap(await pdf.image(jpeg()));
		let drawnImage = unwrap(await pdf.image(jpeg({ width: 7 })));
		pdf.page().image(drawnImage, { x: 0, y: 0, width: 7 });
		let file = inspect(await pdf.bytes());
		expect(images(file).map((object) => /\/Width (\d+)/.exec(object.head)?.[1])).toEqual(["7"]);
		expect(file.text).toContain("/XObject << /Im2 ");
	});
});
