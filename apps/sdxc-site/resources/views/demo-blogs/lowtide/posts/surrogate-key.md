---
title: Surrogate key
description: A label a response carries naming the content it shows, so a cache can purge every response showing that content at once.
kind: glossary
date: "2026-10-30"
tags: [caching, edge]
---

Also called a cache tag. The origin sends it in a response header, such as `Surrogate-Key` or `Cache-Tag`, listing the content the page contains. When that content changes, one purge by tag drops every page that showed it, without knowing their URLs.
