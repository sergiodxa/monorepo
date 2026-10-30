---
title: Draw QR codes
description: Encode a link at the error correction level its surface needs, render it inline with remix/component, and serve it as an SVG file from a route.
section:
    title: Building Remix apps
    order: 4
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "How to encode a link at the error correction level its surface needs with `@sdxc/qr`"
    - "How to render a QR code inline with `remix/component` and keep it inside its layout"
    - "How to serve a QR code as an SVG file from a route"
---

This guide puts a QR code on a meetup ticket: the attendee shows it at the door, a volunteer's
phone scans it, and the check-in page opens. The same code appears inline on the ticket page and
as an SVG file a printable badge links to.

[`@sdxc/qr`](/api/qr) encodes text or bytes into a QR symbol and turns it into SVG path data.
Its `./ui` entry draws that path as a `remix/component` element.

```bash
npm add @sdxc/http @sdxc/logger @sdxc/qr @sdxc/result remix
```

## Encode the link

`QR.encode` picks the smallest symbol that holds the data and answers a `Result`:

```typescript {% title="app/services/tickets/qr.ts" %}
import { QR } from "@sdxc/qr";

const CHECK_IN_ORIGIN = "HTTPS://EXAMPLE.COM/C/";

export function checkInCode(ticketCode: string) {
	return QR.encode(`${CHECK_IN_ORIGIN}${ticketCode.toUpperCase()}`, { level: "Q" });
}
```

An upper-case URL fits a smaller symbol, since alphanumeric mode spends fewer bits a character.
`level` is the minimum error correction, the share a scanner can rebuild when part is
unreadable: `"L"` 7%, `"M"` 15% (the default), `"Q"` 25% and `"H"` 30%. A code read off a phone
screen does well with `M`; a printed ticket that gets folded and scuffed earns `Q`.

## Keep a code inside its layout

A code drawn at a fixed size gets harder to scan as its version grows, because each module gets
smaller. `maxVersion` caps it, and data that needs more fails with `too-long` instead:

```typescript {% title="app/services/tickets/badge-code.ts" %}
import { QR } from "@sdxc/qr";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";

export function badgeCode(url: string) {
	let encoded = QR.encode(url, { level: "M", maxVersion: 6 });
	if (isFailure(encoded) && encoded.error.code === "too-long") {
		let { needed, available } = encoded.error.bits;
		currentLog()?.warn("badge.qr_too_long", { needed, available });
	}
	return encoded;
}
```

A `too-long` error's `bits` holds what the data needs and what the largest allowed symbol has,
so the log says how much to shorten.

## Render it on a page

Encode in the handler, which can log a failure and decide what the page shows without the code:

```tsx {% title="app/http/controllers/tickets/show.tsx" %}
import { notFound } from "@sdxc/http/response/html";
import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Tickets from "~/app/models/ticket";
import { checkInCode } from "~/app/services/tickets/qr";
import { TicketPage } from "~/resources/views/ticket";
import routes from "~/routes/web";

export default createAction(routes.tickets.show, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	let ticket = await Tickets.find(ctx.db, id);
	if (ticket === null) return notFound("Not Found");

	let encoded = checkInCode(ticket.code);
	if (isFailure(encoded)) {
		ctx.log.warn("ticket.qr_failed", { code: encoded.error.code });
	}

	let qr = isSuccess(encoded) ? encoded.data.toSVGPath() : null;
	return ctx.render(<TicketPage ticket={ticket} qr={qr} />);
});
```

`Tickets` is your own model. `toSVGPath()` answers plain JSON, `{ d, viewBox, size }`, with the
standard quiet zone included.

`QrCode` from `@sdxc/qr/ui` draws it as an inline `<svg role="img">`:

```tsx {% title="resources/views/ticket.tsx" %}
import type { SvgPath } from "@sdxc/qr";
import type { Handle } from "remix/component";

import { QrCode } from "@sdxc/qr/ui";

import type { Ticket } from "~/app/models/ticket";

interface TicketPageProps {
	ticket: Ticket;
	qr: SvgPath | null;
}

export function TicketPage(handle: Handle<TicketPageProps>) {
	return () => {
		let { ticket, qr } = handle.props;
		return (
			<main>
				<h1>{ticket.eventName}</h1>
				{qr && (
					<QrCode
						path={qr}
						label="Check-in code for this ticket"
						size="14rem"
					/>
				)}
				<p>
					Ticket code <code>{ticket.code}</code>
				</p>
			</main>
		);
	};
}
```

`label` is the image's accessible name, so the page shows the ticket code beside it as text a
volunteer can type. `size` is any CSS length, and `dark` and `light` set the colors, `#000` on
`#fff` by default.

> [!NOTE]
> A brand pair passed through `dark` and `light` needs the same strong contrast as black on
> white, with the darker color on the modules, or phones fail to scan the code.

## Serve it as an SVG file

A printable badge wants the code at a URL of its own. Render the path into a
standalone SVG document with `renderToString`, and answer it with the SVG content type:

```tsx {% title="app/http/controllers/tickets/qr.tsx" %}
import { SVG } from "@sdxc/http/content-type";
import { notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import { renderToString } from "remix/component/server";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Tickets from "~/app/models/ticket";
import { checkInCode } from "~/app/services/tickets/qr";
import routes from "~/routes/web";

export default createAction(routes.tickets.qr, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	let ticket = await Tickets.find(ctx.db, id);
	if (ticket === null) return notFound("Not Found");

	let encoded = checkInCode(ticket.code);
	if (isFailure(encoded)) return notFound("Not Found");

	let { d, viewBox } = encoded.data.toSVGPath({ margin: 2 });
	let svg = await renderToString(
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={viewBox}
			shapeRendering="crispEdges"
		>
			<rect width="100%" height="100%" fill="#fff" />
			<path d={d} fill="#000" />
		</svg>,
	);

	return new Response(svg, {
		headers: { "Content-Type": SVG, "Cache-Control": "private, max-age=3600" },
	});
});
```

`routes.tickets.qr` is a route such as `/tickets/:id/qr.svg`. `margin` sets the quiet zone in
modules; 2 suits a badge whose own light border supplies the rest.

> [!WARNING]
> A ticket's code admits its holder, so answer it `private`, as above. A `public` response lets
> a shared cache hand one attendee's code to another.

## Test the encoding

The services are plain functions, so a test reads the symbol and the failure a capped version
answers:

```typescript {% title="app/services/tickets/qr.test.ts" %}
import { isFailure, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { badgeCode } from "~/app/services/tickets/badge-code";
import { checkInCode } from "~/app/services/tickets/qr";

test("encodes a check-in link at level Q or better", () => {
	let symbol = unwrap(checkInCode("abc123"));

	expect(["Q", "H"]).toContain(symbol.level);
	expect(symbol.toSVGPath().d).not.toBe("");
});

test("refuses a badge link longer than version 6 holds", () => {
	let encoded = badgeCode(`https://example.com/${"x".repeat(300)}`);

	expect(isFailure(encoded) && encoded.error.code).toBe("too-long");
});
```

## Where to go next

- [Add two-factor sign-in with TOTP](/docs/identity-and-security/two-factor) — the code an
  authenticator app scans to enroll.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
  — the component model `QrCode` renders in.
- [`@sdxc/qr`](/api/qr) — every option, and `isDark` for drawing modules yourself.
