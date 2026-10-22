# @sdxc/iife

Immediately invoke a callback where an expression is needed.

## Installation

```sh
npm add @sdxc/iife
```

## Usage

### Compute a value without an outer mutable binding

```typescript
import { iife } from "@sdxc/iife";

let buttonLabel = iife(() => {
	if (isSaving) return "Saving…";
	if (hasChanges) return "Save changes";
	return "Saved";
});
```

### Branch in the middle of JSX

```tsx
import { iife } from "@sdxc/iife";

<header>
	<h1>{team.name}</h1>
	<p>
		{iife(() => {
			if (team.plan === "enterprise") return "Priority support enabled";
			if (team.trialEndsAt) return `Trial ends on ${formatDate(team.trialEndsAt)}`;
			return "Standard support";
		})}
	</p>
</header>;
```

### Keep `try`/`catch` inside the assignment

```typescript
import { iife } from "@sdxc/iife";

let result = iife(() => {
	try {
		let data = JSON.parse(input) as { name: string };
		return { data: data.name, error: null };
	} catch {
		return { data: null, error: "Invalid JSON input" };
	}
});
```

### Await sequential async work inline

```typescript
import { iife } from "@sdxc/iife";

let viewer = await iife(async () => {
	let response = await fetch("/api/viewer");
	return response.json() as Promise<{ profileUrl: string }>;
});

let profile = await iife(async () => {
	let response = await fetch(viewer.profileUrl);
	return response.json();
});
```

## API

### `iife<T>(fn: () => T): T`

Runs `fn` immediately and returns its result. An async callback yields a promise; `await` it like any other.

## Pattern: Object fields that need a branch

```typescript
import { iife } from "@sdxc/iife";

let payload = {
	title: "Invoice",
	status: iife(() => {
		if (isPaid) return "paid";
		if (isOverdue) return "overdue";
		return "pending";
	}),
};
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/iife": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
