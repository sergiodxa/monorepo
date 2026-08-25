/**
 * MIME type constants for HTTP `Content-Type` header values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Plain text content type with UTF-8 charset.
 * Used for simple text responses without any formatting.
 * @example
 * headers.set("Content-Type", Text);
 * @example
 * return new Response("Hello", { headers: { "Content-Type": Text } });
 */
export const Text = "text/plain" as const;

/**
 * HTML content type with UTF-8 charset.
 * Used for web pages and HTML document responses.
 * @example
 * headers.set("Content-Type", HTML);
 * @example
 * return new Response("<h1>Hello</h1>", { headers: { "Content-Type": HTML } });
 */
export const HTML = "text/html" as const;

/**
 * CSS content type with UTF-8 charset.
 * Used for stylesheet responses.
 * @example
 * headers.set("Content-Type", CSS);
 * @example
 * return new Response("body { color: red; }", { headers: { "Content-Type": CSS } });
 */
export const CSS = "text/css" as const;

/**
 * JavaScript content type with UTF-8 charset.
 * Used for JavaScript file responses.
 * @example
 * headers.set("Content-Type", JavaScript);
 * @example
 * return new Response("console.log('hi')", { headers: { "Content-Type": JavaScript } });
 */
export const JavaScript = "text/javascript" as const;

/**
 * CSV content type with UTF-8 charset.
 * Used for comma-separated values data exports.
 * @example
 * headers.set("Content-Type", CSV);
 * @example
 * return new Response("name,age\nJohn,30", { headers: { "Content-Type": CSV } });
 */
export const CSV = "text/csv" as const;

/**
 * XML content type with UTF-8 charset (text variant).
 * Used for XML documents intended for human readability.
 * @example
 * headers.set("Content-Type", XML);
 * @example
 * return new Response("<root><item/></root>", { headers: { "Content-Type": XML } });
 */
export const XML = "text/xml" as const;

/**
 * Markdown content type with UTF-8 charset.
 * Used for Markdown-formatted text responses.
 * @example
 * headers.set("Content-Type", Markdown);
 * @example
 * return new Response("# Hello", { headers: { "Content-Type": Markdown } });
 */
export const Markdown = "text/markdown" as const;

/**
 * JSON content type with UTF-8 charset.
 * Used for API responses and requests with structured data.
 * Named `Json` (not `JSON`) to avoid shadowing the global `JSON` object.
 * @example
 * headers.set("Content-Type", Json);
 * @example
 * if (contentType === Json) { parseJson(body); }
 */
export const Json = "application/json" as const;

/**
 * JSON Lines content type with UTF-8 charset.
 * Used for newline-delimited JSON streaming responses.
 * @example
 * headers.set("Content-Type", JSONLines);
 * @example
 * return new Response('{"a":1}\n{"b":2}', { headers: { "Content-Type": JSONLines } });
 */
export const JSONLines = "application/jsonl" as const;

/**
 * PDF content type.
 * Used for PDF document responses.
 * @example
 * headers.set("Content-Type", PDF);
 * @example
 * return new Response(pdfBuffer, { headers: { "Content-Type": PDF } });
 */
export const PDF = "application/pdf" as const;

/**
 * ZIP archive content type.
 * Used for compressed archive file responses.
 * @example
 * headers.set("Content-Type", ZIP);
 * @example
 * return new Response(zipBuffer, { headers: { "Content-Type": ZIP } });
 */
export const ZIP = "application/zip" as const;

/**
 * GZip compressed content type.
 * Used for gzip-compressed file responses.
 * @example
 * headers.set("Content-Type", GZip);
 * @example
 * return new Response(gzipBuffer, { headers: { "Content-Type": GZip } });
 */
export const GZip = "application/gzip" as const;

/**
 * Multipart form data content type.
 * Used for form submissions with file uploads.
 * @example
 * if (contentType.startsWith(FormData)) { parseFormData(body); }
 * @example
 * headers.set("Content-Type", FormData);
 */
export const FormData = "multipart/form-data" as const;

/**
 * URL-encoded form content type.
 * Used for simple form submissions without files.
 * @example
 * headers.set("Content-Type", FormURLEncoded);
 * @example
 * if (contentType === FormURLEncoded) { parseURLEncoded(body); }
 */
export const FormURLEncoded = "application/x-www-form-urlencoded" as const;

/**
 * Binary octet stream content type.
 * Used for arbitrary binary data when type is unknown.
 * @example
 * headers.set("Content-Type", OctetStream);
 * @example
 * return new Response(binaryData, { headers: { "Content-Type": OctetStream } });
 */
export const OctetStream = "application/octet-stream" as const;

/**
 * XML content type with UTF-8 charset (application variant).
 * Used for XML data in API responses and machine processing.
 * @example
 * headers.set("Content-Type", ApplicationXML);
 * @example
 * return new Response(xmlData, { headers: { "Content-Type": ApplicationXML } });
 */
export const ApplicationXML = "application/xml" as const;

/**
 * PNG image content type.
 * Used for lossless raster image responses.
 * @example
 * headers.set("Content-Type", PNG);
 * @example
 * return new Response(pngBuffer, { headers: { "Content-Type": PNG } });
 */
export const PNG = "image/png" as const;

/**
 * JPEG image content type.
 * Used for lossy compressed photo responses.
 * @example
 * headers.set("Content-Type", JPEG);
 * @example
 * return new Response(jpegBuffer, { headers: { "Content-Type": JPEG } });
 */
export const JPEG = "image/jpeg" as const;

/**
 * GIF image content type.
 * Used for animated or simple graphics responses.
 * @example
 * headers.set("Content-Type", GIF);
 * @example
 * return new Response(gifBuffer, { headers: { "Content-Type": GIF } });
 */
export const GIF = "image/gif" as const;

/**
 * WebP image content type.
 * Used for modern lossy/lossless image responses.
 * @example
 * headers.set("Content-Type", WebP);
 * @example
 * return new Response(webpBuffer, { headers: { "Content-Type": WebP } });
 */
export const WebP = "image/webp" as const;

/**
 * SVG image content type.
 * Used for vector graphics responses.
 * @example
 * headers.set("Content-Type", SVG);
 * @example
 * return new Response(svgString, { headers: { "Content-Type": SVG } });
 */
export const SVG = "image/svg+xml" as const;

/**
 * ICO image content type.
 * Used for favicon and icon file responses.
 * @example
 * headers.set("Content-Type", ICO);
 * @example
 * return new Response(icoBuffer, { headers: { "Content-Type": ICO } });
 */
export const ICO = "image/x-icon" as const;

/**
 * AVIF image content type.
 * Used for highly compressed modern image responses.
 * @example
 * headers.set("Content-Type", AVIF);
 * @example
 * return new Response(avifBuffer, { headers: { "Content-Type": AVIF } });
 */
export const AVIF = "image/avif" as const;

/**
 * MP3 audio content type.
 * Used for MPEG audio file responses.
 * @example
 * headers.set("Content-Type", MP3);
 * @example
 * return new Response(mp3Buffer, { headers: { "Content-Type": MP3 } });
 */
export const MP3 = "audio/mpeg" as const;

/**
 * WAV audio content type.
 * Used for uncompressed audio file responses.
 * @example
 * headers.set("Content-Type", WAV);
 * @example
 * return new Response(wavBuffer, { headers: { "Content-Type": WAV } });
 */
export const WAV = "audio/wav" as const;

/**
 * OGG audio content type.
 * Used for Ogg Vorbis audio file responses.
 * @example
 * headers.set("Content-Type", OGG);
 * @example
 * return new Response(oggBuffer, { headers: { "Content-Type": OGG } });
 */
export const OGG = "audio/ogg" as const;

/**
 * WebM audio content type.
 * Used for WebM audio-only file responses.
 * @example
 * headers.set("Content-Type", WebMAudio);
 * @example
 * return new Response(webmAudioBuffer, { headers: { "Content-Type": WebMAudio } });
 */
export const WebMAudio = "audio/webm" as const;

/**
 * MP4 video content type.
 * Used for MPEG-4 video file responses.
 * @example
 * headers.set("Content-Type", MP4);
 * @example
 * return new Response(mp4Buffer, { headers: { "Content-Type": MP4 } });
 */
export const MP4 = "video/mp4" as const;

/**
 * WebM video content type.
 * Used for WebM video file responses.
 * @example
 * headers.set("Content-Type", WebMVideo);
 * @example
 * return new Response(webmVideoBuffer, { headers: { "Content-Type": WebMVideo } });
 */
export const WebMVideo = "video/webm" as const;

/**
 * WOFF font content type.
 * Used for Web Open Font Format file responses.
 * @example
 * headers.set("Content-Type", WOFF);
 * @example
 * return new Response(woffBuffer, { headers: { "Content-Type": WOFF } });
 */
export const WOFF = "font/woff" as const;

/**
 * WOFF2 font content type.
 * Used for Web Open Font Format 2.0 file responses.
 * @example
 * headers.set("Content-Type", WOFF2);
 * @example
 * return new Response(woff2Buffer, { headers: { "Content-Type": WOFF2 } });
 */
export const WOFF2 = "font/woff2" as const;

/**
 * TrueType font content type.
 * Used for TTF font file responses.
 * @example
 * headers.set("Content-Type", TTF);
 * @example
 * return new Response(ttfBuffer, { headers: { "Content-Type": TTF } });
 */
export const TTF = "font/ttf" as const;

/**
 * OpenType font content type.
 * Used for OTF font file responses.
 * @example
 * headers.set("Content-Type", OTF);
 * @example
 * return new Response(otfBuffer, { headers: { "Content-Type": OTF } });
 */
export const OTF = "font/otf" as const;

/**
 * Server-Sent Events content type.
 * Used for streaming event responses to clients.
 * @example
 * headers.set("Content-Type", EventStream);
 * @example
 * return new Response(stream, { headers: { "Content-Type": EventStream } });
 */
export const EventStream = "text/event-stream" as const;

/**
 * Newline-delimited JSON content type.
 * Used for streaming JSON objects one per line.
 * @example
 * headers.set("Content-Type", NDJson);
 * @example
 * return new Response(ndjsonStream, { headers: { "Content-Type": NDJson } });
 */
export const NDJson = "application/x-ndjson" as const;
