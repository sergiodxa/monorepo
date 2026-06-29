---
title: How to Build a Command-Driven Markdown Toolbar in React
excerpt: Use custom invoker commands to format selected textarea text as Markdown.
tech: react@19.0.0 tailwindcss@4.0.0
---

A Markdown textarea is one of those cases where a tiny toolbar is enough. You may want buttons for bold, italic, and links, but you do not need a full editor library for that.

The common approach is to put an `onClick` on every button and make each one find the textarea. With custom invoker commands, the buttons can target the textarea instead, and the textarea can decide how to handle each formatting command.

## Type Custom Commands

React may not include the `command` and `commandfor` button attributes in your installed types yet. Add a small augmentation so TypeScript accepts the standard commands and any custom command starting with `--`:

```ts {% path="app/types/react-command-attributes.d.ts" %}
import "react";

declare module "react" {
	type StandardCommand =
		| "show-modal"
		| "close"
		| "request-close"
		| "show-popover"
		| "hide-popover"
		| "toggle-popover";

	interface ButtonHTMLAttributes<T> {
		command?: StandardCommand | `--${string}`;
		commandfor?: string;
	}
}
```

For custom commands, the command name must start with `--`. The browser dispatches a `command` event on the element referenced by `commandfor`.

## Create the Editor Context

The toolbar buttons need the textarea ID. Instead of passing the ID to every button, generate it once in `Editor` and put it in context:

```tsx {% path="app/components/markdown-editor.tsx" %}
import { createContext, useContext, useId } from "react";
import type { ComponentProps, ReactNode } from "react";

export const BOLD_COMMAND = "--markdown-bold";
export const ITALIC_COMMAND = "--markdown-italic";
export const LINK_COMMAND = "--markdown-link";

const EditorContext = createContext<string | null>(null);

function useEditorId() {
	let id = useContext(EditorContext);
	if (!id) throw new Error("Editor components must be rendered inside <Editor>.");
	return id;
}

export namespace Editor {
	export interface Props {
		children: ReactNode;
	}
}

export function Editor({ children }: Editor.Props) {
	let textareaId = useId();

	return (
		<EditorContext.Provider value={textareaId}>
			<div className="v-stack gap-2">{children}</div>
		</EditorContext.Provider>
	);
}
```

`Editor` owns the generated ID. Every component inside it can read that ID and use it as the `commandfor` target.

The command strings are module-level constants because the buttons and the textarea listener need to share the same values.

## Add the Toolbar Components

Now add the toolbar and button components. The button reads the textarea ID from context and writes it to `commandfor`:

```tsx {% path="app/components/markdown-editor.tsx" %}
// ... previous code

export namespace Editor {
	export interface Props {
		children: ReactNode;
	}

	export interface ToolbarProps extends ComponentProps<"div"> {}

	export interface ButtonProps extends Omit<ComponentProps<"button">, "commandfor" | "type"> {
		command: `--${string}`;
	}
}

Editor.Toolbar = function Toolbar({ children, ...props }: Editor.ToolbarProps) {
	return (
		<div {...props} role="group" aria-label="Markdown formatting" className="h-stack gap-2">
			{children}
		</div>
	);
};

Editor.Button = function Button({ command, children, ...props }: Editor.ButtonProps) {
	let textareaId = useEditorId();

	return (
		<button {...props} type="button" command={command} commandfor={textareaId}>
			{children}
		</button>
	);
};
```

The caller does not pass `commandfor`. The only thing each button needs to say is which command it invokes.

The toolbar is only a `div` with `role="group"`. It groups the formatting buttons, but the textarea still owns the actual formatting behavior.

## Add the Textarea Field

The textarea is the command target. React does not expose an `onCommand` prop, so attach a native listener with a callback ref and clean it up with `AbortController`:

```tsx {% path="app/components/markdown-editor.tsx" %}
// ... previous code

export namespace Editor {
	// ... previous types

	export interface FieldProps extends Omit<ComponentProps<"textarea">, "id"> {}
}

Editor.Field = function Field(props: Editor.FieldProps) {
	let textareaId = useEditorId();

	return (
		<textarea
			{...props}
			id={textareaId}
			ref={(textarea) => {
				let controller = new AbortController();

				textarea.addEventListener(
					"command",
					(event) => {
						if (event.command === BOLD_COMMAND) wrapSelection(textarea, "**", "**");
						if (event.command === ITALIC_COMMAND) wrapSelection(textarea, "_", "_");
						if (event.command === LINK_COMMAND) {
							wrapSelection(textarea, "[", "]()");
							moveCursor(textarea, -1);
						}
					},
					{ signal: controller.signal },
				);

				return () => controller.abort();
			}}
		/>
	);
};
```

The `command` event fires on the textarea because that is the element referenced by `commandfor`. The listener checks `event.command` and applies the matching Markdown wrapper.

For the link command, the helper inserts `[selected text]()` and moves the cursor inside the parentheses. That lets the user type the URL immediately.

## Wrap the Selected Text

Add one helper to update the selected text and another one to move the cursor. `setRangeText()` replaces the current selection and can keep the new text selected after the replacement:

```tsx {% path="app/components/markdown-editor.tsx" %}
function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string) {
	let start = textarea.selectionStart;
	let end = textarea.selectionEnd;
	let selectedText = textarea.value.slice(start, end);
	let nextText = `${before}${selectedText}${after}`;

	textarea.setRangeText(nextText, start, end, "select");
	textarea.focus();
}

function moveCursor(textarea: HTMLTextAreaElement, offset: number) {
	let position = textarea.selectionEnd + offset;

	textarea.setSelectionRange(position, position);
	textarea.focus();
}
```

If the user selects `hello` and clicks Bold, `wrapSelection` replaces it with `**hello**`. If they click Link, `wrapSelection` inserts `[hello]()` and `moveCursor` moves the cursor between the parentheses.

This is the important split: the buttons declare commands, and the textarea owns the editing behavior.

## Use the Editor Components

Now the public API is the part you actually use. `Editor` provides the ID, `Editor.Toolbar` groups the buttons, `Editor.Button` declares commands, and `Editor.Field` receives them:

```tsx {% path="app/routes/post-create.tsx" %}
import { BOLD_COMMAND, Editor, ITALIC_COMMAND, LINK_COMMAND } from "~/components/markdown-editor";

export default function Component() {
	return (
		<form method="post" className="v-stack gap-4">
			<Editor>
				<Editor.Toolbar>
					<Editor.Button command={BOLD_COMMAND}>Bold</Editor.Button>
					<Editor.Button command={ITALIC_COMMAND}>Italic</Editor.Button>
					<Editor.Button command={LINK_COMMAND}>Link</Editor.Button>
				</Editor.Toolbar>

				<Editor.Field
					name="content"
					rows={8}
					className="w-full border p-2"
					defaultValue="Select some text and use the toolbar."
				/>
			</Editor>

			<button type="submit">Publish</button>
		</form>
	);
}
```

No editor state is required here. The browser keeps the textarea value, selection, and form submission behavior.

The components are still flexible because they compose through children. To add another button, add another custom command and teach `Editor.Field` how to handle it.

## Final Thoughts

This pattern works well when the command target is also the element that owns the state. In this case, the textarea owns the value and selection, so it is the right place to apply Markdown formatting.

For a full editor, use a Markdown or rich text library. For a textarea with a few formatting buttons, compound components plus `setRangeText()` are enough.
