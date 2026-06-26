# LLM Review: Serbian (sr)

**Model:** gemini-2.5-flash  
**Took:** 344.4s  
**Fixes proposed:** 217 (valid after placeholder-check: 210)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `appName` | ВајбВокс | **VibeVox** | Brand name must be preserved exactly. |
| `nav.rooms` | Соби | **Собе** | Nominative plural for 'rooms' is 'собе'. |
| `nav.enterpriseSettings` | Подешавања предузећа | **Подешавања Enterprise** | Brand name 'Enterprise' must be preserved. |
| `nav.home` | Дом | **Почетна** | Better translation for 'Home' (as a navigation item). |
| `rooms.participants` | учесници | **учесника** | Genitive plural 'учесника' is correct for 'X participants'. |
| `rooms.actions.open` | Пријава | **Уђи** | Imperative 'Уђи' (Enter/Join) is better for a button than noun 'Пријава' (Login). |
| `common.open` | Отворено | **Отвори** | Imperative 'Отвори' (Open) is better for a button than adjective 'Отворено'. |
| `common.edit` | Промена | **Измени** | Imperative 'Измени' (Edit) is better for a button than noun 'Промена' (Change). |
| `common.success` | Спреман | **Готово** | Neutral adjective 'Готово' (Done) matches source better than masculine 'Спреман'. |
| `balance.minutes_one` | {{count}} минут | **{{count}} минута** | Correct singular form for 'минута'. |
| `balance.minutes_few` | {{count}} минута | **{{count}} минуте** | Correct plural form for 2-4 minutes. |
| `balance.openPlans` | Отворене тарифе и стање | **Отвори тарифе и стање** | Imperative 'Отвори' (Open) is better for a button. |
| `tier.plus` | Плус | **Plus** | Brand name must be preserved exactly. |
| `tier.standard` | Стандардно | **Standard** | Brand name must be preserved exactly. |
| `tier.standardYearly` | Годишње | **Yearly** | Brand name must be preserved exactly. |
| `tier.enterprise` | Предузеће | **Enterprise** | Brand name 'Enterprise' must be preserved. |
| `settings.themeDarkSub` | Бездан Ауроре (тамно) | **Abyss Aurora (тамно)** | Brand name 'Abyss Aurora' must be preserved. |
| `settings.themeLightSub` | Облачна аурора (светло) | **Cloud Aurora (светло)** | Brand name 'Cloud Aurora' must be preserved. |
| `partner.title` | Partner program | **Партнерски програм** | Translate English string to Serbian. |
| `partner.subtitle` | Share your link and earn | **Поделите свој линк и зарадите** | Translate English string to Serbian. |
| `partner.yourLink` | Your link | **Ваш линк** | Translate English string to Serbian. |
| `partner.copy` | Copy | **Копирај** | Translate English string to Serbian. |
| `partner.copied` | ✓ Link copied | **✓ Линк копиран** | Translate English string to Serbian. |
| `partner.stats.clicks` | Clicks | **Кликови** | Translate English string to Serbian. |
| `partner.stats.registrations` | Sign-ups | **Регистрације** | Translate English string to Serbian. |
| `partner.stats.paid` | Payments | **Уплате** | Translate English string to Serbian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} корисника · {{minutes}} мин** | Translate English words to Serbian. |
| `partner.terms` | Program terms | **Услови програма** | Translate English string to Serbian. |
| `partner.contact` | Contact us | **Контактирајте нас** | Translate English string to Serbian. |
| `partner.termsModalTitle` | Partner program terms | **Услови партнерског програма** | Translate English string to Serbian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Услови програма још нису постављени. Молимо контактирајте SuperAdmin-а.** | Translate English string to Serbian. |
| `partner.loadError` | Failed to load partner data | **Није успело учитавање партнерских података** | Translate English string to Serbian. |
| `moreSheet.sip.sub` | Постављање пртљажника | **Подешавање транкова** | 'пртљажника' is incorrect, 'транкова' (trunks) is the correct technical term. |
| `moreSheet.enterprise.label` | Подешавања предузећа | **Подешавања Enterprise** | Brand name 'Enterprise' must be preserved. |
| `moreSheet.enterprise.sub` | Близанци кључ, Квест ток, ознаке, ЦРМ | **Gemini кључ, Quest Flow, ознаке, CRM** | Brand names 'Gemini', 'Quest Flow', 'CRM' must be preserved. |
| `call.you` | Ти | **Ви** | Use formal 'Ви' instead of informal 'Ти' in UI context. |
| `call.geminiLive` | Близанци уживо | **Gemini Live** | Brand name 'Gemini' must be preserved. |
| `call.toPlayground` | 🎯 На депонију | **🎯 На полигон** | 'депонију' (landfill) is incorrect, 'полигон' (proving ground) is correct. |
| `call.validating` | Тестирање безбедне везе са VibeVox-ом… | **Провера безбедне везе са VibeVox-ом…** | 'Провера' (checking) is more accurate than 'Тестирање' (testing). |
| `coach.copy` | Копија | **Копирај** | Imperative 'Копирај' (Copy) is better for a button than noun 'Копија'. |
| `coach.tones.short` | Кратак | **Кратко** | Adverb 'Кратко' (Shortly) is more appropriate for a tone than masculine adjective 'Кратак'. |
| `coach.tones.empathic` | Емпатичан | **Емпатично** | Adverb 'Емпатично' (Empathically) is more appropriate for a tone than masculine adjective 'Емпатичан'. |
| `roomActions.translation.disableSub` | Записи се више неће брисати | **Минути се више неће наплаћивати** | 'Записи' (records) and 'брисати' (delete) are incorrect. Should refer to 'minutes' being 'charged'. |
| `billing.topupCta` | Минути · €{{price}} | **Минута · €{{price}}** | Genitive plural 'Минута' is correct when referring to a quantity of minutes. |
| `rooms.tabs.questFlow` | Ток задатака | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `sip.subtitle` | Подешавање канала за долазне и одлазне позиве | **Подешавање транкова за долазне и одлазне позиве** | 'канала' (channels) is incorrect, 'транкова' (trunks) is the correct technical term. |
| `sip.newTrunk` | Нови СИП транк | **Нови SIP транк** | Brand name 'SIP' must be preserved in Latin script. |
| `sip.editTrunk` | Промени подешавања пртљажника | **Промени подешавања транка** | 'пртљажника' is incorrect, 'транка' (trunk) is the correct technical term. |
| `sip.loginLabel` | Корисничко име (SIP пријава) | **Корисничко име (SIP login)** | Technical term 'login' must be preserved. |
| `sip.loginShort` | Пријава | **Login** | Technical term 'Login' must be preserved. |
| `sip.transport` | Превоз | **Транспорт** | 'Транспорт' is the correct technical term for 'transport' in this context. |
| `sip.trunkId` | ИД пртљажника | **ID транка** | 'пртљажника' is incorrect, 'транка' (trunk) is the correct technical term. |
| `sip.callerIdLabel` | ИД позиваоца (опционо) | **Caller ID (опционо)** | Technical term 'Caller ID' must be preserved. |
| `sip.savingShort` | Чување… | **Чувамо...** | Use verb 'Чувамо' (We are saving) instead of noun 'Чување' (Saving). |
| `sip.createTrunk` | Направите пртљажник | **Направите транк** | 'пртљажник' is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.deletingShort` | Брисање… | **Бришемо...** | Use verb 'Бришемо' (We are deleting) instead of noun 'Брисање' (Deleting). |
| `sip.incoming.emptyHint` | Направите јединствени SIP URI + корисничко име/лозинку како би вас клијенти могли позвати са било ког телефона, а VibeVox ће аутоматски превести ваш глас у реалном времену. | **Направите јединствени SIP URI + login/лозинку како би вас клијенти могли позвати са било ког телефона, а VibeVox ће аутоматски превести ваш глас у реалном времену.** | Technical term 'login' must be preserved. |
| `sip.incoming.activeHint` | Преводилац Bridge слуша ситуацију у просторији. Сваки позив се преводи у реалном времену. | **Bridge преводилац слуша собу. Сваки позив се преводи у реалном времену.** | Brand name 'Bridge' must be preserved. 'ситуацију у просторији' is too literal, 'собу' is more direct. |
| `sip.incoming.pausedHint` | Активирајте пријем да би VibeVox почео да преусмерава долазне позиве. | **Активирајте пријем да би VibeVox почео да преводи долазне позиве.** | 'преусмерава' (redirect) is incorrect, 'преводи' (translate) is correct. |
| `sip.incoming.copy` | Копија | **Копирај** | Imperative 'Копирај' (Copy) is better for a button than noun 'Копија'. |
| `sip.incoming.reissue` | Поновно издање | **Поново издај** | Imperative 'Поново издај' (Reissue) is better for a button than noun 'Поновно издање'. |
| `sip.outbound.lead` | Позовите број телефона са веб интерфејса и VibeVox ће аутоматски пребацити ваш разговор у реалном времену. | **Позовите број телефона са веб интерфејса — VibeVox ће аутоматски превести ваш разговор у реалном времену.** | 'пребацити' (transfer) is incorrect, 'превести' (translate) is correct. |
| `sip.outbound.noTrunkTitle` | Прво, подесите одлазни SIP трунк | **Прво, подесите одлазни SIP транк** | 'трунк' is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.outbound.noTrunkHint` | Попуните образац „Нови SIP канал“ на врху странице - VibeVox ће користити вашег SIP провајдера (Zadarma, OnlinePBX, итд.) за одлазне позиве. | **Попуните образац „Нови SIP транк“ на врху странице — VibeVox ће користити вашег SIP провајдера (Zadarma, OnlinePBX, итд.) за одлазне позиве.** | 'канал' (channel) is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.outbound.configureFirst` | Прво, подесите одлазни SIP трунк (образац изнад) | **Прво, подесите одлазни SIP транк (образац изнад)** | 'трунк' is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.outbound.calling` | Зовемо {{number}}… | **Зовем {{number}}…** | 'Зовем' (I am calling) is more appropriate for a system message than 'Зовемо' (We are calling). |
| `sip.howTo.step3` | VibeVox ће аутоматски креирати одлазни SIP трунк у LiveKit Cloud-у. | **VibeVox ће аутоматски креирати одлазни SIP транк у LiveKit Cloud-у.** | 'трунк' is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.toasts.saveFailed` | Чување пртљажника није успело | **Чување транка није успело** | 'пртљажника' is incorrect, 'транка' (trunk) is the correct technical term. |
| `sip.toasts.deleted` | Трбушњак је обрисан. | **Транк је обрисан.** | 'Трбушњак' (abdominal muscle) is incorrect, 'Транк' (trunk) is the correct technical term. |
| `sip.toasts.deleteFailed` | Брисање пртљажника није успело | **Брисање транка није успело** | 'пртљажника' is incorrect, 'транка' (trunk) is the correct technical term. |
| `sip.tenantOnly.title` | SIP канали се конфигуришу на нивоу закупца | **SIP транкови се конфигуришу на нивоу закупца** | 'канали' (channels) is incorrect, 'транкови' (trunks) is the correct technical term. |
| `sip.danger.deleteTrunk` | Обриши пртљажник | **Обриши транк** | 'пртљажник' is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.danger.deleteTrunkHint` | Конфигурација ће бити обрисана. Одлазни позиви ће се зауставити док поново не креирате линијску везу. | **Конфигурација ће бити обрисана. Одлазни позиви ће се зауставити док поново не креирате транк.** | 'линијску везу' (line connection) is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.danger.deleteInboundHint` | Правило за долазни канал и отпрему LiveKit-а биће уклоњено. Долазни позиви се више неће примати. | **Уклониће се LiveKit inbound trunk и dispatch rule. Долазни позиви се више неће примати.** | Technical terms 'inbound trunk' and 'dispatch rule' must be preserved. 'канал' is incorrect. |
| `sip.danger.reissueHint` | Поново издајте корисничко име и лозинку за SIP адресу. Стари подаци више неће функционисати. | **Поново издајте login и лозинку за SIP адресу. Стари подаци више неће функционисати.** | Technical term 'login' must be preserved. |
| `sip.outbound2.callingButton` | Зовемо... | **Зовем...** | 'Зовем' (I am calling) is more appropriate for a system message than 'Зовемо' (We are calling). |
| `sip.outbound2.rateInfo` | Цена по минуту одлазног позива одређује ваш SIP провајдер. | **Цена за минуту одлазног позива одређује ваш SIP провајдер.** | 'за минуту' (per minute) is more natural than 'по минуту'. |
| `sip.confirm.deleteTrunkBody` | Ова радња је неповратна. Након брисања, одлазни позиви ће се зауставити док се не креира нови канал. | **Ова радња је неповратна. Након брисања, одлазни позиви ће се зауставити док се не креира нови транк.** | 'канал' (channel) is incorrect, 'транк' (trunk) is the correct technical term. |
| `sip.confirm.deleteInboundBody` | Ова радња је неповратна. Долазни трунк и правило отпреме у LiveKit Cloud-у ће бити обрисани. | **Ова радња је неповратна. Долазни inbound trunk и dispatch rule у LiveKit Cloud-у ће бити обрисани.** | Technical terms 'inbound trunk' and 'dispatch rule' must be preserved. 'трунк' is incorrect. |
| `enterprise.page.title` | Подешавања предузећа | **Подешавања Enterprise** | Brand name 'Enterprise' must be preserved. |
| `enterprise.page.upsellTitle` | Овај одељак је доступан у оквиру Ентерпрајз плана. | **Овај одељак је доступан у оквиру Enterprise плана.** | Brand name 'Enterprise' must be preserved. |
| `enterprise.tabs.gemini` | Џемини АПИ | **Gemini API** | Brand name 'Gemini' must be preserved. |
| `enterprise.tabs.questFlow` | Ток задатака | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.tabs.chatwoot` | CRM (Четвут) | **CRM (Chatwoot)** | Brand name 'Chatwoot' must be preserved. |
| `enterprise.common.saving` | Чување… | **Чувамо...** | Use verb 'Чувамо' (We are saving) instead of noun 'Чување' (Saving). |
| `enterprise.common.copy` | Копија | **Копирај** | Imperative 'Копирај' (Copy) is better for a button than noun 'Копија'. |
| `enterprise.apiKey.copy` | Копија | **Копирај** | Imperative 'Копирај' (Copy) is better for a button than noun 'Копија'. |
| `enterprise.gemini.heading` | Кључ за Google Gemini API | **Google Gemini API кључ** | Brand name 'Gemini' must be preserved. |
| `enterprise.gemini.lead` | Лични кључ из AI Studio-а. Овај кључ замењује глобални кључ за све Gemini позиве на вашем налогу. | **Лични кључ из AI Studio. Овај кључ замењује глобални кључ за све Gemini позиве на вашем налогу.** | Brand name 'AI Studio' must be preserved. |
| `enterprise.gemini.aiStudioLink` | Студио за вештачку интелигенцију | **AI Studio** | Brand name 'AI Studio' must be preserved. |
| `enterprise.gemini.keyPlaceholder` | АјзаСи... | **AIzaSy...** | Placeholder text must be preserved exactly. |
| `enterprise.gemini.savingLabel` | Чување… | **Чувамо...** | Use verb 'Чувамо' (We are saving) instead of noun 'Чување' (Saving). |
| `enterprise.gemini.telegram.heading` | Телеграм бот за обавештења | **Telegram бот за обавештења** | Brand name 'Telegram' must be preserved. |
| `enterprise.gemini.telegram.lead` | Направите бота са @BotFather и уметните његов токен. Свако ко пошаље поруку овом боту са /start добијаће обавештења: нови клијенти, ознаке, грешке интеграције. Можете претплатити више запослених или додати бота у групу или канал — обавештења ће се аутоматски слати свима. | **Направите бота код @BotFather и уметните његов токен. Свако ко пошаље поруку овом боту са /start добијаће обавештења: нови клијенти, ознаке, грешке интеграције. Можете претплатити више запослених или додати бота у групу или канал — обавештења ће се аутоматски слати свима.** | 'код' (at/with) is more appropriate for '@BotFather'. Brand name '@BotFather' must be preserved. |
| `enterprise.gemini.telegram.leadCreatePart1` | Направите бота на | **Направите бота код** | 'код' (at/with) is more appropriate than 'на' (on). |
| `enterprise.gemini.telegram.leadCreatePart2` | и налепите његов токен. | **и уметните његов токен.** | 'уметните' (insert) is more appropriate than 'налепите' (paste/glue). |
| `enterprise.gemini.telegram.leadStartCmd` | /почетак | **/start** | Command '/start' must be preserved exactly. |
| `enterprise.gemini.telegram.leadAfterStart` | , добијаће обавештења о новим клијентима, ознакама и грешкама у интеграцији. Можете претплатити више запослених или додати бота у групу или канал — сви ће аутоматски добити обавештење. | **, добијаће обавештења: нови клијенти, ознаке, грешке интеграција. Можете претплатити више запослених или додати бота у групу/канал — рассылка иде сваком аутоматски.** | Slightly rephrased for better flow and to match source structure. |
| `enterprise.gemini.telegram.tokenLabel` | Токен бота за Телеграм | **Токен Telegram-бота** | Brand name 'Telegram' must be preserved. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Бот @{{username}} је сачуван. Свако ко му пошаље СМС поруку са командом /start добиће обавештења. | **✓ Бот @{{username}} је сачуван. Свако ко му напише /start добиће обавештења.** | Simplify phrase and preserve command '/start'. |
| `enterprise.gemini.telegram.successTestSingle` | ✓ Порука је достављена. Проверите Телеграм. | **✓ Порука је достављена. Проверите Telegram.** | Brand name 'Telegram' must be preserved. |
| `enterprise.gemini.telegram.successTestMany` | ✓ Порука је достављена примаоцима {{count}}. Молимо проверите Телеграм. | **✓ Порука је достављена {{count}} примаоцима. Молимо проверите Telegram.** | Brand name 'Telegram' must be preserved. Better phrasing for '{{count}} recipients'. |
| `enterprise.gemini.telegram.savingLabel` | Чување… | **Чувамо...** | Use verb 'Чувамо' (We are saving) instead of noun 'Чување' (Saving). |
| `enterprise.gemini.telegram.testingLabel` | Кацига… | **Шаљемо...** | 'Кацига' (helmet) is incorrect, 'Шаљемо' (Sending) is correct. |
| `enterprise.gemini.telegram.lastBroadcast` | Последња пошта: испоручено {{sent}} од {{total}} | **Последње слање: испоручено {{sent}} од {{total}}** | 'пошта' (mail) is incorrect, 'слање' (sending/broadcast) is correct. |
| `enterprise.gemini.telegram.lastBroadcastFailed` | · грешке: {{failed}} | **· грешака: {{failed}}** | Genitive plural 'грешака' is correct for 'X errors'. |
| `enterprise.prompt.subtitle` | Брз и информативан рад за транскрипцију само у видео собама | **Промпт и база знања само за транскрипцију у видео собама** | 'Брз и информативан рад' is incorrect. 'Промпт' is a technical term and should be preserved. |
| `enterprise.prompt.promptLabel` | Системски упит (тон, стил, речник) | **Системски промпт (тон, стил, речник)** | 'упит' (query) is incorrect, 'промпт' is a technical term and should be preserved. |
| `enterprise.prompt.showDefault` | Шта вештачка интелигенција користи подразумевано? | **Шта вештачка интелигенција користи подразумевано** | Remove question mark as it's not present in the source. |
| `enterprise.prompt.defaultLabel` | VibeVox подразумевани упит | **VibeVox подразумевани промпт** | 'упит' (query) is incorrect, 'промпт' is a technical term and should be preserved. |
| `enterprise.prompt.headerLeadBold2` | „Према вашем захтеву“ | **„Према вашем промпту“** | 'захтеву' (request) is incorrect, 'промпту' is a technical term and should be preserved. |
| `enterprise.prompt.contextLeadBold` | „Према вашем захтеву“ | **„Према вашем промпту“** | 'захтеву' (request) is incorrect, 'промпту' is a technical term and should be preserved. |
| `enterprise.prompt.contextLeadPart2` | База знања је такође помешана (доле). | **Такође се додаје база знања (доле).** | More accurate translation of 'Тоже подмешивается база знаний' (also mixed in knowledge base). |
| `enterprise.prompt.promptPlaceholder` | Ваш подсетник... | **Ваш промпт...** | 'подсетник' (reminder) is incorrect, 'промпт' is a technical term and should be preserved. |
| `enterprise.prompt.savingPromptLabel` | Чување… | **Чувамо...** | Use verb 'Чувамо' (We are saving) instead of noun 'Чување' (Saving). |
| `enterprise.prompt.successPromptSaved` | Упит је сачуван. | **Промпт је сачуван.** | 'Упит' (query) is incorrect, 'Промпт' is a technical term and should be preserved. |
| `enterprise.prompt.kbLead` | Отпремите документ — каталог, честа питања, ценовник, прописе или материјале са саветима. Садржај се анализира на серверу (Word/Excel/CSV → текст) и интегрише га вештачка интелигенција приликом транскрибовања порука у видео собама. Ограничење: 50 MB датотека / 500.000 знакова у бази података. | **Отпремите документ — каталог, FAQ, ценовник, прописе или материјале са саветима. Садржај се анализира на серверу (Word/Excel/CSV → текст) и интегрише га вештачка интелигенција приликом транскрибовања порука у видео собама. Ограничење: 50 MB датотека / 500.000 знакова у бази података.** | Brand name 'FAQ' must be preserved. |
| `enterprise.prompt.kbCharsSuffix` | симболи | **симбола** | Genitive plural 'симбола' is correct for 'X characters'. |
| `enterprise.prompt.kbUploading` | Учитавање… | **Учитавамо...** | Use verb 'Учитавамо' (We are uploading) instead of noun 'Учитавање' (Uploading). |
| `enterprise.prompt.presetsLeadPart1` | У ћаскању у Enterprise Room-у можете да истакнете било коју поруку и замолите вештачку интелигенцију да је објасни изабраним тоном. Дугме | **У ћаскању у Enterprise соби можете да истакнете било коју поруку и замолите AI да је објасни изабраним тоном. Дугме** | Brand name 'Enterprise' must be preserved. 'AI' is preferred over 'вештачку интелигенцију' for brevity. |
| `enterprise.prompt.presetsLeadBold` | „Према вашем захтеву“ | **„Према вашем промпту“** | 'захтеву' (request) is incorrect, 'промпту' is a technical term and should be preserved. |
| `enterprise.prompt.presetsLeadPart2` | користи ваш упит из горњег поља. | **користи ваш промпт из горњег поља.** | 'упит' (query) is incorrect, 'промпт' is a technical term and should be preserved. |
| `enterprise.questFlow.heading` | Ток задатака | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.subtitle` | АИ одговори клијентима путем Телеграм ботова и Инбоунд АПИ-ја | **AI одговори клијентима путем Telegram ботова и Inbound API-ја** | Brand names 'Telegram' and 'Inbound API' must be preserved. |
| `enterprise.questFlow.apiKeyLabel` | Улазни API кључ (носилац) | **Inbound API Key (Bearer)** | Technical terms 'Inbound API Key' and 'Bearer' must be preserved. |
| `enterprise.questFlow.promptLabel` | Системски упит тока задатка | **Системски промпт Quest Flow** | 'упит' (query) is incorrect, 'промпт' is a technical term. Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.kbLabel` | База знања о току задатака | **База знања Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.headerLead` | АИ дијалог са сваким клијентом појединачно путем Телеграм бота повезаног са Quest Flow-ом. | **AI дијалог са сваким клијентом појединачно путем Telegram бота повезаног са Quest Flow-ом.** | Brand names 'Telegram' and 'Quest Flow' must be preserved. 'AI' is preferred over 'АИ'. |
| `enterprise.questFlow.keyLabelPlaceholder` | Ознака (опционо), на пример: „Клиника за производне роботе“ | **Ознака (опционо), на пример: „Прод бот клинике“** | Placeholder example should be transliterated, not translated. |
| `enterprise.questFlow.creatingKey` | Ми стварамо… | **Креирамо...** | More concise verb 'Креирамо' (We are creating). |
| `enterprise.questFlow.errDelete` | Delete error | **Грешка при брисању** | Translate English string to Serbian. |
| `enterprise.questFlow.copyKey` | Копија | **Копирај** | Imperative 'Копирај' (Copy) is better for a button than noun 'Копија'. |
| `enterprise.questFlow.deleteTitle` | Delete | **Обриши** | Translate English string to Serbian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Обриши кључ?** | Translate English string to Serbian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Кључ ће бити трајно обрисан. Quest Flow ће престати да ради преко њега — биће потребно креирати нови кључ и заменити га у ланцу.** | Translate English string to Serbian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Обриши** | Translate English string to Serbian. |
| `enterprise.questFlow.promptHeading` | Упит за Телеграм разговоре | **Промпт за Telegram дијалоге** | 'Упит' (query) is incorrect, 'Промпт' is a technical term. Brand name 'Telegram' must be preserved. |
| `enterprise.questFlow.promptLead3` | - биће комбиновано са основним упутством и базом знања. | **- биће комбиновано са основним промптом и базом знања.** | 'упутством' (instruction) is incorrect, 'промптом' is a technical term and should be preserved. |
| `enterprise.questFlow.promptPlaceholder` | Ваш подсетник... | **Ваш промпт...** | 'подсетник' (reminder) is incorrect, 'промпт' is a technical term and should be preserved. |
| `enterprise.questFlow.savingPromptLabel` | Чување… | **Чувамо...** | Use verb 'Чувамо' (We are saving) instead of noun 'Чување' (Saving). |
| `enterprise.questFlow.successPromptSaved` | Упит за ток задатка је сачуван. | **Промпт Quest Flow је сачуван.** | 'Упит' (query) is incorrect, 'Промпт' is a technical term. Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.kbHeading` | База знања за ток задатака | **База знања за Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.kbLead1` | Документи – каталог услуга, ценовник, честа питања. Отпремите TXT / Word / Excel / CSV. | **Документи – каталог услуга, ценовник, FAQ. Отпремите TXT / Word / Excel / CSV.** | Brand name 'FAQ' must be preserved. |
| `enterprise.questFlow.kbLead3` | Из одељка „Савети“ – за транскрипцију видеа. Ограничење: датотека од 50 MB / 500.000 знакова у бази података. | **од одељка „Савети“ – тамо за транскрипцију видеа. Ограничење: датотека од 50 MB / 500.000 знакова у бази података.** | 'од одељка' (from section) is more accurate than 'Из одељка' (out of section). |
| `enterprise.questFlow.kbCharsSuffix` | симболи | **симбола** | Genitive plural 'симбола' is correct for 'X characters'. |
| `enterprise.questFlow.kbUploading` | Учитавање… | **Учитавамо...** | Use verb 'Учитавамо' (We are uploading) instead of noun 'Учитавање' (Uploading). |
| `enterprise.questFlow.successFileUploaded` | Датотека „{{filename}}“ је учитана ({{kbLength}} карактери). | **Датотека „{{filename}}“ је учитана ({{kbLength}} карактера).** | Genitive plural 'карактера' is correct for 'X characters'. |
| `enterprise.chatwoot.headingShort` | CRM (Четвут) | **CRM (Chatwoot)** | Brand name 'Chatwoot' must be preserved. |
| `enterprise.chatwoot.tokenFieldLabel` | Токен за приступ агента (из Профил → Токен за приступ) | **Agent Access Token (из Profile → Access Token)** | Technical terms 'Agent Access Token', 'Profile', 'Access Token' must be preserved. |
| `enterprise.chatwoot.tokenPlaceholder` | Токен за приступ агента | **Agent access token** | Technical term 'Agent access token' must be preserved. |
| `enterprise.chatwoot.savingLabel` | Чување… | **Чувамо...** | Use verb 'Чувамо' (We are saving) instead of noun 'Чување' (Saving). |
| `enterprise.chatwoot.whatSentItem2` | Разговор са приватном белешком = комплетна историја дијалога | **Conversation са приватном белешком = комплетна историја дијалога** | Technical term 'Conversation' must be preserved. |
| `enterprise.chatwoot.whatSentItem3Code` | прилагођени_атрибути.вибевокс_тагови | **custom_attributes.vibevox_tags** | Code snippet must be preserved exactly. |
| `chat.deletingShort` | Брисање… | **Бришемо...** | Use verb 'Бришемо' (We are deleting) instead of noun 'Брисање' (Deleting). |
| `chat.telegramBadge` | Телеграм | **Telegram** | Brand name 'Telegram' must be preserved. |
| `insights.recalc` | Поновно пребројавање | **Поново израчунај** | Imperative 'Поново израчунај' (Recalculate) is better for a button than noun 'Поновно пребројавање'. |
| `insights.sentiment` | Кључ | **Тоналитет** | 'Кључ' (key) is incorrect, 'Тоналитет' (sentiment/tonality) is correct. |
| `insights.leadScore` | Резултат вођства | **Lead Score** | Technical term 'Lead Score' must be preserved. |
| `postCallInsights.subtitle` | Увиди након позива у предузеће | **Enterprise · увиди након позива** | Brand name 'Enterprise' must be preserved. 'post-call insights' translated to 'увиди након позива'. |
| `postCallInsights.analyzing` | Хајде да анализирамо разговор... | **Анализирамо разговор…** | Use verb 'Анализирамо' (We are analyzing) instead of 'Хајде да анализирамо' (Let's analyze). |
| `postCallInsights.metricLeadScore` | Резултат потенцијалних клијената | **Lead Score** | Technical term 'Lead Score' must be preserved. |
| `lobby.nameLabel` | Како се зовеш? | **Како се зовете?** | Use formal 'Како се зовете?' instead of informal 'Како се зовеш?'. |
| `lobby.shareSection` | Подели линк | **Поделите линк** | Use formal 'Поделите' instead of informal 'Подели'. |
| `lobby.tos` | Услови коришћења | **Условима коришћења** | Instrumental plural 'Условима' is grammatically correct with 'слажете са'. |
| `lobby.andWord` | И | ** и ** | Lowercase 'и' is correct for a conjunction in the middle of a sentence. |
| `lobby.privacy` | Политика приватности | **Политиком приватности** | Instrumental 'Политиком' is grammatically correct with 'слажете са'. |
| `lobby.audioConsent` | , а такође и сагласност за обраду звука ради превода. | **, а такође дајете сагласност за обраду звука ради превода.** | Missing verb 'дајете' (you give) from the source. |
| `lobby.shareSuccessHint` | ✓ Линк је копиран. Пошаљите га свом контакту путем Телеграма / WhatsApp-а / имејла. Сада можете затворити страницу — линк увек ради. | **✓ Линк је копиран. Пошаљите га свом контакту путем Telegram-а / WhatsApp-а / имејла. Сада можете затворити страницу — линк увек ради.** | Brand names 'Telegram' and 'WhatsApp' must be preserved. |
| `paywall.buyPlus` | Плус — 19 €/месечно (60 мин) | **Plus — 19 €/месечно (60 мин)** | Brand name 'Plus' must be preserved. |
| `paywall.buyStandard` | Стандардно – 29 €/месечно (120 мин) | **Standard – 29 €/месечно (120 мин)** | Brand name 'Standard' must be preserved. |
| `paywall.subscribe` | Дизајн | **Претплати се** | 'Дизајн' (design) is incorrect, 'Претплати се' (subscribe) is correct. |
| `paywall.featureMinutes` | {{count}} мин превод | **{{count}} мин превода** | Genitive 'превода' is correct with 'минут'. |
| `paywall.featureHd` | HD гласови, видео, AI тренер | **HD гласови, видео, AI Coach** | Brand name 'AI Coach' must be preserved. |
| `paywall.topupNoSubInfo` | ℹ Немате активну претплату. Плус ће бити додат вашој куповини за 19 €/месечно—60 минута је укључено у ваш план, тако да нема додатних трошкова. | **ℹ Немате активну претплату. Plus ће бити додат вашој куповини за 19 €/месечно—60 минута је укључено у ваш план, тако да нема додатних трошкова.** | Brand name 'Plus' must be preserved. |
| `paywall.topupPlusLine` | Плус тарифа (укључујући {{count}} мин) | **Тариф Plus (укључујући {{count}} мин)** | Brand name 'Plus' must be preserved. |
| `billingPage.tierLabel` | Оцена | **Тариф** | 'Оцена' (grade) is incorrect, 'Тариф' (tariff/plan) is correct. |
| `billingPage.resume` | Резиме | **Настави** | 'Резиме' (summary) is incorrect, 'Настави' (resume) is correct. |
| `billingPage.promoPlaceholder` | На пример: ЛЕТО25 | **На пример: SUMMER25** | Placeholder text must be preserved exactly. |
| `billingPage.languagesCount_few` | {{count}} језик | **{{count}} језика** | Genitive plural 'језика' is correct for 2-4 languages. |
| `billingPage.languagesCount_many` | {{count}} језици | **{{count}} језика** | Genitive plural 'језика' is correct for 5+ languages. |
| `billingPage.languagesCount_other` | {{count}} језици | **{{count}} језика** | Genitive plural 'језика' is correct for 'other' plural forms. |
| `billingPage.faqQ3` | Шта укључује Ентерпрајз? | **Шта укључује Enterprise?** | Brand name 'Enterprise' must be preserved. |
| `billingPage.faqA3` | Комплетан AI стек: картице купаца са аутоматским препознавањем, ауторизација у Telegram-у, персонализовани упити, Google календар, паметно означавање потреба, извоз у CRM, интеграција са questflow.pro и посебна администраторска картица. | **Комплетан AI стек: картице купаца са аутоматским препознавањем, Telegram-ауторизација, персонални промпти, Google Calendar, паметно означавање потреба, извоз у CRM, интеграција са questflow.pro и посебна администраторска картица.** | Brand names 'Telegram', 'Google Calendar', 'CRM', 'questflow.pro' must be preserved. 'упити' (queries) is incorrect, 'промпти' is a technical term. |
| `billingPage.faqA4` | Било који RFC компатибилан: Zadarma, OnlinePBX, Asterisk/FreePBX, итд. VibeVox аутоматски креира одлазни канал. | **Било који RFC компатибилан: Zadarma, OnlinePBX, Asterisk/FreePBX, итд. VibeVox аутоматски креира outbound trunk.** | Brand names 'Zadarma', 'OnlinePBX', 'Asterisk', 'FreePBX' must be preserved. 'канал' (channel) is incorrect, 'outbound trunk' is the correct technical term. |
| `billingPage.topupDescription` | 0,17 € по минуту. Од 60 минута до 10 сати. Кредитовано одмах након уплате. | **0,17 € за минуту. Од 60 минута до 10 сати. Кредитовано одмах након уплате.** | 'за минуту' (per minute) is more natural than 'по минуту'. |
| `billingPage.presetHours` | {{count}}h | **{{count}}ч** | Use Cyrillic 'ч' for hours instead of Latin 'h'. |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}м** | Use Cyrillic 'м' for minutes instead of Latin 'm'. |
| `billingPage.renewsOn` | екстензија {{date}} | **обнова {{date}}** | 'екстензија' (extension) is incorrect, 'обнова' (renewal) is correct. |
| `billingPage.tierPlusName` | Плус | **Plus** | Brand name 'Plus' must be preserved. |
| `billingPage.tierStandardName` | Стандардно | **Standard** | Brand name 'Standard' must be preserved. |
| `billingPage.tierEnterpriseName` | Предузеће | **Enterprise** | Brand name 'Enterprise' must be preserved. |
| `billingPage.featureHd` | HD превод гласова (Аоеде, Харон, Коре) | **HD превод гласова (Aoede, Charon, Kore)** | Brand names 'Aoede', 'Charon', 'Kore' must be preserved. |
| `billingPage.featureLearnHub` | Чвориште за учење вештачке интелигенције — сопствени дијалекти | **AI Learning Hub — сопствени дијалекти** | Brand name 'AI Learning Hub' must be preserved. |
| `billingPage.featureAllPlus` | Све из Плуса | **Све из Plus** | Brand name 'Plus' must be preserved. |
| `billingPage.featureAllStandard` | Све из Стандарда | **Све из Standard** | Brand name 'Standard' must be preserved. |
| `billingPage.featureTelegramAuth` | Ауторизација у Телеграму + повезивање са картицом | **Telegram-ауторизација + повезивање са картицом** | Brand name 'Telegram' must be preserved. |
| `billingPage.featurePersonalPrompts` | Лични вештачки интелигентни упити | **Лични AI промпти** | 'упити' (queries) is incorrect, 'промпти' is a technical term. 'AI' is preferred over 'вештачки интелигентни'. |
| `billingPage.featureCalendar` | Google календар - Заказивање састанака са клијентима | **Google Calendar — Заказивање састанака са клијентима** | Brand name 'Google Calendar' must be preserved. |
| `billingPage.ctaSubscribePlus` | Преузми плус | **Претплати се на Plus** | 'Преузми' (download) is incorrect, 'Претплати се' (subscribe) is correct. Brand name 'Plus' must be preserved. |
| `billingPage.ctaSubscribeStandard` | Стандардна поруџбина | **Претплати се на Standard** | 'Стандардна поруџбина' (Standard order) is incorrect, 'Претплати се на Standard' (Subscribe to Standard) is correct. Brand name 'Standard' must be preserved. |
| `billingPage.ctaContactWhatsApp` | Контакт путем WhatsApp-а | **Связаться в WhatsApp** | Brand name 'WhatsApp' must be preserved. 'Связаться в WhatsApp' is more direct. |
| `auth.login.submit` | Пријава | **Пријави се** | Imperative 'Пријави се' (Login) is better for a button than noun 'Пријава'. |
| `auth.register.loginLink` | Пријава | **Пријави се** | Imperative 'Пријави се' (Login) is better for a button than noun 'Пријава'. |
| `auth.register.namePlaceholder` | твоје име | **Ваше име** | Use formal 'Ваше име' instead of informal 'твоје име'. |
| `auth.register.agreementTos` | Услови коришћења | **Условима коришћења** | Instrumental plural 'Условима' is grammatically correct with 'слажете са'. |
| `auth.register.agreementAnd` | И | ** и ** | Lowercase 'и' is correct for a conjunction in the middle of a sentence. |
| `auth.register.agreementPrivacy` | Политика приватности | **Политиком приватности** | Instrumental 'Политиком' is grammatically correct with 'слажете са'. |
| `auth.forgot.loading` | Слање… | **Шаљемо...** | Use verb 'Шаљемо' (We are sending) instead of noun 'Слање' (Sending). |
| `auth.googleCallback.loading` | Потврђивање ваше пријаве преко Гугла… | **Потврђивање ваше пријаве преко Google-а…** | Brand name 'Google' must be preserved. |
| `footer.copyright` | ВајбВокс © {{year}} | **VibeVox © {{year}}** | Brand name must be preserved exactly. |

⚠ 7 fix(es) skipped (no-op, missing path, or would break placeholders).
