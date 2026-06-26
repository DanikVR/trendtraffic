# LLM Review: Mongolian (mn)

**Model:** gemini-2.5-flash  
**Took:** 245.0s  
**Fixes proposed:** 116 (valid after placeholder-check: 116)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.sip` | SIP телефон | **SIP утас** | Translate 'телефония' as 'утас' (telephony system) not 'телефон' (phone). |
| `nav.home` | Гэр | **Нүүр хуудас** | Translate 'На главную' as 'Нүүр хуудас' (homepage) for UI navigation. |
| `common.open` | Нээлттэй | **Нээх** | Use verb 'Нээх' (to open) for a button, not adjective 'Нээлттэй' (open). |
| `common.edit` | Өөрчлөлт | **Өөрчлөх** | Use verb 'Өөрчлөх' (to change/edit) for a button, not noun 'Өөрчлөлт' (change). |
| `balance.label` | Тэнцвэр | **Үлдэгдэл** | Use 'Үлдэгдэл' for financial balance, not 'Тэнцвэр' (equilibrium). |
| `balance.openPlans` | Нээлттэй тариф ба баланс | **Тариф болон үлдэгдлийг нээх** | Use verb 'Нээх' (to open) and 'Үлдэгдэл' for balance. |
| `tier.trial` | Шүүх хурал | **Туршилтын хугацаа** | Fix 'trial_meaning': 'Шүүх хурал' (court trial) should be 'Туршилтын хугацаа' (trial period). |
| `tier.plus` | Нэмэлт | **Plus** | Preserve brand name 'Plus' exactly as specified. |
| `tier.standardYearly` | Жил бүр | **Yearly** | Preserve brand name 'Yearly' exactly as specified. |
| `moreSheet.sip.label` | SIP телефон | **SIP утас** | Translate 'телефония' as 'утас' (telephony system) not 'телефон' (phone). |
| `moreSheet.sip.sub` | Их бие суурилуулах | **Их бие тохируулах** | Translate 'настройка' as 'тохируулах' (configure) not 'суурилуулах' (install). |
| `rooms.tabs.questFlow` | Даалгаврын урсгал | **Quest Flow** | Preserve brand name 'Quest Flow' exactly as specified. |
| `rooms.tabs.vibeAdd` | ВибАдд | **VibeAdd** | Preserve brand name 'VibeAdd' exactly as specified. |
| `call.toPlayground` | 🎯 Хогийн цэг рүү | **🎯 Туршилтын талбай руу** | Fix 'wrong word sense': 'Хогийн цэг' (dump) should be 'Туршилтын талбай' (testing ground). |
| `call.more` | Нэмж дурдахад | **Дэлгэрэнгүй** | Translate 'Дополнительно' (More) as 'Дэлгэрэнгүй' for a menu item. |
| `call.cameraBlocked` | Камер эсвэл микрофоныг зөвшөөрөхгүй | **Камер эсвэл микрофоныг зөвшөөрөөгүй** | Use 'зөвшөөрөөгүй' (not allowed) for a passive state. |
| `coach.help` | Тусламжийн хариулт | **Хариулахад туслах** | Translate 'Помочь ответить' as 'Хариулахад туслах' (help to answer). |
| `coach.thinking` | Хиймэл оюун ухаан ... гэж боддог. | **Хиймэл оюун ухаан бодож байна...** | Use continuous tense 'бодож байна' (is thinking) for ongoing action. |
| `coach.pin` | Үүнийг зүү | **Зүүх** | Shorten button label to verb 'Зүүх' (to pin). |
| `roomActions.translation.disableSub` | Тэмдэглэлийг цаашид хасахгүй | **Минутыг цаашид хасахгүй** | Fix 'wrong word sense': 'Тэмдэглэл' (note) should be 'Минут' (minutes). |
| `partner.title` | Partner program | **Түншлэлийн хөтөлбөр** | Translate 'Партнёрская программа' into Mongolian. |
| `partner.subtitle` | Share your link and earn | **Холбоосоо хуваалцаж, орлого олоорой** | Translate 'Делитесь ссылкой и зарабатывайте' into Mongolian. |
| `partner.yourLink` | Your link | **Таны холбоос** | Translate 'Ваша ссылка' into Mongolian. |
| `partner.copy` | Copy | **Хуулбарлах** | Translate 'Скопировать' into Mongolian. |
| `partner.copied` | ✓ Link copied | **✓ Холбоосыг хуулсан** | Translate 'Ссылка скопирована' into Mongolian. |
| `partner.stats.clicks` | Clicks | **Даралтууд** | Translate 'Переходы' (clicks) into Mongolian. |
| `partner.stats.registrations` | Sign-ups | **Бүртгэлүүд** | Translate 'Регистрации' (registrations/sign-ups) into Mongolian. |
| `partner.stats.paid` | Payments | **Төлбөрүүд** | Translate 'Оплаты' (payments) into Mongolian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} хэрэглэгч · {{minutes}} мин** | Translate 'чел' (people) as 'хэрэглэгч' (users) and preserve 'мин'. |
| `partner.terms` | Program terms | **Хөтөлбөрийн нөхцөл** | Translate 'Условия сотрудничества' into Mongolian. |
| `partner.contact` | Contact us | **Холбоо барих** | Translate 'Связаться' into Mongolian. |
| `partner.termsModalTitle` | Partner program terms | **Түншлэлийн хөтөлбөрийн нөхцөл** | Translate 'Условия партнёрской программы' into Mongolian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Хөтөлбөрийн нөхцөл одоогоор тохируулагдаагүй байна. SuperAdmin-тай холбогдоно уу.** | Translate 'Условия программы пока не заполнены. Свяжитесь со SuperAdmin.' into Mongolian. |
| `partner.loadError` | Failed to load partner data | **Түншлэлийн өгөгдлийг ачаалж чадсангүй** | Translate 'Не удалось загрузить данные партнёрства' into Mongolian. |
| `toneMenu.generating` | Хиймэл оюун ухаан тайлбар үүсгэдэг ... | **Хиймэл оюун ухаан тайлбар үүсгэж байна...** | Use continuous tense 'үүсгэж байна' (is generating) for ongoing action. |
| `toneMenu.generationError` | Үеийн алдаа | **Үүсгэлтийн алдаа** | Translate 'Ошибка генерации' as 'Үүсгэлтийн алдаа' (generation error). |
| `sip.title` | SIP телефон | **SIP утас** | Translate 'телефония' as 'утас' (telephony system) not 'телефон' (phone). |
| `sip.trunkId` | Ачааны машины ID | **Их биений ID** | Fix 'wrong word sense': 'Ачааны машин' (truck) should be 'Их бие' (trunk). |
| `sip.incoming.show` | Шоу | **Харуулах** | Use verb 'Харуулах' (to show) for a button, not noun 'Шоу' (show/event). |
| `sip.toasts.saveFailed` | Тээврийн хэрэгслийг хадгалж чадсангүй | **Их биеийг хадгалж чадсангүй** | Fix 'wrong word sense': 'Тээврийн хэрэгсэл' (vehicle) should be 'Их бие' (trunk). |
| `sip.toasts.deleted` | Ачааны тээшийг устгасан. | **Их биеийг устгасан.** | Fix 'wrong word sense': 'Ачааны тээш' (cargo) should be 'Их бие' (trunk). |
| `sip.toasts.deleteFailed` | Транзитыг устгаж чадсангүй | **Их биеийг устгаж чадсангүй** | Fix 'wrong word sense': 'Транзит' (transit) should be 'Их бие' (trunk). |
| `sip.tenantOnly.hint1` | SIP телефоныг супер админ бүртгэлээр (түрээслэгчийн UUIDгүйгээр) тохируулах боломжгүй. | **SIP утсыг супер админ бүртгэлээр (түрээслэгчийн UUIDгүйгээр) тохируулах боломжгүй.** | Translate 'телефония' as 'утас' (telephony system) not 'телефон' (phone). |
| `sip.danger.deleteInboundHint` | LiveKit-н дотогшоо чиглэсэн шуудангийн болон илгээлтийн дүрмийг устгах болно. Ирж буй дуудлагыг цаашид хүлээн авахгүй. | **LiveKit-н дотогшоо чиглэсэн их бие болон илгээлтийн дүрмийг устгах болно. Ирж буй дуудлагыг цаашид хүлээн авахгүй.** | Fix 'wrong word sense': 'шуудангийн' (mail) should be 'их бие' (trunk). |
| `sip.outbound2.callButton` | Дуудлага | **Залгах** | Use verb 'Залгах' (to call) for a button, not noun 'Дуудлага' (call). |
| `sip.confirm.deleteInboundTitle` | Ирж буй хэрэглэгчийн SIP хаягийг устгах уу? | **Ирж буй SIP хаягийг устгах уу?** | Remove 'хэрэглэгчийн' (user's) as it's not in the source. |
| `sip.confirm.deleteInboundBody` | LiveKit Cloud дахь дотогшоо чиглэсэн урсгал болон илгээлтийн дүрмийг устгах болно. | **LiveKit Cloud дахь дотогшоо чиглэсэн их бие болон илгээлтийн дүрмийг устгах болно.** | Fix 'wrong word sense': 'урсгал' (flow) should be 'их бие' (trunk). |
| `enterprise.tabs.prompts` | Зөвлөгөө | **Промпт** | Translate 'Подсказки' (prompts) as 'Промпт' (transliteration) for technical term. |
| `enterprise.common.loadError` | Ачаалж буй алдаа | **Ачаалах алдаа** | Translate 'Ошибка загрузки' as 'Ачаалах алдаа' (load error). |
| `enterprise.common.show` | Шоу | **Харуулах** | Use verb 'Харуулах' (to show) for a button, not noun 'Шоу' (show/event). |
| `enterprise.apiKey.show` | Шоу | **Харуулах** | Use verb 'Харуулах' (to show) for a button, not noun 'Шоу' (show/event). |
| `enterprise.gemini.aiStudioLink` | Хиймэл оюун ухааны студи | **AI Studio** | Preserve brand name 'AI Studio' exactly as specified. |
| `enterprise.gemini.leadSuffix` | Таны бүртгэл дэх бүх Gemini дуудлагын хувьд дэлхийн дуудлагын оронд ашиглагдсан. | **-с. Таны бүртгэл дэх бүх Gemini дуудлагад дэлхийн түлхүүрийн оронд ашиглагдана.** | Improve grammar and flow with preceding 'AI Studio' and subsequent text. |
| `enterprise.gemini.telegram.leadCreatePart2` | мөн түүний тэмдгийг буулгана уу. | **мөн түүний токеныг буулгана уу.** | Fix 'wrong word sense': 'тэмдэг' (symbol) should be 'токен' (token). |
| `enterprise.gemini.telegram.leadStartCmd` | /эхлэх | **/start** | Preserve command '/start' exactly as specified. |
| `enterprise.gemini.telegram.testingLabel` | Дуулга… | **Илгээж байна…** | Fix 'wrong word sense': 'Дуулга' (helmet/inform) should be 'Илгээж байна' (sending). |
| `enterprise.gemini.telegram.lastBroadcast` | Хамгийн сүүлийн шуудан: {{total}}-с {{sent}}-д хүргэгдсэн | **Хамгийн сүүлийн илгээлт: {{total}}-с {{sent}}-д хүргэгдсэн** | Fix 'wrong word sense': 'шуудан' (mail) should be 'илгээлт' (broadcast/sending). |
| `enterprise.prompt.heading` | Зөвлөгөө | **Промпт** | Translate 'Подсказки' (prompts) as 'Промпт' (transliteration) for technical term. |
| `enterprise.prompt.subtitle` | Зөвхөн видео өрөөнд транскрипцийн шуурхай болон мэдлэгийн сан | **Зөвхөн видео өрөөнд транскрипцийн промпт болон мэдлэгийн сан** | Translate 'промпт' as 'Промпт' (transliteration) for technical term. |
| `enterprise.prompt.headerLeadBold2` | "Таны хүсэлтийн дагуу" | **"Таны промптын дагуу"** | Translate 'промпта' as 'промпт' (transliteration) for technical term. |
| `enterprise.prompt.contextHeading` | Контекст / promt | **Контекст / промпт** | Correct misspelling and use transliteration 'промпт'. |
| `enterprise.prompt.contextLeadBold` | "Таны хүсэлтийн дагуу" | **"Таны промптын дагуу"** | Translate 'промпта' as 'промпт' (transliteration) for technical term. |
| `enterprise.prompt.promptPlaceholder` | Таны урилга... | **Таны промпт...** | Fix 'wrong word sense': 'урилга' (invitation) should be 'промпт' (prompt). |
| `enterprise.prompt.successPromptSaved` | Сануулгыг хадгалсан. | **Промптыг хадгалсан.** | Fix 'wrong word sense': 'Сануулга' (reminder) should be 'Промпт' (prompt). |
| `enterprise.prompt.kbCharsSuffix` | тэмдэг | **тэмдэгт** | Translate 'символов' as 'тэмдэгт' (characters) not 'тэмдэг' (symbols). |
| `enterprise.prompt.presetsLeadBold` | "Таны хүсэлтийн дагуу" | **"Таны промптын дагуу"** | Translate 'промпта' as 'промпт' (transliteration) for technical term. |
| `enterprise.prompt.presetsLeadPart2` | дээрх талбараас таны хүлээх мөрийг ашигладаг. | **дээрх талбараас таны промптыг ашигладаг.** | Fix 'wrong word sense': 'хүлээх мөр' (waiting line) should be 'промпт' (prompt). |
| `enterprise.questFlow.heading` | Даалгаврын урсгал | **Quest Flow** | Preserve brand name 'Quest Flow' exactly as specified. |
| `enterprise.questFlow.warning` | Хэрэв талбар хоосон байвал ерөнхий VibeVox командыг ашиглана. | **Хэрэв талбар хоосон байвал ерөнхий VibeVox промптыг ашиглана.** | Fix 'wrong word sense': 'команд' (command) should be 'промпт' (prompt). |
| `enterprise.questFlow.promptLabel` | Quest Flow системийн хүсэлт | **Quest Flow системийн промпт** | Fix 'wrong word sense': 'хүсэлт' (request) should be 'промпт' (prompt). |
| `enterprise.questFlow.tagsLabel` | Шошго хэрэгтэй | **Хэрэгцээний шошго** | Improve grammar: 'Шошго хэрэгтэй' (tag needed) should be 'Хэрэгцээний шошго' (tags of needs). |
| `enterprise.questFlow.errDelete` | Delete error | **Устгах алдаа** | Translate 'Ошибка удаления' into Mongolian. |
| `enterprise.questFlow.errUpload` | Ачаалж буй алдаа | **Ачаалах алдаа** | Translate 'Ошибка загрузки' as 'Ачаалах алдаа' (load error). |
| `enterprise.questFlow.deleteTitle` | Delete | **Устгах** | Translate 'Удалить' into Mongolian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Түлхүүрийг устгах уу?** | Translate 'Удалить ключ?' into Mongolian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Түлхүүрийг буцаах боломжгүйгээр устгах болно. Quest Flow үүгээр дамжуулан ажиллахаа болино — та шинэ түлхүүр үүсгэж, урсгалд солих шаардлагатай болно.** | Translate 'Ключ будет удалён без возможности восстановить. Quest Flow перестанет работать через него — потребуется создать новый ключ и заменить в цепочке.' into Mongolian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Устгах** | Translate 'Удалить' into Mongolian. |
| `enterprise.questFlow.promptHeading` | Telegram яриаг асуух | **Telegram ярианы промпт** | Fix 'wrong word sense': 'асуух' (to ask) should be 'промпт' (prompt). |
| `enterprise.questFlow.promptLead3` | - үүнийг үндсэн мэдээлэл болон мэдлэгийн сантай хослуулна. | **- үүнийг үндсэн промпт болон мэдлэгийн сантай хослуулна.** | Fix 'wrong word sense': 'мэдээлэл' (information) should be 'промпт' (prompt). |
| `enterprise.questFlow.promptPlaceholder` | Таны урилга... | **Таны промпт...** | Fix 'wrong word sense': 'урилга' (invitation) should be 'промпт' (prompt). |
| `enterprise.questFlow.successPromptSaved` | Даалгаврын урсгалын хүсэлтийг хадгалсан. | **Quest Flow промптыг хадгалсан.** | Fix 'wrong word sense': 'хүсэлт' (request) should be 'промпт' (prompt) and preserve 'Quest Flow'. |
| `enterprise.questFlow.kbLead3` | "Зөвлөмж" хэсгээс—видео бичлэгийн хувьд. Хязгаар: 50 МБ файл / мэдээллийн санд 500,000 тэмдэгт. | **"Промпт" хэсгээс—видео бичлэгийн хувьд. Хязгаар: 50 МБ файл / мэдээллийн санд 500,000 тэмдэгт.** | Translate 'Подсказки' (prompts) as 'Промпт' (transliteration) for technical term. |
| `enterprise.questFlow.kbCharsSuffix` | тэмдэг | **тэмдэгт** | Translate 'символов' as 'тэмдэгт' (characters) not 'тэмдэг' (symbols). |
| `enterprise.questFlow.tagsHeading` | Шошго хэрэгтэй | **Хэрэгцээний шошго** | Improve grammar: 'Шошго хэрэгтэй' (tag needed) should be 'Хэрэгцээний шошго' (tags of needs). |
| `enterprise.questFlow.errLoad` | Ачаалж буй алдаа | **Ачаалах алдаа** | Translate 'Ошибка загрузки' as 'Ачаалах алдаа' (load error). |
| `enterprise.chatwoot.headerLead` | Харилцагчийн хэрэгцээний шошгыг Chatwoot CRM руу шилжүүлдэг | **Харилцан ярианы түүх болон харилцагчийн хэрэгцээний шошгыг Chatwoot CRM руу шилжүүлдэг** | Missing 'историю диалогов' (dialog history) from the source translation. |
| `enterprise.chatwoot.whatSentItem3Prefix` | Хэрэгцээний бүх оноогдсон шошго | **Хэрэгцээний бүх оноогдсон шошго дотор** | Missing 'в' (in) from the source translation. |
| `chat.loadError` | Ачаалж буй алдаа | **Ачаалах алдаа** | Translate 'Ошибка загрузки' as 'Ачаалах алдаа' (load error). |
| `chat.enterpriseOnlyHint` | Чат өрөөнүүд нь Байгууллагын онцлог юм. "Үнэ" хэсгээс төлөвлөгөөгөө шинэчилнэ үү. | **Чат өрөөнүүд нь Байгууллагын онцлог юм. "Тарифууд" хэсгээс төлөвлөгөөгөө шинэчилнэ үү.** | Fix 'wrong word sense': 'Үнэ' (price) should be 'Тарифууд' (tariffs). |
| `insights.summary` | Анкет | **Хураангуй** | Fix 'wrong word sense': 'Анкет' (questionnaire) should be 'Хураангуй' (summary). |
| `insights.sentiment` | Түлхүүр | **Сэтгэл хөдлөл** | Fix 'wrong word sense': 'Түлхүүр' (key) should be 'Сэтгэл хөдлөл' (sentiment). |
| `insights.analyzedReplies_one` | {{count}} хуулбарыг шинжилсэн | **{{count}} хариултыг шинжилсэн** | Fix 'wrong word sense': 'хуулбар' (copy) should be 'хариулт' (reply/utterance). |
| `insights.analyzedReplies_few` | {{count}} хуулбаруудыг шинжилсэн | **{{count}} хариултыг шинжилсэн** | Fix 'wrong word sense': 'хуулбар' (copy) should be 'хариулт' (reply/utterance). |
| `insights.analyzedReplies_many` | {{count}} хуулбаруудыг шинжилсэн | **{{count}} хариултыг шинжилсэн** | Fix 'wrong word sense': 'хуулбар' (copy) should be 'хариулт' (reply/utterance). |
| `insights.analyzedReplies_other` | {{count}} хуулбаруудыг шинжилсэн | **{{count}} хариултыг шинжилсэн** | Fix 'wrong word sense': 'хуулбар' (copy) should be 'хариулт' (reply/utterance). |
| `insights.thinking` | Хиймэл оюун ухаан харилцан яриаг шинжилдэг... | **Хиймэл оюун ухаан харилцан яриаг шинжилж байна...** | Use continuous tense 'шинжилж байна' (is analyzing) for ongoing action. |
| `lobby.andWord` | Мөн | **ба** | Use 'ба' for 'and' in a list, not 'Мөн' (also/and). |
| `paywall.buyPlus` | Дээрээс нь — сард 19 евро (60 минут) | **Plus — сард 19 евро (60 минут)** | Preserve brand name 'Plus' exactly as specified. |
| `paywall.subscribe` | Дизайн | **Захиалах** | Fix 'wrong word sense': 'Дизайн' (design) should be 'Захиалах' (subscribe). |
| `paywall.topupNoSubInfo` | Таны худалдан авалтад сард €19-өөр нэмэлт төлбөр нэмэгдэх бөгөөд таны төлөвлөгөөнд 60 минут багтсан тул нэмэлт төлбөр байхгүй. | **Таны худалдан авалтад сард €19-өөр Plus нэмэгдэх бөгөөд таны төлөвлөгөөнд 60 минут багтсан тул нэмэлт төлбөр байхгүй.** | Preserve brand name 'Plus' exactly as specified. |
| `paywall.topupPlusLine` | Нэмэлт тариф ({{count}} мин багтсан) | **Plus тариф ({{count}} мин багтсан)** | Preserve brand name 'Plus' exactly as specified. |
| `confirmModal.ok` | Зүгээр дээ | **ОК** | Use 'ОК' for 'OK' button, 'Зүгээр дээ' (it's okay) is less direct. |
| `postCallInsights.analyzing` | Ярилцлагыг шинжилж үзье... | **Ярилцлагыг шинжилж байна...** | Use continuous tense 'шинжилж байна' (analyzing) for ongoing action. |
| `postCallInsights.summary` | Анкет | **Хураангуй** | Fix 'wrong word sense': 'Анкет' (questionnaire) should be 'Хураангуй' (summary). |
| `billingPage.tierLabel` | Үнэлгээ | **Тариф** | Fix 'wrong word sense': 'Үнэлгээ' (rating) should be 'Тариф' (tariff). |
| `billingPage.resume` | Анкет | **Үргэлжлүүлэх** | Fix 'wrong word sense': 'Анкет' (questionnaire) should be 'Үргэлжлүүлэх' (resume). |
| `billingPage.resumeFailed` | Таны захиалгыг шинэчилж чадсангүй | **Таны захиалгыг сэргээж чадсангүй** | Translate 'возобновить' (resume) as 'сэргээх' (restore/resume) not 'шинэчлэх' (renew). |
| `billingPage.topupCarried` | Хойшлуулсан | **Шилжүүлсэн** | Fix 'wrong word sense': 'Хойшлуулсан' (postponed) should be 'Шилжүүлсэн' (carried over). |
| `billingPage.tierPlusName` | Нэмэлт | **Plus** | Preserve brand name 'Plus' exactly as specified. |
| `billingPage.tierStandardName` | Стандарт | **Standard** | Preserve brand name 'Standard' exactly as specified. |
| `billingPage.featureSip` | SIP телефон утас (орж ирж буй болон гарах) | **SIP утас (орж ирж буй болон гарах)** | Translate 'телефония' as 'утас' (telephony system) not 'телефон утас' (phone). |
| `billingPage.featurePersonalPrompts` | Хувийн хиймэл оюун ухааны өдөөлтүүд | **Хувийн хиймэл оюун ухааны промптууд** | Fix 'wrong word sense': 'өдөөлтүүд' (stimuli) should be 'промптууд' (prompts). |
| `billingPage.ctaSubscribePlus` | Нэмэлт авах | **Plus авах** | Preserve brand name 'Plus' exactly as specified. |
| `billingPage.faqA3` | хувийн тохиргоотой сануулга | **хувийн промпт** | Fix 'wrong word sense': 'сануулга' (reminder) should be 'промпт' (prompt). |
| `billingPage.presetHours` | {{count}}h | **{{count}}ц** | Use Mongolian abbreviation 'ц' for 'цаг' (hour) instead of 'h'. |
| `billingPage.renewsOn` | өргөтгөл {{date}} | **шинэчлэлт {{date}}** | Fix 'wrong word sense': 'өргөтгөл' (extension) should be 'шинэчлэлт' (renewal). |
