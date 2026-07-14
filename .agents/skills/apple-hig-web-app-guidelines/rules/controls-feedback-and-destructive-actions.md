---
title: Controls, Feedback, and Destructive Actions
impact: HIGH
tags: [apple-hig, controls, feedback, destructive-actions, forms]
---

# Controls, Feedback, and Destructive Actions

Controls should communicate what will happen, show progress immediately, and make destructive actions deliberate without adding friction to safe tasks.

## Why

- Apple interfaces make actions feel direct and reversible where possible
- Web latency means users need visible pending, success, and failure states
- Destructive actions need clear wording, separation, and confirmation when data loss is likely
- Disabled or loading states without explanation feel broken

## Pattern

```tsx
// Bad: vague label and no pending state
<button type="submit">OK</button>

// Good: explicit verb and immediate feedback
<button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
  {isSubmitting ? "Saving..." : "Save changes"}
</button>
```

```tsx
// Bad: destructive action placed beside safe actions without context
<div mix={css({ display: "flex", gap: "0.5rem" })}>
  <button>Cancel</button>
  <button>Delete</button>
  <button>Save</button>
</div>

// Good: destructive action is explicit, visually separated, and confirmable
<div mix={css({ display: "flex", justifyContent: "space-between", gap: "0.75rem" })}>
  <button
    type="button"
    commandfor="delete-project"
    command="show-modal"
    mix={css({ color: "var(--color-failure)" })}
  >
    Delete project
  </button>
  <div mix={css({ display: "flex", gap: "0.75rem" })}>
    <button type="button">Cancel</button>
    <button type="submit">Save changes</button>
  </div>
</div>

<dialog id="delete-project" aria-labelledby="delete-project-title">
  <form method="dialog" mix={css({ display: "grid", gap: "1rem", padding: "1.5rem" })}>
    <h2 id="delete-project-title">Delete project?</h2>
    <p>This permanently removes the project and cannot be undone.</p>
    <div mix={css({ display: "flex", justifyContent: "end", gap: "0.75rem" })}>
      <button value="cancel">Cancel</button>
      <button value="delete" mix={css({ color: "var(--color-failure)" })}>Delete project</button>
    </div>
  </form>
</dialog>
```

```tsx
// Good: background progress has a visible status region
<div
	role="status"
	aria-live="polite"
	mix={css({ color: "var(--color-muted-foreground)", fontSize: "0.875rem" })}
>
	Syncing changes...
</div>
```

## Feedback Guidance

| Situation          | Good feedback                                              |
| ------------------ | ---------------------------------------------------------- |
| Button press       | Visual pressed/pending state and explicit disabled reason  |
| Form submit        | Inline validation, pending state, success or failure copy  |
| Background update  | Non-blocking status region or toast with meaningful text   |
| Destructive action | Specific label, separation, confirmation, undo if possible |
| Empty result       | Explain the state and provide the next useful action       |

## Rules

1. Use labels that describe the result of the action.
2. Show pending state immediately for network or long-running operations.
3. Keep validation errors close to the affected fields.
4. Separate destructive actions from safe primary actions.
5. Confirm irreversible destructive actions and prefer undo for reversible ones.
