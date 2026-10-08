---
name: sdxc-qr
description: "@sdxc/qr encodes text or bytes as a QR Code Model 2 symbol — `QR.encode(data, { level, minVersion, maxVersion, mask, boostLevel })` answering `Result<QR, QrError>` — builds SVG path data with the instance's `toSVGPath({ margin })`, and renders it with the `QrCode` component from `@sdxc/qr/ui`. Use when a page must show a QR code: an `otpauth://` URI during TOTP enrolment, a device-grant `verification_uri_complete`, any link a phone should scan; or when drawing a code in a terminal or custom renderer from `isDark(x, y)`."
---

# @sdxc/qr

`QR.encode` picks the smallest version that holds the optimally segmented data (numeric, alphanumeric and UTF-8 byte runs), adds Reed–Solomon correction, and chooses the lowest-penalty mask. It answers a `Result` holding a `QR` instance with `version`, `level`, `mask`, `size` and `isDark(x, y)`, which answers `false` outside the symbol; `qr.toSVGPath()` turns it into `{ d, viewBox, size }` with the quiet zone included. `QrCode` (from `@sdxc/qr/ui`, needs `remix`) renders that path data as an inline `<svg role="img">` with fixed dark-on-light colors and `forced-color-adjust: none`. The main entry depends only on `@sdxc/result` and does no work at import time, so it runs in a Worker.

Full API, options and examples: [packages/qr/README.md](packages/qr/README.md)

## When to reach for it

- A TOTP enrolment page shows the `otpauth://` URI from `totp.uri` as a scannable code.
- A device-authorization client shows `verification_uri_complete`.
- Any server-rendered page needs a QR code without a CSP `img-src data:` exception.
- A CLI draws a code with half-block characters from `isDark`.

## Using it

```json
{ "dependencies": { "@sdxc/qr": "workspace:*" } }
```

```tsx
import { QR } from "@sdxc/qr";
import { QrCode } from "@sdxc/qr/ui";
import { isFailure, isSuccess } from "@sdxc/result";

let encoded = QR.encode(uri, { level: "M" });
if (isFailure(encoded)) ctx.log.warn("totp.qr_failed", { code: encoded.error.code });

<Page qr={isSuccess(encoded) ? encoded.data : null} />;

// in the view
{qr && <QrCode path={qr.toSVGPath()} label={t("enrol.qrLabel")} />}
```

## Suggestions

- Encode in the controller, never inside a render function: a render cannot answer the `Result`.
- Pass `qr.toSVGPath()` (plain JSON) to `QrCode` or into a hydrated component's props, never the `QR` instance.
- Keep the text alternative (setup key, link) on the page; the code's payload is not in the accessibility tree.
- `label` is required and says what the code is for; take it from the app's locales.
- Leave `dark`/`light` at black on white unless a brand pair has strong contrast; never derive them from `currentColor` or theme variables.
- Cap `maxVersion` only to keep a code small on screen, and handle `too-long` (`error.bits` has `needed`/`available`).

## Related

- `@sdxc/crypto` — `totp.uri` builds the `otpauth://` URI this encodes; skill `sdxc-crypto`
- `@sdxc/result` — the `Result` `QR.encode` answers; skill `sdxc-result`
