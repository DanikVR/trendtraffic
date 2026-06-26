# LLM Review: Kazakh (kk)

**Model:** gemini-2.5-flash  
**Took:** 835.6s  
**Fixes proposed:** 106 (valid after placeholder-check: 106)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.home` | Үй | **Басты бетке** | Better translation for "to home page". |
| `rooms.tabs.questFlow` | Тапсырма ағыны | **Quest Flow** | Brand name "Quest Flow" should not be translated. |
| `common.open` | Ашық | **Ашу** | Use verb form for button label "Open". |
| `common.edit` | Өзгеріс | **Өзгерту** | Use verb form for button label "Edit". |
| `balance.openPlans` | Ашық тарифтер және баланс | **Тарифтер мен балансты ашу** | Use verb form "Ашу" for "Open". Reordered for natural flow. |
| `tier.standardYearly` | Жыл сайынғы | **Yearly** | Brand name "Yearly" should not be translated. |
| `languagePicker.searchPlaceholder` | Тіл ізделуде... | **Тіл іздеу...** | Better phrasing for "Search language" in a placeholder. |
| `sidebar.logoAria` | VibeVox — Басты бет | **VibeVox — Басты бетке** | Better translation for "to home page". |
| `moreSheet.sip.sub` | Сандықтарды орнату | **Транктерді орнату** | Translate "транков" as "trunks" (technical term). |
| `call.you` | Сен | **Сіз** | Use formal "Сіз" for UI consistency. |
| `call.toPlayground` | 🎯 Қоқыс полигонына | **🎯 Жаттығу алаңына** | Translate "playground" as "training ground" not "landfill". |
| `call.sentToPlayground` | ✅ Бұл сөз тіркесі жаттығу алаңына жіберілді! | **✅ Фраза жаттығу алаңына жіберілді!** | Slightly more concise, "фраза" is commonly used. |
| `call.playgroundTip` | Жасанды интеллект жаттығу алаңына сөз тіркесін жіберіңіз | **Жасанды интеллект жаттығу алаңына фразаны жіберіңіз** | Use "фразаны" for "phrase". |
| `call.more` | Сонымен қатар | **Қосымша** | Better translation for "More" (additional options). |
| `coach.help` | Көмекші жауап | **Жауап беруге көмектесу** | More accurate translation for "Help to answer". |
| `coach.promptPlaceholder` | Әңгіме немесе өзіңіз туралы кез келген сұрақ туралы сұраңыз | **Әңгіме немесе кез келген сұрағыңыз туралы сұраңыз** | Corrected "about yourself" to "about your question". |
| `coach.pin` | Қадағалаңыз | **Бекіту** | Translate "pin" as "Бекіту" (to fasten/pin). |
| `roomActions.translation.disableSub` | Хаттамалар енді есептен шығарылмайды | **Минуттар енді есептен шығарылмайды** | Corrected "minutes" (time unit) from "protocols". |
| `settings.themeDarkSub` | Абисс Аврора (Қараңғы) | **Abyss Aurora (Қараңғы)** | Brand name "Abyss Aurora" should not be translated. |
| `settings.themeLightSub` | Бұлтты Аврора (Жарық) | **Cloud Aurora (Жарық)** | Brand name "Cloud Aurora" should not be translated. |
| `partner.title` | Partner program | **Серіктестік бағдарламасы** | Translate to Kazakh: "Partner program". |
| `partner.subtitle` | Share your link and earn | **Сілтемеңізбен бөлісіңіз және табыс табыңыз** | Translate to Kazakh: "Share your link and earn". |
| `partner.yourLink` | Your link | **Сіздің сілтемеңіз** | Translate to Kazakh: "Your link". |
| `partner.copy` | Copy | **Көшіру** | Translate to Kazakh: "Copy". |
| `partner.copied` | ✓ Link copied | **✓ Сілтеме көшірілді** | Translate to Kazakh: "Link copied". |
| `partner.stats.clicks` | Clicks | **Өтулер** | Translate to Kazakh: "Clicks". |
| `partner.stats.registrations` | Sign-ups | **Тіркелулер** | Translate to Kazakh: "Sign-ups". |
| `partner.stats.paid` | Payments | **Төлемдер** | Translate to Kazakh: "Payments". |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} пайдаланушы · {{minutes}} мин** | Translate "users" to Kazakh. |
| `partner.terms` | Program terms | **Бағдарлама шарттары** | Translate to Kazakh: "Program terms". |
| `partner.contact` | Contact us | **Бізбен байланысу** | Translate to Kazakh: "Contact us". |
| `partner.termsModalTitle` | Partner program terms | **Серіктестік бағдарламасының шарттары** | Translate to Kazakh: "Partner program terms". |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Бағдарлама шарттары әлі орнатылмаған. SuperAdmin-мен байланысыңыз.** | Translate to Kazakh. |
| `partner.loadError` | Failed to load partner data | **Серіктестік деректерін жүктеу мүмкін болмады** | Translate to Kazakh. |
| `sip.newTrunk` | Жаңа SIP магистральдық бөлігі | **Жаңа SIP транкі** | More concise and common term for "SIP trunk". |
| `sip.editTrunk` | Жүксалғыш параметрлерін өзгерту | **Транк параметрлерін өзгерту** | Corrected "trunk" (technical term) from "car trunk". |
| `sip.trunkId` | Жүк көлігінің идентификаторы | **Транк идентификаторы** | Corrected "trunk ID" (technical term) from "truck ID". |
| `sip.createTrunk` | Магистраль жасау | **Транк жасау** | Use "транк" for consistency with technical term. |
| `sip.toasts.saveFailed` | Жүксалғышты сақтау сәтсіз аяқталды | **Транкті сақтау сәтсіз аяқталды** | Corrected "trunk" (technical term) from "car trunk". |
| `sip.toasts.deleted` | Жүксалғыш жойылды. | **Транк жойылды.** | Corrected "trunk" (technical term) from "car trunk". |
| `sip.toasts.deleteFailed` | Транзакциялық жол жойылмады | **Транкті жою мүмкін болмады** | Corrected "trunk" (technical term) from "transaction path". |
| `sip.incoming.pausedHint` | VibeVox кіріс қоңырауларды бағыттай бастауы үшін қабылдауды іске қосыңыз. | **VibeVox кіріс қоңырауларды аудара бастауы үшін қабылдауды іске қосыңыз.** | Corrected "redirect" to "translate". |
| `sip.outbound.lead` | Веб-интерфейс арқылы телефон нөміріне қоңырау шалыңыз, сонда VibeVox сіздің әңгімеңізді нақты уақыт режимінде автоматты түрде жібереді. | **Веб-интерфейс арқылы телефон нөміріне қоңырау шалыңыз, сонда VibeVox сіздің әңгімеңізді нақты уақыт режимінде автоматты түрде аударады.** | Corrected "sends" to "translates". |
| `sip.tenantOnly.hint2` | Транзит жасау үшін өзінің tenantId идентификаторы бар тұрақты пайдаланушы ретінде кіріңіз. | **Транк жасау үшін өзінің tenantId идентификаторы бар тұрақты пайдаланушы ретінде кіріңіз.** | Corrected "transit" to "trunk" (technical term). |
| `sip.confirm.deleteTrunkTitle` | SIP трассасын жою керек пе? | **SIP транкін жою керек пе?** | Corrected "trunk" (technical term) from "route". |
| `enterprise.tabs.questFlow` | Тапсырма ағыны | **Quest Flow** | Brand name "Quest Flow" should not be translated. |
| `enterprise.gemini.lead` | AI Studio компаниясының жеке кілті. Бұл сіздің аккаунтыңыздағы барлық Gemini қоңырауларына арналған жаһандық кілтті ауыстырады. | **AI Studio жеке кілті. Бұл сіздің аккаунтыңыздағы барлық Gemini қоңырауларына арналған жаһандық кілтті ауыстырады.** | Brand name "AI Studio" should not be translated. |
| `enterprise.gemini.aiStudioLink` | Жасанды интеллект студиясы | **AI Studio** | Brand name "AI Studio" should not be translated. |
| `enterprise.gemini.telegram.leadStartCmd` | /бастау | **/start** | Telegram command "/start" should be preserved. |
| `enterprise.gemini.telegram.testingLabel` | Дулыға… | **Жіберудеміз…** | Corrected "sending" from "helmet". |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Бауды шешу | **Байланысты үзу** | Better translation for "unlink/disconnect". |
| `enterprise.prompt.subtitle` | Тек бейне бөлмелерінде транскрипциялауға арналған жедел және білім базасы | **Тек бейне бөлмелерінде транскрипциялауға арналған промпт және білім базасы** | Use "промпт" as a technical term. |
| `enterprise.prompt.promptLabel` | Жүйелік тапсырма (ырғақ, стиль, сөздік қор) | **Жүйелік промпт (ырғақ, стиль, сөздік қор)** | Use "промпт" as a technical term. |
| `enterprise.prompt.savePrompt` | Сақтау нұсқауы | **Промптты сақтау** | Use "промпт" as a technical term. |
| `enterprise.prompt.defaultLabel` | VibeVox әдепкі сұрауы | **VibeVox әдепкі промпты** | Use "промпт" as a technical term. |
| `enterprise.prompt.headerLeadBold2` | «Сіздің өтінішіңіз бойынша» | **«Сіздің промптыңыз бойынша»** | Use "промпт" as a technical term. |
| `enterprise.prompt.contextHeading` | Контекст / шақыру | **Контекст / промпт** | Use "промпт" as a technical term. |
| `enterprise.prompt.contextLeadBold` | «Сіздің өтінішіңіз бойынша» | **«Сіздің промптыңыз бойынша»** | Use "промпт" as a technical term. |
| `enterprise.prompt.extendNoteText` | өзіндік ережелерімен/стилімен/терминологиясымен - олар жоғарыдағы әдепкі шақырумен және білім базасымен біріктіріледі. | **өзіндік ережелерімен/стилімен/терминологиясымен - олар жоғарыдағы әдепкі промптпен және білім базасымен біріктіріледі.** | Use "промпт" as a technical term. |
| `enterprise.prompt.promptPlaceholder` | Сіздің сұранысыңыз... | **Сіздің промптыңыз...** | Use "промпт" as a technical term. |
| `enterprise.prompt.savePromptLabel` | Сақтау нұсқауы | **Промптты сақтау** | Use "промпт" as a technical term. |
| `enterprise.prompt.successPromptSaved` | Сұрау сақталды. | **Промпт сақталды.** | Use "промпт" as a technical term. |
| `enterprise.prompt.presetsLeadBold` | «Сіздің өтінішіңіз бойынша» | **«Сіздің промптыңыз бойынша»** | Use "промпт" as a technical term. |
| `enterprise.prompt.presetsLeadPart2` | жоғарыдағы өрістен сіздің сұрауыңызды пайдаланады. | **жоғарыдағы өрістен сіздің промптыңызды пайдаланады.** | Use "промпт" as a technical term. |
| `enterprise.questFlow.heading` | Тапсырма ағыны | **Quest Flow** | Brand name "Quest Flow" should not be translated. |
| `enterprise.questFlow.warning` | Егер өріс бос болса, жалпы VibeVox шақыруы қолданылады. | **Егер өріс бос болса, жалпы VibeVox промпты қолданылады.** | Use "промпт" as a technical term. |
| `enterprise.questFlow.promptLabel` | Quest Flow жүйесінің сұрауы | **Quest Flow жүйесінің промпты** | Use "промпт" as a technical term. |
| `enterprise.questFlow.tagsLabel` | Тегтер қажет | **Қажеттілік тегтері** | Better phrasing for "tags of needs". |
| `enterprise.questFlow.savePrompt` | Сақтау нұсқауы | **Промптты сақтау** | Use "промпт" as a technical term. |
| `enterprise.questFlow.errDelete` | Delete error | **Жою қатесі** | Translate to Kazakh: "Delete error". |
| `enterprise.questFlow.deleteTitle` | Delete | **Жою** | Translate to Kazakh: "Delete". |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Кілтті жою керек пе?** | Translate to Kazakh: "Delete key?". |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Кілт қалпына келтіру мүмкіндігінсіз жойылады. Quest Flow ол арқылы жұмыс істеуді тоқтатады — жаңа кілт жасап, оны тізбекте ауыстыру қажет болады.** | Translate to Kazakh. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Жою** | Translate to Kazakh: "Delete". |
| `enterprise.questFlow.promptHeading` | Telegram әңгімелерін сұрау | **Telegram әңгімелеріне арналған промпт** | Use "промпт" as a technical term and improve grammar. |
| `enterprise.questFlow.promptLead2` | — жалпы VibeVox шақыруы пайдаланылады (төменде). | **— жалпы VibeVox промпты пайдаланылады (төменде).** | Use "промпт" as a technical term. |
| `enterprise.questFlow.promptLead3` | - ол негізгі тапсырмамен және білім базасымен біріктіріледі. | **- ол негізгі промптпен және білім базасымен біріктіріледі.** | Use "промпт" as a technical term. |
| `enterprise.questFlow.promptPlaceholder` | Сіздің сұранысыңыз... | **Сіздің промптыңыз...** | Use "промпт" as a technical term. |
| `enterprise.questFlow.successPromptSaved` | Тапсырма ағыны сұрауы сақталды. | **Quest Flow промпты сақталды.** | Use "промпт" as a technical term and keep brand name. |
| `enterprise.questFlow.tagsHeading` | Тегтер қажет | **Қажеттілік тегтері** | Better phrasing for "tags of needs". |
| `enterprise.chatwoot.urlLabel` | Чатвут URL мекенжайы (мысалы, https://app.chatwoot.com) | **Chatwoot URL мекенжайы (мысалы, https://app.chatwoot.com)** | Brand name "Chatwoot" should not be translated. |
| `enterprise.chatwoot.headingShort` | CRM (Чатвут) | **CRM (Chatwoot)** | Brand name "Chatwoot" should not be translated. |
| `enterprise.chatwoot.whatSentHeading` | Чатвутта не беріледі | **Chatwoot-қа не беріледі** | Corrected preposition "in Chatwoot" to "to Chatwoot". |
| `insights.sentiment` | Кілт | **Тоналдық** | Corrected "key" to "tonality". |
| `insights.leadScore` | Басшылық ұпайы | **Lead Score** | Preserve "Lead Score" as a sales funnel term. |
| `lobby.andWord` | Және | **және** | Use lowercase for conjunction "and" within a sentence. |
| `paywall.buyPlus` | Қосымша — айына 19 еуро (60 мин) | **Plus — айына 19 еуро (60 мин)** | Brand name "Plus" should not be translated. |
| `paywall.buyStandard` | Стандартты – айына €29 (120 мин) | **Standard – айына €29 (120 мин)** | Brand name "Standard" should not be translated. |
| `paywall.subscribe` | Дизайн | **Жазылу** | Corrected "design" to "subscribe". |
| `paywall.topupNoSubInfo` | ℹ Сізде белсенді жазылым жоқ. Сатып алуыңызға айына €19 төленетін қосымша бонус қосылады — жоспарыңызға 60 минут кіреді, сондықтан қосымша ақы алынбайды. | **ℹ Сізде белсенді жазылым жоқ. Сатып алуыңызға айына €19 төленетін Plus қосылады — жоспарыңызға 60 минут кіреді, сондықтан қосымша ақы алынбайды.** | Brand name "Plus" should not be translated. |
| `paywall.topupPlusLine` | Қосымша тариф ({{count}} мин кіреді) | **Plus тарифі ({{count}} мин кіреді)** | Brand name "Plus" should not be translated. |
| `postCallInsights.metricLeadScore` | Басты ұпай | **Lead Score** | Preserve "Lead Score" as a sales funnel term. |
| `billingPage.tierLabel` | Бағасы | **Тариф** | Corrected "price" to "tariff" (loanword). |
| `billingPage.resume` | Түйіндеме | **Жалғастыру** | Corrected "summary" to "resume" (verb). |
| `billingPage.tierPlusName` | Плюс | **Plus** | Brand name "Plus" should not be translated. |
| `billingPage.tierStandardName` | Стандартты | **Standard** | Brand name "Standard" should not be translated. |
| `billingPage.featureHd` | HD аударма дауыстары (Аоэде, Чарон, Корея) | **HD аударма дауыстары (Aoede, Charon, Kore)** | Brand names "Aoede, Charon, Kore" should not be translated. |
| `billingPage.featurePersonalPrompts` | Жеке жасанды интеллект сұраулары | **Жеке жасанды интеллект промпттары** | Use "промпт" as a technical term. |
| `billingPage.ctaSubscribePlus` | Плюс алыңыз | **Plus алыңыз** | Brand name "Plus" should not be translated. |
| `billingPage.ctaSubscribeStandard` | Тапсырыс стандарты | **Standard тарифіне жазылу** | Brand name "Standard" should not be translated, and improve verb. |
| `billingPage.faqA3` | Толық жасанды интеллект жинағы: автоматты түрде тану мүмкіндігі бар тұтынушы карталары, Telegram авторизациясы, жекелендірілген сұраулар, Google күнтізбесі, ақылды қажеттіліктерді белгілеу, CRM экспорты, questflow.pro-мен интеграция және бөлек әкімші қойындысы. | **Толық жасанды интеллект жинағы: автоматты түрде тану мүмкіндігі бар тұтынушы карталары, Telegram авторизациясы, жекелендірілген промпттар, Google күнтізбесі, ақылды қажеттіліктерді белгілеу, CRM экспорты, questflow.pro-мен интеграция және бөлек әкімші қойындысы.** | Use "промпт" as a technical term. |
| `billingPage.faqA4` | Кез келген RFC үйлесімді: Zadarma, OnlinePBX, Asterisk/FreePBX және т.б. VibeVox шығыс транзитті автоматты түрде жасайды. | **Кез келген RFC үйлесімді: Zadarma, OnlinePBX, Asterisk/FreePBX және т.б. VibeVox шығыс транкті автоматты түрде жасайды.** | Corrected "transit" to "trunk" (technical term). |
| `billingPage.presetHours` | {{count}}h | **{{count}} сағ** | Use Kazakh abbreviation for "hours". |
| `billingPage.presetMinutes` | {{count}}m | **{{count}} мин** | Use Kazakh abbreviation for "minutes". |
| `billingPage.renewsOn` | кеңейтім {{date}} | **жаңарту {{date}}** | Better translation for "renewal". |
| `auth.register.agreementAnd` | Және | **және** | Use lowercase for conjunction "and" within a sentence. |
