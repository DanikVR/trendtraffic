# LLM Review: Kyrgyz (ky)

**Model:** gemini-2.5-flash  
**Took:** 238.5s  
**Fixes proposed:** 130 (valid after placeholder-check: 122)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.home` | Үй | **Башкы бетке** | Translate "На главную" as "To home page". |
| `rooms.tabs.questFlow` | Тапшырма агымы | **Quest Flow** | Preserve brand name "Quest Flow". |
| `common.edit` | Өзгөрүү | **Өзгөртүү** | Use imperative verb for button label. |
| `balance.openPlans` | Ачык тарифтер жана баланс | **Тарифтерди жана балансты ачуу** | Correct grammar: use infinitive verb for "open". |
| `tier.trial` | Сыноо | **Сыноо мөөнөтү** | Clarify "Trial" as "trial period" in subscription context. |
| `sidebar.logoAria` | VibeVox — Башкы бет | **VibeVox — Башкы бетке** | Translate "на главную" as "to home page". |
| `call.geminiLive` | Эгиздер жашоосу | **Gemini Live** | Preserve product/feature name "Gemini Live". |
| `call.toPlayground` | 🎯 Таштанды төгүүчү жайга | **🎯 Машыгуу аянтчасына** | Translate "полигон" as "training ground" in AI context, not "landfill". |
| `call.sentToPlayground` | ✅ Бул сөз айкашы машыгуу аянтчасына жөнөтүлдү! | **✅ Сөз айкашы машыгуу аянтчасына жөнөтүлдү!** | Remove extra word "Бул" (This) not present in source. |
| `call.playgroundTip` | Жасалма интеллект машыгуу полигонуна сөз айкашын жөнөтүңүз | **Жасалма интеллект машыгуу аянтчасына сөз айкашын жөнөтүңүз** | Use "аянтчасына" (ground) instead of "полигонуна" (polygon/range) for "training ground". |
| `call.more` | Мындан тышкары | **Кошумча** | Translate "Дополнительно" as "Additional" for menu item. |
| `coach.help` | Жардам жооп | **Жооп берүүгө жардам берүү** | Correct grammar: use infinitive verb for "answer". |
| `roomActions.translation.disableSub` | Протоколдор мындан ары эсептен чыгарылбайт | **Мүнөттөр мындан ары эсептен чыгарылбайт** | Translate "минуты" (time unit) as "мүнөттөр", not "протоколдор" (meeting minutes). |
| `settings.themeDarkSub` | Абисс Аврора (Караңгы) | **Abyss Aurora (Караңгы)** | Preserve brand name "Abyss Aurora". |
| `settings.themeLightSub` | Булут Аврора (Жарык) | **Cloud Aurora (Жарык)** | Preserve brand name "Cloud Aurora". |
| `partner.title` | Partner program | **Өнөктөштүк программасы** | Translate "Партнёрская программа" into Kyrgyz. |
| `partner.subtitle` | Share your link and earn | **Шилтемеңизди бөлүшүңүз жана киреше табыңыз** | Translate "Делитесь ссылкой и зарабатывайте" into Kyrgyz. |
| `partner.yourLink` | Your link | **Сиздин шилтемеңиз** | Translate "Ваша ссылка" into Kyrgyz. |
| `partner.copy` | Copy | **Көчүрүү** | Translate "Скопировать" into Kyrgyz. |
| `partner.copied` | ✓ Link copied | **✓ Шилтеме көчүрүлдү** | Translate "Ссылка скопирована" into Kyrgyz. |
| `partner.stats.clicks` | Clicks | **Өтүүлөр** | Translate "Переходы" into Kyrgyz. |
| `partner.stats.registrations` | Sign-ups | **Каттоолор** | Translate "Регистрации" into Kyrgyz. |
| `partner.stats.paid` | Payments | **Төлөмдөр** | Translate "Оплаты" into Kyrgyz. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} адам · {{minutes}} мүн** | Translate "чел" (people) and "мин" (minutes) into Kyrgyz. |
| `partner.terms` | Program terms | **Кызматташуу шарттары** | Translate "Условия сотрудничества" into Kyrgyz. |
| `partner.contact` | Contact us | **Байланышуу** | Translate "Связаться" into Kyrgyz. |
| `partner.termsModalTitle` | Partner program terms | **Өнөктөштүк программасынын шарттары** | Translate "Условия партнёрской программы" into Kyrgyz. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Программанын шарттары азырынча толтурулган эмес. SuperAdmin менен байланышыңыз.** | Translate into Kyrgyz. |
| `partner.loadError` | Failed to load partner data | **Өнөктөштүк маалыматтарын жүктөө ишке ашкан жок** | Translate into Kyrgyz. |
| `toneMenu.explainIn` | Үн менен түшүндүрүңүз | **Тон менен түшүндүрүңүз** | Use "тон" (tone) instead of "үн" (voice/sound). |
| `toneMenu.generationError` | Муун түзүү катасы | **Түзүү катасы** | Translate "генерации" (creation) as "түзүү", not "муун" (generation/syllable). |
| `sip.subtitle` | Кирүүчү жана чыгуучу чалуулар үчүн транзиттик линияларды орнотуу | **Кирүүчү жана чыгуучу чалуулар үчүн транктарды орнотуу** | Use common loanword "транктарды" for "trunks" for brevity and clarity. |
| `sip.newTrunk` | Жаңы SIP магистралы | **Жаңы SIP транк** | Use "транк" for "trunk" instead of "магистралы". |
| `sip.editTrunk` | Багажниктин жөндөөлөрүн өзгөртүү | **Транктын жөндөөлөрүн өзгөртүү** | Translate "транка" (SIP trunk) as "транктын", not "багажниктин" (car boot). |
| `sip.trunkId` | Багажниктин IDси | **Транктын IDси** | Translate "транка" (SIP trunk) as "транктын", not "багажниктин" (car boot). |
| `sip.createTrunk` | Тумба түзүү | **Транк түзүү** | Translate "транк" (SIP trunk) as "транк", not "тумба" (pedestal). |
| `sip.incoming.pausedHint` | VibeVox кирүүчү чалууларды багыттоону баштоо үчүн кабыл алууну иштетиңиз. | **VibeVox кирүүчү чалууларды которууну баштоо үчүн кабыл алууну иштетиңиз.** | Translate "переводить" (to translate) as "которууну", not "багыттоону" (to redirect). |
| `sip.incoming.show` | Шоу | **Көрсөтүү** | Translate "Показать" as "Көрсөтүү" (to show), not "Шоу" (performance). |
| `sip.outbound.lead` | Веб-интерфейстен телефон номерине чалыңыз, ошондо VibeVox сүйлөшүүңүздү автоматтык түрдө реалдуу убакыт режиминде өткөрүп берет. | **Веб-интерфейстен телефон номерине чалыңыз, ошондо VibeVox сүйлөшүүңүздү автоматтык түрдө реалдуу убакыт режиминде которот.** | Translate "переведёт" (will translate) as "которот", not "өткөрүп берет" (will transfer). |
| `sip.outbound.noTrunkTitle` | Алгач, чыгуучу SIP магистралын орнотуңуз | **Алгач, чыгуучу SIP транк орнотуңуз** | Use "транк" for "trunk" instead of "магистралын". |
| `sip.outbound.noTrunkHint` | Барактын жогору жагындагы "Жаңы SIP Trunk" формасын толтуруңуз - VibeVox чыгуучу чалуулар үчүн сиздин SIP провайдериңизди (Zadarma, OnlinePBX ж.б.) колдонот. | **Барактын жогору жагындагы "Жаңы SIP транк" формасын толтуруңуз - VibeVox чыгуучу чалуулар үчүн сиздин SIP провайдериңизди (Zadarma, OnlinePBX ж.б.) колдонот.** | Use "транк" for "Trunk" for consistency. |
| `sip.outbound.configureFirst` | Алгач, чыгуучу SIP магистралын орнотуңуз (жогорку форма) | **Алгач, чыгуучу SIP транк орнотуңуз (жогорку форма)** | Use "транк" for "trunk" instead of "магистралын". |
| `sip.howTo.step1` | Провайдериңизден (Zadarma, OnlinePBX, Asterisk) SIP магистралдык маалыматын алыңыз. | **Провайдериңизден (Zadarma, OnlinePBX, Asterisk) SIP транк маалыматын алыңыз.** | Use "транк" for "trunk" instead of "магистралдык". |
| `sip.howTo.step3` | VibeVox LiveKit Cloud'до чыгуучу SIP траншын автоматтык түрдө түзөт. | **VibeVox LiveKit Cloud'до чыгуучу SIP транкын автоматтык түрдө түзөт.** | Translate "транк" (SIP trunk) as "транкын", not "траншын" (tranche). |
| `sip.toasts.saved` | SIP магистралдык жөндөөлөрү сакталды | **SIP транк жөндөөлөрү сакталды** | Use "транк" for "trunk" instead of "магистралдык". |
| `sip.toasts.saveFailed` | Жүк ташуучу унаа сакталган жок | **Транк сакталган жок** | Translate "транк" (SIP trunk) as "транк", not "жүк ташуучу унаа" (truck). |
| `sip.toasts.deleted` | Багажник өчүрүлдү. | **Транк өчүрүлдү.** | Translate "транк" (SIP trunk) as "транк", not "багажник" (car boot). |
| `sip.toasts.deleteFailed` | Түйүн өчүрүлгөн жок | **Транк өчүрүлгөн жок** | Translate "транк" (SIP trunk) as "транк", not "түйүн" (knot/node). |
| `sip.tenantOnly.title` | SIP магистралдары ижарачынын деңгээлинде конфигурацияланган | **SIP транктары ижарачынын деңгээлинде конфигурацияланган** | Use "транктары" for "trunks" instead of "магистралдары". |
| `sip.tenantOnly.hint2` | Трубка түзүү үчүн өзүнүн tenantId'и бар кадимки колдонуучу катары кириңиз. | **Транк түзүү үчүн өзүнүн tenantId'и бар кадимки колдонуучу катары кириңиз.** | Translate "транк" (SIP trunk) as "транк", not "трубка" (handset). |
| `sip.connected` | SIP трассасы сакталып, LiveKit менен синхрондоштурулат | **SIP транк сакталып, LiveKit менен синхрондоштурулат** | Translate "транк" (SIP trunk) as "транк", not "трассасы" (route). |
| `sip.danger.deleteTrunk` | Түйүндү өчүрүү | **Транкты өчүрүү** | Translate "транк" (SIP trunk) as "транкты", not "түйүндү" (knot/node). |
| `sip.danger.deleteTrunkHint` | Конфигурация өчүрүлөт. Транзитти кайра түзгөнгө чейин чыгуучу чалуулар токтотулат. | **Конфигурация өчүрүлөт. Транкты кайра түзгөнгө чейин чыгуучу чалуулар токтотулат.** | Translate "транк" (SIP trunk) as "транкты", not "транзитти" (transit). |
| `sip.danger.deleteInboundHint` | LiveKitтин кирүүчү магистралдык жана жөнөтүү эрежеси алынып салынат. Кирүүчү чалуулар мындан ары кабыл алынбайт. | **LiveKitтин кирүүчү транкы жана жөнөтүү эрежеси алынып салынат. Кирүүчү чалуулар мындан ары кабыл алынбайт.** | Use "транкы" for "trunk" instead of "магистралдык". |
| `sip.confirm.deleteTrunkTitle` | SIP траншын жок кылынсынбы? | **SIP транкын жок кылынсынбы?** | Translate "транк" (SIP trunk) as "транкын", not "траншын" (tranche). |
| `sip.confirm.deleteTrunkBody` | Бул аракет кайтарылгыс. Өчүрүлгөндөн кийин, чыгуучу чалуулар жаңы магистралдык түзүлмөйүнчө токтотулат. | **Бул аракет кайтарылгыс. Өчүрүлгөндөн кийин, чыгуучу чалуулар жаңы транк түзүлмөйүнчө токтотулат.** | Use "транк" for "trunk" instead of "магистралдык". |
| `sip.confirm.deleteInboundBody` | Бул аракет кайтарылгыс. LiveKit Cloud'тагы кирүүчү магистралдык жана жөнөтүү эрежеси өчүрүлөт. | **Бул аракет кайтарылгыс. LiveKit Cloud'тагы кирүүчү транк жана жөнөтүү эрежеси өчүрүлөт.** | Use "транк" for "trunk" instead of "магистралдык". |
| `enterprise.tabs.questFlow` | Тапшырма агымы | **Quest Flow** | Preserve brand name "Quest Flow". |
| `enterprise.common.show` | Шоу | **Көрсөтүү** | Translate "Показать" as "Көрсөтүү" (to show), not "Шоу" (performance). |
| `enterprise.apiKey.show` | Шоу | **Көрсөтүү** | Translate "Показать" as "Көрсөтүү" (to show), not "Шоу" (performance). |
| `enterprise.gemini.aiStudioLink` | Жасалма интеллект студиясы | **AI Studio** | Preserve brand name "AI Studio". |
| `enterprise.gemini.telegram.leadCreatePart1` | Ботту бул жерден түзүңүз | **Ботту @BotFather'дан түзүңүз** | Translate "у" (at/with) more accurately in context of @BotFather. |
| `enterprise.gemini.telegram.leadStartCmd` | /баштоо | **/start** | Preserve command "/start" as it is. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ @{{username}} боту сакталды. Ага /start деп SMS жазган ар бир адам эскертмелерди алат. | **✓ @{{username}} боту сакталды. Ага /start деп жазган ар бир адам эскертмелерди алат.** | Preserve command "/start" and remove "SMS жазган" (wrote SMS). |
| `enterprise.gemini.telegram.testingLabel` | Туулга… | **Жөнөтүлүүдө…** | Translate "Шлём" (Sending) as "Жөнөтүлүүдө", not "Туулга" (helmet). |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Боону чечүү | **Ажыратуу** | Translate "Отвязать" (unlink) as "Ажыратуу", not "Боону чечүү" (untie a strap). |
| `enterprise.gemini.telegram.lastBroadcast` | Акыркы почта: {{total}} аркылуу {{sent}} жеткирилди | **Акыркы жөнөтүү: {{total}} ичинен {{sent}} жеткирилди** | Translate "рассылка" as "жөнөтүү" (sending) and correct "из" (out of). |
| `enterprise.prompt.subtitle` | Видео бөлмөлөрдө гана транскрипциялоо үчүн тез жана билим базасы | **Видео бөлмөлөрдө гана транскрипциялоо үчүн промпт жана билим базасы** | Preserve "промпт" as a loanword, "тез" (fast) is incorrect. |
| `enterprise.prompt.promptLabel` | Системалык суроо (тон, стиль, сөздүк) | **Системалык промпт (тон, стиль, сөздүк)** | Preserve "промпт" as a loanword, "суроо" (question) is incorrect. |
| `enterprise.prompt.savePrompt` | Сурамды сактоо | **Промптту сактоо** | Preserve "промпт" as a loanword, "сурам" (request) is incorrect. |
| `enterprise.prompt.defaultLabel` | VibeVox демейки суроосу | **VibeVox демейки промпту** | Preserve "промпт" as a loanword, "суроосу" (question) is incorrect. |
| `enterprise.prompt.headerLeadPart2` | - чаттагы билдирүүнү чыкылдатып, обонду тандаганда | **- чаттагы билдирүүнү чыкылдатып, тонду тандаганда** | Use "тон" (tone) instead of "обон" (melody/tune). |
| `enterprise.prompt.headerLeadBold2` | "Сиздин өтүнүчүңүз боюнча" | **"Сиздин промптуңуз боюнча"** | Preserve "промпт" as a loanword, "өтүнүчүңүз" (request) is incorrect. |
| `enterprise.prompt.contextHeading` | Контекст / сунуш | **Контекст / промпт** | Preserve "промпт" as a loanword, "сунуш" (suggestion) is incorrect. |
| `enterprise.prompt.contextLeadPart1` | Видео бөлмөдөгү баарлашууда билдирүүнү чыкылдатып, обонду тандаганда колдонулат | **Видео бөлмөдөгү баарлашууда билдирүүнү чыкылдатып, тонду тандаганда колдонулат** | Use "тон" (tone) instead of "обон" (melody/tune). |
| `enterprise.prompt.contextLeadBold` | "Сиздин өтүнүчүңүз боюнча" | **"Сиздин промптуңуз боюнча"** | Preserve "промпт" as a loanword, "өтүнүчүңүз" (request) is incorrect. |
| `enterprise.prompt.extendNoteText` | өздөрүнүн эрежелери/стили/терминологиясы менен - алар жогорудагы демейки суроо жана билим базасы менен айкалыштырылат. | **өздөрүнүн эрежелери/стили/терминологиясы менен - алар жогорудагы демейки промпт жана билим базасы менен айкалыштырылат.** | Preserve "промпт" as a loanword, "суроо" (question) is incorrect. |
| `enterprise.prompt.promptPlaceholder` | Сиздин сунушуңуз... | **Сиздин промптуңуз...** | Preserve "промпт" as a loanword, "сунушуңуз" (suggestion) is incorrect. |
| `enterprise.prompt.savePromptLabel` | Сурамды сактоо | **Промптту сактоо** | Preserve "промпт" as a loanword, "сурамды" (request) is incorrect. |
| `enterprise.prompt.successPromptSaved` | Сурам сакталды. | **Промпт сакталды.** | Preserve "промпт" as a loanword, "сурам" (request) is incorrect. |
| `enterprise.prompt.presetsLeadPart1` | "Ишкана бөлмөсүнүн" чатында сиз каалаган билдирүүнү белгилеп, жасалма интеллекттен аны тандалган үн менен түшүндүрүп берүүсүн сурансаңыз болот. Баскыч | **"Ишкана бөлмөсүнүн" чатында сиз каалаган билдирүүнү белгилеп, жасалма интеллекттен аны тандалган тон менен түшүндүрүп берүүсүн сурансаңыз болот. Баскыч** | Use "тон" (tone) instead of "үн" (voice/sound). |
| `enterprise.prompt.presetsLeadBold` | "Сиздин өтүнүчүңүз боюнча" | **"Сиздин промптуңуз боюнча"** | Preserve "промпт" as a loanword, "өтүнүчүңүз" (request) is incorrect. |
| `enterprise.prompt.presetsLeadPart2` | жогорудагы талаадан сиздин сунушуңузду колдонот. | **жогорудагы талаадан сиздин промптуңузду колдонот.** | Preserve "промпт" as a loanword, "сунушуңузду" (suggestion) is incorrect. |
| `enterprise.questFlow.heading` | Тапшырма агымы | **Quest Flow** | Preserve brand name "Quest Flow". |
| `enterprise.questFlow.warning` | Эгерде талаа бош болсо, анда жалпы VibeVox суроосу колдонулат. | **Эгерде талаа бош болсо, анда жалпы VibeVox промпту колдонулат.** | Preserve "промпт" as a loanword, "суроосу" (question) is incorrect. |
| `enterprise.questFlow.promptLabel` | Тапшырма агымынын системасынын сурамы | **Quest Flow системасынын промпту** | Preserve "Quest Flow" and "промпт" as loanwords, "сурамы" (request) is incorrect. |
| `enterprise.questFlow.kbLabel` | Тапшырма агымынын билим базасы | **Quest Flow билим базасы** | Preserve brand name "Quest Flow". |
| `enterprise.questFlow.tagsLabel` | Тегдер керек | **Муктаждыктардын тегдери** | Translate "потребностей" (of needs) as "муктаждыктардын", not "керек" (needed). |
| `enterprise.questFlow.savePrompt` | Сурамды сактоо | **Промптту сактоо** | Preserve "промпт" as a loanword, "сурамды" (request) is incorrect. |
| `enterprise.questFlow.keyLabelPlaceholder` | Энбелги (милдеттүү эмес), мисалы: "Prod bot clinic" | **Энбелги (милдеттүү эмес), мисалы: "Клиниканын прод боту"** | Translate example text "Прод бот клиники" into Kyrgyz. |
| `enterprise.questFlow.errDelete` | Delete error | **Өчүрүү катасы** | Translate "Ошибка удаления" into Kyrgyz. |
| `enterprise.questFlow.deleteTitle` | Delete | **Өчүрүү** | Translate "Удалить" into Kyrgyz. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Ачкычты жок кылуу керекпи?** | Translate "Удалить ключ?" into Kyrgyz. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Ачкыч кайтарылгыс түрдө жок кылынат. Quest Flow ал аркылуу иштебей калат — жаңы ачкыч түзүп, аны чынжырда алмаштыруу талап кылынат.** | Translate into Kyrgyz and preserve brand name "Quest Flow". |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Өчүрүү** | Translate "Удалить" into Kyrgyz. |
| `enterprise.questFlow.promptHeading` | Telegram баарлашуулары үчүн суроо | **Telegram баарлашуулары үчүн промпт** | Preserve "промпт" as a loanword, "суроо" (question) is incorrect. |
| `enterprise.questFlow.promptLead2` | — жалпы VibeVox көрсөтмөсү колдонулат (төмөндө). | **— жалпы VibeVox промпту колдонулат (төмөндө).** | Preserve "промпт" as a loanword, "көрсөтмөсү" (instruction) is less precise. |
| `enterprise.questFlow.promptLead3` | - ал негизги тапшырма жана билим базасы менен айкалыштырылат. | **- ал негизги промпт жана билим базасы менен айкалыштырылат.** | Preserve "промпт" as a loanword, "тапшырма" (task) is incorrect. |
| `enterprise.questFlow.promptPlaceholder` | Сиздин сунушуңуз... | **Сиздин промптуңуз...** | Preserve "промпт" as a loanword, "сунушуңуз" (suggestion) is incorrect. |
| `enterprise.questFlow.successPromptSaved` | "Тапшырма агымы" сурамы сакталды. | **Quest Flow промпту сакталды.** | Preserve "Quest Flow" and "промпт" as loanwords, "сурамы" (request) is incorrect. |
| `enterprise.questFlow.kbHeading` | Тапшырма агымы үчүн билим базасы | **Quest Flow үчүн билим базасы** | Preserve brand name "Quest Flow". |
| `enterprise.questFlow.tagsHeading` | Тегдер керек | **Муктаждыктардын тегдери** | Translate "потребностей" (of needs) as "муктаждыктардын", not "керек" (needed). |
| `insights.sentiment` | Ачкыч | **Тон** | Translate "Тональность" (tonality) as "Тон", not "Ачкыч" (key). |
| `insights.engagement` | Кызыктуу | **Катышуу** | Translate "Вовлечённость" (engagement) as "Катышуу", not "Кызыктуу" (interesting). |
| `insights.leadScore` | Лидерлик упай | **Lead Score** | Preserve "Lead Score" as a sales term or translate accurately. |
| `lobby.connect` | Байланыш | **Туташуу** | Translate "Подключиться" (to connect) as "Туташуу" (verb), not "Байланыш" (noun). |
| `paywall.buyPlus` | Кошумча — айына 19 евро (60 мүнөт) | **Plus — айына €19 (60 мүнөт)** | Preserve brand name "Plus". |
| `paywall.subscribe` | Дизайн | **Жазылуу** | Translate "Оформить" (subscribe) as "Жазылуу", not "Дизайн" (design). |
| `postCallInsights.subtitle` | Ишкана · чалуудан кийинки статистика | **Ишкана · чалуудан кийинки аналитика** | Translate "insights" as "аналитика" (analytics), not "статистика" (statistics). |
| `postCallInsights.analyzing` | Келгиле, сүйлөшүүнү талдап көрөлү... | **Сүйлөшүүнү талдап жатабыз...** | Translate "Анализируем" (We are analyzing) directly, without "Келгиле" (Let's). |
| `postCallInsights.metricEngagement` | Кызыктуу | **Катышуу** | Translate "Вовлечённость" (engagement) as "Катышуу", not "Кызыктуу" (interesting). |
| `postCallInsights.metricLeadScore` | Лидерлердин упайы | **Lead Score** | Preserve "Lead Score" as a sales term or translate accurately. |
| `billingPage.tierLabel` | Баалоо | **Тариф** | Translate "Тариф" (tariff/plan) as "Тариф", not "Баалоо" (evaluation). |
| `billingPage.resume` | Резюме | **Улантуу** | Translate "Возобновить" (to resume/renew) as "Улантуу", not "Резюме" (summary). |
| `billingPage.featureHd` | HD котормо үндөр (Аоэде, Чарон, Корея) | **HD котормо үндөр (Aoede, Charon, Kore)** | Preserve brand names "Aoede, Charon, Kore". |
| `billingPage.featurePersonalPrompts` | Жеке жасалма интеллект боюнча көрсөтмөлөр | **Жеке жасалма интеллект промпттары** | Preserve "промпты" as a loanword, "көрсөтмөлөр" (instructions) is less precise. |
| `billingPage.ctaContact` | Байланыш | **Байланышуу** | Translate "Связаться" (to contact) as "Байланышуу" (verb), not "Байланыш" (noun). |
| `billingPage.faqA3` | Толук жасалма интеллект стек: автоматтык түрдө таанылуучу кардарлардын карталары, Telegram авторизациясы, жекелештирилген сурамдар, Google календары, акылдуу муктаждыктар тегдөөсү, CRM экспорту, questflow.pro менен интеграция жана өзүнчө администратор өтмөгү. | **Толук жасалма интеллект стек: автоматтык түрдө таанылуучу кардарлардын карталары, Telegram авторизациясы, жекелештирилген промпттар, Google календары, акылдуу муктаждыктар тегдөөсү, CRM экспорту, questflow.pro менен интеграция жана өзүнчө администратор өтмөгү.** | Preserve "промпты" as a loanword, "сурамдар" (requests) is incorrect. |
| `billingPage.faqA4` | RFC талаптарына жооп берген каалаган нерсе: Zadarma, OnlinePBX, Asterisk/FreePBX ж.б. VibeVox чыгуучу транзитти автоматтык түрдө түзөт. | **RFC талаптарына жооп берген каалаган нерсе: Zadarma, OnlinePBX, Asterisk/FreePBX ж.б. VibeVox чыгуучу транкты автоматтык түрдө түзөт.** | Translate "trunk" as "транкты", not "транзитти" (transit). |
| `billingPage.presetHours` | {{count}}h | **{{count}}с** | Use Kyrgyz abbreviation "с" for "саат" (hours). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}мүн** | Use Kyrgyz abbreviation "мүн" for "мүнөт" (minutes). |
| `billingPage.renewsOn` | кеңейтүү {{date}} | **жаңыртуу {{date}}** | Translate "продление" (renewal) as "жаңыртуу", not "кеңейтүү" (extension). |

⚠ 8 fix(es) skipped (no-op, missing path, or would break placeholders).
