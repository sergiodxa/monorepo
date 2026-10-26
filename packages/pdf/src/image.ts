/**
 * Images a document embeds: a JPEG passes through as `DCTDecode`, and a PNG is decoded with
 * `@sdxc/png` to RGB plus a soft mask when it has transparency. Each becomes one image
 * XObject, drawn as many times as pages ask for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { decode } from "@sdxc/png";
import { failure, isFailure, success } from "@sdxc/result";

import type { Canvas } from "./canvas.js";
import type { Dict, ObjectTable, Ref } from "./objects.js";

import { Name, deflate, name, num } from "./objects.js";
import { PDFError } from "./pdf-error.js";

/** The bytes every PNG file starts with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Start-of-frame markers whose Huffman-coded 8-bit data every `DCTDecode` reader handles:
 * baseline, extended sequential and progressive.
 */
const JPEG_DCT_FRAMES = new Set([0xc0, 0xc1, 0xc2]);

/**
 * The remaining start-of-frame markers: lossless, hierarchical and arithmetic-coded frames,
 * which a JPEG may use but PDF viewers cannot reliably decode.
 */
const JPEG_OTHER_FRAMES = new Set([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** The color space a JPEG's component count implies. */
const JPEG_COLOR_SPACES: Record<number, string> = {
	1: "DeviceGray",
	3: "DeviceRGB",
	4: "DeviceCMYK",
};

/** Where `page.image()` puts an image, in top-down page coordinates. */
export interface ImageOptions {
	x: number;
	y: number;
	width: number;
	/** Height in points; omitted, it keeps the image's aspect ratio at `width`. */
	height?: number;
}

/** A JPEG kept as its file bytes, which the PDF stores unchanged. */
interface JPEGSource {
	kind: "jpeg";
	bytes: Uint8Array;
	colorSpace: string;
	/** An Adobe `APP14` marker on a CMYK file, whose samples are stored inverted. */
	inverted: boolean;
}

/** A decoded PNG as straight RGBA, compressed only when the document is written. */
interface PixelSource {
	kind: "pixels";
	data: Uint8ClampedArray;
}

/** What an image writes its XObject from. */
export type ImageSource = JPEGSource | PixelSource;

/** What a JPEG's header says about the frame. */
interface JPEGHeader {
	width: number;
	height: number;
	components: number;
	adobe: boolean;
}

/** An image a document embeds. Obtain one from `pdf.image()`. */
export class EmbeddedImage {
	/** The resource name pages list the image under (`Im1`, `Im2`, …). */
	readonly resource: string;
	/** Width in pixels. */
	readonly width: number;
	/** Height in pixels. */
	readonly height: number;

	#source: ImageSource;

	/**
	 * @param resource - The page resource name.
	 * @param width - Width in pixels.
	 * @param height - Height in pixels.
	 * @param source - The JPEG bytes or decoded pixels the XObject is written from.
	 */
	constructor(resource: string, width: number, height: number, source: ImageSource) {
		this.resource = resource;
		this.width = width;
		this.height = height;
		this.#source = source;
	}

	/**
	 * Writes the image XObject, and its soft mask when it has one, and answers its reference.
	 * Each call writes fresh objects into the given table, so a document can be written twice.
	 *
	 * @param table - The document's objects.
	 */
	async write(table: ObjectTable): Promise<Ref> {
		let source = this.#source;
		let base: Dict = {
			Type: new Name("XObject"),
			Subtype: new Name("Image"),
			Width: this.width,
			Height: this.height,
		};
		if (source.kind === "jpeg") {
			return table.add({
				dict: {
					...base,
					ColorSpace: new Name(source.colorSpace),
					BitsPerComponent: 8,
					Decode: source.inverted ? [1, 0, 1, 0, 1, 0, 1, 0] : undefined,
					Filter: new Name("DCTDecode"),
				},
				data: source.bytes,
			});
		}
		let planes = splitPixels(source.data);
		let ref = table.allocate();
		let mask =
			planes.alpha === null
				? undefined
				: table.add({
						dict: {
							...base,
							ColorSpace: new Name("DeviceGray"),
							BitsPerComponent: 8,
							Filter: new Name("FlateDecode"),
						},
						data: await deflate(planes.alpha),
					});
		table.set(ref, {
			dict: {
				...base,
				ColorSpace: new Name(planes.gray ? "DeviceGray" : "DeviceRGB"),
				BitsPerComponent: 8,
				Filter: new Name("FlateDecode"),
				SMask: mask,
			},
			data: await deflate(planes.color),
		});
		return ref;
	}
}

/**
 * Splits RGBA into the color samples and the alpha channel. Color is one gray sample per
 * pixel when every pixel has equal red, green and blue, which keeps scans and black-and-white
 * art a third the size; alpha is `null` when every pixel is opaque, so no mask is written.
 *
 * @param data - Straight RGBA, four bytes per pixel.
 */
function splitPixels(data: Uint8ClampedArray): {
	color: Uint8Array;
	alpha: Uint8Array | null;
	gray: boolean;
} {
	let pixels = data.length / 4;
	let gray = true;
	let opaque = true;
	for (let index = 0; index < data.length; index += 4) {
		if (data[index] !== data[index + 1] || data[index] !== data[index + 2]) gray = false;
		if (data[index + 3] !== 255) opaque = false;
	}
	let channels = gray ? 1 : 3;
	let color = new Uint8Array(pixels * channels);
	let alpha = opaque ? null : new Uint8Array(pixels);
	for (let pixel = 0; pixel < pixels; pixel++) {
		for (let channel = 0; channel < channels; channel++) {
			color[pixel * channels + channel] = data[pixel * 4 + channel] ?? 0;
		}
		if (alpha) alpha[pixel] = data[pixel * 4 + 3] ?? 255;
	}
	return { color, alpha, gray };
}

/**
 * Reads a JPEG or PNG file into an image the document can draw. A JPEG is checked only as
 * far as its frame header, since its bytes go into the file untouched; a PNG is fully decoded.
 *
 * @param bytes - The file.
 * @param resource - The page resource name to give it.
 * @returns The image, `invalid-image` for a corrupt or truncated file, `unsupported-image`
 *   for any other format or a JPEG variant PDF viewers cannot decode.
 */
export async function loadImage(
	bytes: Uint8Array,
	resource: string,
): Promise<Result<EmbeddedImage, PDFError>> {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return loadJPEG(bytes, resource);
	if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
		return loadPNG(bytes, resource);
	}
	return failure(new PDFError("unsupported-image", "The image is neither a JPEG nor a PNG."));
}

/**
 * Decodes a PNG to pixels, which `write` later compresses as RGB and an alpha mask.
 *
 * @param bytes - A file starting with the PNG signature.
 * @param resource - The page resource name.
 */
async function loadPNG(
	bytes: Uint8Array,
	resource: string,
): Promise<Result<EmbeddedImage, PDFError>> {
	let decoded = await decode(bytes);
	if (isFailure(decoded)) {
		return failure(
			new PDFError("invalid-image", `The PNG cannot be read: ${decoded.error.message}`, {
				cause: decoded.error,
			}),
		);
	}
	let { width, height, data } = decoded.data;
	return success(new EmbeddedImage(resource, width, height, { kind: "pixels", data }));
}

/**
 * Validates a JPEG's header and keeps the file as is for `DCTDecode`.
 *
 * @param bytes - A file starting with the JPEG start-of-image marker.
 * @param resource - The page resource name.
 */
function loadJPEG(bytes: Uint8Array, resource: string): Result<EmbeddedImage, PDFError> {
	let header = readJPEGHeader(bytes);
	if (isFailure(header)) return header;
	let { width, height, components, adobe } = header.data;
	let colorSpace = JPEG_COLOR_SPACES[components];
	if (colorSpace === undefined) {
		return failure(
			new PDFError(
				"unsupported-image",
				`A JPEG with ${components} components has no PDF color space.`,
			),
		);
	}
	return success(
		new EmbeddedImage(resource, width, height, {
			kind: "jpeg",
			bytes,
			colorSpace,
			inverted: adobe && components === 4,
		}),
	);
}

/**
 * Walks a JPEG's marker segments up to its first scan, reading the frame header and noting
 * an Adobe `APP14` segment wherever it sits before the scan.
 *
 * @param bytes - A file starting with the JPEG start-of-image marker.
 * @returns The frame's size and component count, `invalid-image` when the segments run past
 *   the file or the scan starts before any frame, `unsupported-image` for a frame or sample
 *   precision PDF viewers cannot decode.
 */
function readJPEGHeader(bytes: Uint8Array): Result<JPEGHeader, PDFError> {
	let offset = 2;
	let adobe = false;
	let frame: JPEGHeader | null = null;
	while (offset < bytes.length) {
		if (bytes[offset] !== 0xff) return invalidJPEG("A marker is missing between segments.");
		while (bytes[offset] === 0xff) offset++;
		let marker = bytes[offset++];
		if (marker === undefined) break;
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
		if (marker === 0xd9) break;
		if (marker === 0xda) {
			if (frame === null) return invalidJPEG("The scan starts before the frame header.");
			return success({ ...frame, adobe });
		}
		if (offset + 2 > bytes.length) break;
		let length = readUint16(bytes, offset);
		if (length < 2 || offset + length > bytes.length) break;
		let segment = bytes.subarray(offset + 2, offset + length);
		offset += length;
		if (marker === 0xee && isAdobe(segment)) adobe = true;
		if (JPEG_OTHER_FRAMES.has(marker)) {
			return failure(
				new PDFError(
					"unsupported-image",
					"The JPEG uses a lossless, hierarchical or arithmetic-coded frame.",
				),
			);
		}
		if (JPEG_DCT_FRAMES.has(marker)) {
			let parsed = readFrame(segment);
			if (isFailure(parsed)) return parsed;
			frame = parsed.data;
		}
	}
	return invalidJPEG("The JPEG ends before its first scan.");
}

/**
 * Reads a start-of-frame segment: precision, height, width and component count.
 *
 * @param segment - The segment after its length field.
 */
function readFrame(segment: Uint8Array): Result<JPEGHeader, PDFError> {
	if (segment.length < 6) return invalidJPEG("The frame header is truncated.");
	let precision = segment[0];
	let height = readUint16(segment, 1);
	let width = readUint16(segment, 3);
	let components = segment[5] ?? 0;
	if (segment.length < 6 + components * 3) return invalidJPEG("The frame header is truncated.");
	if (precision !== 8) {
		return failure(new PDFError("unsupported-image", `The JPEG uses ${precision}-bit samples.`));
	}
	if (width === 0 || height === 0) {
		return failure(
			new PDFError("unsupported-image", "The JPEG declares its height after the first scan."),
		);
	}
	return success({ width, height, components, adobe: false });
}

/**
 * Whether an `APP14` segment is Adobe's, which marks CMYK samples as stored inverted.
 *
 * @param segment - The segment after its length field.
 */
function isAdobe(segment: Uint8Array): boolean {
	return String.fromCharCode(...segment.subarray(0, 5)) === "Adobe";
}

/**
 * A big-endian 16-bit integer.
 *
 * @param bytes - The buffer.
 * @param offset - Where the high byte is.
 */
function readUint16(bytes: Uint8Array, offset: number): number {
	return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

/**
 * The failure for a JPEG whose structure is broken.
 *
 * @param message - What is wrong with it.
 */
function invalidJPEG(message: string): Result<never, PDFError> {
	return failure(new PDFError("invalid-image", message));
}

/**
 * Draws an image scaled into a box. The image's unit square is mapped onto the box with one
 * `cm`, inside its own graphics state so the transform never leaks into later drawing.
 *
 * @param canvas - The page drawn on.
 * @param image - An image from the same document.
 * @param options - The box.
 */
export function drawImage(canvas: Canvas, image: EmbeddedImage, options: ImageOptions): void {
	let { x, y, width } = options;
	let height = options.height ?? (width * image.height) / image.width;
	let bottom = canvas.height - y - height;
	canvas.images.add(image);
	canvas.ops.push(
		`q ${num(width)} 0 0 ${num(height)} ${num(x)} ${num(bottom)} cm ${name(image.resource)} Do Q`,
	);
}
