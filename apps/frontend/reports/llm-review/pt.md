# LLM Review: Portuguese (pt)

**Model:** gemini-2.5-flash  
**Took:** 206.7s  
**Fixes proposed:** 197 (valid after placeholder-check: 192)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | Quartos | **Salas** | Use 'Salas' for virtual meeting rooms, 'Quartos' is for house rooms. |
| `nav.enterpriseSettings` | Configurações empresariais | **Configurações Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `nav.createRoom` | Crie um quarto | **Criar sala** | Use infinitive for button label and 'sala' for room consistency. |
| `nav.home` | Lar | **Início** | Use 'Início' for UI home page, 'Lar' means dwelling. |
| `rooms.tabs.questFlow` | Fluxo de Missão | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `rooms.noRoomsInCategory` | Ainda não há quartos disponíveis nesta categoria. | **Ainda não há salas disponíveis nesta categoria.** | Use 'salas' for room consistency. |
| `rooms.actions.open` | Conecte-se | **Entrar** | Use 'Entrar' for joining a room, 'Conecte-se' means 'connect yourself'. |
| `rooms.actions.chat` | Bater papo | **Chat** | Use 'Chat' for brevity and common UI terminology. |
| `common.select` | Escolher | **Selecionar** | More formal and common for UI 'select'. |
| `common.edit` | Mudar | **Editar** | Use 'Editar' for 'edit' functionality. |
| `common.tryAgain` | Repita | **Tentar novamente** | Use infinitive for button label and more natural phrasing. |
| `common.success` | Preparar | **Concluído** | Use 'Concluído' for 'Done/Success', 'Preparar' means 'prepare'. |
| `balance.label` | Equilíbrio | **Saldo** | Use 'Saldo' for financial balance, 'Equilíbrio' is general balance. |
| `balance.openPlans` | Tarifas abertas e saldo | **Abrir tarifas e saldo** | Use infinitive for action. |
| `tier.trial` | Julgamento | **Teste** | Wrong word sense: 'Trial' in subscription context means 'free trial period', not 'court trial'. |
| `tier.plus` | Mais | **Plus** | Preserve 'Plus' as a brand/tier name. |
| `tier.standard` | Padrão | **Standard** | Preserve 'Standard' as a brand/tier name. |
| `tier.standardYearly` | Anual | **Yearly** | Preserve 'Yearly' as a brand/tier name. |
| `tier.enterprise` | Empresa | **Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `languagePicker.searchPlaceholder` | Procurando idioma... | **Pesquisar idioma...** | Use 'Pesquisar' for 'search' in UI context. |
| `sidebar.themeLight` | Mude para o tema claro. | **Mudar para o tema claro** | Use infinitive for action. |
| `sidebar.themeDark` | Mude para o tema escuro. | **Mudar para o tema escuro** | Use infinitive for action. |
| `moreSheet.sip.sub` | Instalando troncos | **Configuração de troncos** | 'Instalando' means installing, 'Configuração' is more appropriate for settings. |
| `moreSheet.enterprise.label` | Configurações empresariais | **Configurações Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `moreSheet.logout` | Saia da sua conta | **Sair da conta** | Use infinitive for action. |
| `call.toPlayground` | 🎯 Para o aterro sanitário | **🎯 Para o campo de treinamento** | 'Полигон' means 'training ground' or 'proving ground', not 'landfill'. |
| `call.micOn` | Desligue o microfone | **Desligar microfone** | Use infinitive for action. |
| `call.micOff` | Ligue o microfone | **Ligar microfone** | Use infinitive for action. |
| `call.camOn` | Desligue a câmera | **Desligar câmera** | Use infinitive for action. |
| `call.camOff` | Ligue a câmera | **Ligar câmera** | Use infinitive for action. |
| `call.screenshareOff` | Pare o compartilhamento de tela | **Parar compartilhamento de tela** | Use infinitive for action. |
| `call.more` | Adicionalmente | **Mais** | Use 'Mais' for 'More' in UI context. |
| `call.validating` | Testando a conexão segura do VibeVox… | **Verificando a conexão segura do VibeVox…** | 'Verificando' is more accurate for 'validating' than 'testando'. |
| `call.backToRooms` | Voltar à lista de quartos | **Voltar à lista de salas** | Use 'salas' for room consistency. |
| `call.connecting` | Conectando ao quarto… | **Conectando à sala…** | Use 'sala' for room consistency. |
| `coach.help` | Ajude a responder | **Ajudar a responder** | Use infinitive for action. |
| `coach.promptLabel` | Seus desejos (tom, estilo, profundidade) | **Suas instruções (tom, estilo, profundidade)** | 'Instruções' is more appropriate for AI prompts than 'desejos'. |
| `coach.ask` | Pergunte à IA | **Perguntar à IA** | Use infinitive for action. |
| `coach.yourReply` | sua Resposta | **Sua resposta** | Correct capitalization. |
| `coach.copy` | Cópia | **Copiar** | Use infinitive for action, 'Cópia' is the noun. |
| `coach.pin` | Fixe-o no Pinterest | **Fixar** | Incorrect literal translation. 'Закрепить' means 'pin/fix'. |
| `roomActions.translation.disableSub` | As atas não serão mais descartadas. | **Os minutos não serão mais debitados.** | 'Atas' means meeting minutes, should be 'minutos' (time unit). 'Descartadas' means discarded, should be 'debitados'. |
| `roomActions.copyLink` | Copie o link para a sala. | **Copiar link da sala** | Use infinitive for action and more concise phrasing. |
| `roomActions.deleteSub` | Encerre a reunião e apague todos os dados. | **Encerrar a reunião e apagar todos os dados** | Use infinitive for action. |
| `billing.quotaExhausted` | O tempo de tradução terminou. | **Os minutos de tradução terminaram.** | Plural agreement for 'minutos'. |
| `billing.createRoomFailed` | Não foi possível criar espaço | **Não foi possível criar a sala** | Use 'sala' for room consistency. |
| `settings.themeLightSub` | Aurora de nuvens (luz) | **Cloud Aurora (Light)** | Preserve 'Cloud Aurora' as a brand name. |
| `partner.title` | Partner program | **Programa de Parceiros** | Translate English UI string to Portuguese. |
| `partner.subtitle` | Share your link and earn | **Compartilhe seu link e ganhe** | Translate English UI string to Portuguese. |
| `partner.yourLink` | Your link | **Seu link** | Translate English UI string to Portuguese. |
| `partner.copy` | Copy | **Copiar** | Translate English UI string to Portuguese. |
| `partner.copied` | ✓ Link copied | **✓ Link copiado** | Translate English UI string to Portuguese. |
| `partner.stats.clicks` | Clicks | **Cliques** | Translate English UI string to Portuguese. |
| `partner.stats.registrations` | Sign-ups | **Registros** | Translate English UI string to Portuguese. |
| `partner.stats.paid` | Payments | **Pagamentos** | Translate English UI string to Portuguese. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} usuários · {{minutes}} min** | Translate 'users' to Portuguese. 'min' is acceptable. |
| `partner.terms` | Program terms | **Termos do programa** | Translate English UI string to Portuguese. |
| `partner.contact` | Contact us | **Contate-nos** | Translate English UI string to Portuguese. |
| `partner.termsModalTitle` | Partner program terms | **Termos do programa de parceria** | Translate English UI string to Portuguese. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Os termos do programa ainda não foram definidos. Por favor, entre em contato com o SuperAdmin.** | Translate English UI string to Portuguese. |
| `partner.loadError` | Failed to load partner data | **Falha ao carregar dados do parceiro** | Translate English UI string to Portuguese. |
| `toneMenu.explainIn` | Explique em tom adequado. | **Explicar no tom** | Use infinitive for action and remove 'adequado' which is not in source. |
| `sip.loginShort` | Conecte-se | **Login** | 'Login' is a common UI term for username/login field. |
| `sip.trunkId` | Identificação do tronco | **ID do tronco** | More concise and common for 'ID'. |
| `sip.createTrunk` | Crie um tronco | **Criar tronco** | Use infinitive for action. |
| `sip.incoming.active` | Chamadas recebidas. | **Recebimento de chamadas ativas** | More descriptive and grammatically complete. |
| `sip.incoming.pausedHint` | Ative a recepção para que o VibeVox comece a encaminhar as chamadas recebidas. | **Ative a recepção para que o VibeVox comece a traduzir as chamadas recebidas.** | 'Encaminhar' means 'forward', but the context is 'translate'. |
| `sip.incoming.copy` | Cópia | **Copiar** | Use infinitive for action, 'Cópia' is the noun. |
| `sip.incoming.reissue` | Reedição | **Reemitir** | 'Reemitir' is more accurate for 'reissue' (e.g., a key/password). |
| `sip.outbound.lead` | Ligue para um número de telefone através da interface web e o VibeVox transferirá automaticamente a sua conversa em tempo real. | **Ligue para um número de telefone através da interface web e o VibeVox traduzirá automaticamente a sua conversa em tempo real.** | 'Transferirá' means 'transfer', but the context is 'translate'. |
| `enterprise.page.title` | Configurações empresariais | **Configurações Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `enterprise.page.upsellCta` | Acesse as tarifas. | **Acessar tarifas** | Use infinitive for action. |
| `enterprise.tabs.prompts` | Pontas | **Prompts** | 'Pontas' means 'tips', 'Prompts' is the technical term. |
| `enterprise.tabs.questFlow` | Fluxo de Missão | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.tabs.chatwoot` | CRM (Chattwoot) | **CRM (Chatwoot)** | Correct spelling of 'Chatwoot'. |
| `enterprise.common.recheck` | Verifique novamente | **Verificar novamente** | Use infinitive for action. |
| `enterprise.common.inactive` | Não está ativo | **Inativo** | More concise and common for 'inactive'. |
| `enterprise.common.pasteApiKey` | Insira a chave da API | **Cole a chave da API** | 'Cole' is more accurate for 'paste'. |
| `enterprise.common.copy` | Cópia | **Copiar** | Use infinitive for action, 'Cópia' is the noun. |
| `enterprise.apiKey.pastePlaceholder` | Insira a chave da API | **Cole a chave da API** | 'Cole' is more accurate for 'paste'. |
| `enterprise.apiKey.copy` | Cópia | **Copiar** | Use infinitive for action, 'Cópia' is the noun. |
| `enterprise.gemini.aiStudioLink` | Estúdio de IA | **AI Studio** | Preserve 'AI Studio' as a brand name. |
| `enterprise.gemini.validateLabel` | Verifique novamente | **Verificar novamente** | Use infinitive for action. |
| `enterprise.gemini.successDeleted` | Chave individual removida. | **Chave per-tenant removida.** | Use 'per-tenant' for consistency with the source term. |
| `enterprise.gemini.telegram.leadAllWhoStart` | Todos que escrevem para este bot | **Todos que escreverem para este bot** | Use future tense for 'will receive notifications'. |
| `enterprise.gemini.telegram.leadStartCmd` | /começar | **/start** | Preserve '/start' as a command name. |
| `enterprise.gemini.telegram.leadAfterStart` | Você receberá notificações sobre novos clientes, tags e erros de integração. É possível inscrever vários funcionários ou adicionar o bot a um grupo ou canal — todos receberão a notificação automaticamente. | **receberão notificações: novos clientes, tags, erros de integração. É possível inscrever vários funcionários ou adicionar o bot a um grupo ou canal — as notificações serão enviadas a todos automaticamente.** | Correct subject and verb agreement (they will receive) and phrasing. |
| `enterprise.gemini.telegram.botUnlink` | Desvincule o bot | **Desvincular bot** | Use infinitive for action. |
| `enterprise.gemini.telegram.errEnterToken` | Insira o token do bot | **Cole o token do bot** | 'Cole' is more accurate for 'paste'. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ Bot @{{username}} salvo. Saudação entregue aos assinantes {{sent}}. | **✓ Bot @{{username}} salvo. Saudação entregue a {{sent}} assinantes.** | Correct plural agreement for 'assinantes'. |
| `enterprise.gemini.telegram.successUnlinked` | O robô foi desamarrado. | **O bot foi desvinculado.** | 'Desamarrado' means 'untied', 'desvinculado' is more appropriate for 'unlinked'. |
| `enterprise.gemini.telegram.testingLabel` | Capacete… | **Enviando…** | Incorrect literal translation. 'Шлём' means 'sending'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Desatar | **Desvincular** | Consistent with 'desvincular' for unlinking a bot. |
| `enterprise.gemini.telegram.lastBroadcast` | Última correspondência: entregue em {{sent}} de {{total}} | **Último envio: entregue a {{sent}} de {{total}}** | 'Correspondência' means correspondence. 'Envio' is more appropriate. 'entregue a' for 'delivered to'. |
| `enterprise.prompt.heading` | Pontas | **Prompts** | 'Pontas' means 'tips', 'Prompts' is the technical term. |
| `enterprise.prompt.promptLabel` | Mensagem do sistema (tom, estilo, vocabulário) | **Prompt do sistema (tom, estilo, vocabulário)** | Use 'Prompt' as the technical term. |
| `enterprise.prompt.defaultLabel` | prompt padrão do VibeVox | **Prompt padrão do VibeVox** | Correct capitalization and use 'Prompt'. |
| `enterprise.prompt.headerLeadBold1` | Apenas para descriptografar mensagens em salas de vídeo. | **Apenas para transcrever mensagens em salas de vídeo.** | 'Descriptografar' means 'decrypt', 'transcrever' is 'transcribe'. |
| `enterprise.prompt.headerLeadPart2` | - Quando você clica em uma mensagem em um bate-papo e seleciona um toque. | **- Quando você clica em uma mensagem em um bate-papo e seleciona um tom.** | 'Toque' means 'touch' or 'ringtone', 'tom' is 'tone'. |
| `enterprise.prompt.headerLeadBold2` | "Conforme sua solicitação" | **"Conforme seu prompt"** | Use 'prompt' as the technical term. |
| `enterprise.prompt.contextHeading` | Contexto / sugestão | **Contexto / prompt** | Use 'prompt' as the technical term. |
| `enterprise.prompt.contextLeadPart1` | Usado quando você clica em uma mensagem em um bate-papo por vídeo e seleciona um toque. | **Usado quando você clica em uma mensagem em um bate-papo por vídeo e seleciona um tom.** | 'Toque' means 'touch' or 'ringtone', 'tom' is 'tone'. |
| `enterprise.prompt.contextLeadBold` | "Conforme sua solicitação" | **"Conforme seu prompt"** | Use 'prompt' as the technical term. |
| `enterprise.prompt.contextLeadPart2` | A base de conhecimento também está incluída (abaixo). | **A base de conhecimento também é adicionada (abaixo).** | 'Adicionada' is more direct for 'подмешивается' (mixed in/added). |
| `enterprise.prompt.promptPlaceholder` | Seu pedido... | **Seu prompt...** | Use 'prompt' as the technical term. |
| `enterprise.prompt.presetsLeadBold` | "Conforme sua solicitação" | **"Conforme seu prompt"** | Use 'prompt' as the technical term. |
| `enterprise.prompt.presetsLeadPart2` | Utiliza a sua solicitação do campo acima. | **Utiliza seu prompt do campo acima.** | Use 'prompt' as the technical term. |
| `enterprise.questFlow.heading` | Fluxo de Missão | **Quest Flow** | Preserve 'Quest Flow' as a brand name. |
| `enterprise.questFlow.warning` | Se o campo estiver vazio, será utilizada a mensagem padrão do VibeVox. | **Se o campo estiver vazio, será utilizado o prompt padrão do VibeVox.** | Use 'prompt' as the technical term. |
| `enterprise.questFlow.promptLabel` | Sistema de fluxo de missões | **Prompt do sistema Quest Flow** | Use 'Prompt' as the technical term and preserve 'Quest Flow'. |
| `enterprise.questFlow.tagsLabel` | Precisa de etiquetas | **Tags de necessidades** | 'Precisa de etiquetas' means 'needs labels'. 'Tags de necessidades' is more accurate. |
| `enterprise.questFlow.errDelete` | Delete error | **Erro de exclusão** | Translate English UI string to Portuguese. |
| `enterprise.questFlow.createdWarning` | ⚠ Guarde a chave - ela só é exibida uma vez | **⚠ Salve a chave - ela só é exibida uma vez** | 'Salvar' is more common for 'save' in UI. |
| `enterprise.questFlow.copyKey` | Cópia | **Copiar** | Use infinitive for action, 'Cópia' is the noun. |
| `enterprise.questFlow.savedKeyConfirm` | Eu guardei a chave. | **Eu salvei a chave.** | 'Salvar' is more common for 'save' in UI. |
| `enterprise.questFlow.deleteTitle` | Delete | **Excluir** | Translate English UI string to Portuguese. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Excluir chave?** | Translate English UI string to Portuguese. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **A chave será excluída permanentemente. O Quest Flow deixará de funcionar com ela — será necessário criar uma nova chave e substituí-la no fluxo.** | Translate English UI string to Portuguese. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Excluir** | Translate English UI string to Portuguese. |
| `enterprise.questFlow.promptHeading` | Solicitação para conversas no Telegram | **Prompt para conversas no Telegram** | Use 'Prompt' as the technical term. |
| `enterprise.questFlow.promptPlaceholder` | Seu pedido... | **Seu prompt...** | Use 'prompt' as the technical term. |
| `enterprise.questFlow.successPromptSaved` | Solicitação do Quest Flow salva. | **Prompt do Quest Flow salvo.** | Use 'Prompt' as the technical term. |
| `enterprise.questFlow.kbLeadBold2` | separar | **separada** | Feminine agreement with 'base'. |
| `enterprise.questFlow.kbLead3` | Da seção "Dicas" — para transcrição de vídeo. Limite: arquivo de 50 MB / 500.000 caracteres no banco de dados. | **Da seção "Prompts" — para transcrição de vídeo. Limite: arquivo de 50 MB / 500.000 caracteres no banco de dados.** | Consistent with 'Prompts' for the section name. |
| `enterprise.questFlow.tagsHeading` | Precisa de etiquetas | **Tags de necessidades** | 'Precisa de etiquetas' means 'needs labels'. 'Tags de necessidades' is more accurate. |
| `enterprise.questFlow.tagsLead` | A IA atribui essas etiquetas aos clientes se detectar uma correspondência na conversa. As etiquetas são exibidas no cartão do quarto do cliente e transmitidas para o CRM (Seção 4). | **A IA atribui essas etiquetas aos clientes se detectar uma correspondência na conversa. As etiquetas são exibidas no cartão da sala do cliente e transmitidas para o CRM (Seção 4).** | Use 'sala' for room consistency. |
| `enterprise.chatwoot.heading` | Integração com CRM (Chattwoot) | **Integração com CRM (Chatwoot)** | Correct spelling of 'Chatwoot'. |
| `enterprise.chatwoot.test` | Verifique a conexão | **Verificar conexão** | Use infinitive for action. |
| `enterprise.chatwoot.headingShort` | CRM (Chattwoot) | **CRM (Chatwoot)** | Correct spelling of 'Chatwoot'. |
| `enterprise.chatwoot.statusActive` | Ativo | **Ativa** | Feminine agreement with 'integração' or 'conexão'. |
| `enterprise.chatwoot.statusDisabled` | Desligado | **Desativada** | Feminine agreement with 'integração' or 'conexão'. |
| `chat.openWithClient` | Inicie um chat com o cliente. | **Abrir chat com o cliente** | Use infinitive for action. |
| `chat.attach` | Anexe um arquivo | **Anexar arquivo** | Use infinitive for action. |
| `chat.deleteMessageConfirmTitle` | Apagar mensagem? | **Excluir mensagem?** | 'Excluir' is more common for 'delete' in UI. |
| `chat.backToRooms` | ← Voltar aos quartos | **← Voltar às salas** | Use 'salas' for room consistency. |
| `chat.enterpriseOnlyHint` | As salas de bate-papo são um recurso exclusivo para empresas. Atualize seu plano na seção "Preços". | **O chat de salas é um recurso Enterprise. Atualize seu plano na seção "Tarifas".** | More direct translation, 'Enterprise' as tier name, 'Tarifas' for consistency. |
| `chat.telegramBadge` | Telegrama | **Telegram** | Preserve 'Telegram' as a brand name. |
| `insights.recalc` | Recontagem | **Recalcular** | 'Recontagem' means 'recount', 'Recalcular' is 'recalculate'. |
| `insights.summary` | Retomar | **Resumo** | 'Retomar' means 'resume', 'Resumo' is 'summary'. |
| `insights.sentiment` | Chave | **Tonalidade** | 'Chave' means 'key', 'Tonalidade' is 'sentiment/tone'. |
| `insights.engagement` | Noivado | **Engajamento** | 'Noivado' means 'engagement' (marriage), 'Engajamento' is 'engagement' (involvement). |
| `insights.leadValues.warm` | Esquentar | **Morno** | 'Esquentar' means 'to warm up', 'Morno' is 'warm' (adjective). |
| `lobby.tosAgree` | Ao se cadastrar, você concorda com | **Ao participar, você concorda com** | 'Cadastrar' means 'register', 'participar' is more appropriate for joining a meeting. |
| `lobby.andWord` |  E  | ** e ** | Use lowercase for 'e'. |
| `lobby.privacy` | política de Privacidade | **Política de Privacidade** | Correct capitalization. |
| `lobby.audioConsent` | e também consentir com o processamento do áudio para fins de tradução. | **e também consente com o processamento do áudio para fins de tradução.** | Verb agreement with 'você'. |
| `lobby.footerTagline` | tradução com inteligência artificial | **Tradução com inteligência artificial** | Correct capitalization. |
| `lobby.roomFullMsg` | Já há um participante na reunião. Entre em contato com o criador da reunião ou solicite um novo participante. | **Já há um participante na reunião. Entre em contato com o criador da reunião ou solicite uma nova.** | Feminine agreement with 'reunião' (nova reunião). |
| `paywall.subtitle` | Escolha um plano ou compre mais minutos – pague via Stripe e receba o reembolso imediatamente aqui. | **Escolha um plano ou compre mais minutos – pague via Stripe e o saldo será atualizado aqui imediatamente.** | 'Reembolso' means refund, but the context is minutes being added to balance. |
| `paywall.subscribe` | Projeto | **Assinar** | 'Projeto' means 'project', 'Assinar' is 'subscribe'. |
| `paywall.featureMinutes` | Tradução mínima {{count}} | **{{count}} minutos de tradução** | 'Tradução mínima' means 'minimum translation'. Correct phrasing for 'X minutes of translation'. |
| `paywall.topupTitle` | Compre mais minutos | **Comprar mais minutos** | Use infinitive for action. |
| `paywall.topupBuyButton` | Compre por €{{price}} | **Comprar por €{{price}}** | Use infinitive for action. |
| `paywall.topupCalcLoading` | Calculamos o custo… | **Calculando o custo…** | Use present participle for 'loading' state. |
| `paywall.topupPlusLine` | Tarifa Plus ({{count}} mínimo incluído) | **Tarifa Plus ({{count}} minutos incluídos)** | Plural agreement for 'minutos'. |
| `billingPage.tierLabel` | Avaliar | **Plano** | 'Avaliar' means 'evaluate', 'Plano' is 'plan/tier'. |
| `billingPage.billingNotActive` | não ativo | **inativo** | More concise and common for 'inactive'. |
| `billingPage.resumeFailed` | Sua assinatura não foi renovada. | **Não foi possível renovar a assinatura.** | More direct translation of 'Не удалось возобновить подписку'. |
| `billingPage.topupHelp` | Botão deslizante de compra adicional. Disponível com uma assinatura ativa. | **Slider de compra adicional. Disponível com uma assinatura ativa.** | 'Slider' is a common UI term, 'Botão deslizante' is too literal. |
| `billingPage.topupCarried` | Postergado | **Minutos acumulados** | 'Postergado' means 'postponed', 'Minutos acumulados' is more accurate for 'carried over minutes'. |
| `billingPage.tierPlusName` | Mais | **Plus** | Preserve 'Plus' as a brand/tier name. |
| `billingPage.tierStandardName` | Padrão | **Standard** | Preserve 'Standard' as a brand/tier name. |
| `billingPage.tierEnterpriseName` | Empresa | **Enterprise** | Preserve 'Enterprise' as a brand/tier name. |
| `billingPage.featureLearnHub` | Centro de Aprendizagem de IA — seus próprios dialetos | **AI Learning Hub — seus próprios dialetos** | Preserve 'AI Learning Hub' as a brand name. |
| `billingPage.featureBranding` | Identidade visual do quarto (logotipo, cores) | **Identidade visual da sala (logotipo, cores)** | Use 'sala' for room consistency. |
| `billingPage.featurePersonalPrompts` | Sugestões de IA personalizadas | **Prompts de IA personalizados** | Use 'Prompts' as the technical term. |
| `billingPage.ctaSubscribePlus` | Obtenha o Plus | **Assinar Plus** | 'Assinar' is more appropriate for subscribing to a plan. |
| `billingPage.ctaSubscribeStandard` | Pedido padrão | **Assinar Standard** | 'Assinar' is more appropriate for subscribing to a plan. |
| `billingPage.ctaContact` | Contato | **Entrar em contato** | More complete and natural phrasing for 'contact'. |
| `billingPage.languagesCount_few` | {{count}} idioma | **{{count}} idiomas** | Plural agreement for 'idiomas'. |
| `billingPage.faqA3` | Conjunto completo de IA: fichas de clientes com reconhecimento automático, autorização via Telegram, avisos personalizados, Google Agenda, marcação inteligente de necessidades, exportação para CRM, integração com questflow.pro e uma aba administrativa separada. | **Conjunto completo de IA: fichas de clientes com reconhecimento automático, autorização via Telegram, prompts personalizados, Google Agenda, marcação inteligente de necessidades, exportação para CRM, integração com questflow.pro e uma aba administrativa separada.** | Use 'prompts' as the technical term. |
| `billingPage.renewsOn` | extensão {{date}} | **renovação {{date}}** | 'Extensão' means 'extension', 'renovação' is 'renewal'. |
| `defaultRoom.namePattern` | Quarto {{name}} · {{date}}, {{time}} | **Sala {{name}} · {{date}}, {{time}}** | Use 'sala' for room consistency. |
| `postCallInsights.subtitle` | Empresas · insights pós-chamada | **Enterprise · insights pós-chamada** | Preserve 'Enterprise' as a brand/tier name. |
| `postCallInsights.analyzing` | Vamos analisar a conversa... | **Analisando a conversa...** | Use present participle for 'analyzing' state. |
| `postCallInsights.metricSentiment` | Humor | **Tonalidade** | 'Humor' means 'mood', 'Tonalidade' is 'sentiment/tone'. |
| `postCallInsights.metricEngagement` | Noivado | **Engajamento** | 'Noivado' means 'engagement' (marriage), 'Engajamento' is 'engagement' (involvement). |
| `postCallInsights.summary` | Retomar | **Resumo** | 'Retomar' means 'resume', 'Resumo' is 'summary'. |
| `postCallInsights.close` | Feche e retorne aos quartos. | **Fechar e retornar às salas** | Use infinitive for action and 'salas' for room consistency. |
| `settingsMore.logout` | Saia da sua conta | **Sair da conta** | Use infinitive for action. |
| `pwaInstall.buttonLabel` | Instale o aplicativo | **Instalar aplicativo** | Use infinitive for action. |
| `pwaInstall.buttonSubtitle` | Acesse a tela inicial - abra com um toque. | **Na tela inicial — inicie com um toque.** | More natural phrasing for 'on the home screen - launch with one tap'. |
| `pwaInstall.buttonAria` | Instale o VibeVox como um aplicativo. | **Instalar VibeVox como aplicativo** | Use infinitive for action. |
| `auth.login.submit` | Conecte-se | **Entrar** | Use 'Entrar' for login. |
| `auth.register.loginLink` | Conecte-se | **Entrar** | Use 'Entrar' for login. |
| `auth.register.namePlaceholder` | seu nome | **Seu nome** | Correct capitalization. |
| `auth.register.agreementPrefix` | Ao se cadastrar, você concorda com | **Ao se registrar, você concorda com** | Consistent with 'register' context. |
| `auth.register.agreementAnd` |  E  | ** e ** | Use lowercase for 'e'. |
| `auth.register.agreementPrivacy` | política de Privacidade | **Política de Privacidade** | Correct capitalization. |
| `auth.forgot.backToLogin` | ← Voltar à entrada | **← Voltar ao login** | More common UI term for 'login'. |
| `auth.forgot.successTitle` | A carta foi enviada. | **E-mail enviado.** | 'Carta' means 'letter', 'E-mail' is more appropriate. |
| `footer.poweredBy` | tradução com inteligência artificial | **Tradução com inteligência artificial** | Correct capitalization. |

⚠ 5 fix(es) skipped (no-op, missing path, or would break placeholders).
