---
title: Draw QR codes
description: Encode a link at the error correction level its surface needs, render it inline with remix/component, and serve it as an SVG file from a route.
section:
    title: Building Remix apps
    order: 3
order: 9
lastUpdated: 2026-10-08
---

This guide puts a QR code on a meetup ticket: the attendee shows it at the door, a volunteer's
phone scans it, and the check-in page opens. The same code appears inline on the ticket page and
as an SVG file a printable badge links to.

[`@sdxc/qr`](/api/qr) encodes text or bytes into a QR symbol and turns it into SVG path data.
Its `./ui` entry draws that path as a `remix/component` element. Encoding runs anywhere
`TextEncoder` does, so it needs no binding and no Node built-in on Workers.

```bash
npm add @sdxc/qr @sdxc/result @sdxc/http @sdxc/logger remix
```

## Encode the link

`QR.encode` picks the smallest symbol that holds the data and answers a `Result`:

```typescript {% title="app/tickets/qr.ts" %}
import { QR } from "@sdxc/qr";

const CHECK_IN_ORIGIN = "HTTPS://EXAMPLE.COM/C/";

export function checkInCode(ticketCode: string) {
	return QR.encode(`${CHECK_IN_ORIGIN}${ticketCode.toUpperCase()}`, { level: "Q" });
}
```

A string is split into numeric, alphanumeric and byte segments with the fewest total bits.
Alphanumeric mode holds digits, upper-case letters and a few symbols at 5.5 bits a character
against 8 for a byte, so an upper-case URL fits a smaller symbol. The scheme and host are
case-insensitive, and the path is yours to route, which here is a ticket code issued in upper
case. Pass a `Uint8Array` instead to encode bytes exactly as given.

`level` is the minimum error correction, the share of the symbol a scanner can rebuild when part
of it is unreadable: `"L"` 7%, `"M"` 15% (the default), `"Q"` 25% and `"H"` 30%. A code read off
a phone screen does well with `L` or `M`; a printed ticket that gets folded and scuffed earns
`Q`. Each step up costs modules, so the symbol grows for the same data.

`boostLevel`, on by default, raises the level as far as the chosen symbol still holds the data,
since that extra correction costs nothing. The symbol reports what it got: `version` (1 to 40),
`level` after the boost, `mask`, and `size`, the modules a side.

## Keep a code inside its layout

A code drawn at a fixed size gets harder to scan as its version grows, because each module gets
smaller. `maxVersion` caps it, and data that needs more fails with `too-long` instead:

```typescript {% title="app/tickets/badge-code.ts" %}
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

Checking `code` narrows the error: `too-long` is a `QrTooLongError` whose `bits` holds the
bits the data needs and the bits the largest allowed symbol has, so the log says how much to
shorten. The other failure, `invalid-options`, is a version outside 1 to 40, a mask outside 0 to
7 or an unknown level. Version 40 at level `L` holds 2,953 bytes, so without a cap a
`too-long` comes only from unusually large data.

## Render it on a page

Encode in the handler, which can log a failure and decide what the page shows without the code:

```tsx {% title="app/http/controllers/tickets/show.tsx" %}
import { notFound } from "@sdxc/http/response/html";
import { isFailure, isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Tickets from "~/app/data/ticket";
import { checkInCode } from "~/app/tickets/qr";
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

`Tickets` is your own model. `toSVGPath()` answers plain JSON, `{ d, viewBox, size }`, with each
horizontal run of dark modules as one rectangle and the standard four-module quiet zone
included. Because it is JSON, the same value also works as a prop of a hydrated component.

`QrCode` from `@sdxc/qr/ui` draws it as an inline `<svg role="img">`:

```tsx {% title="resources/views/ticket.tsx" %}
import type { SvgPath } from "@sdxc/qr";
import type { Handle } from "remix/component";

import { QrCode } from "@sdxc/qr/ui";

import type { Ticket } from "~/app/data/ticket";

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

`label` is the image's accessible name, and the payload stays out of the accessibility tree, so
the page shows the ticket code beside it as the text a volunteer can type. `size` is any CSS
length for the width and height. `dark` and `light` set the module and background colors,
`#000` on `#fff` by default; they stay as given under a dark theme, and the SVG opts out of
forced colors, because a scanner needs a dark code on a light margin. A brand pair passed
through them needs the same strong contrast. `mix` adds your own mixins after the
component's.

An inline SVG needs no `img-src data:` in your Content Security Policy.

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

import Tickets from "~/app/data/ticket";
import { checkInCode } from "~/app/tickets/qr";
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

`routes.tickets.qr` is a route such as `/tickets/:id/qr.svg` in your route map. `margin` sets
the quiet zone in modules; 2 suits a badge whose own light border supplies the rest, and the
default of 4 is what the standard asks for on a busy background. The `viewBox` is in modules,
one unit each, so the file scales to any print size, and `crispEdges` keeps adjacent rows from
showing seams at fractional scales. The response is `private` because a ticket's code admits
its holder.

## Where to go next

- [Add two-factor sign-in with TOTP](/docs/identity-and-security/two-factor) — the code an
  authenticator app scans to enroll.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
  — the component model `QrCode` renders in.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — the Content Security
  Policy an inline SVG fits.
- [`@sdxc/qr`](/api/qr) — every option, and `isDark` for drawing modules yourself.
