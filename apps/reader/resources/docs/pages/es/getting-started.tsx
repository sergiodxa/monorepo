/**
 * The Spanish body of the quickstart: from signing in to reading a first post, with the
 * queue shown as it looks once a few feeds are followed. It is the hub's first route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { QueueView, ReaderWindow } from "~/resources/components/marketing/reader-window";
import { H2Es, Kbd, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "sign-in", text: "Inicia sesión", level: 2 },
	{ id: "follow", text: "Sigue tu primer feed", level: 2 },
	{ id: "read", text: "Lee una entrada", level: 2 },
	{ id: "phone", text: "Lee en tu teléfono", level: 2 },
];

/** The quickstart's body. */
export default function GettingStarted(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					Reader reúne en una sola lista todas las entradas de todos los sitios que sigues, de la
					más reciente a la más antigua. Iniciar sesión es gratis, y el plan Gratis sigue hasta{" "}
					{figures.freeFeeds} feeds.
				</p>

				<H2Es id="sign-in">Inicia sesión</H2Es>
				<Steps>
					<Steps.Item title="Abre Reader y pulsa Iniciar sesión">
						<p>
							Pulsa <UiLabel>Iniciar sesión</UiLabel> en la parte superior de la página de inicio.
							Reader te identifica a través de <strong>auth.sergiodxa.com</strong>; la primera vez,
							sigue sus pasos para crear tu cuenta.
						</p>
					</Steps.Item>
					<Steps.Item title="Llega a Lectura">
						<p>
							Al iniciar sesión llegas a <UiLabel>Lectura</UiLabel>, tu cola. Está vacía hasta que
							sigas algo.
						</p>
					</Steps.Item>
				</Steps>

				<H2Es id="follow">Sigue tu primer feed</H2Es>
				<Steps>
					<Steps.Item title="Pega una dirección">
						<p>
							Pega la dirección de un sitio en <UiLabel>Sigue un feed o un sitio…</UiLabel>, en la
							parte superior de Lectura, y pulsa Enter. Sirve la dirección del propio feed, y
							también la de un sitio que anuncie uno, como la página de inicio de un blog.
						</p>
					</Steps.Item>
					<Steps.Item title="Recibe también sus entradas anteriores">
						<p>
							Cuando el feed publica su archivo, Reader también trae sus entradas anteriores: hasta{" "}
							{figures.historyPosts} de ellas de hasta {figures.historyPages} páginas de archivo,
							justo después de seguirlo.
						</p>
					</Steps.Item>
				</Steps>

				<Callout kind="tip" label="Consejo">
					<p>
						¿Vienes de otro lector? Importa todo de una vez desde un archivo OPML:{" "}
						<a href={docHref("import-opml")}>Importar desde otro lector</a>.
					</p>
				</Callout>

				<H2Es id="read">Lee una entrada</H2Es>
				<p>
					Tu cola muestra todas las entradas de la más reciente a la más antigua. Pulsa el título de
					una entrada para abrirla en el sitio de quien la publica, lo que además la marca como
					leída, o pulsa <UiLabel>Leer aquí</UiLabel> para leerla dentro de Reader. Con el teclado,{" "}
					<Kbd>j</Kbd> y <Kbd>k</Kbd> te mueven entre entradas y <Kbd>o</Kbd> abre una.
				</p>
				<Scene caption="La cola, en Sin leer, con las entradas de todos los feeds que sigues, de la más reciente a la más antigua.">
					<ReaderWindow
						t={t}
						title={t("nav.reading")}
						path="/reading"
						label="La cola de Reader con entradas de varios feeds"
					>
						<QueueView t={t} waiting={0} />
					</ReaderWindow>
				</Scene>
				<p>
					Para conservar una entrada para después, pulsa <UiLabel>Guardar</UiLabel> en ella; desde
					ese momento se queda en <UiPath items={["Guardadas"]} /> pase lo que pase con el feed.
				</p>

				<H2Es id="phone">Lee en tu teléfono</H2Es>
				<p>
					Reader es una aplicación web pensada también para teléfonos. Ábrela en el navegador de tu
					teléfono y añádela a tu pantalla de inicio. En un teléfono, desliza la fila de una entrada
					hacia un lado para marcarla como leída.
				</p>
			</>
		);
	};
}
