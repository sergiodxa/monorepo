---
title: How to Handle Custom Invoker Commands in React
excerpt: Use custom --commands with a native command event listener and a React callback ref cleanup.
tech: react@19.0.0 tailwindcss@4.0.0
---

The Invoker Commands API has standard commands like `show-modal`, `toggle-popover`, and `request-close`. It also supports custom commands when the command name starts with `--`.

Custom commands are useful when a button should target a specific element, but the behavior is application specific. React does not expose an `onCommand` prop for this event, so you attach a native `command` event listener to the target element.

## Type the Command Attribute

Start with the same React type augmentation used for standard commands. The important part for custom commands is `` `--${string}` ``, which allows values like `--mark-all-read`:

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

	interface HTMLAttributes<T> {
		popover?: "auto" | "manual" | "";
	}
}
```

The browser treats command names starting with `--` as custom commands. Instead of running built in behavior, it dispatches a `command` event on the target element.

## Render the Command Target

For this example, build a notifications popover. The bell button uses the standard `toggle-popover` command, and the "Mark all as read" button uses a custom `--mark-all-read` command:

```tsx {% path="app/components/notifications-menu.tsx" %}
import { useId } from "react";

const MARK_ALL_READ_COMMAND = "--mark-all-read";

const INITIAL_NOTIFICATIONS = [
	{ id: "comment", title: "New comment on your post", read: false },
	{ id: "deployment", title: "Deployment finished", read: false },
	{ id: "invoice", title: "Invoice paid", read: true },
];

export function NotificationsMenu() {
	let menuId = useId();

	return (
		<div>
			<button type="button" command="toggle-popover" commandfor={menuId}>
				Notifications
			</button>

			<div id={menuId} popover="auto" className="fixed top-16 right-4 m-0 w-64 border bg-white p-2">
				<div className="h-stack items-center gap-2 px-2 py-1">
					<h2 className="spacer">Notifications</h2>
					<button type="button" command={MARK_ALL_READ_COMMAND} commandfor={menuId}>
						Mark All as Read
					</button>
				</div>

				<ul>
					{INITIAL_NOTIFICATIONS.map((notification) => (
						<li key={notification.id} className="px-2 py-1">
							{notification.title} ({notification.read ? "read" : "unread"})
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
```

The custom command still uses `commandfor={menuId}`. That means the popover element receives the `command` event, not the button.

This is the same direction as the built in commands: the button invokes an action, and the target element decides what to do.

## Attach the Command Listener

React does not have an `onCommand` prop, so attach the listener with a callback ref. In React 19, a callback ref can return a cleanup function, and React runs that cleanup when the element unmounts or the ref changes:

```tsx {% path="app/components/notifications-menu.tsx" %}
import { useId, useState } from "react";

const MARK_ALL_READ_COMMAND = "--mark-all-read";

const INITIAL_NOTIFICATIONS = [
	{ id: "comment", title: "New comment on your post", read: false },
	{ id: "deployment", title: "Deployment finished", read: false },
	{ id: "invoice", title: "Invoice paid", read: true },
];

export function NotificationsMenu() {
	let menuId = useId();
	let [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
	let unreadCount = notifications.filter((notification) => !notification.read).length;

	return (
		<div>
			<button type="button" command="toggle-popover" commandfor={menuId}>
				Notifications ({unreadCount})
			</button>

			<div
				id={menuId}
				popover="auto"
				className="fixed top-16 right-4 m-0 w-64 border bg-white p-2"
				ref={(element) => {
					let controller = new AbortController();

					element.addEventListener(
						"command",
						(event) => {
							if (event.command !== MARK_ALL_READ_COMMAND) return;

							setNotifications((notifications) =>
								notifications.map((notification) => ({ ...notification, read: true })),
							);

							element.hidePopover();
						},
						{ signal: controller.signal },
					);

					return () => controller.abort();
				}}
			>
				<div className="h-stack items-center gap-2 px-2 py-1">
					<h2 className="spacer">Notifications</h2>
					<button type="button" command={MARK_ALL_READ_COMMAND} commandfor={menuId}>
						Mark All as Read
					</button>
				</div>

				<ul>
					{notifications.map((notification) => (
						<li key={notification.id} className="px-2 py-1">
							{notification.title} ({notification.read ? "read" : "unread"})
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
```

The `command` event gives you the command string through `event.command`. Check that value before running your action, because the same target can receive multiple custom commands.

The handler maps over the notifications and sets every `read` flag to `true`, then calls `element.hidePopover()`. Custom commands do not automatically close popovers, but the target element is already in scope, so you can close it directly after your action runs.

The cleanup function aborts the controller. Because the listener was registered with `signal`, aborting the controller removes the listener added by the ref callback.

If your command handler needs more state or props, keep the listener small and call another function from inside it.

## Use the Command Source

The `CommandEvent` also gives you `event.source`, which is the button that invoked the command. This is useful when multiple buttons send the same command with different values:

```tsx {% path="app/components/notifications-menu.tsx" %}
<button type="button" command="--archive-notification" commandfor={menuId} value="comment">
	Archive Comment Notification
</button>

<button type="button" command="--archive-notification" commandfor={menuId} value="deployment">
	Archive Deployment Notification
</button>
```

Then read the source button inside the command listener:

```tsx {% path="app/components/notifications-menu.tsx" %}
function handleCommand(event: CommandEvent) {
	if (event.command !== "--archive-notification") return;
	if (!(event.source instanceof HTMLButtonElement)) return;
	archiveNotification(event.source.value);
}
```

This keeps the command name focused on the action and lets the button provide the specific value. It is the same idea as form submit buttons carrying a `name` or `value`.

## Keep the Ref Callback Small

The callback ref is the bridge between React and the native event. Keep it focused on adding and removing the listener.

If the command needs more application logic, call a function from inside `handleCommand` instead of putting everything in the event listener. That keeps the DOM integration small and the behavior easy to test.

## Final Thoughts

Custom invoker commands let buttons target a specific element without inventing another React prop API. Use a `--command-name`, listen for the native `command` event on the target, and return a cleanup function from the callback ref to remove the listener on unmount.
