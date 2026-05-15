---
title: How to Use an `iife` Helper for Inline Control Flow in TypeScript
excerpt: Create a small `iife` helper to use `if`, `try`/`catch`, and async code where JavaScript expects an expression.
tech: typescript@5.0.0 react@19.0.0
---

One thing JavaScript still does not have is a `do` expression. If you have seen the [`do` expressions proposal](https://github.com/tc39/proposal-do-expressions), the idea is simple: write a block of code and get a value back from it as an expression.

That would be useful in a lot of places. Assigning a variable, building an object property, or returning JSX often needs `if`, `try`/`catch`, or a few local variables, but JavaScript only allows expressions there.

Since we do not have `do` expressions today, and may never get them, we can write a small helper function to let us achieve the same.

## Create the Helper

You could write an actual IIFE every time you need it.

```ts
let result = (() => {
	if (input === "") return "empty";
	return input.trim();
})();
```

That works, but the syntax is also a bit awkward to read and write. A small helper gives you the same idea with a shape that feels easier to scan.

```ts
export function iife<T>(fn: () => T): T {
	return fn();
}
```

That is all it does. The benefit is that it lets you use the same pattern with less syntax, while keeping the code close to the place where the value is needed.

## Compute a Value Without Hoisting a Variable

One of the most common cases is variable initialization. Usually the code ends up declaring a variable first and assigning it later.

```ts
let buttonLabel: string;

if (isSaving) {
	buttonLabel = "Saving...";
} else if (hasChanges) {
	buttonLabel = "Save changes";
} else {
	buttonLabel = "Saved";
}
```

This works, but the variable has to exist before the logic that computes it. With `iife`, the assignment and the control flow stay together.

```ts
let buttonLabel = iife(() => {
	if (isSaving) return "Saving...";
	if (hasChanges) return "Save changes";
	return "Saved";
});
```

This is a small example, but it shows the shape clearly. The whole block exists to produce one value.

## Branch in the Middle of JSX

The helper is more useful in JSX when you need to branch in the middle of a larger tree, not when you can just return early from the component.

```tsx
<header>
	<h1>{team.name}</h1>
	<p>
		{iife(() => {
			if (team.plan === "enterprise") return "Priority support enabled";
			if (team.trialEndsAt) return `Trial ends on ${formatDate(team.trialEndsAt)}`;
			return "Standard support";
		})}
	</p>
</header>
```

This is the kind of JSX where `iife` helps. You are already inside a larger return value and only one small part needs block-style logic.

## Use `try`/`catch` Inside an Assignment

`try`/`catch` is another place where this helps. Without `iife`, you usually need a variable outside the block so both `try` and `catch` can assign to it.

```ts
let result: { data: string | null; error: string | null };

try {
	let data = JSON.parse(input) as { name: string };
	result = { data: data.name, error: null };
} catch {
	result = { data: null, error: "Invalid JSON input" };
}
```

With `iife`, the assignment and the control flow stay together.

```ts
let result = iife(() => {
	try {
		let data = JSON.parse(input) as { name: string };
		return { data: data.name, error: null };
	} catch {
		return { data: null, error: "Invalid JSON input" };
	}
});
```

This is one of the clearest uses for the pattern. The block exists to compute one value, so keeping everything inside the assignment reads well.

## Await Sequential Async Work Inline

The same idea works with async code. If the callback is async, `iife` returns a promise, so you can `await` it.

You could move this logic into helpers like `fetchViewer` and `fetchProfile`, but then those helpers need more arguments because they no longer have access to the current scope. Keeping the inline flow inside `iife` can make those extracted functions stay simpler.

```ts
interface Viewer {
	id: string;
	profileUrl: string;
}

interface Profile {
	name: string;
}

let viewer = await iife<Promise<Viewer>>(async () => {
	let response = await fetch("/api/viewer", {
		headers: request.headers,
	});

	return await response.json();
});

let profile = await iife<Promise<Profile>>(async () => {
	let response = await fetch(viewer.profileUrl, {
		headers: request.headers,
	});

	return await response.json();
});
```

Each block only keeps the variables it needs. You do not need names like `viewerResponse` and `profileResponse`, and you also do not need to extract small helpers just to avoid outer mutable state.

If the requests are independent, `Promise.all` is still the better tool. This pattern helps when the work is sequential and you want each computed value to keep its own local setup.

## Keep Inline Logic Small

This pattern works best when the inline block is short and only exists to compute one value. A couple of branches, a `try`/`catch`, or a small async sequence are usually fine.

Once the block starts growing, the trade-off changes. At that point, a named function is often easier to understand because it gives the logic a clear boundary and a name that explains why it exists.

## Final Thoughts

An `iife` helper is a small pattern, but it solves a real problem. It gives you a way to use block-style logic where JavaScript only accepts expressions, without introducing outer mutable state.
