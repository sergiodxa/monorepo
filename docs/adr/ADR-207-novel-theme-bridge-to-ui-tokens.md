# ADR-207: The Novel Themes `@sdxc/ui` Controls Through an Unlayered Bridge Stylesheet

## Status

**Implemented** - 2026-11-27

## Background

`@sdxc/novel`'s player draws its dialogs (settings, saves, the library screens) with `@sdxc/ui`
controls: the dialog's close button, `Button`, `Select`, `Slider`, `Switch`, `Menu`. A game themes
the player through `--novel-*` variables, such as `--novel-dialog-color` and
`--novel-dialog-accent`, set on the player or any ancestor. Those colors reached the novel's own
parts and stopped at every `@sdxc/ui` control: a dialog themed parchment-on-green still showed the
app's default close button, slider track and focus ring.

## Context

- `@sdxc/ui`'s `theme.css` sets its `--ui-*` tokens on every element of a themed page, not only on
  the root: `:is(.system, .system *)`, and likewise `:is(.dark, .dark *)`, under
  `prefers-color-scheme` and `prefers-contrast`. Each control reads the token from its own
  element, so a value inherited from the player never wins: the theme sets the token again on the
  control itself.
- Those rules are unlayered.
- `remix/component`'s `css()` emits every rule inside a cascade layer. An unlayered declaration
  beats any layered one regardless of specificity, so a `css()` mixin that sets `--ui-*` tokens on
  a dialog, or on `& *` inside it, always loses to `theme.css`.
- A player can sit on a page with any `@sdxc/ui` theme, or none, and several players or a title
  screen with its own dialogs can share one page.

## Decision

The novel renders one unlayered stylesheet, `THEME_BRIDGE_STYLESHEET` in `ui/theme.ts`, through
the `ThemeBridge` component: the player renders it once on its root, and a dialog rendered outside
a player (a title screen's) renders its own.

- Every surface carries `data-novel-theme-surface` (`dialog`, `settings`, `encyclopedia`). One rule
  per surface resolves its `--novel-*` colors into five `--novel-ui-*` values: ink, accent, text
  on the accent, line and field.
- One rule, `[data-novel-theme-surface] *:not([data-novel-theme-surface])`, maps every `--ui-*`
  token a control reads onto those values, mixing hover, pressed and muted steps with
  `color-mix()`.
- The bridge rule is unlayered and carries two attribute selectors, so it outranks
  `:is(.system, .system *)` and `:is(.dark, .dark *)` by specificity in every color scheme.
- The surface colors stay `--novel-*` variables with defaults, listed in `NOVEL_THEME_VARIABLES`,
  so a game themes the controls the same way it themes everything else: `css(theme({ … }))`.

## Consequences

- Every `@sdxc/ui` control inside a player dialog follows the game's theme, including a `Button`
  or `Select` a game places there itself, whatever theme the page applies.
- The bridge is the one place that knows `@sdxc/ui`'s token names; a token `@sdxc/ui` adds that a
  control inside a dialog reads must be added to `BRIDGED_TOKENS`, or that control keeps the
  page's theme for it.
- The novel ships one plain `<style>` element beside its `css()` mixins. It is a fixed string with
  no per-instance values, so every copy on a page is identical.
- Controls outside a surface (the quick menu, the title's own buttons) keep their `css()` styling
  through `--novel-*` variables and are unaffected.

## Alternatives Considered

- **Set the tokens with `css()` on each dialog.** Layered, so `theme.css` overrides them on every
  control.
- **Ask `@sdxc/ui` to set its tokens on `:root` only.** That changes how every app's theme cascades
  and lets a value set on an ancestor leak into unrelated components; the novel would still need
  to map its variables onto the tokens.
- **Restyle each control's internals from the novel.** It couples the novel to every control's
  markup and breaks when a control changes, where the tokens are `@sdxc/ui`'s stable contract.

## References

- [ADR-200](./ADR-200-novel-package.md): the `@sdxc/novel` package
- `packages/novel/src/ui/theme.ts` and `packages/novel/src/ui/theme-bridge.tsx`
- `packages/ui/src/theme.css`
