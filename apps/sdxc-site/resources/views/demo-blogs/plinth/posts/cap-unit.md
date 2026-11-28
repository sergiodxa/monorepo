---
title: Size icons in cap
description: The cap unit lines an icon up with capital letters.
kind: notes
date: "2026-10-21"
tags: [css, typography, components]
---

An inline icon sized in `em` is taller than the capitals beside it, because the em box includes room for ascenders and descenders. The `cap` unit is the cap height of the element's own font, so `block-size: 1cap` makes the icon exactly as tall as an uppercase letter. Pair it with `vertical-align: baseline` on an inline SVG and a button label with an icon finally looks centred without a magic negative margin.
