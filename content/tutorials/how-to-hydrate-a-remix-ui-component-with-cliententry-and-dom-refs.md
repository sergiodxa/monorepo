---
title: How to Hydrate a Remix UI Component with `clientEntry` and DOM Refs
excerpt: Hydrate a browser-only Remix UI island, attach DOM listeners with `ref`, and bubble custom events to a parent.
tech: remix@3.0.0-beta.4
---

Some UI only makes sense in the browser. Copy buttons, media controls, and clipboard interactions all depend on DOM APIs that do not exist during server rendering.

`clientEntry` and `ref` from `remix/ui` let you hydrate only that part of the page. This example uses an invite panel that copies a link, dispatches a custom event from a child button, and updates the parent island when that event bubbles up. These APIs are still beta in `remix@3.0.0-beta.4`.

## Render the Island From a Route

The route module only needs to render the island with server data. The browser-only work lives inside the client entry.

```tsx {% path="app/routes/invite.tsx" %}
import { InvitePanel } from "~/components/invite-panel";

export default function InviteRoute() {
	let inviteUrl = "https://example.com/invite/team-47a9";

	return (
		<main>
			<h1>Invite a Teammate</h1>
			<p>Copy this link and send it to a teammate.</p>

			<InvitePanel inviteUrl={inviteUrl} />
		</main>
	);
}
```

The route renders normal HTML on the server. `InvitePanel` is where hydration starts, so the clipboard logic stays out of the server render.

## Create the Client Entry

The island file contains both the parent panel and the child button so the event flow stays easy to follow.

```tsx {% path="app/components/invite-panel.tsx" %}
import type { Handle } from "remix/ui";

import { clientEntry, ref } from "remix/ui";

interface InvitePanelProps {
	inviteUrl: string;
}

interface InviteCopiedDetail {
	inviteUrl: string;
	copiedAt: string;
}

function CopyInviteButton(handle: Handle<InvitePanelProps>) {
	return () => (
		<button
			type="button"
			mix={ref((element, signal) => {
				async function copyInviteLink() {
					await navigator.clipboard.writeText(handle.props.inviteUrl);

					element.dispatchEvent(
						new CustomEvent<InviteCopiedDetail>("invite:copied", {
							bubbles: true,
							detail: {
								inviteUrl: handle.props.inviteUrl,
								copiedAt: new Date().toLocaleTimeString("en-US"),
							},
						}),
					);
				}

				element.addEventListener("click", copyInviteLink, { signal });
			})}
		>
			Copy Invite Link
		</button>
	);
}

export let InvitePanel = clientEntry(
	import.meta.url,
	function InvitePanel(handle: Handle<InvitePanelProps>) {
		let status = "Nothing copied yet.";

		return () => (
			<section
				mix={ref((element, signal) => {
					element.addEventListener(
						"invite:copied",
						(event) => {
							let detail = (event as CustomEvent<InviteCopiedDetail>).detail;
							status = `Copied ${detail.inviteUrl} at ${detail.copiedAt}.`;
							handle.update();
						},
						{ signal },
					);
				})}
			>
				<p>{handle.props.inviteUrl}</p>
				<CopyInviteButton inviteUrl={handle.props.inviteUrl} />
				<output aria-live="polite">{status}</output>
			</section>
		);
	},
);
```

`clientEntry` marks this component as a client island. The returned function renders the HTML, while the outer closure holds browser-only state and calls `handle.update()` when that state changes.

## Attach the Button Listener

The child button does not use JSX event props. It uses `ref(...)` to get the DOM element and add a native listener.

```tsx {% path="app/components/invite-panel.tsx" %}
function CopyInviteButton(handle: Handle<InvitePanelProps>) {
	return () => (
		<button
			type="button"
			mix={ref((element, signal) => {
				async function copyInviteLink() {
					await navigator.clipboard.writeText(handle.props.inviteUrl);
				}

				element.addEventListener("click", copyInviteLink, { signal });
			})}
		>
			Copy Invite Link
		</button>
	);
}
```

This is the key hydration step. The button HTML is already on the page from the server render, but the `navigator.clipboard` call only starts working after the client entry hydrates in the browser.

The `signal` matters too. Remix can use it to remove the listener when the element is replaced or unmounted.

## Dispatch a Custom Event From the Child

After the clipboard write succeeds, dispatch a bubbling `CustomEvent` from the button element. This keeps the child focused on the browser action while letting the parent decide what to do.

```tsx {% path="app/components/invite-panel.tsx" %}
// ... previous code

async function copyInviteLink() {
	await navigator.clipboard.writeText(handle.props.inviteUrl);

	element.dispatchEvent(
		new CustomEvent<InviteCopiedDetail>("invite:copied", {
			bubbles: true,
			detail: {
				inviteUrl: handle.props.inviteUrl,
				copiedAt: new Date().toLocaleTimeString("en-US"),
			},
		}),
	);
}
```

`detail` carries the event data, and `bubbles: true` lets the event travel up to the wrapping panel. That gives you parent-child coordination without passing callbacks through every layer.

## Listen on the Parent Element

Now attach a listener to the parent section. Because the event bubbles, the parent can react to the child without knowing how the child copied the link.

```tsx {% path="app/components/invite-panel.tsx" %}
export let InvitePanel = clientEntry(
	import.meta.url,
	function InvitePanel(handle: Handle<InvitePanelProps>) {
		let status = "Nothing copied yet.";

		return () => (
			<section
				mix={ref((element, signal) => {
					element.addEventListener(
						"invite:copied",
						(event) => {
							let detail = (event as CustomEvent<InviteCopiedDetail>).detail;
							status = `Copied ${detail.inviteUrl} at ${detail.copiedAt}.`;
							handle.update();
						},
						{ signal },
					);
				})}
			>
				<p>{handle.props.inviteUrl}</p>
				<CopyInviteButton inviteUrl={handle.props.inviteUrl} />
				<output aria-live="polite">{status}</output>
			</section>
		);
	},
);
```

The parent owns the UI state, so it updates `status` and calls `handle.update()`. This is a good fit for client entries because you can keep local state in plain variables instead of introducing hooks for a small island.

## Delay Mount Events When Needed

Click events happen after both elements are hydrated, so the parent listener is already attached. Mount-time custom events are different because a child `ref` can run before the parent listener is ready.

```tsx {% path="app/components/invite-panel.tsx" %}
function ChildStatusBeacon(_handle: Handle<Record<string, never>>) {
	return () => (
		<div
			mix={ref((element) => {
				queueMicrotask(() => {
					element.dispatchEvent(
						new CustomEvent("panel:ready", {
							bubbles: true,
						}),
					);
				});
			})}
		/>
	);
}
```

That `queueMicrotask(...)` pattern is the same one you need when a child should notify the parent as soon as it mounts. It gives the parent time to attach its own `ref(...)` listener first.

## Put the Full Flow Together

The full component looks like this.

```tsx {% path="app/components/invite-panel.tsx" %}
import type { Handle } from "remix/ui";

import { clientEntry, ref } from "remix/ui";

interface InvitePanelProps {
	inviteUrl: string;
}

interface InviteCopiedDetail {
	inviteUrl: string;
	copiedAt: string;
}

function CopyInviteButton(handle: Handle<InvitePanelProps>) {
	return () => (
		<button
			type="button"
			mix={ref((element, signal) => {
				async function copyInviteLink() {
					await navigator.clipboard.writeText(handle.props.inviteUrl);

					element.dispatchEvent(
						new CustomEvent<InviteCopiedDetail>("invite:copied", {
							bubbles: true,
							detail: {
								inviteUrl: handle.props.inviteUrl,
								copiedAt: new Date().toLocaleTimeString("en-US"),
							},
						}),
					);
				}

				element.addEventListener("click", copyInviteLink, { signal });
			})}
		>
			Copy Invite Link
		</button>
	);
}

export let InvitePanel = clientEntry(
	import.meta.url,
	function InvitePanel(handle: Handle<InvitePanelProps>) {
		let status = "Nothing copied yet.";

		return () => (
			<section
				mix={ref((element, signal) => {
					element.addEventListener(
						"invite:copied",
						(event) => {
							let detail = (event as CustomEvent<InviteCopiedDetail>).detail;
							status = `Copied ${detail.inviteUrl} at ${detail.copiedAt}.`;
							handle.update();
						},
						{ signal },
					);
				})}
			>
				<p>{handle.props.inviteUrl}</p>
				<CopyInviteButton inviteUrl={handle.props.inviteUrl} />
				<output aria-live="polite">{status}</output>
			</section>
		);
	},
);
```

The route renders the HTML on the server, the client entry hydrates the island in the browser, the child button uses `navigator.clipboard`, and the parent reacts through a bubbling custom event.

## Final Thoughts

This pattern works well when one small part of the page needs browser APIs but the rest can stay server rendered. `clientEntry` keeps hydration limited to that area, and `ref(...)` lets you work directly with DOM listeners and bubbling events when parent and child should talk through the DOM.
