---
title: Servidor MCP
description: Conectá este blog a tu agente para que pueda buscar y leer lo que escribo.
---

Este blog habla el [Model Context Protocol](https://modelcontextprotocol.io). Conectalo a
tu agente una vez y va a poder buscar en mis artículos, tutoriales y glosario, y leer
cualquiera de ellos completo.

Es mejor que dejar que el modelo adivine con lo que vio mientras se entrenaba, o con una
búsqueda web que capaz que encuentra una copia vieja.

Es de solo lectura y no necesitás una cuenta. La dirección es:

```
https://sergiodxa.com/mcp
```

## Cómo conectarlo

En Claude Code:

```sh
claude mcp add --transport http sergiodxa https://sergiodxa.com/mcp
```

En un cliente que se configura con un archivo:

```json
{
	"mcpServers": {
		"sergiodxa": {
			"type": "http",
			"url": "https://sergiodxa.com/mcp"
		}
	}
}
```

Claude Desktop todavía no habla esta versión del protocolo, así que necesita un puente:

```json
{
	"mcpServers": {
		"sergiodxa": {
			"command": "npx",
			"args": [
				"-y",
				"@abluva/mcp-remote@latest",
				"https://sergiodxa.com/mcp",
				"--protocol",
				"2026-07-28"
			]
		}
	}
}
```

## Herramientas

Tu agente las llama solo, cuando las necesita.

- `search_posts` busca artículos, tutoriales y entradas del glosario por título, extracto y
  etiquetas. Empezá por acá. Te da los slugs que las demás necesitan.
- `list_posts` lista artículos o tutoriales publicados, del más nuevo al más viejo. Sirve
  para ver qué hay, no para buscar un tema.
- `get_post` lee un artículo o tutorial completo, en Markdown.
- `list_glossary` lista todos los términos que definí. Es corto, así que no hay búsqueda.
- `get_glossary_term` lee la definición de un término.
- `list_bookmarks` lista los links que guardé.

## Recursos

Estos son para vos, no para el modelo. Si tu cliente muestra un selector, ahí está cada
publicación, así podés adjuntar una vos mismo en vez de confiar en que el modelo adivine el
slug correcto.

- Artículo: `https://sergiodxa.com/articles/{slug}.md`
- Tutorial: `https://sergiodxa.com/tutorials/{slug}.md`

Los dos son URLs normales de este sitio, así que tu cliente puede leerlos directo sin pasar
por el servidor MCP.

Cualquier página de acá puede responder en Markdown. Agregá `.md` a la URL, o mandá
`Accept: text/markdown`. Esta página también lo hace.

## Para tener en cuenta

- Nada de esto escribe. Ninguna herramienta puede cambiar nada en este blog.
- Los borradores y las publicaciones programadas nunca se ven.
- 60 pedidos por minuto por cliente. Mucho más de lo que necesita una conversación, y lo
  suficientemente poco como para aburrir a un scraper.
- Las respuestas pueden estar hasta cinco minutos desactualizadas, igual que las de un
  lector de feeds.
