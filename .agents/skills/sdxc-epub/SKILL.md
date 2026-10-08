---
name: sdxc-epub
description: "@sdxc/epub builds EPUB 3.3 ebooks — `EPUB.build({ metadata, chapters, cover?, styles?, resources?, legacyNcx?, labels? })` answering `Result<EPUB, EpubError>`, then `epub.stream()` for an `application/epub+zip` Response or `epub.bytes()` — verifying at build time what epubcheck rejects (well-formed XHTML, no script/forms, references, fragments, remote resources, media types, paths). Use when an app offers a chapter, tutorial or handbook as a download for e-readers or Send to Kindle."
---

# @sdxc/epub

`EPUB.build` writes the whole OCF container (`mimetype` stored first, `container.xml`, `EPUB/package.opf`, `nav.xhtml` with toc and landmarks, `toc.ncx`, optional `cover.xhtml`, `text/<id>.xhtml` per chapter, styles and resources) through `@sdxc/zip`. Each chapter `body` is an XHTML string, parsed with `@sdxc/xml` (whitespace preserved, named entities resolved) and checked; manifest properties (`svg`, `mathml`, `nav`, `cover-image`) are derived, never passed. Errors are one subclass per `code`: `invalid-metadata`, `invalid-content`, `missing-resource`, `remote-resource`, `unsupported-media`, `invalid-path`, each with `path` (chapter id or resource path).

Full API and examples: [packages/epub/README.md](packages/epub/README.md)

## Using it

```json
{ "dependencies": { "@sdxc/epub": "workspace:*" } }
```

```typescript
import { EPUB } from "@sdxc/epub";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";

let built = EPUB.build({
	metadata: { identifier: BOOK_ID, title, language: "en", modified: BOOK_MODIFIED },
	styles: [{ path: "styles/book.css", text: css }],
	chapters: [{ id: "sample", title, body: toHTML(document, { syntax: "xhtml" }) }],
});
if (isFailure(built)) {
	ctx.log.error("epub.build_failed", { code: built.error.code, path: built.error.path });
	return notFound();
}
return new Response(built.data.stream(), {
	headers: {
		"content-type": "application/epub+zip",
		"content-disposition": `attachment; filename="sample.epub"`,
	},
});
```

## Suggestions

- Keep `identifier` and `modified` constants per book; a fresh UUID or `new Date()` per request makes every download a new book and the bytes unreproducible.
- Render Markdown with `toHTML(doc, { syntax: "xhtml" })`; `remix/component` HTML is not XML and is not accepted.
- References in a chapter body resolve from `text/`: write `../images/a.png`, and `other-id.xhtml#frag` for another chapter.
- Pass remote images as `resources` bytes fetched by the app; the package does no I/O and refuses remote images, stylesheets and fonts.
- Set `metadata.accessibility` honestly for books sold in the EU (European Accessibility Act); nothing is written by default.
- After changing the package's output, run `UPDATE_EPUB_FIXTURES=1 vp test run "$PWD/packages/epub/"` then `bun run epubcheck` in `packages/epub` (Java or Docker); the golden fixtures must pass with zero warnings.

## Related

- `@sdxc/zip` — the container writer; skill `sdxc-zip`
- `@sdxc/markdown` — `toHTML(…, { syntax: "xhtml" })` produces chapter bodies; skill `sdxc-markdown`
- `@sdxc/xml` — parses and re-serializes each body; skill `sdxc-xml`
