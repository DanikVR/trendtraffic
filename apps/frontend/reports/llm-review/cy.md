# LLM Review: Welsh (cy)

**Model:** gemini-2.5-flash  
**Took:** 481.3s  
**Fixes proposed:** 71 (valid after placeholder-check: 65)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | Llif y Chwest | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `rooms.actions.open` | Mewngofnodi | **Mynediad** | Current means 'Log in'; 'Mynediad' means 'Enter/Access' which fits context. |
| `balance.minutes_few` | {{count}} munud | **{{count}} munudau** | Incorrect plural form for 'minutes' (munudau). |
| `balance.minutes_many` | {{count}} munud | **{{count}} munudau** | Incorrect plural form for 'minutes' (munudau). |
| `balance.openPlans` | Tariffau agored a chydbwysedd | **Agor tariffau a chydbwysedd** | Word order correction for 'Open tariffs and balance'. |
| `tier.trial` | Treial | **Cyfnod Prawf** | Current 'Treial' can mean legal trial; 'Cyfnod Prawf' means 'Trial Period'. |
| `call.toPlayground` | 🎯 I'r safle tirlenwi | **🎯 I'r maes hyfforddi** | Current 'safle tirlenwi' means 'landfill site'; 'maes hyfforddi' means 'training ground'. |
| `call.more` | Yn ogystal | **Ychwanegol** | Current means 'in addition'; 'Ychwanegol' means 'Additional/More'. |
| `coach.help` | Ateb cymorth | **Cymorth i ateb** | Current means 'Answer help'; 'Cymorth i ateb' means 'Help to answer'. |
| `roomActions.translation.disableSub` | Ni fydd cofnodion yn cael eu hysgrifennu i ffwrdd mwyach | **Ni fydd munudau'n cael eu hysgrifennu i ffwrdd mwyach** | Current 'cofnodion' means 'records'; 'munudau' means 'minutes'. |
| `partner.title` | Partner program | **Rhaglen Partneriaeth** | English phrase, should be translated to Welsh. |
| `partner.subtitle` | Share your link and earn | **Rhannwch eich dolen ac ennill** | English phrase, should be translated to Welsh. |
| `partner.yourLink` | Your link | **Eich dolen** | English phrase, should be translated to Welsh. |
| `partner.copy` | Copy | **Copïo** | English word, should be translated to Welsh. |
| `partner.copied` | ✓ Link copied | **✓ Dolen wedi'i chopïo** | English phrase, should be translated to Welsh. |
| `partner.stats.clicks` | Clicks | **Cliciau** | English word, should be translated to Welsh. |
| `partner.stats.registrations` | Sign-ups | **Cofrestriadau** | English phrase, should be translated to Welsh. |
| `partner.stats.paid` | Payments | **Taliadau** | English word, should be translated to Welsh. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} defnyddiwr · {{minutes}} min** | English word 'users' should be translated to Welsh 'defnyddiwr'. |
| `partner.terms` | Program terms | **Telerau'r rhaglen** | English phrase, should be translated to Welsh. |
| `partner.contact` | Contact us | **Cysylltwch â ni** | English phrase, should be translated to Welsh. |
| `partner.termsModalTitle` | Partner program terms | **Telerau rhaglen partneriaeth** | English phrase, should be translated to Welsh. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Nid yw telerau'r rhaglen wedi'u gosod eto. Cysylltwch â SuperAdmin.** | English phrase, should be translated to Welsh. |
| `partner.loadError` | Failed to load partner data | **Methwyd llwytho data partner** | English phrase, should be translated to Welsh. |
| `sip.incoming.pausedHint` | Galluogwch y dderbynfa i gael VibeVox i ddechrau anfon galwadau sy'n dod i mewn ymlaen. | **Galluogwch y dderbynfa i gael VibeVox i ddechrau cyfieithu galwadau sy'n dod i mewn.** | Current means 'forward incoming calls'; should be 'translate incoming calls'. |
| `sip.outbound.noTrunkHint` | Llenwch y ffurflen "Trefn SIP Newydd" ar frig y dudalen - bydd VibeVox yn defnyddio'ch darparwr SIP (Zadarma, OnlinePBX, ac ati) ar gyfer galwadau sy'n mynd allan. | **Llenwch y ffurflen "Boncyff SIP Newydd" ar frig y dudalen - bydd VibeVox yn defnyddio'ch darparwr SIP (Zadarma, OnlinePBX, ac ati) ar gyfer galwadau sy'n mynd allan.** | Current 'Trefn SIP Newydd' means 'New SIP Order'; should be 'Boncyff SIP Newydd' (New SIP Trunk). |
| `sip.confirm.deleteInboundTitle` | Dileu cyfeiriad SIP ar gyfer negeseuon sy'n dod i mewn? | **Dileu cyfeiriad SIP ar gyfer galwadau sy'n dod i mewn?** | Current 'negeseuon' means 'messages'; should be 'galwadau' (calls). |
| `enterprise.tabs.questFlow` | Llif y Chwest | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.gemini.telegram.leadStartCmd` | /dechrau | **/start** | Command '/start' should be preserved, not translated. |
| `enterprise.gemini.telegram.testingLabel` | Helmed… | **Yn anfon...** | Current 'Helmed' means 'helmet'; should be 'Yn anfon...' (Sending...). |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Datglymu | **Datgysylltu** | Current 'Datglymu' means 'unfasten'; 'Datgysylltu' means 'disconnect'. |
| `enterprise.prompt.headerLeadBold1` | dim ond ar gyfer dadgryptio negeseuon mewn ystafelloedd fideo | **dim ond ar gyfer trawsgrifio negeseuon mewn ystafelloedd fideo** | Current 'dadgryptio' means 'decrypt'; should be 'trawsgrifio' (transcribe). |
| `enterprise.prompt.headerLeadBold2` | "Yn ôl eich cais" | **"Yn ôl eich prydlondeb"** | Current 'cais' means 'request'; 'prydlondeb' means 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "Yn ôl eich cais" | **"Yn ôl eich prydlondeb"** | Current 'cais' means 'request'; 'prydlondeb' means 'prompt'. |
| `enterprise.prompt.kbLead` | Llwythwch ddogfen i fyny—catalog, Cwestiynau Cyffredin, rhestr brisiau, rheoliadau, neu ddeunyddiau awgrymiadau. Caiff y cynnwys ei ddadansoddi ar y gweinydd (Word/Excel/CSV → testun) a'i integreiddio gan y deallusrwydd artiffisial wrth drawsgrifio negeseuon mewn ystafelloedd fideo. Terfyn: ffeil 50 MB / 500,000 nod yn y gronfa ddata. | **Llwythwch ddogfen i fyny—catalog, Cwestiynau Cyffredin, rhestr brisiau, rheoliadau, neu ddeunyddiau awgrymiadau. Caiff y cynnwys ei ddadansoddi ar y gweinydd (Word/Excel/CSV → testun) a'i gymysgu gan y deallusrwydd artiffisial wrth drawsgrifio negeseuon mewn ystafelloedd fideo. Terfyn: ffeil 50 MB / 500,000 nod yn y gronfa ddata.** | Current 'integreiddio' means 'integrate'; 'cymysgu' means 'mixed in' (closer to original 'подмешивается'). |
| `enterprise.prompt.presetsLeadBold` | "Yn ôl eich cais" | **"Yn ôl eich prydlondeb"** | Current 'cais' means 'request'; 'prydlondeb' means 'prompt'. |
| `enterprise.questFlow.heading` | Llif y Chwest | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.promptLabel` | Awgrym System Llif Quest | **Awgrym System Quest Flow** | Capitalize 'Quest Flow' as it's a brand name. |
| `enterprise.questFlow.errDelete` | Delete error | **Gwall dileu** | English phrase, should be translated to Welsh. |
| `enterprise.questFlow.deleteTitle` | Delete | **Dileu** | English word, should be translated to Welsh. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Dileu allwedd?** | English phrase, should be translated to Welsh. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Bydd yr allwedd yn cael ei dileu'n barhaol. Bydd Quest Flow yn rhoi'r gorau i weithio drwyddi — bydd angen i chi greu allwedd newydd a'i disodli yn y llif.** | English phrase, should be translated to Welsh. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Dileu** | English word, should be translated to Welsh. |
| `enterprise.questFlow.successPromptSaved` | Anogwr Llif y Chwest wedi'i gadw. | **Anogwr Quest Flow wedi'i gadw.** | Capitalize 'Quest Flow' as it's a brand name. |
| `enterprise.chatwoot.accountIdLabel` | ID Cyfrif (id_account) | **ID Cyfrif (account_id)** | Preserve 'account_id' exactly as specified. |
| `enterprise.chatwoot.whatSentItem1` | Cyswllt cleient (trwy telegram_user_id, gyda phriodoleddau_custom) | **Cyswllt cleient (trwy telegram_user_id, gyda custom_attributes)** | Preserve 'telegram_user_id' and 'custom_attributes' exactly as specified. |
| `enterprise.chatwoot.whatSentItem3Code` | priodoleddau_addas.vibevox_tagiau | **custom_attributes.vibevox_tags** | Preserve 'custom_attributes.vibevox_tags' exactly as specified. |
| `chat.enterpriseOnlyHint` | Mae ystafelloedd sgwrsio yn nodwedd Enterprise. Uwchraddiwch eich cynllun yn yr adran "Prisio". | **Mae ystafelloedd sgwrsio yn nodwedd Enterprise. Uwchraddiwch eich cynllun yn yr adran "Tariffau".** | Current 'Prisio' means 'Pricing'; 'Tariffau' means 'Tariffs' (closer to original 'Тарифы'). |
| `insights.summary` | Ail-ddechrau | **Crynodeb** | Current 'Ail-ddechrau' means 'resume'; 'Crynodeb' means 'Summary'. |
| `insights.sentiment` | Allwedd | **Teimlad** | Current 'Allwedd' means 'key'; 'Teimlad' means 'Sentiment'. |
| `insights.analyzedReplies_few` | {{count}} replicas wedi'u dadansoddi | **Dadansoddwyd {{count}} replica** | Incorrect plural form for 'replica' when count is 'few'. |
| `paywall.buyPlus` | Hefyd — €19/mis (60 munud) | **Plus — €19/mis (60 munud)** | Brand name 'Plus' should be preserved, not translated to 'Hefyd'. |
| `paywall.subscribe` | Dylunio | **Tanysgrifio** | Current 'Dylunio' means 'design'; 'Tanysgrifio' means 'Subscribe'. |
| `paywall.topupPlusLine` | Tariff Plws ({{count}} o leiaf wedi'i gynnwys) | **Tariff Plus ({{count}} munud wedi'i gynnwys)** | Current 'o leiaf' means 'at least'; 'munud' means 'minute'. |
| `paywall.topupAddon` | Pryniant ychwanegol {{count}} o leiaf × €0.17 | **Pryniant ychwanegol {{count}} munud × €0.17** | Current 'o leiaf' means 'at least'; 'munud' means 'minute'. |
| `postCallInsights.analyzing` | Gadewch i ni ddadansoddi'r sgwrs... | **Yn dadansoddi'r sgwrs...** | Current means 'Let's analyze'; should be 'Analyzing...'. |
| `postCallInsights.metricSentiment` | Hwyliau | **Teimlad** | Current 'Hwyliau' means 'mood'; 'Teimlad' means 'Sentiment'. |
| `postCallInsights.summary` | Ail-ddechrau | **Crynodeb** | Current 'Ail-ddechrau' means 'resume'; 'Crynodeb' means 'Summary'. |
| `billingPage.tierLabel` | Cyfradd | **Tariff** | Current 'Cyfradd' means 'rate'; 'Tariff' means 'Tariff'. |
| `billingPage.topupCarriedTooltip` | Cofnodion a gariwyd drosodd o'r cyfnod blaenorol. Nhw sy'n cael eu defnyddio i gyd yn gyntaf. | **Munudau a gariwyd drosodd o'r cyfnod blaenorol. Nhw sy'n cael eu defnyddio i gyd yn gyntaf.** | Current 'Cofnodion' means 'records'; 'Munudau' means 'minutes'. |
| `billingPage.topupCarried` | Gohiriwyd | **Cariwyd drosodd** | Current 'Gohiriwyd' means 'postponed'; 'Cariwyd drosodd' means 'carried over'. |
| `billingPage.ctaSubscribePlus` | Cael Plws | **Tanysgrifio i Plus** | Current 'Cael Plws' means 'Get Plus'; 'Tanysgrifio i Plus' means 'Subscribe to Plus'. |
| `billingPage.ctaSubscribeStandard` | Safon Archebu | **Tanysgrifio i Safonol** | Current 'Safon Archebu' means 'Order Standard'; 'Tanysgrifio i Safonol' means 'Subscribe to Standard'. |
| `billingPage.languagesCount_few` | iaith {{count}} | **ieithoedd {{count}}** | Incorrect plural form for 'languages' (ieithoedd). |
| `billingPage.renewsOn` | estyniad {{date}} | **adnewyddiad {{date}}** | Current 'estyniad' means 'extension'; 'adnewyddiad' means 'renewal'. |

⚠ 6 fix(es) skipped (no-op, missing path, or would break placeholders).
