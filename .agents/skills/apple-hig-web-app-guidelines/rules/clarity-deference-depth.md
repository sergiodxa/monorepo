---
title: Clarity, Deference, and Depth
impact: HIGH
tags: [apple-hig, principles, hierarchy, depth]
---

# Clarity, Deference, and Depth

Apple's core design principles map well to web apps: make the task clear, let content lead, and use layers only when they preserve context.

## Why

- Clear labels and hierarchy reduce hesitation, especially on small screens
- Deferential UI keeps decoration from competing with the user's content or task
- Depth helps users understand where temporary UI came from and how to dismiss it
- Overly decorative or ambiguous controls feel less trustworthy and are harder to scan

## Pattern

```tsx
// Bad: the action depends on an unexplained icon and decoration competes with content
<section
  mix={css({
    padding: "2rem",
    borderRadius: "3rem",
    background: "linear-gradient(135deg, #d946ef, #06b6d4)",
    boxShadow: "0 24px 80px rgb(0 0 0 / 0.35)",
  })}
>
  <button mix={css({ padding: "0.5rem", borderRadius: "999px" })}>
    <ArchiveIcon />
  </button>
  <p mix={css({ fontSize: "0.75rem", letterSpacing: "0.4em", textTransform: "uppercase" })}>
    Important content
  </p>
</section>

// Good: content and action are explicit; decoration stays quiet
<section
  mix={css({
    display: "grid",
    gap: "1rem",
    padding: "1rem",
    border: "1px solid var(--color-border)",
    borderRadius: "1rem",
    backgroundColor: "var(--color-background)",
    boxShadow: "0 1px 2px rgb(0 0 0 / 0.08)",
  })}
>
  <div>
    <p mix={css({ color: "var(--color-muted-foreground)", fontSize: "0.875rem" })}>Invoice #2481</p>
    <h2 mix={css({ margin: 0, fontSize: "1.25rem", fontWeight: 600 })}>Payment due Friday</h2>
  </div>
  <button
    mix={css({
      display: "inline-flex",
      alignItems: "center",
      gap: "0.5rem",
      justifySelf: "start",
      minHeight: "2.75rem",
      paddingInline: "1rem",
      borderRadius: "999px",
    })}
  >
    <ArchiveIcon aria-hidden="true" />
    Archive invoice
  </button>
</section>
```

```tsx
// Bad: modal appears without context or a clear title
<dialog open>
  <button>OK</button>
</dialog>

// Good: depth is attached to a focused task and has an explicit exit
<dialog id="rename-project" aria-labelledby="rename-project-title">
  <form
    method="dialog"
    mix={css({ display: "grid", gap: "1rem", padding: "1.5rem", minWidth: "min(24rem, 90vw)" })}
  >
    <h2 id="rename-project-title">Rename project</h2>
    <label mix={css({ display: "grid", gap: "0.5rem" })}>
      Name
      <input name="name" />
    </label>
    <div mix={css({ display: "flex", justifyContent: "end", gap: "0.75rem" })}>
      <button value="cancel">Cancel</button>
      <button value="confirm">Save</button>
    </div>
  </form>
</dialog>
```

## Practical Checks

- A first-time user can identify the current page, primary action, and next step within a few seconds
- Body text and user content are visually stronger than borders, shadows, gradients, and icons
- Overlays have titles, close/cancel paths, and are visually connected to a task
- Icon-only controls are limited to universally understood icons and still include accessible names

## Rules

1. Lead with readable content, not decorative containers.
2. Use explicit verbs for actions: `Save changes`, `Archive invoice`, `Invite member`.
3. Keep visual effects subtle unless they communicate state or hierarchy.
4. Use dialogs, popovers, and sheets for temporary focused tasks, not full page structure.
5. Make every layer easy to understand, complete, and dismiss.
