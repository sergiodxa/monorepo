---
title: "Vary: * is a polite way to say never cache"
description: A response with Vary star can't be reused by any cache, and some CDNs won't tell you.
kind: notes
date: "2026-11-20"
tags: [http, caching]
---

Found a `Vary: *` on a client's home page today, added years ago "to be safe". It tells every cache that the response depends on something outside the request, so no stored copy can ever be reused. The CDN was dutifully storing it and serving none of it. Hit ratio on the busiest page: zero. Removing one header halved their origin traffic.
