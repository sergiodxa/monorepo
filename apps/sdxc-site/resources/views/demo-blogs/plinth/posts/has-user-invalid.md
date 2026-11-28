---
title: Style the field, not just the input
description: ":has() and :user-invalid together, no script needed."
kind: notes
date: "2025-11-20"
tags: [css, accessibility, components]
---

`:invalid` matches an empty required field the moment the page loads, which is why error styles used to need JavaScript. `:user-invalid` only matches after the reader has interacted with the field. Combine it with `:has()` and the whole field group can react: `.field:has(input:user-invalid) { --field-border: var(--border-critical); }` turns the label, border and hint red together. Keep the error text in the DOM and linked with `aria-describedby`, so it is announced, not only painted.
