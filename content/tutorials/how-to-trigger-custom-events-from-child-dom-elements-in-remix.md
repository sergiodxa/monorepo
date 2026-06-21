---
title: How to Trigger Custom Events from Child DOM Elements in Remix 3
excerpt: Dispatch a custom DOM event from a child element and handle it on a parent element in Remix 3.
tech: remix@3.0.0-beta.4
---

Sometimes a child element needs to tell a parent element that something happened, but you do not want to thread callbacks through every layer just for that one interaction. When the communication stays inside one DOM subtree, a bubbling custom event is often the simplest option.

With `remix/ui`, this fits naturally because `ref` gives you direct access to the rendered element. Let's see how you could dispatch a `CustomEvent` from a child element and handle it from a parent element in Remix 3.

## Create the Child Element

Start with the child. It renders a `div`, gets a reference to that element, and dispatches a custom event from that node.

```tsx {% path="src/components/test.tsx" %}
import { ref, clientEntry } from "remix/ui";

function Child() {
	return () => (
		<div
			mix={ref((ref) => {
				queueMicrotask(() =>
					ref.dispatchEvent(
						new CustomEvent("testEvent", {
							detail: "Hello from Child!",
							bubbles: true,
						}),
					),
				);
			})}
		>
			Test
		</div>
	);
}
```

The child dispatches `testEvent` from its own DOM node. The payload lives in `detail`, so the parent can read it without reaching into the child.

## Bubble the Event to the Parent

The parent will only receive the event if it bubbles through the DOM. That is what `bubbles: true` is doing here.

```tsx {% path="/src/components/test.tsx" %}
new CustomEvent("testEvent", {
	detail: "Hello from Child!",
	bubbles: true,
});
```

Without that option, the event stops at the child element and the parent listener never sees it.

## Listen on the Parent Element

Now attach the listener on the parent element. This is the element that wraps `<Child />`, so any bubbling event from the child can reach it.

```tsx {% path="/src/components/test.tsx" %}
export const Parent = clientEntry(import.meta.url, function Parent() {
	return () => (
		<div
			mix={ref((ref, signal) => {
				ref.addEventListener(
					"testEvent",
					(event: CustomEvent<string>) => console.log(event.detail),
					{ signal },
				);
			})}
		>
			<Child />
		</div>
	);
});
```

The `signal` lets `remix/ui` clean up the listener when the element goes away. The handler receives the same `detail` value the child dispatched.

## Delay the Dispatch to a Microtask

There is one small timing issue here. The child's `ref` callback runs before the parent has attached its listener, so dispatching immediately can fire the event too early.

```tsx {% path="/src/components/test.tsx" %}
mix={ref((ref) => {
	queueMicrotask(() =>
		ref.dispatchEvent(
			new CustomEvent("testEvent", {
				detail: "Hello from Child!",
				bubbles: true,
			}),
		),
	);
})}
```

Queuing the dispatch in a microtask gives the parent time to register `addEventListener()` first. Without that, the initial event can be missed.

## Put the Full Example Together

Here is the full example together.

```tsx {% path="/src/components/test.tsx" %}
import { ref, clientEntry } from "remix/ui";

function Child() {
	return () => (
		<div
			mix={ref((ref) => {
				// Delay dispatch until the parent listener is attached.
				queueMicrotask(() =>
					ref.dispatchEvent(
						new CustomEvent("testEvent", {
							detail: "Hello from Child!",
							bubbles: true,
						}),
					),
				);
			})}
		>
			Test
		</div>
	);
}

export const Parent = clientEntry(import.meta.url, function Parent() {
	return () => (
		<div
			mix={ref((ref, signal) => {
				ref.addEventListener(
					"testEvent",
					(event: CustomEvent<string>) => console.log(event.detail),
					{ signal },
				);
			})}
		>
			<Child />
		</div>
	);
});
```

When the child mounts, it dispatches `testEvent`. Because the event bubbles, the parent receives it and logs `Hello from Child!`.

## Final Thoughts

This pattern works well for small, local interactions where both sides already share a DOM boundary. It keeps the communication close to the platform, but at the cost of being tied to DOM timing, which is why the microtask step matters here.
