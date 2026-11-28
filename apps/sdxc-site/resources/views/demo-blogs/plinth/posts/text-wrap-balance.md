---
title: Balance the heading, prettify the paragraph
description: Two text-wrap values, two different jobs.
kind: notes
date: "2026-11-18"
tags: [typography, css]
---

`text-wrap: balance` evens out the line lengths of a block, which is what a two-line heading wants: no single word stranded on the second line. Browsers only balance short blocks of a few lines and ignore it beyond that, so it is safe to put on every heading. For paragraphs I use `text-wrap: pretty` instead. It leaves most lines alone and only avoids a lonely last word, which costs far less layout work on long text.
