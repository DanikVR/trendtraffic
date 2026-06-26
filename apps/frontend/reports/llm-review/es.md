# LLM Review: Spanish (es)

**Model:** gemini-2.5-flash  
**Took:** 197.0s  
**Fixes proposed:** 212 (valid after placeholder-check: 209)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Alojamiento | **Salas** | 'Alojamiento' means lodging; 'Salas' is correct for meeting rooms. |
| `nav.enterpriseSettings` | Configuración empresarial | **Configuración Enterprise** | 'Enterprise' is a brand/tier name and should be preserved. |
| `nav.createRoom` | Crear una habitación | **Crear una sala** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `nav.billing` | aranceles | **Tarifas** | 'Aranceles' means tariffs/duties; 'Tarifas' is correct for pricing plans. |
| `nav.home` | Hogar | **Inicio** | 'Hogar' means home (residence); 'Inicio' is for a homepage. |
| `rooms.tabs.questFlow` | Flujo de búsqueda | **Quest Flow** | 'Quest Flow' is a brand name and should be preserved. |
| `rooms.empty` | No hay habitaciones disponibles. | **No hay salas disponibles.** | 'Habitaciones' means bedrooms; 'salas' is correct for meeting rooms. |
| `rooms.noRoomsInCategory` | Todavía no hay habitaciones en esta categoría. | **Todavía no hay salas en esta categoría.** | 'Habitaciones' means bedrooms; 'salas' is correct for meeting rooms. |
| `rooms.live` | Vivir | **Activa** | 'Vivir' is the verb 'to live'; 'Activa' is correct for a live room status. |
| `rooms.closed` | Cerrado | **Cerrada** | 'Cerrado' is masculine; 'Cerrada' agrees with 'sala' (feminine). |
| `rooms.actions.open` | Acceso | **Entrar** | 'Acceso' is a noun; 'Entrar' is the verb for joining a room. |
| `rooms.actions.chat` | Charlar | **Chat** | 'Charlar' is a verb; 'Chat' (noun) is better for a button label. |
| `rooms.actions.rename` | Rebautizar | **Renombrar** | 'Rebautizar' is less common; 'Renombrar' is the standard term for renaming. |
| `rooms.toasts.joined` | Alguien entró en la habitación "{{room}}" | **Alguien entró en la sala "{{room}}"** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `rooms.confirmDelete.title` | ¿Eliminar la habitación permanentemente? | **¿Eliminar la sala permanentemente?** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `common.save` | Ahorrar | **Guardar** | 'Ahorrar' means to save money/time; 'Guardar' means to save data/changes. |
| `common.close` | Cerca | **Cerrar** | 'Cerca' is an adverb; 'Cerrar' is the verb. |
| `common.open` | Abierto | **Abrir** | 'Abierto' is an adjective; 'Abrir' is the verb. |
| `balance.openPlans` | Tarifas abiertas y equilibrio | **Abrir tarifas y saldo** | Awkward phrasing; 'Abrir tarifas y saldo' is more natural. |
| `balance.tariffs` | aranceles | **Tarifas** | 'Aranceles' means tariffs/duties; 'Tarifas' is correct for pricing plans. |
| `tier.trial` | Ensayo | **Prueba** | 'Ensayo' can mean legal trial; 'Prueba' is correct for a free trial period. |
| `tier.plus` | Más | **Plus** | 'Plus' is a brand/tier name and should be preserved. |
| `tier.standard` | Estándar | **Standard** | 'Standard' is a brand/tier name and should be preserved. |
| `tier.standardYearly` | Anual | **Yearly** | 'Yearly' is a brand/tier name and should be preserved. |
| `languagePicker.searchPlaceholder` | Idioma de búsqueda... | **Buscar idioma...** | Incorrect word order; 'Buscar idioma' is correct. |
| `moreSheet.sip.sub` | Instalación de troncos | **Configuración de troncales** | 'Instalación' is for software; 'Configuración' is for settings. 'Troncales' is better for SIP. |
| `moreSheet.enterprise.label` | Configuración empresarial | **Configuración Enterprise** | 'Enterprise' is a brand/tier name and should be preserved. |
| `moreSheet.enterprise.sub` | Clave Gemini, Flujo de búsqueda, etiquetas, CRM | **Clave Gemini, Quest Flow, etiquetas, CRM** | 'Quest Flow' is a brand name and should be preserved. |
| `moreSheet.createRoomAria` | Crear una sala de traducción | **Crear sala de traducción** | More concise for a menu label. |
| `call.muted` | No hay sonido | **Silenciado** | 'No hay sonido' means no sound; 'Silenciado' is correct for a muted microphone. |
| `call.geminiLive` | Géminis en vivo | **Gemini Live** | 'Gemini Live' is a brand/feature name and should be preserved. |
| `call.toPlayground` | 🎯 Al vertedero | **🎯 Al campo de pruebas** | 'Vertedero' means landfill/dump; 'campo de pruebas' is correct for AI training. |
| `call.expandPeer` | Amplíe el interlocutor | **Expandir interlocutor** | 'Amplíe' is imperative; 'Expandir' is the infinitive for a button/action. |
| `call.more` | Además | **Más** | 'Además' means furthermore; 'Más' is correct for 'More' button. |
| `call.hangUp` | Fin de la llamada | **Finalizar llamada** | 'Fin de la llamada' is a noun phrase; 'Finalizar llamada' is a verb phrase for a button. |
| `call.validating` | Probando la conexión segura de VibeVox… | **Verificando la conexión segura de VibeVox…** | 'Probando' means testing; 'Verificando' is correct for validating. |
| `call.backToRooms` | Volver a la lista de habitaciones | **Volver a la lista de salas** | 'Habitaciones' means bedrooms; 'salas' is correct for meeting rooms. |
| `call.connecting` | Conectando con la habitación… | **Conectando con la sala…** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `call.translatorJoining` | Lanzamiento de un traductor de IA… | **Iniciando traductor de IA…** | 'Lanzamiento' is for product launch; 'Iniciando' is correct for a process. |
| `coach.close` | Cerca | **Cerrar** | 'Cerca' is an adverb; 'Cerrar' is the verb. |
| `roomActions.translation.enableSub` | El robot volverá a la habitación. | **El bot volverá a la sala.** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `roomActions.delete` | Eliminar habitación | **Eliminar sala** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `billing.quotaExhaustedSub` | El servicio de traducción automática ha sido suspendido. Por favor, compre minutos adicionales. | **El bot traductor ha sido suspendido. Por favor, compre minutos adicionales.** | 'Bot-traductor' is more concise than 'servicio de traducción automática'. |
| `billing.createRoomFailed` | No se pudo crear espacio | **No se pudo crear la sala** | 'Espacio' is too generic; 'sala' is correct for a meeting room. |
| `settings.themeDarkSub` | Aurora del Abismo (Oscura) | **Abyss Aurora (Dark)** | 'Abyss Aurora' is a brand name and should be preserved. |
| `settings.themeLightSub` | Aurora de nubes (luz) | **Cloud Aurora (Light)** | 'Cloud Aurora' is a brand name and should be preserved. |
| `partner.title` | Partner program | **Programa de socios** | English term, should be translated to Spanish. |
| `partner.subtitle` | Share your link and earn | **Comparte tu enlace y gana** | English term, should be translated to Spanish. |
| `partner.yourLink` | Your link | **Tu enlace** | English term, should be translated to Spanish. |
| `partner.copy` | Copy | **Copiar** | English term, should be translated to Spanish. |
| `partner.copied` | ✓ Link copied | **✓ Enlace copiado** | English term, should be translated to Spanish. |
| `partner.stats.clicks` | Clicks | **Clics** | English term, should be translated to Spanish. |
| `partner.stats.registrations` | Sign-ups | **Registros** | English term, should be translated to Spanish. |
| `partner.stats.paid` | Payments | **Pagos** | English term, should be translated to Spanish. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} usuarios · {{minutes}} min** | 'users' should be translated to 'usuarios'. |
| `partner.terms` | Program terms | **Términos del programa** | English term, should be translated to Spanish. |
| `partner.contact` | Contact us | **Contáctanos** | English term, should be translated to Spanish. |
| `partner.termsModalTitle` | Partner program terms | **Términos del programa de socios** | English term, should be translated to Spanish. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Los términos del programa aún no se han establecido. Póngase en contacto con el SuperAdmin.** | English term, should be translated to Spanish. |
| `partner.loadError` | Failed to load partner data | **No se pudieron cargar los datos del socio** | English term, should be translated to Spanish. |
| `sip.newTrunk` | Nuevo enlace troncal SIP | **Nueva troncal SIP** | 'Enlace troncal' is a bit literal; 'troncal SIP' is more common. |
| `sip.loginShort` | Acceso | **Login** | 'Acceso' is a noun; 'Login' (English) or 'Usuario' is more common for a login field. |
| `sip.trunkId` | Identificación del tronco | **ID del troncal** | 'Identificación del tronco' is less concise; 'ID del troncal' is better. |
| `sip.savingShort` | Ahorro… | **Guardando…** | 'Ahorro' is a noun; 'Guardando' is the verb for saving changes. |
| `sip.createTrunk` | Crear un tronco | **Crear una troncal** | 'Tronco' is less precise; 'troncal' is correct for SIP. |
| `sip.incoming.pausedHint` | Activa la recepción para que VibeVox comience a desviar las llamadas entrantes. | **Activa la recepción para que VibeVox comience a traducir las llamadas entrantes.** | 'Desviar' means to redirect; 'traducir' is correct for translation. |
| `sip.incoming.show` | Espectáculo | **Mostrar** | 'Espectáculo' means show/performance; 'Mostrar' is the verb. |
| `sip.incoming.hide` | Esconder | **Ocultar** | 'Esconder' is to hide something; 'Ocultar' is better for UI elements. |
| `sip.incoming.reissue` | Reedición | **Reemitir** | 'Reedición' is a noun; 'Reemitir' is the verb for reissuing. |
| `sip.outbound.lead` | Llama a un número de teléfono desde la interfaz web y VibeVox transferirá automáticamente tu conversación en tiempo real. | **Llama a un número de teléfono desde la interfaz web y VibeVox traducirá automáticamente tu conversación en tiempo real.** | 'Transferirá' is incorrect; 'traducirá' is correct for translation. |
| `sip.outbound.noTrunkTitle` | Primero, configure un enlace SIP saliente. | **Primero, configure una troncal SIP saliente.** | 'Enlace SIP' is less precise; 'troncal SIP' is more common. |
| `sip.outbound.noTrunkHint` | Rellene el formulario "Nuevo troncal SIP" que aparece en la parte superior de la página. VibeVox utilizará su proveedor de SIP (Zadarma, OnlinePBX, etc.) para las llamadas salientes. | **Rellene el formulario "Nueva troncal SIP" que aparece en la parte superior de la página. VibeVox utilizará su proveedor de SIP (Zadarma, OnlinePBX, etc.) para las llamadas salientes.** | 'Nuevo troncal SIP' should be 'Nueva troncal SIP' (feminine). |
| `sip.outbound.configureFirst` | Primero, configure una troncal SIP saliente (formulario anterior). | **Primero, configure una troncal SIP saliente (formulario de arriba).** | 'Formulario anterior' is ambiguous; 'formulario de arriba' is more direct. |
| `sip.howTo.step1` | Obtenga las credenciales del enlace SIP de su proveedor (Zadarma, OnlinePBX, Asterisk). | **Obtenga las credenciales de la troncal SIP de su proveedor (Zadarma, OnlinePBX, Asterisk).** | 'Enlace SIP' is less precise; 'troncal SIP' is more common. |
| `sip.howTo.step3` | VibeVox creará automáticamente un enlace SIP saliente en LiveKit Cloud. | **VibeVox creará automáticamente una troncal SIP saliente en LiveKit Cloud.** | 'Enlace SIP' is less precise; 'troncal SIP' is more common. |
| `sip.toasts.saveFailed` | No se pudo guardar el tronco | **No se pudo guardar la troncal** | 'Tronco' is less precise; 'troncal' is correct for SIP. |
| `sip.toasts.deleted` | El tronco ha sido eliminado. | **La troncal ha sido eliminada.** | 'Tronco' is less precise; 'troncal' is correct for SIP. |
| `sip.toasts.deleteFailed` | No se pudo eliminar el tronco | **No se pudo eliminar la troncal** | 'Tronco' is less precise; 'troncal' is correct for SIP. |
| `sip.validation.serverRequired` | Especificar servidor SIP | **Indique el servidor SIP** | 'Especificar' is formal; 'Indique' is more common for form fields. |
| `sip.tenantOnly.hint2` | Inicie sesión como un usuario normal que tenga su propio tenantId para crear un trunk. | **Inicie sesión como un usuario normal que tenga su propio tenantId para crear una troncal.** | 'Trunk' is English; 'troncal' is the Spanish term. |
| `sip.connected` | El enlace SIP se guarda y sincroniza con LiveKit. | **La troncal SIP se guarda y sincroniza con LiveKit.** | 'Enlace SIP' is less precise; 'troncal SIP' is more common. |
| `sip.danger.deleteTrunk` | Eliminar tronco | **Eliminar troncal** | 'Tronco' is less precise; 'troncal' is correct for SIP. |
| `sip.danger.deleteInboundHint` | Se eliminará la regla de despacho y de enlace entrante de LiveKit. Ya no se recibirán llamadas entrantes. | **Se eliminará la regla de despacho y la troncal entrante de LiveKit. Ya no se recibirán llamadas entrantes.** | 'Enlace entrante' is less precise; 'troncal entrante' is more common. |
| `sip.danger.reissueHint` | Vuelva a introducir el nombre de usuario y la contraseña para la dirección SIP. La información anterior ya no funcionará. | **Reemitirá el nombre de usuario y la contraseña para la dirección SIP. La información anterior ya no funcionará.** | 'Vuelva a introducir' means re-enter; 'Reemitirá' is correct for reissuing. |
| `sip.confirm.deleteTrunkBody` | Esta acción es irreversible. Una vez eliminada, las llamadas salientes se interrumpirán hasta que se cree una nueva línea troncal. | **Esta acción es irreversible. Una vez eliminada, las llamadas salientes se interrumpirán hasta que se cree una nueva troncal.** | 'Línea troncal' is fine, but 'troncal' is more concise. |
| `sip.confirm.deleteInboundBody` | Esta acción es irreversible. El enlace troncal entrante y la regla de despacho en LiveKit Cloud se eliminarán. | **Esta acción es irreversible. La troncal entrante y la regla de despacho en LiveKit Cloud se eliminarán.** | 'Enlace troncal' is less precise; 'troncal entrante' is more common. |
| `enterprise.page.title` | Configuración empresarial | **Configuración Enterprise** | 'Enterprise' is a brand/tier name and should be preserved. |
| `enterprise.page.upsellBody` | Aquí puedes configurar: una clave API personal de Gemini, una base de conocimientos y un sistema de mensajes, la integración con Quest Flow + bot de Telegram y la conexión con Chatwoot CRM. | **Aquí puedes configurar: una clave API personal de Gemini, un prompt y una base de conocimientos, la integración con Quest Flow + bot de Telegram y la conexión con Chatwoot CRM.** | 'Sistema de mensajes' is not 'prompt'. 'Prompt' can be kept or translated as 'indicación'. |
| `enterprise.tabs.prompts` | Consejos | **Prompts** | 'Consejos' means advice; 'Prompts' (English) or 'Indicaciones' is better for AI prompts. |
| `enterprise.tabs.questFlow` | Flujo de búsqueda | **Quest Flow** | 'Quest Flow' is a brand name and should be preserved. |
| `enterprise.common.save` | Ahorrar | **Guardar** | 'Ahorrar' means to save money/time; 'Guardar' means to save data/changes. |
| `enterprise.common.savedPlaceholder` | Guardado (introduzca "nuevo" para reemplazar) | **Guardado (introduzca uno nuevo para reemplazarlo)** | 'Introduzca "nuevo"' is literal; 'introduzca uno nuevo' is correct. |
| `enterprise.common.saving` | Ahorro… | **Guardando…** | 'Ahorro' is a noun; 'Guardando' is the verb for saving changes. |
| `enterprise.common.show` | Espectáculo | **Mostrar** | 'Espectáculo' means show/performance; 'Mostrar' is the verb. |
| `enterprise.common.hide` | Esconder | **Ocultar** | 'Esconder' is to hide something; 'Ocultar' is better for UI elements. |
| `enterprise.apiKey.show` | Espectáculo | **Mostrar** | 'Espectáculo' means show/performance; 'Mostrar' is the verb. |
| `enterprise.apiKey.hide` | Esconder | **Ocultar** | 'Esconder' is to hide something; 'Ocultar' is better for UI elements. |
| `enterprise.gemini.leadPrefix` | Llave personal de | **Clave personal de** | 'Llave' means physical key; 'Clave' is correct for API key. |
| `enterprise.gemini.aiStudioLink` | Estudio de IA | **AI Studio** | 'AI Studio' is a brand name and should be preserved. |
| `enterprise.gemini.savingLabel` | Ahorro… | **Guardando…** | 'Ahorro' is a noun; 'Guardando' is the verb for saving changes. |
| `enterprise.gemini.telegram.leadCreatePart2` | y pegar su token. | **e insertar su token.** | 'Pegar' is fine, but 'insertar' is also common and perhaps slightly more formal. |
| `enterprise.gemini.telegram.leadAllWhoStart` | Todos los que escriben a este bot | **Todos los que escriban a este bot** | 'Escriben' is indicative; 'escriban' (subjunctive) is correct for 'whoever writes'. |
| `enterprise.gemini.telegram.leadStartCmd` | /comenzar | **/start** | '/start' is a command and should be preserved. |
| `enterprise.gemini.telegram.leadAfterStart` | Recibirás notificaciones sobre nuevos clientes, etiquetas y errores de integración. Puedes suscribir a varios empleados o añadir el bot a un grupo o canal; todos recibirán la notificación automáticamente. | **Recibirán notificaciones sobre nuevos clientes, etiquetas y errores de integración. Puedes suscribir a varios empleados o añadir el bot a un grupo o canal; todos recibirán la notificación automáticamente.** | 'Recibirás' is singular; 'Recibirán' is plural to match 'Todos los que escriban'. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Bot @{{username}} guardado. Saludo entregado a los suscriptores de {{sent}}. | **✓ Bot @{{username}} guardado. Saludo entregado a {{sent}} suscriptores.** | Awkward phrasing; 'a {{sent}} suscriptores' is more natural. |
| `enterprise.gemini.telegram.successUnlinked` | El bot está desatado. | **El bot está desvinculado.** | 'Desatado' means unleashed; 'Desvinculado' is correct for unlinking. |
| `enterprise.gemini.telegram.saveLabel` | Ahorrar | **Guardar** | 'Ahorrar' means to save money/time; 'Guardar' means to save data/changes. |
| `enterprise.gemini.telegram.savingLabel` | Ahorro… | **Guardando…** | 'Ahorro' is a noun; 'Guardando' is the verb for saving changes. |
| `enterprise.gemini.telegram.testingLabel` | Casco… | **Enviando…** | 'Casco' means helmet; 'Enviando' is correct for sending. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Desatar | **Desvincular** | 'Desatar' means unleash; 'Desvincular' is correct for unlinking. |
| `enterprise.gemini.telegram.lastBroadcast` | Último envío: entregado {{sent}} desde {{total}} | **Último envío: entregado {{sent}} de {{total}}** | 'Desde' is incorrect; 'de' is correct for 'out of'. |
| `enterprise.prompt.heading` | Consejos | **Prompts** | 'Consejos' means advice; 'Prompts' (English) or 'Indicaciones' is better for AI prompts. |
| `enterprise.prompt.subtitle` | Base de conocimientos y sugerencias para la transcripción únicamente en salas de vídeo. | **Base de conocimientos y prompts para la transcripción únicamente en salas de vídeo.** | 'Sugerencias' means suggestions; 'prompts' (English) or 'indicaciones' is better. |
| `enterprise.prompt.promptLabel` | Mensaje del sistema (tono, estilo, vocabulario) | **Prompt del sistema (tono, estilo, vocabulario)** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.prompt.savePrompt` | Guardar mensaje | **Guardar prompt** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.prompt.hideDefault` | Esconder | **Ocultar** | 'Esconder' is to hide something; 'Ocultar' is better for UI elements. |
| `enterprise.prompt.defaultLabel` | Mensaje predeterminado de VibeVox | **Prompt predeterminado de VibeVox** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.prompt.headerLeadBold2` | "Según su solicitud" | **"Según su prompt"** | 'Solicitud' means request; 'prompt' (English) or 'indicación' is better. |
| `enterprise.prompt.contextLeadBold` | "Según su solicitud" | **"Según su prompt"** | 'Solicitud' means request; 'prompt' (English) or 'indicación' is better. |
| `enterprise.prompt.extendNoteText` | con sus propias reglas/estilo/terminología, se combinarán con la solicitud predeterminada anterior y la base de conocimientos. | **con sus propias reglas/estilo/terminología, se combinarán con el prompt predeterminado anterior y la base de conocimientos.** | 'Solicitud' means request; 'prompt' (English) or 'indicación' is better. |
| `enterprise.prompt.promptPlaceholder` | Tu mensaje... | **Tu prompt...** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.prompt.savingPromptLabel` | Ahorro… | **Guardando…** | 'Ahorro' is a noun; 'Guardando' is the verb for saving changes. |
| `enterprise.prompt.savePromptLabel` | Guardar mensaje | **Guardar prompt** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.prompt.successPromptSaved` | Mensaje guardado. | **Prompt guardado.** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.prompt.successFileUploaded` | Archivo "{{filename}}" ({{format}}) cargado - caracteres {{kbLength}} guardados. | **Archivo "{{filename}}" ({{format}}) cargado - se guardaron {{kbLength}} caracteres.** | Awkward phrasing; 'se guardaron {{kbLength}} caracteres' is more natural. |
| `enterprise.prompt.successKbCleared` | La base de conocimientos ha sido despejada. | **La base de conocimientos ha sido borrada.** | 'Despejada' means cleared (e.g., a path); 'borrada' is better for data. |
| `enterprise.prompt.errClearKb` | No se pudo completar | **No se pudo borrar** | 'Completar' is incorrect; 'borrar' is correct for clearing. |
| `enterprise.prompt.presetsLeadBold` | "Según su solicitud" | **"Según su prompt"** | 'Solicitud' means request; 'prompt' (English) or 'indicación' is better. |
| `enterprise.prompt.presetsLeadPart2` | Utiliza la sugerencia que proporcionaste en el campo anterior. | **Utiliza el prompt que proporcionaste en el campo anterior.** | 'Sugerencia' means suggestion; 'prompt' (English) or 'indicación' is better. |
| `enterprise.questFlow.heading` | Flujo de búsqueda | **Quest Flow** | 'Quest Flow' is a brand name and should be preserved. |
| `enterprise.questFlow.warning` | Si el campo está vacío, se utiliza el mensaje general de VibeVox. | **Si el campo está vacío, se utiliza el prompt general de VibeVox.** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.questFlow.promptLabel` | Sistema de flujo de búsqueda | **Prompt del sistema Quest Flow** | Literal translation; 'Prompt del sistema Quest Flow' is more accurate. |
| `enterprise.questFlow.keyLabelPlaceholder` | Etiqueta (opcional), por ejemplo: "Clínica de bots de producción" | **Etiqueta (opcional), por ejemplo: "Bot de producción de la clínica"** | Literal translation; 'Bot de producción de la clínica' is more natural. |
| `enterprise.questFlow.errDelete` | Delete error | **Error al eliminar** | English term, should be translated to Spanish. |
| `enterprise.questFlow.savedKeyConfirm` | Guardé la llave | **Guardé la clave** | 'Llave' means physical key; 'Clave' is correct for API key. |
| `enterprise.questFlow.deleteTitle` | Delete | **Eliminar** | English term, should be translated to Spanish. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **¿Eliminar clave?** | English term, should be translated to Spanish. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **La clave se eliminará permanentemente. Quest Flow dejará de funcionar con ella; deberá crear una nueva clave y reemplazarla en el flujo.** | English term, should be translated to Spanish. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Eliminar** | English term, should be translated to Spanish. |
| `enterprise.questFlow.promptHeading` | Mensaje para conversaciones de Telegram | **Prompt para conversaciones de Telegram** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.questFlow.promptLead2` | — se utiliza el mensaje general de VibeVox (abajo). | **— se utiliza el prompt general de VibeVox (abajo).** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.questFlow.promptLeadBold2` | Si rellenas tu | **Si rellenas el tuyo** | Incomplete phrase; 'el tuyo' is more natural. |
| `enterprise.questFlow.promptPlaceholder` | Tu mensaje... | **Tu prompt...** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.questFlow.savingPromptLabel` | Ahorro… | **Guardando…** | 'Ahorro' is a noun; 'Guardando' is the verb for saving changes. |
| `enterprise.questFlow.savePromptLabel` | Ahorrar | **Guardar** | 'Ahorrar' means to save money/time; 'Guardar' means to save data/changes. |
| `enterprise.questFlow.successPromptSaved` | Mensaje de Quest Flow guardado. | **Prompt de Quest Flow guardado.** | 'Mensaje' is okay, but 'Prompt' (English) or 'Indicación' is more precise. |
| `enterprise.questFlow.kbLeadBold2` | separado | **separada** | 'Separado' is masculine; 'separada' agrees with 'base' (feminine). |
| `enterprise.questFlow.kbLead3` | De la sección "Sugerencias" para la transcripción de vídeo. Límite: archivo de 50 MB / 500 000 caracteres en la base de datos. | **De la sección "Prompts" para la transcripción de vídeo. Límite: archivo de 50 MB / 500 000 caracteres en la base de datos.** | 'Sugerencias' means suggestions; 'prompts' (English) or 'indicaciones' is better. |
| `enterprise.questFlow.successKbCleared` | La base de conocimientos ha sido despejada. | **La base de conocimientos ha sido borrada.** | 'Despejada' means cleared (e.g., a path); 'borrada' is better for data. |
| `enterprise.questFlow.tagsLead` | La IA asigna estas etiquetas a los clientes si detecta una coincidencia en la conversación. Las etiquetas se muestran en la ficha de la habitación del cliente y se transmiten al CRM (Sección 4). | **La IA asigna estas etiquetas a los clientes si detecta una coincidencia en la conversación. Las etiquetas se muestran en la ficha de la sala del cliente y se transmiten al CRM (Sección 4).** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `enterprise.chatwoot.save` | Ahorrar | **Guardar** | 'Ahorrar' means to save money/time; 'Guardar' means to save data/changes. |
| `enterprise.chatwoot.statusActive` | Activo | **Activa** | 'Activo' is masculine; 'Activa' agrees with 'conexión' (feminine). |
| `enterprise.chatwoot.statusDisabled` | Apagado | **Apagada** | 'Apagado' is masculine; 'Apagada' agrees with 'conexión' (feminine). |
| `enterprise.chatwoot.savingLabel` | Ahorro… | **Guardando…** | 'Ahorro' is a noun; 'Guardando' is the verb for saving changes. |
| `enterprise.chatwoot.saveLabel` | Ahorrar | **Guardar** | 'Ahorrar' means to save money/time; 'Guardar' means to save data/changes. |
| `enterprise.chatwoot.whatSentFooter` | Se envía al hacer clic manualmente en "Enviar a CRM" en el chat de la sala. El envío automático al detectar la etiqueta es la siguiente función. | **Se envía al hacer clic manualmente en "Enviar a CRM" en el chat de la sala. El envío automático al detectar las etiquetas es la siguiente función.** | 'La etiqueta' should be 'las etiquetas' (plural) to match 'detección de etiquetas'. |
| `chat.openWithClient` | Inicia un chat con el cliente. | **Abrir chat con el cliente** | 'Inicia' is imperative; 'Abrir' is better for a button label. |
| `chat.backToRooms` | ← Volver a las habitaciones | **← Volver a las salas** | 'Habitaciones' means bedrooms; 'salas' is correct for meeting rooms. |
| `chat.telegramBadge` | Telegrama | **Telegram** | 'Telegram' is a brand name and should be preserved. |
| `insights.recalc` | Recuento | **Recalcular** | 'Recuento' is a noun; 'Recalcular' is the verb. |
| `insights.summary` | Reanudar | **Resumen** | 'Reanudar' means to resume; 'Resumen' is correct for summary. |
| `insights.sentiment` | Llave | **Tonalidad** | 'Llave' means key; 'Tonalidad' or 'Sentimiento' is correct for sentiment. |
| `insights.leadScore` | Puntuación de plomo | **Lead Score** | 'Puntuación de plomo' is a literal translation; 'Lead Score' can be preserved or 'Puntuación de clientes potenciales'. |
| `lobby.privacy` | política de privacidad | **Política de privacidad** | Should be capitalized as it's a proper noun phrase. |
| `lobby.audioConsent` | y también dan su consentimiento para el procesamiento del audio con fines de traducción. | **y también das tu consentimiento para el procesamiento del audio con fines de traducción.** | Grammar: 'dan' (plural) should be 'das' (singular) to match 'Al unirte, aceptas'. |
| `paywall.subtitle` | Elige un plan o compra más minutos; paga a través de Stripe y recibe el reembolso inmediatamente aquí. | **Elige un plan o compra más minutos; paga a través de Stripe y los minutos se añadirán inmediatamente aquí.** | 'Reembolso' is incorrect; minutes are added, not refunded. |
| `paywall.buyPlus` | Además — 19 €/mes (60 min) | **Plus — 19 €/mes (60 min)** | 'Plus' is a brand/tier name and should be preserved. |
| `paywall.buyStandard` | Estándar – 29 €/mes (120 min) | **Standard – 29 €/mes (120 min)** | 'Standard' is a brand/tier name and should be preserved. |
| `paywall.subscribe` | Diseño | **Suscribirse** | 'Diseño' means design; 'Suscribirse' or 'Contratar' is correct for subscribing. |
| `paywall.featureMinutes` | Traducción mínima de {{count}} | **{{count}} min de traducción** | Incorrect phrasing; '{{count}} min de traducción' is correct. |
| `paywall.topupNoSubInfo` | ℹ No tienes una suscripción activa. Plus se añadirá a tu compra por 19 €/mes; 60 minutos están incluidos en tu plan, por lo que no hay ningún cargo adicional. | **ℹ No tienes una suscripción activa. El plan Plus se añadirá a tu compra por 19 €/mes; 60 minutos están incluidos en tu plan, por lo que no hay ningún cargo adicional.** | 'Plus' is a brand/tier name and should be preserved, with 'El plan' for clarity. |
| `paywall.topupPlusLine` | Más tarifa ({{count}} min incluido) | **Tarifa Plus ({{count}} min incluido)** | 'Más tarifa' is incorrect; 'Tarifa Plus' is correct. |
| `paywall.close` | Cerca | **Cerrar** | 'Cerca' is an adverb; 'Cerrar' is the verb. |
| `confirmModal.ok` | DE ACUERDO | **OK** | 'DE ACUERDO' is too formal; 'OK' or 'Aceptar' is more common. |
| `defaultRoom.namePattern` | Habitación {{name}} · {{date}}, {{time}} | **Sala {{name}} · {{date}}, {{time}}** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `postCallInsights.subtitle` | Empresa · información posterior a la llamada | **Enterprise · información posterior a la llamada** | 'Enterprise' is a brand/tier name and should be preserved. |
| `postCallInsights.analyzing` | Analicemos la conversación... | **Analizando la conversación...** | 'Analicemos' is imperative; 'Analizando' is correct for a continuous action. |
| `postCallInsights.metricSentiment` | Ánimo | **Sentimiento** | 'Ánimo' means mood/spirit; 'Sentimiento' or 'Tonalidad' is correct for sentiment. |
| `postCallInsights.metricLeadScore` | Puntuación de plomo | **Lead Score** | 'Puntuación de plomo' is a literal translation; 'Lead Score' can be preserved or 'Puntuación de clientes potenciales'. |
| `postCallInsights.summary` | Reanudar | **Resumen** | 'Reanudar' means to resume; 'Resumen' is correct for summary. |
| `postCallInsights.close` | Cerrar y regresar a las habitaciones. | **Cerrar y regresar a las salas.** | 'Habitaciones' means bedrooms; 'salas' is correct for meeting rooms. |
| `billingPage.title` | Aranceles y pago | **Tarifas y pago** | 'Aranceles' means tariffs/duties; 'Tarifas' is correct for pricing plans. |
| `billingPage.tierLabel` | Tasa | **Tarifa** | 'Tasa' means rate/tax; 'Tarifa' is correct for pricing plans. |
| `billingPage.topupCarried` | Aplazado | **Transferido** | 'Aplazado' means postponed; 'Transferido' or 'Acumulado' is better for carried over minutes. |
| `billingPage.tierPlusName` | Más | **Plus** | 'Plus' is a brand/tier name and should be preserved. |
| `billingPage.tierStandardName` | Estándar | **Standard** | 'Standard' is a brand/tier name and should be preserved. |
| `billingPage.featureLearnHub` | Centro de aprendizaje de IA: sus propios dialectos | **AI Learning Hub — sus propios dialectos** | 'AI Learning Hub' is a brand name and should be preserved. |
| `billingPage.featureBranding` | Imagen de la habitación (logotipo, colores) | **Imagen de la sala (logotipo, colores)** | 'Habitación' means bedroom; 'sala' is correct for a meeting room. |
| `billingPage.featurePersonalPrompts` | Mensajes personalizados de IA | **Prompts personalizados de IA** | 'Mensajes' is okay, but 'Prompts' (English) or 'Indicaciones' is more precise. |
| `billingPage.ctaSubscribePlus` | Obtén Plus | **Suscribirse a Plus** | 'Obtén' is imperative; 'Suscribirse a Plus' is better for a call to action. |
| `billingPage.ctaSubscribeStandard` | Estándar de pedido | **Suscribirse a Standard** | Awkward phrasing; 'Suscribirse a Standard' is better for a call to action. |
| `billingPage.ctaContact` | Contacto | **Contactar** | 'Contacto' is a noun; 'Contactar' or 'Contáctanos' is better for a button. |
| `billingPage.languagesCount_one` | Idioma {{count}} | **{{count}} idioma** | Incorrect phrasing; '{{count}} idioma' is correct. |
| `billingPage.languagesCount_few` | Idioma {{count}} | **{{count}} idiomas** | Incorrect phrasing; '{{count}} idiomas' is correct. |
| `billingPage.faqA3` | Plataforma completa de IA: fichas de clientes con reconocimiento automático, autorización por Telegram, avisos personalizados, Google Calendar, etiquetado inteligente de necesidades, exportación a CRM, integración con questflow.pro y una pestaña de administración independiente. | **Plataforma completa de IA: fichas de clientes con reconocimiento automático, autorización por Telegram, prompts personalizados, Google Calendar, etiquetado inteligente de necesidades, exportación a CRM, integración con questflow.pro y una pestaña de administración independiente.** | 'Avisos' means notices/warnings; 'prompts' (English) or 'indicaciones' is better. |
| `billingPage.faqA4` | Cualquier sistema compatible con RFC: Zadarma, OnlinePBX, Asterisk/FreePBX, etc. VibeVox crea automáticamente un enlace troncal de salida. | **Cualquier sistema compatible con RFC: Zadarma, OnlinePBX, Asterisk/FreePBX, etc. VibeVox crea automáticamente una troncal de salida.** | 'Enlace troncal' is less precise; 'troncal de salida' is more common. |
| `billingPage.cancelDetailMinutesAvailable` | Los minutos con tarifa reducida están disponibles hasta esta fecha; se pueden comprar minutos adicionales. | **Los minutos del plan están disponibles hasta esta fecha; se pueden comprar minutos adicionales.** | 'Tarifa reducida' is incorrect; 'minutos del plan' is correct. |
| `billingPage.renewsOn` | extensión {{date}} | **renovación {{date}}** | 'Extensión' means extension; 'renovación' is correct for subscription renewal. |
| `billingPage.searchResultsCount_one` | Encontrado: idioma {{count}} | **Encontrado: {{count}} idioma** | Incorrect phrasing; '{{count}} idioma' is correct. |
| `auth.login.submit` | Acceso | **Iniciar sesión** | 'Acceso' is a noun; 'Iniciar sesión' is better for a button. |
| `auth.login.registerLink` | Registro | **Registrarse** | 'Registro' is a noun; 'Registrarse' is better for a link. |
| `auth.register.submit` | Registro | **Registrarse** | 'Registro' is a noun; 'Registrarse' is better for a button. |
| `auth.register.loginLink` | Acceso | **Iniciar sesión** | 'Acceso' is a noun; 'Iniciar sesión' is better for a link. |
| `auth.register.agreementPrivacy` | política de privacidad | **Política de privacidad** | Should be capitalized as it's a proper noun phrase. |
| `auth.forgot.successTitle` | La carta ha sido enviada | **El correo ha sido enviado** | 'Carta' means letter; 'correo' or 'email' is better for email. |
| `auth.forgot.successHint` | Revisa tu correo electrónico para ver si encuentras el mensaje {{email}}. Si no lo encuentras, revisa tu carpeta de correo no deseado. | **Revisa tu correo electrónico para ver si encuentras el correo {{email}}. Si no lo encuentras, revisa tu carpeta de correo no deseado.** | 'Mensaje' is fine, but 'correo' or 'email' is more direct. |
| `pwaInstall.buttonLabel` | Instala la aplicación | **Instalar aplicación** | 'Instala' is imperative; 'Instalar aplicación' (infinitive) is better for a button. |
| `pwaInstall.buttonSubtitle` | Ve a la pantalla de inicio: inicia con un solo toque. | **A la pantalla de inicio: inicio con un solo toque.** | 'Ve' is imperative; 'A la pantalla de inicio' is more descriptive. |
| `pwaInstall.buttonAria` | Instala VibeVox como una aplicación. | **Instalar VibeVox como aplicación** | 'Instala' is imperative; 'Instalar VibeVox como aplicación' is better. |

⚠ 3 fix(es) skipped (no-op, missing path, or would break placeholders).
