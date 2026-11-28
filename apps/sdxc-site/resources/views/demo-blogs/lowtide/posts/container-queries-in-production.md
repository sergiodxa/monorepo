---
title: Container queries, a year in production
description: The card component finally knows how wide it is.
kind: notes
date: "2026-08-22"
tags: [css]
---

A year of `@container` in production and the thing I notice most is what I deleted: every `.card--compact` modifier and the props that chose between them. A card in a sidebar and a card in the main column are now the same markup, and each lays itself out for the space it gets.
