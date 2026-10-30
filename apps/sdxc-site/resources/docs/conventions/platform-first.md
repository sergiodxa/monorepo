---
title: Platform first
description: The collection builds on what the browser and the runtime already ship, so dialogs, menus and requests work with standard elements, attributes and fetch.
section:
    title: Conventions
    order: 3
order: 9
lastUpdated: 2026-10-25
outcomes:
    - "Why the components open dialogs, menus and disclosures through HTML attributes"
    - "How to wire triggers with Invoker Commands and the Popover API"
    - "How packages call the global `fetch`, and how MSW tests them"
---

Packages in this collection reach for a web platform feature before they write JavaScript.
[`@sdxc/ui`](/api/ui) opens a modal with `<dialog>` and a menu with the Popover API, and wires
each trigger with an HTML attribute, so the interface works from the server's HTML before any
script loads. The packages that make requests call the global `fetch`, so one MSW handler
covers them in a test.

```bash
npm add @sdxc/outbound @sdxc/result @sdxc/ui remix
```

## Open a dialog from a command button

A button opens a modal by naming it: `commandfor` holds the dialog's `id` and `command` the
verb. This is the Invoker Commands API, so the browser tracks the open state and the page ships
no click handler. `Dialog` renders a native `<dialog>`, which closes on Escape and makes the
rest of the page inert while it is open.

```tsx {% title="resources/components/delete-book.tsx" %}
import type { Handle } from "remix/component";

import { Button, Dialog } from "@sdxc/ui";

export function DeleteBook(handle: Handle<{ action: string }>) {
	return () => (
		<>
			<Button commandfor="delete-book" command="show-modal" color="danger">
				Delete
			</Button>
			<Dialog id="delete-book" aria-labelledby="delete-book-title">
				<Dialog.Title id="delete-book-title">Delete this book?</Dialog.Title>
				<form method="post" action={handle.props.action}>
					<Button type="submit" color="danger">
						Delete
					</Button>
				</form>
				<Dialog.Close commandfor="delete-book" aria-label="Close" />
			</Dialog>
		</>
	);
}
```

`Dialog.Close` sends `close` by default. A menu opens the same way: `Menu` carries the `popover`
attribute, so a button with `command="toggle-popover"` opens it in the top layer, and a menu
row can send `show-modal` to this dialog. `Disclosure` and `Accordion` follow the same rule
with `<details>` and `<summary>`. [Open a dialog with no script](/docs/building-remix-apps/interface-with-remix-ui#open-a-dialog-with-no-script)
covers the family in full.

> [!NOTE]
> Every target needs an `id`, since `commandfor` and `popovertarget` find it by that alone. In
> development `Dialog` logs a warning when it renders without one.

## Call the global fetch

Every package that makes a request sends it with the global `fetch`, so whatever answers
`fetch` in a runtime or a test answers the packages too. A service that reads a URL someone
pasted calls `follow` from [`@sdxc/outbound`](/api/outbound) and reads the body within a cap:

```typescript {% title="app/services/feeds/fetch-feed.ts" %}
import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

export async function fetchFeed(input: string) {
	let followed = await follow(input, { timeout: "8 seconds" });
	if (isFailure(followed)) return followed;

	let { response, url } = followed.data;
	if (!response.ok) {
		release(response.body);
		return failure(new Error(`The feed answered ${response.status}`));
	}
	let body = await readText(response, { maxBytes: 2 * 1024 * 1024 });
	if (isFailure(body)) return body;
	return success({ xml: body.data.text, url });
}
```

`follow` checks every hop, so a redirect into a private address fails as `refused-address`
before the request is sent.

> [!NOTE]
> On Cloudflare Workers the global `fetch` is the Worker's outbound request, so every package
> call counts toward the Worker's subrequest limit. A `follow` that walks three redirects is
> four subrequests.

## Test the requests with MSW and the commands in a browser

The call goes through the global `fetch`, so MSW intercepts it and the code under test is the
real one, redirects included:

```typescript {% title="app/services/feeds/fetch-feed.test.ts" %}
import { isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { fetchFeed } from "~/app/services/feeds/fetch-feed";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("follows a redirect and reads the feed", async () => {
	server.use(
		http.get("https://blog.example.com/feed", () =>
			HttpResponse.redirect("https://blog.example.com/atom.xml", 301),
		),
		http.get("https://blog.example.com/atom.xml", () =>
			HttpResponse.xml("<feed />"),
		),
	);

	let result = await fetchFeed("https://blog.example.com/feed");

	if (!isSuccess(result)) expect.unreachable("the feed should load");
	expect(result.data.xml).toBe("<feed />");
	expect(result.data.url.href).toBe("https://blog.example.com/atom.xml");
});
```

Invoker Commands are browser behavior, so test them in a `*.browser.test.tsx`
file: mount with `render()` from `remix/component/test`, and click.

```tsx {% title="resources/components/delete-book.browser.test.tsx" %}
import { render } from "remix/component/test";
import { expect, test } from "vitest";

import { DeleteBook } from "~/resources/components/delete-book";

test("the delete button opens the dialog and its close button closes it", () => {
	let page = render(<DeleteBook action="/books/1/delete" />);
	let dialog = page.$("#delete-book") as HTMLDialogElement;

	(page.$('[command="show-modal"]') as HTMLButtonElement).click();
	expect(dialog.matches(":modal")).toBe(true);

	(page.$('[data-slot="close"]') as HTMLButtonElement).click();
	expect(dialog.open).toBe(false);
	page.cleanup();
});
```

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) — the
  stylesheets and components these examples sit in.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — every check
  `follow` runs on a URL someone else chose.
- [`@sdxc/ui`](/api/ui) — the components, and which platform feature each one renders.
