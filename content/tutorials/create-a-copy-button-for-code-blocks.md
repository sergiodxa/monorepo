---
title: How to Create a Copy Button for Code Blocks
excerpt: Build a copy button with visual feedback using the Clipboard API and React hooks.
technologies: react@19.0.0
---

When you display code blocks in a blog, documentation site, or any application with code examples, users often want to copy that code quickly. A copy button that provides visual feedback makes this interaction seamless: the user clicks, sees a checkmark confirming success, and the button resets after a couple of seconds. If you're rendering code blocks from markdown content, you can integrate this with a [type-safe markdown pipeline using Markdoc](/tutorials/build-a-type-safe-markdown-pipeline-with-markdoc).

The challenge is handling the clipboard interaction correctly, managing the button's state transitions, and ensuring the feedback resets automatically. Let's build this using the Clipboard API and a custom React hook.

## Create the useClipboard Hook

```ts {% path="app/hooks/use-clipboard.ts" %}
import { useCallback, useState } from "react";

type Status = "idle" | "loading" | "success" | "failure";

interface State {
	status: Status;
	error: Error | null;
}

export function useClipboard() {
	let [state, setState] = useState<State>({
		status: "idle",
		error: null,
	});

	let write = useCallback(async (data: ClipboardItems) => {
		setState({ status: "loading", error: null });
		try {
			await navigator.clipboard.write(data);
			setState({ status: "success", error: null });
		} catch (error) {
			setState({
				status: "failure",
				error: error instanceof Error ? error : new Error(String(error)),
			});
		}
	}, []);

	let reset = useCallback(() => {
		setState({ status: "idle", error: null });
	}, []);

	return { status: state.status, error: state.error, write, reset };
}
```

This hook wraps the Clipboard API and tracks the operation's status. It exposes a `write` function to copy data, a `reset` function to return to the idle state, and the current `status` so the UI can react accordingly.

## Build the Copy Button Component

```tsx {% path="app/components/copy-button.tsx" %}
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect } from "react";
import { useClipboard } from "~/hooks/use-clipboard";

interface CopyButtonProps {
	targetId: string;
}

export function CopyButton({ targetId }: CopyButtonProps) {
	let { status, write, reset } = useClipboard();

	useEffect(() => {
		if (status === "idle" || status === "loading") return;
		let timeout = setTimeout(reset, 2000);
		return () => clearTimeout(timeout);
	}, [status, reset]);

	return (
		<button
			type="button"
			onClick={async () => {
				let element = document.getElementById(targetId);
				if (!element) return;

				let text = element.textContent ?? "";
				let item = new ClipboardItem({
					"text/plain": new Blob([text], { type: "text/plain" }),
				});

				await write([item]);
			}}
			disabled={status === "loading"}
			aria-label={status === "success" ? "Copied" : "Copy code"}
		>
			{status === "success" ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
		</button>
	);
}
```

The component receives a `targetId` prop that references the code block element. When clicked, it reads the text content from that element, creates a `ClipboardItem`, and writes it to the clipboard. The `useEffect` handles the auto-reset: after a successful or failed copy, it waits two seconds and then resets the status back to idle.

## Use ClipboardItem for Better Compatibility

```ts {% path="app/components/copy-button.tsx" %}
let text = element.textContent ?? "";
let item = new ClipboardItem({
	"text/plain": new Blob([text], { type: "text/plain" }),
});

await write([item]);
```

Instead of using `navigator.clipboard.writeText()`, we use `navigator.clipboard.write()` with a `ClipboardItem`. This approach is more flexible because it supports multiple MIME types. For code blocks, plain text works perfectly, but this pattern extends to copying HTML, images, or other formats if needed.

## Connect the Button to Your Code Block

```tsx {% path="app/components/code-block.tsx" %}
import { useId } from "react";
import { CopyButton } from "~/components/copy-button";

interface CodeBlockProps {
	code: string;
	language: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
	let id = useId();

	return (
		<div className="relative">
			<div className="absolute right-2 top-2">
				<CopyButton targetId={id} />
			</div>
			<pre>
				<code id={id} className={`language-${language}`}>
					{code}
				</code>
			</pre>
		</div>
	);
}
```

The `useId` hook generates a unique ID for each code block, which the `CopyButton` uses to find and read the code content. Position the button absolutely in the top-right corner of the code block container for a clean UI.

## Handle the Auto-Reset Logic

```ts {% path="app/components/copy-button.tsx" %}
useEffect(() => {
	if (status === "idle" || status === "loading") return;
	let timeout = setTimeout(reset, 2000);
	return () => clearTimeout(timeout);
}, [status, reset]);
```

This effect runs whenever the status changes. If the status is `success` or `failure`, it schedules a reset after two seconds. The cleanup function clears the timeout if the component unmounts or if the status changes again before the timeout fires. This prevents memory leaks and ensures the button always returns to its initial state.

## Add Accessible Labels

```tsx {% path="app/components/copy-button.tsx" %}
<button
  type="button"
  aria-label={status === "success" ? "Copied" : "Copy code"}
  // ...
>
```

Since the button only contains an icon, the `aria-label` provides context for screen reader users. The label changes based on the status, so users know when the copy operation succeeded. For more accessible component patterns, see [Building Accessible UI with React Aria Components](/articles/building-accessible-ui-with-react-aria-components).
