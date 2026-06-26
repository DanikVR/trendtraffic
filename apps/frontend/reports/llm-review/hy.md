# LLM Review: Armenian (hy)

**Model:** gemini-2.5-flash  
**Took:** 622.9s  
**Fixes proposed:** 113 (valid after placeholder-check: 113)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `appName` | ՎայբՎոքս | **VibeVox** | Brand name should not be translated. |
| `nav.enterpriseSettings` | Ձեռնարկության կարգավորումներ | **Enterprise կարգավորումներ** | "Enterprise" is a tier name, should not be translated. |
| `rooms.tabs.questFlow` | Որոնման հոսք | **Quest Flow** | Brand name should not be translated. |
| `rooms.toasts.renameFailed` | Անհաջող վերանվանում | **Չհաջողվեց վերանվանել** | More natural phrasing for "Failed to rename". |
| `common.edit` | Փոփոխություն | **Խմբագրել** | More appropriate for "Edit" button label. |
| `balance.openPlans` | Բաց սակագներ և մնացորդ | **Բացել սակագները և մնացորդը** | Correct verb form for "Open plans". |
| `tier.trial` | Փորձարկում | **Փորձնական** | Correct word sense for "trial" in subscription context. |
| `tier.plus` | Գումարած | **Plus** | Brand name should not be translated. |
| `tier.standard` | Ստանդարտ | **Standard** | Brand name should not be translated. |
| `tier.standardYearly` | Տարեկան | **Yearly** | Brand name should not be translated. |
| `tier.enterprise` | ձեռնարկություն | **Enterprise** | "Enterprise" is a tier name, should not be translated. |
| `settings.themeDarkSub` | Անդունդ Ավրորա (Մութ) | **Abyss Aurora (Մութ)** | Brand name should not be translated. |
| `settings.themeLightSub` | Ամպային Ավրորա (Լույս) | **Cloud Aurora (Լույս)** | Brand name should not be translated. |
| `partner.title` | Partner program | **Գործընկերային ծրագիր** | Should be translated to Armenian. |
| `partner.subtitle` | Share your link and earn | **Կիսվեք ձեր հղումով և վաստակեք** | Should be translated to Armenian. |
| `partner.yourLink` | Your link | **Ձեր հղումը** | Should be translated to Armenian. |
| `partner.copy` | Copy | **Պատճենել** | Should be translated to Armenian. |
| `partner.copied` | ✓ Link copied | **✓ Հղումը պատճենվեց** | Should be translated to Armenian. |
| `partner.stats.clicks` | Clicks | **Անցումներ** | Should be translated to Armenian. |
| `partner.stats.registrations` | Sign-ups | **Գրանցումներ** | Should be translated to Armenian. |
| `partner.stats.paid` | Payments | **Վճարումներ** | Should be translated to Armenian. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} հոգի · {{minutes}} րոպե** | Should be translated to Armenian. |
| `partner.terms` | Program terms | **Ծրագրի պայմաններ** | Should be translated to Armenian. |
| `partner.contact` | Contact us | **Կապ մեզ հետ** | Should be translated to Armenian. |
| `partner.termsModalTitle` | Partner program terms | **Գործընկերային ծրագրի պայմաններ** | Should be translated to Armenian. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Ծրագրի պայմանները դեռ սահմանված չեն։ Խնդրում ենք կապվել SuperAdmin-ի հետ։** | Should be translated to Armenian. |
| `partner.loadError` | Failed to load partner data | **Չհաջողվեց բեռնել գործընկերային տվյալները** | Should be translated to Armenian. |
| `call.muted` | Ձայն չկա | **Անձայն** | More accurate translation for "Muted". |
| `call.geminiLive` | Երկվորյակներ ուղիղ եթերում | **Gemini Live** | Brand name "Gemini" and "Live" should be preserved. |
| `call.toPlayground` | 🎯 Դեպի աղբավայր | **🎯 Դեպի մարզադաշտ** | Wrong word sense, "աղբավայր" means landfill. "Մարզադաշտ" is more appropriate. |
| `call.more` | Բացի այդ | **Ավելին** | More appropriate for "More" menu item. |
| `coach.pin` | Ամրացրեք այն | **Ամրացնել** | More concise and accurate for "Pin" as an action. |
| `roomActions.translation.disableSub` | Արձանագրությունները այլևս չեն գրանցվի | **Րոպեները այլևս չեն գրանցվի** | "Արձանագրությունները" means "protocols", should be "Րոպեները" (minutes). |
| `sip.subtitle` | Մուտքային և ելքային զանգերի համար լարերի կարգավորում | **Մուտքային և ելքային զանգերի համար տրանկների կարգավորում** | "Լարերի" means "wires", should be "տրանկների" (trunks). |
| `sip.newTrunk` | Նոր SIP բեռնախցիկ | **Նոր SIP տրանկ** | "Բեռնախցիկ" means car trunk, should be "տրանկ". |
| `sip.editTrunk` | Փոխել բեռնախցիկի կարգավորումները | **Փոխել տրանկի կարգավորումները** | "Բեռնախցիկ" means car trunk, should be "տրանկ". |
| `sip.loginShort` | Մուտք գործել | **Մուտքանուն** | "Մուտք գործել" is a verb, "Մուտքանուն" is the noun for "login". |
| `sip.trunkId` | Բեռնախցիկի ID | **Տրանկի ID** | "Բեռնախցիկ" means car trunk, should be "տրանկ". |
| `sip.createTrunk` | Ստեղծեք բեռնախցիկ | **Ստեղծել տրանկ** | "Բեռնախցիկ" means car trunk, should be "տրանկ". "Ստեղծել" is more natural for a button. |
| `sip.incoming.pausedHint` | Ակտիվացրեք ընդունումը, որպեսզի VibeVox-ը սկսի վերահասցեավորել մուտքային զանգերը: | **Ակտիվացրեք ընդունումը, որպեսզի VibeVox-ը սկսի թարգմանել մուտքային զանգերը:** | "Վերահասցեավորել" means "redirect", should be "թարգմանել" (translate). |
| `sip.incoming.stop` | Կանգ առեք | **Կանգնեցնել** | More appropriate for a button label. |
| `sip.incoming.reissue` | Վերաթողարկում | **Վերաթողարկել** | Should be a verb for a button label. |
| `sip.incoming.toggleFailed` | Չհաջողվեց միացնել ընդունման ազդանշանը | **Չհաջողվեց միացնել ընդունումը** | Removed extra word "ազդանշանը" (signal) not present in source. |
| `sip.outbound.noTrunkTitle` | Նախ, կարգավորեք արտագնա SIP մայրուղին | **Նախ, կարգավորեք արտագնա SIP տրանկը** | "Մայրուղի" means "highway", should be "տրանկ". |
| `sip.toasts.saveFailed` | Չհաջողվեց պահպանել բեռնախցիկը | **Չհաջողվեց պահպանել տրանկը** | "Բեռնախցիկ" means car trunk, should be "տրանկ". |
| `sip.toasts.deleted` | Բեռնախցիկը ջնջվել է։ | **Տրանկը ջնջվել է։** | "Բեռնախցիկ" means car trunk, should be "տրանկ". |
| `sip.toasts.deleteFailed` | Չհաջողվեց ջնջել բեռնախցիկը | **Չհաջողվեց ջնջել տրանկը** | "Բեռնախցիկ" means car trunk, should be "տրանկ". |
| `sip.danger.deleteTrunk` | Ջնջել բեռնախցիկը | **Ջնջել տրանկը** | "Բեռնախցիկ" means car trunk, should be "տրանկ". |
| `sip.danger.deleteTrunkHint` | Կարգավորումը կջնջվի։ Ելքային զանգերը կդադարեցվեն մինչև դուք վերստեղծեք գլխավոր գիծը։ | **Կարգավորումը կջնջվի։ Ելքային զանգերը կդադարեցվեն մինչև դուք վերստեղծեք տրանկը։** | "Գլխավոր գիծը" means "main line", should be "տրանկը". |
| `sip.danger.deleteInboundHint` | LiveKit-ի մուտքային կապի և ուղարկման կանոնը կհեռացվի: Մուտքային զանգերը այլևս չեն ընդունվի: | **LiveKit-ի մուտքային տրանկը և ուղարկման կանոնը կհեռացվի: Մուտքային զանգերը այլևս չեն ընդունվի:** | "Կապի" means "connection", should be "տրանկը" (trunk). |
| `sip.danger.reissueHint` | Վերահղեք SIP հասցեի մուտքանունը և գաղտնաբառը։ Հին տեղեկությունները այլևս չեն աշխատի։ | **Վերաթողարկել SIP հասցեի մուտքանունը և գաղտնաբառը։ Հին տեղեկությունները այլևս չեն աշխատի։** | "Վերահղեք" means "redirect", should be "Վերաթողարկել" (reissue). |
| `sip.confirm.deleteTrunkBody` | Այս գործողությունը անշրջելի է: Ջնջելուց հետո ելքային զանգերը կդադարեցվեն մինչև նոր մայրուղու ստեղծումը: | **Այս գործողությունը անշրջելի է: Ջնջելուց հետո ելքային զանգերը կդադարեցվեն մինչև նոր տրանկի ստեղծումը:** | "Մայրուղու" means "highway", should be "տրանկի". |
| `sip.confirm.deleteInboundTitle` | Հեռացնե՞լ SIP հասցեն մուտքային հաղորդագրությունների համար։ | **Հեռացնե՞լ SIP հասցեն մուտքային զանգերի համար։** | "Հաղորդագրությունների" means "messages", should be "զանգերի" (calls). |
| `sip.confirm.deleteInboundBody` | Այս գործողությունը անդարձելի է: LiveKit Cloud-ում մուտքային կապի և ուղարկման կանոնը կջնջվի: | **Այս գործողությունը անդարձելի է: LiveKit Cloud-ում մուտքային տրանկի և ուղարկման կանոնը կջնջվի:** | "Կապի" means "connection", should be "տրանկի" (trunk). |
| `enterprise.page.title` | Ձեռնարկության կարգավորումներ | **Enterprise կարգավորումներ** | "Enterprise" is a tier name, should not be translated. |
| `enterprise.page.upsellTitle` | Այս բաժինը հասանելի է Ձեռնարկության պլանում։ | **Այս բաժինը հասանելի է Enterprise պլանում։** | "Enterprise" is a tier name, should not be translated. |
| `enterprise.tabs.questFlow` | Որոնման հոսք | **Quest Flow** | Brand name should not be translated. |
| `enterprise.gemini.aiStudioLink` | Արհեստական բանականության ստուդիա | **AI Studio** | Brand name should not be translated. |
| `enterprise.gemini.keyPlaceholder` | ԱիզաՍի... | **AIzaSy...** | Placeholder for API key should not be translated. |
| `enterprise.gemini.successDeleted` | Վարձակալի յուրաքանչյուր հաշվի բանալին հեռացված է։ | **Per-tenant բանալին հեռացված է։** | "Per-tenant" is a technical term, better to preserve or use a more concise translation. |
| `enterprise.gemini.confirmDeleteTitle` | Ջնջե՞լ Gemini բանալին յուրաքանչյուր վարձակալի համար | **Ջնջե՞լ per-tenant Gemini բանալին** | "Per-tenant" is a technical term, better to preserve or use a more concise translation. |
| `enterprise.gemini.telegram.leadStartCmd` | /սկիզբ | **/start** | Command should be preserved as is. |
| `enterprise.gemini.telegram.testingLabel` | Սաղավարտ… | **Ուղարկում ենք…** | Wrong word sense, "Սաղավարտ" means helmet. Should be "Ուղարկում ենք…" (We are sending...). |
| `enterprise.prompt.headerLeadPart2` | - երբ դուք սեղմում եք հաղորդագրության վրա զրույցում և ընտրում եք ձայնային ազդանշան | **- երբ դուք սեղմում եք հաղորդագրության վրա զրույցում և ընտրում եք տոն** | "Ձայնային ազդանշան" means sound signal, should be "տոն" (tone). |
| `enterprise.prompt.headerLeadBold2` | «Ըստ ձեր խնդրանքի» | **«Ըստ ձեր պրոմպտի»** | "Խնդրանքի" means request, should be "պրոմպտի" (prompt). |
| `enterprise.prompt.contextLeadPart1` | Օգտագործվում է, երբ դուք սեղմում եք տեսազանգում հաղորդագրության վրա և ընտրում եք ձայնային ազդանշան | **Օգտագործվում է, երբ դուք սեղմում եք տեսազանգում հաղորդագրության վրա և ընտրում եք տոն** | "Ձայնային ազդանշան" means sound signal, should be "տոն" (tone). |
| `enterprise.prompt.contextLeadBold` | «Ըստ ձեր խնդրանքի» | **«Ըստ ձեր պրոմպտի»** | "Խնդրանքի" means request, should be "պրոմպտի" (prompt). |
| `enterprise.prompt.successPromptSaved` | Հարցումը պահվեց։ | **Պրոմպտը պահվեց։** | "Հարցումը" means query, should be "Պրոմպտը" (prompt). |
| `enterprise.prompt.presetsLeadPart1` | «Ձեռնարկությունների սենյակ» չաթում կարող եք ընդգծել ցանկացած հաղորդագրություն և խնդրել արհեստական բանականությանը բացատրել այն ընտրված տոնով։ Կոճակ | **Enterprise սենյակ չաթում կարող եք ընդգծել ցանկացած հաղորդագրություն և խնդրել արհեստական բանականությանը բացատրել այն ընտրված տոնով։ Կոճակ** | "Enterprise" is a brand/tier name, should not be translated. |
| `enterprise.prompt.presetsLeadBold` | «Ըստ ձեր խնդրանքի» | **«Ըստ ձեր պրոմպտի»** | "Խնդրանքի" means request, should be "պրոմպտի" (prompt). |
| `enterprise.questFlow.heading` | Որոնման հոսք | **Quest Flow** | Brand name should not be translated. |
| `enterprise.questFlow.apiKeyLabel` | Մուտքային API բանալի (կրող) | **Մուտքային API Key (Bearer)** | "Bearer" is a technical term, should be preserved. |
| `enterprise.questFlow.tagsLabel` | Անհրաժեշտ պիտակներ | **Կարիքների պիտակներ** | "Անհրաժեշտ" means necessary, should be "Կարիքների" (needs). |
| `enterprise.questFlow.errDelete` | Delete error | **Ջնջման սխալ** | Should be translated to Armenian. |
| `enterprise.questFlow.deleteTitle` | Delete | **Ջնջել** | Should be translated to Armenian. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Ջնջե՞լ բանալին։** | Should be translated to Armenian. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Բանալին կջնջվի անդառնալիորեն։ Quest Flow-ն կդադարի աշխատել դրա միջոցով. անհրաժեշտ կլինի ստեղծել նոր բանալի և փոխարինել շղթայում։** | Should be translated to Armenian. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Ջնջել** | Should be translated to Armenian. |
| `enterprise.questFlow.promptHeading` | Հարցում Telegram-ում զրույցների համար | **Պրոմպտ Telegram-ում զրույցների համար** | "Հարցում" means query, should be "Պրոմպտ" (prompt). |
| `enterprise.questFlow.successPromptSaved` | Առաջադրանքի հոսքի հարցումը պահպանվեց։ | **Quest Flow պրոմպտը պահպանվեց։** | "Հարցումը" means query, should be "Պրոմպտը" (prompt). Also, "Առաջադրանքի հոսքի" is a translation of "Quest Flow", which should be preserved. |
| `enterprise.questFlow.kbLeadBold2` | առանձնացնել | **առանձին** | "Առանձնացնել" is a verb, should be "առանձին" (adjective). |
| `enterprise.questFlow.tagsHeading` | Անհրաժեշտ պիտակներ | **Կարիքների պիտակներ** | "Անհրաժեշտ" means necessary, should be "Կարիքների" (needs). |
| `chat.enterpriseOnlyHint` | Զրուցարանները Enterprise-ի գործառույթ են: Թարմացրեք ձեր պլանը «Գներ» բաժնում: | **Զրուցարանները Enterprise գործառույթ են: Թարմացրեք ձեր պլանը «Գներ» բաժնում:** | "Enterprise" is a brand/tier name, should not be translated. |
| `insights.sentiment` | Բանալի | **Տոնայնություն** | "Բանալի" means key, should be "Տոնայնություն" (tonality/sentiment). |
| `insights.leadScore` | Առաջատար միավոր | **Lead Score** | "Lead Score" is a specific sales term, better to preserve in English. |
| `insights.analyzedReplies_one` | {{count}} կրկնօրինակը վերլուծված է | **{{count}} արտահայտություն է վերլուծվել** | "Կրկնօրինակը" means copy, should be "արտահայտություն" (utterance). |
| `insights.analyzedReplies_few` | {{count}} կրկնօրինակները վերլուծվել են | **{{count}} արտահայտություններ են վերլուծվել** | "Կրկնօրինակները" means copies, should be "արտահայտություններ" (utterances). |
| `insights.analyzedReplies_many` | {{count}} կրկնօրինակները վերլուծվել են | **{{count}} արտահայտություններ են վերլուծվել** | "Կրկնօրինակները" means copies, should be "արտահայտություններ" (utterances). |
| `insights.analyzedReplies_other` | {{count}} կրկնօրինակները վերլուծվել են | **{{count}} արտահայտություններ են վերլուծվել** | "Կրկնօրինակները" means copies, should be "արտահայտություններ" (utterances). |
| `postCallInsights.subtitle` | Ձեռնարկություն · զանգից հետո ստացված տեղեկատվություն | **Enterprise · զանգից հետո ստացված տեղեկատվություն** | "Enterprise" is a brand/tier name, should not be translated. |
| `postCallInsights.analyzing` | Եկեք վերլուծենք զրույցը... | **Վերլուծում ենք զրույցը...** | "Եկեք վերլուծենք" means "Let's analyze", should be "Վերլուծում ենք" (We are analyzing). |
| `postCallInsights.metricLeadScore` | Առաջատարի միավոր | **Lead Score** | "Lead Score" is a specific sales term, better to preserve in English. |
| `billingPage.tierLabel` | Գնահատել | **Սակագին** | "Գնահատել" means to evaluate, should be "Սակագին" (tariff/plan). |
| `billingPage.resume` | Ռեզյումե | **Վերսկսել** | "Ռեզյումե" means summary, should be "Վերսկսել" (resume/restart). |
| `billingPage.promoPlaceholder` | Օրինակ՝ ԱՄԱՌ25 | **Օրինակ՝ SUMMER25** | Placeholder should be preserved. |
| `paywall.buyPlus` | Գումարած՝ 19 եվրո/ամիս (60 րոպե) | **Plus — 19 եվրո/ամիս (60 րոպե)** | Brand name should not be translated. |
| `paywall.buyStandard` | Ստանդարտ – €29/ամիս (120 րոպե) | **Standard – €29/ամիս (120 րոպե)** | Brand name should not be translated. |
| `paywall.subscribe` | Դիզայն | **Բաժանորդագրվել** | "Դիզայն" means design, should be "Բաժանորդագրվել" (Subscribe). |
| `paywall.topupPlusLine` | Գումարած սակագին (ներառյալ {{count}} րոպե) | **Plus սակագին (ներառյալ {{count}} րոպե)** | Brand name should not be translated. |
| `paywall.topupAddon` | Լրացուցիչ գնում {{count}} նվազագույն × €0.17 | **Լրացուցիչ գնում {{count}} րոպե × €0.17** | "Նվազագույն" means minimum, should be "րոպե" (minutes). |
| `billingPage.tierPlusName` | Գումարած | **Plus** | Brand name should not be translated. |
| `billingPage.tierStandardName` | Ստանդարտ | **Standard** | Brand name should not be translated. |
| `billingPage.tierEnterpriseName` | ձեռնարկություն | **Enterprise** | "Enterprise" is a tier name, should not be translated. |
| `billingPage.featureHd` | HD թարգմանության ձայներ (Աոեդե, Քարոն, Կորե) | **HD թարգմանության ձայներ (Aoede, Charon, Kore)** | Brand names should not be translated. |
| `billingPage.ctaSubscribePlus` | Ստացեք Plus | **Բաժանորդագրվել Plus** | "Ստացեք" means Get, should be "Բաժանորդագրվել" (Subscribe). |
| `billingPage.ctaSubscribeStandard` | Պատվերի ստանդարտ | **Բաժանորդագրվել Standard** | "Պատվերի ստանդարտ" means Order Standard, should be "Բաժանորդագրվել Standard" (Subscribe Standard). |
| `billingPage.faqA4` | RFC-համատեղելի ցանկացած՝ Zadarma, OnlinePBX, Asterisk/FreePBX և այլն: VibeVox-ը ավտոմատ կերպով ստեղծում է ելքային կապ: | **RFC-համատեղելի ցանկացած՝ Zadarma, OnlinePBX, Asterisk/FreePBX և այլն: VibeVox-ը ավտոմատ կերպով ստեղծում է ելքային տրանկ:** | "Կապ" means connection, should be "տրանկ" (trunk). |
| `billingPage.topupDescription` | €0.17 մեկ րոպեի համար։ 60 րոպեից մինչև 10 ժամ։ Գումարը կհաշվարկվի վճարումից անմիջապես հետո։ | **€0.17 մեկ րոպեի համար։ 60 րոպեից մինչև 10 ժամ։ Րոպեները կհաշվարկվեն վճարումից անմիջապես հետո։** | "Գումարը կհաշվարկվի" means amount will be calculated, should be "Րոպեները կհաշվարկվեն" (minutes will be credited). |
| `billingPage.presetHours` | __ՎՎ0__ժ | **{{count}}ժ** | Placeholder `{{count}}` was incorrectly translated. |
| `billingPage.presetMinutes` | __ՎՎ0__մ | **{{count}}մ** | Placeholder `{{count}}` was incorrectly translated. |
| `billingPage.renewsOn` | ընդլայնում {{date}} | **երկարաձգում {{date}}** | "Ընդլայնում" means expansion, should be "երկարաձգում" (renewal). |
| `auth.common.emailPlaceholder` | դու@example.com | **you@example.com** | Placeholder should be preserved. |
| `auth.register.namePlaceholder` | քո անունը | **Ձեր անունը** | "քո" is informal, "Ձեր" is formal. Placeholder should be formal. |
