/**
 * The Spanish body of the agents guide: minting a Model Context Protocol token and choosing
 * its scope, configuring a client, what the tools can do, and the caps on tokens and calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { AgentsScene } from "~/resources/components/marketing/scenes";
import { Faq, H2Es, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "what", text: "Qué puede hacer un asistente", level: 2 },
	{ id: "connect", text: "Conecta uno", level: 2 },
	{ id: "revoke", text: "Revoca un token", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The agents guide's body. */
export default function Agents(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2Es id="what">Qué puede hacer un asistente</H2Es>
				<p>
					Reader responde al Model Context Protocol (MCP), así que un asistente puede leer tus feeds
					sin que abras Reader. Con {figures.toolCount} herramientas puede listar lo que sigues,
					leer tu cola y buscar en ella y, con un token de escritura, marcar entradas como leídas,
					guardarlas y seguir o dejar de seguir un feed.
				</p>
				<Scene caption="Un asistente al que le preguntan qué hay de nuevo, respondiendo desde tu cola.">
					<AgentsScene t={t} />
				</Scene>

				<H2Es id="connect">Conecta uno</H2Es>
				<Steps>
					<Steps.Item title="Emite un token">
						<p>
							En <UiPath items={["Preferencias", "Agentes"]} />, rellena{" "}
							<UiLabel>¿Para qué es?</UiLabel> para reconocer el token más adelante, y elige{" "}
							<UiLabel>Qué puede hacer</UiLabel>: <UiLabel>Solo lectura</UiLabel> o{" "}
							<UiLabel>Lectura y escritura</UiLabel>. Pulsa <UiLabel>Emitir un token</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Cópialo ahora">
						<p>
							El token se muestra una sola vez. Cópialo antes de salir de la página; si lo pierdes,
							emite otro.
						</p>
					</Steps.Item>
					<Steps.Item title="Configura tu cliente">
						<p>
							Dale al cliente de tu asistente la dirección que muestran las Preferencias, que
							termina en <code>/mcp</code>, y el token como bearer token.
						</p>
					</Steps.Item>
					<Steps.Item title="Pregunta">
						<p>Pregúntale a tu asistente qué hay de nuevo. Lee tu cola en lugar de un navegador.</p>
					</Steps.Item>
				</Steps>
				<Callout kind="tip" label="Consejo">
					<p>
						Elige Solo lectura salvo que el asistente necesite actuar. Un token de lectura nunca
						puede marcar, guardar, seguir ni dejar de seguir nada.
					</p>
				</Callout>

				<H2Es id="revoke">Revoca un token</H2Es>
				<p>
					Las Preferencias listan cada token con la última vez que se usó y cuándo caduca. Pulsa{" "}
					<UiLabel>Revocar</UiLabel> y deja de responder desde la siguiente llamada.
				</p>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Qué clientes funcionan?",
							answer: (
								<p>
									Cualquier cliente que te deje poner un bearer token en su configuración. Un
									cliente que solo puede iniciar sesión mediante un flujo de autorización no tiene
									aquí contra qué iniciarla.
								</p>
							),
						},
						{
							question: "¿Hay algún límite?",
							answer: (
								<p>
									Puedes tener {figures.tokenLimit} tokens. Cada uno dura {figures.tokenDays} días y
									tiene {figures.agentCalls} llamadas al día, y lo avisa cuando se agotan.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
