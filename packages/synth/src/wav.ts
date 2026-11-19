/**
 * Wraps rendered samples as a WAV file, the format every browser's `<audio>`, every operating
 * system and every editor plays and seeks without a codec.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DEFAULT_SAMPLE_RATE } from "./render.js";

/**
 * Writes mono samples as a 16-bit PCM WAV file; values past full scale are clipped.
 *
 * @param samples Mono samples between -1 and 1.
 * @param sampleRate Samples per second. Default: {@link DEFAULT_SAMPLE_RATE}.
 * @returns The file's bytes.
 * @example new Blob([encodeWav(renderScore(score))], { type: "audio/wav" })
 */
export function encodeWav(
	samples: Float32Array,
	sampleRate: number = DEFAULT_SAMPLE_RATE,
): Uint8Array<ArrayBuffer> {
	let bytes = new Uint8Array(44 + samples.length * 2);
	let view = new DataView(bytes.buffer);
	let text = (offset: number, value: string) => {
		for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
	};
	text(0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	text(8, "WAVE");
	text(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	text(36, "data");
	view.setUint32(40, samples.length * 2, true);
	for (let i = 0; i < samples.length; i++) {
		let clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
		view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
	}
	return bytes;
}
