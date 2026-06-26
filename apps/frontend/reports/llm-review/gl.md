# LLM Review: Galician (gl)

**Model:** gemini-2.5-flash  
**Took:** 185.7s  
**Fixes proposed:** 115 (valid after placeholder-check: 91)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Habitacións | **Salas** | Use 'Salas' for meeting rooms, not 'Habitacións'. |
| `nav.enterpriseSettings` | Configuración da empresa | **Configuración Enterprise** | Preserve 'Enterprise' as a tier name. |
| `tier.enterprise` | Empresa | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `nav.createRoom` | Crear unha habitación | **Crear unha sala** | Use 'sala' for meeting rooms, not 'habitación'. |
| `rooms.tabs.questFlow` | Fluxo de misións | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `rooms.noRoomsInCategory` | Aínda non hai habitacións nesta categoría. | **Aínda non hai salas nesta categoría.** | Use 'salas' for meeting rooms, not 'habitacións'. |
| `rooms.actions.open` | Inicio de sesión | **Entrar** | In this context, 'Войти' means 'join' a room, not 'log in'. |
| `rooms.toasts.joined` | Alguén entrou na habitación "{{room}}" | **Alguén entrou na sala "{{room}}"** | Use 'sala' for meeting rooms, not 'habitación'. |
| `common.select` | Escolle | **Seleccionar** | Use infinitive 'Seleccionar' for a neutral button label. |
| `common.edit` | Cambio | **Editar** | Use verb 'Editar' instead of noun 'Cambio'. |
| `balance.label` | Equilibrio | **Saldo** | Use 'Saldo' for financial balance, not 'Equilibrio'. |
| `balance.openPlans` | Tarifas abertas e saldo | **Abrir tarifas e saldo** | Use verb 'Abrir' instead of adjective 'abertas'. |
| `tier.plus` | Máis | **Plus** | Preserve 'Plus' as a tier name. |
| `tier.standard` | Estándar | **Standard** | Preserve 'Standard' as a tier name. |
| `tier.standardYearly` | Anual | **Yearly** | Preserve 'Yearly' as a tier name. |
| `languagePicker.searchPlaceholder` | Buscando idioma... | **Buscar idioma...** | Use infinitive 'Buscar' for a placeholder, not present participle. |
| `moreSheet.enterprise.label` | Configuración da empresa | **Configuración Enterprise** | Preserve 'Enterprise' as a tier name. |
| `moreSheet.enterprise.sub` | Chave Gemini, fluxo de buscas, etiquetas, CRM | **Chave Gemini, Quest Flow, etiquetas, CRM** | Preserve 'Quest Flow' as a brand name. |
| `call.geminiLive` | Xemelgos en directo | **Gemini Live** | Preserve 'Gemini' as a brand name. |
| `call.toPlayground` | 🎯 Ao vertedoiro | **🎯 Ao campo de adestramento** | 'Полигон' means 'training ground', not 'landfill' ('vertedoiro'). |
| `call.more` | Ademais | **Máis** | Use 'Máis' for a 'More' button, not 'Ademais'. |
| `call.validating` | Probando a conexión segura de VibeVox… | **Verificando a conexión segura de VibeVox…** | 'Проверка' means 'verification' or 'validation', not 'testing'. |
| `call.backToRooms` | Volver á lista de habitacións | **Volver á lista de salas** | Use 'salas' for meeting rooms, not 'habitacións'. |
| `sip.incoming.pausedHint` | Activa a recepción para que VibeVox comece a desviar as chamadas entrantes. | **Activa a recepción para que VibeVox comece a traducir as chamadas entrantes.** | 'Переводить' means 'translate', not 'redirect' ('desviar'). |
| `sip.incoming.reissue` | Reedición | **Reemitir** | Use verb 'Reemitir' instead of noun 'Reedición'. |
| `sip.outbound.lead` | Chama a un número de teléfono desde a interface web e VibeVox transferirá automaticamente a túa conversa en tempo real. | **Chama a un número de teléfono desde a interface web e VibeVox traducirá automaticamente a túa conversa en tempo real.** | 'Переведёт' means 'translate', not 'transferirá'. |
| `sip.confirm.deleteInboundTitle` | Eliminar o enderezo SIP para a mensaxe entrante? | **Eliminar o enderezo SIP para as chamadas entrantes?** | Context is 'incoming calls', not 'incoming message'. |
| `enterprise.page.title` | Configuración da empresa | **Configuración Enterprise** | Preserve 'Enterprise' as a tier name. |
| `enterprise.tabs.gemini` | API de Xemelgos | **Gemini API** | Preserve 'Gemini' as a brand name. |
| `enterprise.tabs.questFlow` | Fluxo de misións | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.tabs.chatwoot` | CRM (ChatWoot) | **CRM (Chatwoot)** | Preserve 'Chatwoot' brand name with correct casing. |
| `enterprise.gemini.aiStudioLink` | Estudio de IA | **AI Studio** | Preserve 'AI Studio' as a brand name. |
| `enterprise.gemini.telegram.leadStartCmd` | /inicio | **/start** | Preserve '/start' as an exact command. |
| `enterprise.gemini.telegram.testingLabel` | Casco… | **Enviando…** | 'Шлём' means 'sending', not 'helmet' ('casco'). |
| `enterprise.prompt.promptPlaceholder` | O teu baile de graduación... | **A túa solicitude...** | 'Промпт' (prompt) should be translated as 'solicitude', not 'baile de graduación' (prom). |
| `enterprise.prompt.savePromptLabel` | Gardar o aviso | **Gardar a solicitude** | 'Промпт' (prompt) should be translated as 'solicitude', not 'aviso' (warning). |
| `enterprise.prompt.presetsLeadPart1` | No chat da Sala Empresarial, podes destacar calquera mensaxe e pedirlle á IA que a explique no ton escollido. Botón | **No chat da sala Enterprise, podes destacar calquera mensaxe e pedirlle á IA que a explique no ton escollido. Botón** | Preserve 'Enterprise' as a tier name. |
| `enterprise.prompt.presetsLeadPart2` | usa a túa indicación do campo de arriba. | **usa a túa solicitude do campo de arriba.** | Consistent translation for 'промпт' (prompt). |
| `enterprise.questFlow.heading` | Fluxo de misións | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.promptLabel` | Solicitude do sistema de fluxo de misións | **Solicitude do sistema Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.savePrompt` | Gardar o aviso | **Gardar a solicitude** | 'Промпт' (prompt) should be translated as 'solicitude', not 'aviso' (warning). |
| `enterprise.questFlow.errDelete` | Delete error | **Erro ao eliminar** | Translate English phrase. |
| `enterprise.questFlow.deleteTitle` | Delete | **Eliminar** | Translate English word. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Eliminar clave?** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **A clave eliminarase permanentemente. Quest Flow deixará de funcionar a través dela; terás que crear unha nova clave e substituíla no fluxo.** | Translate English phrase and preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Eliminar** | Translate English word. |
| `enterprise.questFlow.promptLead3` | — combinarase coa introdución básica e a base de coñecementos. | **— combinarase coa solicitude básica e a base de coñecementos.** | Consistent translation for 'промпт' (prompt). |
| `enterprise.questFlow.promptPlaceholder` | O teu baile de graduación... | **A túa solicitude...** | 'Промпт' (prompt) should be translated as 'solicitude', not 'baile de graduación' (prom). |
| `enterprise.questFlow.successPromptSaved` | Gardouse a solicitude de fluxo de misións. | **Gardouse a solicitude de Quest Flow.** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.kbHeading` | Base de coñecementos para o fluxo de misións | **Base de coñecementos para Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.chatwoot.heading` | Integración con CRM (Chatwout) | **Integración con CRM (Chatwoot)** | Preserve 'Chatwoot' brand name with correct casing. |
| `enterprise.chatwoot.accountIdLabel` | ID da conta (id_da_conta) | **ID da conta (account_id)** | Preserve 'account_id' as a technical term. |
| `enterprise.chatwoot.headingShort` | CRM (ChatWoot) | **CRM (Chatwoot)** | Preserve 'Chatwoot' brand name with correct casing. |
| `enterprise.chatwoot.tokenFieldLabel` | Token de acceso do axente (desde Perfil → Token de acceso) | **Agent Access Token (desde Profile → Access Token)** | Preserve 'Agent Access Token' and 'Access Token' as technical terms. |
| `enterprise.chatwoot.tokenPlaceholder` | Token de acceso do axente | **Agent access token** | Preserve 'Agent access token' as a technical term. |
| `enterprise.chatwoot.whatSentItem2` | Conversa cunha nota privada = historial completo do diálogo | **Conversation cunha nota privada = historial completo do diálogo** | Preserve 'Conversation' as a technical term. |
| `enterprise.chatwoot.whatSentItem3Code` | atributos_personalizados.etiquetas_vibevox | **custom_attributes.vibevox_tags** | Preserve 'custom_attributes.vibevox_tags' as a technical term. |
| `chat.backToRooms` | ← Volver ás habitacións | **← Volver ás salas** | Use 'salas' for meeting rooms, not 'habitacións'. |
| `chat.enterpriseOnlyHint` | As salas de chat son unha funcionalidade para empresas. Actualiza o teu plan na sección "Prezos". | **As salas de chat son unha funcionalidade Enterprise. Actualiza o teu plan na sección "Prezos".** | Preserve 'Enterprise' as a tier name. |
| `chat.telegramBadge` | Telegrama | **Telegram** | Preserve 'Telegram' as a brand name. |
| `insights.recalc` | Recontaxe | **Recalcular** | Use verb 'Recalcular' instead of noun 'Recontaxe'. |
| `insights.summary` | Currículo | **Resumo** | Use 'Resumo' for a summary, not 'Currículo' (CV). |
| `insights.sentiment` | Clave | **Tonalidade** | Use 'Tonalidade' for sentiment/tone, not 'Clave' (key). |
| `insights.leadScore` | Puntuación de clientes potenciais | **Lead Score** | Preserve 'Lead Score' as a technical term. |
| `defaultRoom.namePattern` | Habitación {{name}} · {{date}}, {{time}} | **Sala {{name}} · {{date}}, {{time}}** | Use 'Sala' for meeting rooms, not 'Habitación'. |
| `postCallInsights.subtitle` | Empresa · información posterior á chamada | **Enterprise · información posterior á chamada** | Preserve 'Enterprise' as a tier name. |
| `postCallInsights.metricSentiment` | Estado de ánimo | **Tonalidade** | Consistent with 'insights.sentiment' for 'Настроение'. |
| `postCallInsights.metricLeadScore` | Puntuación de clientes potenciais | **Lead Score** | Preserve 'Lead Score' as a technical term. |
| `postCallInsights.summary` | Currículo | **Resumo** | Use 'Resumo' for a summary, not 'Currículo' (CV). |
| `postCallInsights.close` | Pechar e volver ás habitacións | **Pechar e volver ás salas** | Use 'salas' for meeting rooms, not 'habitacións'. |
| `paywall.buyPlus` | Máis — 19 €/mes (60 min) | **Plus — 19 €/mes (60 min)** | Preserve 'Plus' as a tier name. |
| `paywall.buyStandard` | Estándar – 29 €/mes (120 min) | **Standard – 29 €/mes (120 min)** | Preserve 'Standard' as a tier name. |
| `paywall.popular` | Populares | **Popular** | Use singular 'Popular' for a single label. |
| `paywall.subscribe` | Deseño | **Subscribirse** | Use verb 'Subscribirse' for 'Оформить' (subscribe/sign up). |
| `paywall.featureMinutes` | tradución mínima de {{count}} | **{{count}} minutos de tradución** | 'Min' refers to 'minutes', not 'minimal'. |
| `paywall.topupCta` | Comprar {{count}} mínimo · €{{price}} | **Comprar {{count}} min · €{{price}}** | 'Min' refers to 'minutes', not 'minimal'. |
| `paywall.topupPlusLine` | Tarifa Máis ({{count}} mínimo incluído) | **Tarifa Plus ({{count}} min incluído)** | Preserve 'Plus' as a tier name and use 'min' for minutes. |
| `billingPage.resume` | Currículo | **Retomar** | Use 'Retomar' for 'resume' (an action), not 'Currículo' (CV). |
| `billingPage.tierPlusName` | Máis | **Plus** | Preserve 'Plus' as a tier name. |
| `billingPage.tierStandardName` | Estándar | **Standard** | Preserve 'Standard' as a tier name. |
| `billingPage.tierEnterpriseName` | Empresa | **Enterprise** | Preserve 'Enterprise' as a tier name. |
| `billingPage.featureHd` | Voces de tradución en HD (Aoede, Caronte, Kore) | **Voces de tradución en HD (Aoede, Charon, Kore)** | Preserve 'Charon' as a brand name. |
| `billingPage.featureLearnHub` | Centro de aprendizaxe de IA: os seus seus dialectos | **AI Learning Hub — os seus propios dialectos** | Preserve 'AI Learning Hub' as a product name and fix grammatical error 'seus seus'. |
| `billingPage.ctaSubscribePlus` | Obter Plus | **Contratar Plus** | Use 'Contratar' (subscribe/contract) for 'Оформить'. |
| `billingPage.ctaSubscribeStandard` | Estándar de pedido | **Contratar Standard** | Use 'Contratar' for 'Оформить' and preserve 'Standard' as a tier name. |
| `billingPage.languagesCount_one` | Linguaxe {{count}} | **{{count}} lingua** | Correct gender and number agreement for 'lingua'. |
| `billingPage.languagesCount_few` | Linguaxe {{count}} | **{{count}} linguas** | Correct gender and number agreement for 'linguas'. |
| `billingPage.renewsOn` | extensión {{date}} | **renovación {{date}}** | Use 'renovación' for 'renewal', not 'extensión'. |
| `billingPage.searchResultsCount_one` | Atopouse: idioma {{count}} | **Atopouse: {{count}} lingua** | Correct gender and number agreement for 'lingua'. |
| `auth.login.registerLink` | Rexistro | **Rexistrarse** | Use verb 'Rexistrarse' for 'Зарегистрироваться'. |
| `auth.register.submit` | Rexistro | **Rexistrarse** | Use verb 'Rexistrarse' for 'Зарегистрироваться'. |

⚠ 24 fix(es) skipped (no-op, missing path, or would break placeholders).
