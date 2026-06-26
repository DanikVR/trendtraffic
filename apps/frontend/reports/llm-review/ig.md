# LLM Review: Igbo (ig)

**Model:** gemini-2.5-flash  
**Took:** 232.1s  
**Fixes proposed:** 213 (valid after placeholder-check: 205)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.sip` | SIP telephony | **SIP ekwentị** | Translate 'telephony' to Igbo. |
| `nav.admin` | Ndị nchịkwa panel | **Ogwe nchịkwa** | Translate 'panel' to Igbo and improve phrasing. |
| `rooms.subtitle` | Oge nkọwa gị na-arụ ọrụ n'otu oge | **Oge ntụgharị asụsụ gị na-arụ ọrụ n'otu oge** | 'nkọwa' means explanation, not translation. |
| `rooms.tabs.questFlow` | Ọsọ Nchọgharị | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `rooms.toasts.renameFailed` | Ịgbanwe aha agaghị aha ọzọ | **Ịgbanwe aha emeghị** | Improve grammatical awkwardness. |
| `rooms.toasts.deleteFailed` | Agaghị ehichapụ ihe agaghị | **Ihichapụ emeghị** | Improve grammatical awkwardness. |
| `common.edit` | Mgbanwe | **Dezie** | 'Mgbanwe' is 'change' (noun), 'Dezie' is 'edit' (verb). |
| `common.success` | Dị njikere | **Emela** | 'Dị njikere' means ready. 'Emela' means done/success. |
| `balance.label` | Nhazi nguzozi | **Nguzozi** | 'Nhazi' means arrangement. 'Nguzozi' means balance. |
| `balance.minutes` | Nkeji {{count}} | **{{count}} nkeji** | Match placeholder order with source '{{count}} мин'. |
| `balance.minutes_one` | Nkeji {{count}} | **{{count}} nkeji** | Match placeholder order with source '{{count}} минута'. |
| `balance.minutes_few` | Nkeji {{count}} | **{{count}} nkeji** | Match placeholder order with source '{{count}} минуты'. |
| `balance.minutes_many` | Nkeji {{count}} | **{{count}} nkeji** | Match placeholder order with source '{{count}} минут'. |
| `balance.minutesShort` | nkeji | **min** | Preserve 'min' as a short unit as per instructions. |
| `balance.openPlans` | Ọnụ ego na nguzozi mepere emepe | **Mepee tarifụ na nguzozi** | 'Ọnụ ego' means cost. 'Tarifụ' is the correct term for plans. |
| `tier.trial` | Ikpe | **Oge nnwale** | Wrong word sense: 'Ikpe' means court trial. 'Oge nnwale' means trial period. |
| `tier.plus` | Gụnyere | **Plus** | Preserve brand/tier name 'Plus'. |
| `tier.standard` | Ọkọlọtọ | **Standard** | Preserve brand/tier name 'Standard'. |
| `tier.standardYearly` | Kwa afọ | **Yearly** | Preserve brand/tier name 'Yearly'. |
| `sidebar.logoAria` | VibeVox — Ụlọ | **VibeVox — Gaa n'Ebe Obibi** | 'na главную' means 'to home page'. |
| `moreSheet.sip.label` | SIP telephony | **SIP ekwentị** | Translate 'telephony' to Igbo. |
| `moreSheet.sip.sub` | Ịtọ ogwe osisi | **Ịtọlite SIP trunks** | 'ogwe osisi' means tree trunk. 'SIP trunks' is a technical term. |
| `moreSheet.admin.label` | Ndị nchịkwa panel | **Ogwe nchịkwa** | Translate 'panel' to Igbo and improve phrasing. |
| `call.geminiLive` | Gemini Ndụ | **Gemini Live** | Preserve brand name 'Gemini Live'. |
| `call.toPlayground` | 🎯 Gaa n'ebe a na-ekpofu ihe | **🎯 Gaa na Playground** | 'Playground' is a technical term, not a literal dumping ground. |
| `call.validating` | Na-anwale njikọ nchekwa VibeVox… | **Na-enyocha njikọ nchekwa VibeVox…** | 'Na-anwale' means testing. 'Проверка' means checking/validating. |
| `call.connectionError` | Agaghị ejikọ na ụlọ ahụ | **Njikọ na ụlọ ahụ emeghị** | Improve grammatical awkwardness. |
| `call.roomFull` | 🚫 Ụlọ ahụ dị - mmadụ abụọ so na ya | **🚫 Ụlọ ahụ juputara - mmadụ abụọ so na ya** | 'Ụlọ ahụ dị' means available. 'Комната занята' means room is full/occupied. |
| `coach.help` | Enyemaka azịza | **Nyere aka zaa** | 'Enyemaka azịza' is 'answer help'. 'Помочь ответить' means 'help to answer'. |
| `coach.pin` | Tinye ya | **Kedo ya** | 'Tinye ya' means put it. 'Закрепить' means pin. |
| `coach.tones.joke` | Egwuregwu | **Ihe ọchị** | 'Egwuregwu' means game. 'Шутка' means joke. |
| `coach.tones.scientific` | Sayensị | **N'ụzọ sayensị** | 'Sayensị' is science (noun). 'Научно' is scientifically (adverb). |
| `coach.tones.empathic` | Ọmịiko | **N'ụzọ ọmịiko** | 'Ọmịiko' is compassion (noun). 'Эмпатично' is empathically (adverb). |
| `coach.tonePrompts.joke` | Zaa ya n'ụzọ dị mfe ma dịkwa mma. | **Zaa ya n'ụzọ dị mfe ma dịkwa mma, jiri ihe ọchị.** | Missing the 'joke' aspect of the source. |
| `coach.tonePrompts.formal` | Zaa ya n'ụzọ doro anya ma dịkwa mma. | **Zaa ya n'ụzọ iwu kwadoro na nkwanye ùgwù.** | 'doro anya' means clear. 'подчёркнуто формально и вежливо' means emphatically formal and polite. |
| `roomActions.translation.disableSub` | Agaghị edezi nkeji ọzọ | **Agaghịzi ewefu nkeji** | 'edezi' means edit. 'списываться' means to be debited/charged. |
| `billing.lowBalance` | {{n}} nkeji nke ntụgharị asụsụ fọdụrụ | **{{n}} nkeji ntụgharị asụsụ fọdụrụ** | Improve word order for 'minutes of translation'. |
| `billing.createRoomFailed` | Emeghị ime ụlọ | **Ịmepụta ụlọ emeghị** | Improve grammatical awkwardness. |
| `billing.topupCta` | Nkeji · {{price}} | **Nkeji · €{{price}}** | Missing currency symbol '€'. |
| `partner.title` | Partner program | **Mmemme mmekọ** | Translate English phrase. |
| `partner.subtitle` | Share your link and earn | **Kekọrịta njikọ gị wee nweta ego** | Translate English phrase. |
| `partner.yourLink` | Your link | **Njikọ gị** | Translate English phrase. |
| `partner.copy` | Copy | **Detuo** | Translate English word. |
| `partner.copied` | ✓ Link copied | **✓ E detuolarị njikọ ahụ** | Translate English phrase. |
| `partner.stats.clicks` | Clicks | **Pịa** | Translate English word. |
| `partner.stats.registrations` | Sign-ups | **Ndebanye aha** | Translate English phrase. |
| `partner.stats.paid` | Payments | **Ịkwụ ụgwọ** | Translate English word. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ndị ọrụ · {{minutes}} min** | Translate 'users' to Igbo. |
| `partner.terms` | Program terms | **Usoro mmemme** | Translate English phrase. |
| `partner.contact` | Contact us | **Kpọtụrụ anyị** | Translate English phrase. |
| `partner.termsModalTitle` | Partner program terms | **Usoro mmemme mmekọ** | Translate English phrase. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Emebebeghị usoro mmemme. Biko kpọtụrụ SuperAdmin.** | Translate English sentence. |
| `partner.loadError` | Failed to load partner data | **Ịbugo data mmekọ emeghị** | Translate English phrase and improve grammatical awkwardness. |
| `toneMenu.explainIn` | Kọwaa n'olu dị nro | **Kọwaa n'ụda** | 'olu dị nro' means soft tone. 'в тоне' means in tone. |
| `sip.title` | SIP telephony | **SIP ekwentị** | Translate 'telephony' to Igbo. |
| `sip.subtitle` | Ịtọ ntọala igbe maka oku na-abata na oku na-apụ apụ | **Ịtọlite SIP trunks maka oku na-abata na oku na-apụ apụ** | 'igbe' means box. 'Trunk' is a technical term. |
| `sip.newTrunk` | Ogwe SIP ọhụrụ | **SIP Trunk ọhụrụ** | 'Ogwe' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.editTrunk` | Gbanwee ntọala ogwe osisi | **Gbanwee ntọala SIP Trunk** | 'ogwe osisi' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.transport` | Njem | **Ụgbọ njem** | 'Njem' means journey. 'Транспорт' means transport. |
| `sip.encryption` | Nzochi ozi | **Ihe nzuzo** | 'Nzochi ozi' means information hiding. 'Шифрование' means encryption. |
| `sip.trunkId` | NJ Ogwe Aka | **SIP Trunk ID** | 'Ogwe Aka' means arm. 'Trunk ID' is a technical term. |
| `sip.createTrunk` | Mepụta ogwe osisi | **Mepụta SIP Trunk** | 'ogwe osisi' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.incoming.emptyTitle` | Emeghị adreesị SIP na-abata | **Adreesị SIP na-abata emeghị** | Improve grammatical awkwardness. |
| `sip.incoming.emptyHint` | Mepụta SIP URI + nbanye/paswọọdụ pụrụ iche ka ndị ahịa wee nwee ike ịkpọ gị site na ekwentị ọ bụla, VibeVox ga-asụgharị olu gị ozugbo. | **Mepụta SIP URI + nbanye/paswọọdụ pụrụ iche ka ndị ahịa wee nwee ike ịkpọ gị site na ekwentị ọ bụla, VibeVox ga-asụgharị olu na akpaghị aka.** | 'olu gị' (your voice) is too specific; the system translates any voice. |
| `sip.incoming.pausedHint` | Mee ka nnata rụọ ọrụ ka VibeVox wee malite izipu oku na-abata. | **Mee ka nnata rụọ ọrụ ka VibeVox wee malite ịtụgharị oku na-abata.** | 'izipu' means send. 'переводить' means translate. |
| `sip.incoming.createFailed` | Emeghị ka adreesị SIP gị dị mma | **Ịmepụta adreesị SIP emeghị** | Improve grammatical awkwardness. |
| `sip.incoming.deleteFailed` | Agaghị ehichapụ ihe agaghị | **Ihichapụ emeghị** | Improve grammatical awkwardness. |
| `sip.incoming.activated` | Emelitere nnabata | **A rụọla ọrụ nnabata** | 'Emelitere' means updated. 'Активирован' means activated. |
| `sip.incoming.toggleFailed` | Agaghị agbanwe nnata | **Ịgbanwe nnabata emeghị** | Improve grammatical awkwardness. |
| `sip.incoming.copyFailed` | Iṅomi agaghị | **Ịdetu emeghị** | 'Iṅomi' means imitate. 'Скопировать' means copy. |
| `sip.outbound.noTrunkTitle` | Nke mbụ, hazie ogwe SIP na-apụ apụ | **Nke mbụ, hazie SIP Trunk na-apụ apụ** | 'ogwe' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.outbound.noTrunkHint` | Dejupụta fọm "Ọgbọ SIP Ọhụrụ" dị n'elu peeji ahụ - VibeVox ga-eji onye na-enye gị SIP (Zadarma, OnlinePBX, wdg) maka oku na-apụ apụ. | **Dejupụta fọm "SIP Trunk Ọhụrụ" dị n'elu peeji ahụ - VibeVox ga-eji onye na-enye gị SIP (Zadarma, OnlinePBX, wdg) maka oku na-apụ apụ.** | 'Ọgbọ SIP Ọhụrụ' means New SIP generation. Should be 'SIP Trunk Ọhụrụ'. |
| `sip.outbound.configureFirst` | Nke mbụ, hazie ogwe SIP na-apụ apụ (fọọm dị n'elu) | **Nke mbụ, hazie SIP Trunk na-apụ apụ (fọọm dị n'elu)** | 'ogwe' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.outbound.invalidNumber` | Biko tinye nọmba ziri ezi n'ụdị mba ụwa (+XXXXXXXXXXXX) | **Biko tinye nọmba ziri ezi n'ụdị mba ụwa (+XXXXXXXXXXX)** | Placeholder mismatch: 'XXXXXXXXXXXX' vs 'XXXXXXXXXXX'. |
| `sip.outbound.callFailed` | Ịkpọghị oku agaghị | **Ịkpọ oku emeghị** | Improve grammatical awkwardness. |
| `sip.howTo.step1` | Nweta asambodo SIP n'aka onye na-enye gị ọrụ (Zadarma, OnlinePBX, Akara Mmalite). | **Nweta asambodo SIP n'aka onye na-enye gị ọrụ (Zadarma, OnlinePBX, Asterisk).** | Preserve brand name 'Asterisk'. |
| `sip.howTo.step3` | VibeVox ga-emepụta ogwe SIP na-apụ apụ na LiveKit Cloud na akpaghị aka. | **VibeVox ga-emepụta SIP Trunk na-apụ apụ na LiveKit Cloud na akpaghị aka.** | 'ogwe' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.toasts.saved` | Echekwara ntọala ogwe SIP | **Echekwara ntọala SIP Trunk** | 'ogwe' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.toasts.saveFailed` | Enweghị ike ịchekwa akpati ahụ | **Enweghị ike ịchekwa SIP Trunk** | 'akpati' means chest/box. 'SIP Trunk' is a technical term. |
| `sip.toasts.deleted` | E hichapụrụ ogwe osisi ahụ. | **E hichapụrụ SIP Trunk ahụ.** | 'ogwe osisi' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.toasts.deleteFailed` | Agaghị ehichapụ akpati ahụ | **Enweghị ike ihichapụ SIP Trunk** | 'akpati' means chest/box. 'SIP Trunk' is a technical term. |
| `sip.toasts.loadFailed` | Akwụsịghị ibu ntọala SIP: {{error}} | **Ịbugo ntọala SIP emeghị: {{error}}** | 'Akwụsịghị ibu' means did not stop loading. 'Не удалось загрузить' means failed to load. |
| `sip.validation.serverRequired` | Dee sava SIP | **Kwuo sava SIP** | 'Dee' means write. 'Укажите' means specify/indicate. |
| `sip.tenantOnly.title` | A na-ahazi ogwe SIP n'ọkwa onye nwe ụlọ | **A na-ahazi SIP Trunks n'ọkwa onye nwe ụlọ** | 'ogwe' means tree trunk. 'SIP Trunks' is a technical term. |
| `sip.tenantOnly.hint2` | Banye dịka onye ọrụ nkịtị nke nwere tenantId nke ya iji mepụta ogwe osisi. | **Banye dịka onye ọrụ nkịtị nke nwere tenantId nke ya iji mepụta SIP Trunk.** | 'ogwe osisi' means tree trunk. 'SIP Trunk' is a technical term. |
| `sip.connected` | A na-echekwa ma mekọrịta akpa SIP ahụ na LiveKit | **A na-echekwa ma mekọrịta SIP Trunk ahụ na LiveKit** | 'akpa' means bag. 'SIP Trunk' is a technical term. |
| `sip.sections.providerData` | Nkọwa maka onye na-enye gị SIP | **Data maka onye na-enye gị SIP** | 'Nkọwa' means details. 'Данные' means data. |
| `sip.danger.deleteTrunk` | Hichapụ akpati ahụ | **Hichapụ SIP Trunk** | 'akpati' means chest/box. 'SIP Trunk' is a technical term. |
| `sip.danger.deleteTrunkHint` | A ga-ehichapụ nhazi ahụ. Oku na-apụ apụ ga-akwụsị ruo mgbe ị ga-emegharị akpati ahụ. | **A ga-ehichapụ nhazi ahụ. Oku na-apụ apụ ga-akwụsị ruo mgbe ị ga-emegharị SIP Trunk ahụ.** | 'akpati' means chest/box. 'SIP Trunk' is a technical term. |
| `sip.confirm.deleteTrunkTitle` | Hichapụ akpa SIP? | **Hichapụ SIP Trunk?** | 'akpa' means bag. 'SIP Trunk' is a technical term. |
| `sip.confirm.deleteTrunkBody` | Ihe a agaghị agbanwe agbanwe. Ozugbo ehichapụrụ ya, oku ndị na-apụ apụ ga-akwụsị ruo mgbe e mepụtara akpati ọhụrụ. | **Ihe a agaghị agbanwe agbanwe. Ozugbo ehichapụrụ ya, oku ndị na-apụ apụ ga-akwụsị ruo mgbe e mepụtara SIP Trunk ọhụrụ.** | 'akpati' means chest/box. 'SIP Trunk' is a technical term. |
| `sip.confirm.deleteInboundTitle` | Wepụ adreesị SIP maka mbata? | **Wepụ adreesị SIP na-abata?** | 'mbata' means arrival. 'Входящих' means incoming. |
| `sip.confirm.deleteInboundBody` | Ihe a agaghị agbanwe agbanwe. A ga-ehichapụ iwu mbubata na mbupu na LiveKit Cloud. | **Ihe a agaghị agbanwe agbanwe. A ga-ehichapụ inbound trunk na dispatch rule na LiveKit Cloud.** | Preserve technical terms 'inbound trunk' and 'dispatch rule'. |
| `enterprise.tabs.questFlow` | Ọsọ Nchọgharị | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.gemini.aiStudioLink` | Ụlọ Ọrụ AI | **AI Studio** | Preserve brand name 'AI Studio'. |
| `enterprise.gemini.statusInvalid` | Enweghịzi uru | **Adịghị mma** | 'Enweghịzi uru' means no longer useful. 'Невалиден' means invalid. |
| `enterprise.gemini.statusNotChecked` | Ekwenyeghi na ekwenyeghi | **Enyochabeghị** | 'Ekwenyeghi na ekwenyeghi' means not agreed. 'Не проверен' means not checked. |
| `enterprise.gemini.successDeleted` | E wepụrụ igodo onye ọ bụla bi. | **E wepụrụ per-tenant igodo.** | Preserve technical term 'per-tenant'. |
| `enterprise.gemini.confirmDeleteTitle` | Wepụ igodo Gemini nke onye bi n'ụlọ ọ bụla? | **Wepụ per-tenant Gemini igodo?** | Preserve technical term 'per-tenant'. |
| `enterprise.gemini.telegram.leadStartCmd` | /malite | **/start** | Preserve command '/start'. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ E chekwaala Bot @{{username}}. Onye ọ bụla zitere ya ozi /malite ga-enweta ọkwa. | **✓ E chekwaala Bot @{{username}}. Onye ọ bụla zitere ya ozi /start ga-enweta ọkwa.** | Preserve command '/start'. |
| `enterprise.gemini.telegram.testingLabel` | Okpu agha... | **Na-eziga...** | 'Okpu agha' means helmet. 'Шлём…' means Sending…. |
| `enterprise.gemini.telegram.lastBroadcast` | Ozi kachasị ọhụrụ: {{sent}} sitere na {{total}} | **Nkesa ikpeazụ: {{sent}} sitere na {{total}}** | 'Ozi kachasị ọhụrụ' means latest message. 'Последняя рассылка' means last broadcast. |
| `enterprise.prompt.subtitle` | Ngwa ngwa na ihe ọmụma maka ntụgharị okwu naanị n'ime ụlọ vidiyo | **Ntuziaka na ihe ọmụma maka ntụgharị okwu naanị n'ime ụlọ vidiyo** | 'Ngwa ngwa' means fast/quick. 'Промпт' means prompt. |
| `enterprise.prompt.promptLabel` | Usoro sistemụ (ụda, ụdị, okwu) | **Ntuziaka sistemụ (ụda, ụdị, okwu)** | 'Usoro sistemụ' means system process. 'Системный промпт' means system prompt. |
| `enterprise.prompt.savePrompt` | Chekwaa ngwa ngwa | **Chekwaa ntuziaka** | 'Ngwa ngwa' means fast/quick. 'Промпт' means prompt. |
| `enterprise.prompt.headerLeadBold2` | "Dịka arịrịọ gị si dị" | **"Dịka ntuziaka gị si dị"** | 'arịrịọ' means request. 'промпта' means prompt. |
| `enterprise.prompt.contextHeading` | Ọnọdụ / nkwalite | **Ọnọdụ / ntuziaka** | 'nkwalite' means promotion. 'промпт' means prompt. |
| `enterprise.prompt.contextLeadBold` | "Dịka arịrịọ gị si dị" | **"Dịka ntuziaka gị si dị"** | 'arịrịọ' means request. 'промпта' means prompt. |
| `enterprise.prompt.promptPlaceholder` | Echiche gị... | **Ntuziaka gị...** | 'Echiche' means thought/idea. 'Промпт' means prompt. |
| `enterprise.prompt.savePromptLabel` | Chekwaa ngwa ngwa | **Chekwaa ntuziaka** | 'Ngwa ngwa' means fast/quick. 'Промпт' means prompt. |
| `enterprise.prompt.successPromptSaved` | Echekwara oku ozugbo. | **Echekwara ntuziaka.** | 'oku ozugbo' means immediate call. 'Промпт сохранён' means prompt saved. |
| `enterprise.prompt.errLoadSettings` | Ịbugo ntọala agaghị arụ ọrụ | **Ịbugo ntọala emeghị** | Improve grammatical awkwardness. |
| `enterprise.prompt.kbHeading` | Isi Ihe Ọmụma — TXT / Okwu / Excel / CSV | **Isi Ihe Ọmụma — TXT / Word / Excel / CSV** | Preserve brand name 'Word'. |
| `enterprise.prompt.kbCharsSuffix` | akara | **mkpụrụedemede** | 'akara' means symbol. 'символов' means characters. |
| `enterprise.prompt.errLoadFile` | Ibugo faịlụ agaghị enwe ike ibugo | **Ịbugo faịlụ emeghị** | Improve grammatical awkwardness. |
| `enterprise.prompt.errClearKb` | Mkpochapụghị ya agaghị | **Ihichapụ emeghị** | Improve grammatical awkwardness. |
| `enterprise.prompt.presetsHeading` | Ụda nkọwa dị mfe ịnweta | **Ụda nkọwa dịnụ** | 'dị mfe ịnweta' means easy to access. 'Доступные' means available. |
| `enterprise.prompt.presetsLeadBold` | "Dịka arịrịọ gị si dị" | **"Dịka ntuziaka gị si dị"** | 'arịrịọ' means request. 'промпта' means prompt. |
| `enterprise.questFlow.heading` | Ọsọ Nchọgharị | **Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.warning` | Ọ bụrụ na ubi ahụ tọgbọ chakoo, a ga-eji ihe ngosi VibeVox izugbe mee ya. | **Ọ bụrụ na ubi ahụ tọgbọ chakoo, a ga-eji ntuziaka VibeVox izugbe mee ya.** | 'ihe ngosi' means display. 'промпт' means prompt. |
| `enterprise.questFlow.promptLabel` | Mmalite Sistemụ Ọsọ Quest | **Ntuziaka Sistemụ Quest Flow** | 'Mmalite' means beginning. 'Промпт' means prompt. |
| `enterprise.questFlow.tagsLabel` | Mkpa Mkpa Mkpa | **Mkpado mkpa** | 'Mkpa Mkpa Mkpa' is repetitive. 'Теги потребностей' means need tags. |
| `enterprise.questFlow.savePrompt` | Chekwaa ngwa ngwa | **Chekwaa ntuziaka** | 'Ngwa ngwa' means fast/quick. 'Промпт' means prompt. |
| `enterprise.questFlow.keyLabelPlaceholder` | Akara (nhọrọ), dịka ọmụmaatụ: "Ụlọọgwụ ngwaahịa bot" | **Nkpado (nhọrọ), dịka ọmụmaatụ: "Ụlọọgwụ ngwaahịa bot"** | 'Akara' means mark/sign. 'Метка' means label. |
| `enterprise.questFlow.errDelete` | Delete error | **Njehie ihichapụ** | Translate English phrase. |
| `enterprise.questFlow.noLabel` | enweghị aha | **enweghị nkpado** | 'enweghị aha' means nameless. 'без метки' means without label. |
| `enterprise.questFlow.deleteTitle` | Delete | **Hichapụ** | Translate English word. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Hichapụ igodo?** | Translate English phrase. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **A ga-ehichapụ igodo ahụ kpamkpam. Quest Flow agaghịzi arụ ọrụ site na ya — ị ga-achọ ịmepụta igodo ọhụrụ ma dochie ya na usoro ahụ.** | Translate English sentence. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Hichapụ** | Translate English word. |
| `enterprise.questFlow.promptHeading` | Mkpọtụ maka mkparịta ụka na Telegram | **Ntuziaka maka mkparịta ụka na Telegram** | 'Mkpọtụ' means noise/commotion. 'Промпт' means prompt. |
| `enterprise.questFlow.promptLead3` | - ọ ga-ejikọta ya na ihe mkpali bụ isi na ihe ọmụma. | **- ọ ga-ejikọta ya na ntuziaka bụ isi na ihe ọmụma.** | 'ihe mkpali' means inspiration. 'базовым промтом' means base prompt. |
| `enterprise.questFlow.promptPlaceholder` | Echiche gị... | **Ntuziaka gị...** | 'Echiche' means thought/idea. 'Промпт' means prompt. |
| `enterprise.questFlow.successPromptSaved` | Echekwara ihe mkpali Quest Flow. | **Echekwara ntuziaka Quest Flow.** | 'ihe mkpali' means inspiration. 'Промпт' means prompt. |
| `enterprise.questFlow.kbHeading` | Isi ihe ọmụma maka Ọsọ Nchọgharị | **Isi ihe ọmụma maka Quest Flow** | Preserve brand name 'Quest Flow'. |
| `enterprise.questFlow.kbLeadBold1` | Ọ bụrụ na ihe efu | **Ọ bụrụ na ọ tọgbọ chakoo** | 'ihe efu' means empty thing. 'Если пусто' means if empty. |
| `enterprise.questFlow.kbLead3` | Site na ngalaba "Ntuziaka"—maka ndetu vidiyo. Oke: faịlụ 50 MB / mkpụrụedemede 500,000 na nchekwa data. | **Site na ngalaba "Ntuziaka"—maka ntụgharị vidiyo. Oke: faịlụ 50 MB / mkpụrụedemede 500,000 na nchekwa data.** | 'ndetu vidiyo' means video notes. 'расшифровки видео' means video transcription. |
| `enterprise.questFlow.kbCharsSuffix` | akara | **mkpụrụedemede** | 'akara' means symbol. 'символов' means characters. |
| `enterprise.questFlow.successFileUploaded` | E tinyere faịlụ "{{filename}}" (chaadị {{kbLength}}). | **E tinyere faịlụ "{{filename}}" (mkpụrụedemede {{kbLength}}).** | 'chaadị' means card. 'симв.' means characters. |
| `enterprise.questFlow.confirmKbDeleteBody` | A ga-ehichapụ ihe ọmụma Quest Flow. Agaghị ewepụ ihe a. | **A ga-ehichapụ ihe ọmụma Quest Flow. Agaghị emegharị ihe a.** | 'Agaghị ewepụ' means will not be removed. 'Действие нельзя отменить' means action cannot be undone. |
| `enterprise.questFlow.tagsHeading` | Mkpa Mkpa Mkpa | **Mkpado mkpa** | 'Mkpa Mkpa Mkpa' is repetitive. 'Теги потребностей' means need tags. |
| `enterprise.chatwoot.tokenLabel` | Ihe nnọchite anya API akara ngosi | **Akara ngosi API onye nnọchite anya** | Improve word order and clarity for 'Agent API token'. |
| `enterprise.chatwoot.accountIdLabel` | NJ Akaụntụ (njedebe akaụntụ) | **NJ Akaụntụ (account_id)** | Preserve technical term 'account_id'. |
| `enterprise.chatwoot.tokenFieldLabel` | Ihe Nnweta Onye Nnọchiteanya (site na Profaịlụ → Ihe Nnweta) | **Agent Access Token (site na Profaịlụ → Access Token)** | Preserve technical term 'Agent Access Token'. |
| `enterprise.chatwoot.tokenPlaceholder` | Ihe nrịbama nnweta onye nnọchite anya | **Agent access token** | Preserve technical term 'Agent access token'. |
| `enterprise.chatwoot.errToggle` | Mgbanwe agaghị ekwe omume | **Ịgbanwe emeghị** | Improve grammatical awkwardness. |
| `enterprise.chatwoot.errLoad` | Ịbugo ntọala agaghị arụ ọrụ | **Ịbugo ntọala emeghị** | Improve grammatical awkwardness. |
| `enterprise.chatwoot.whatSentItem1` | Kpọtụrụ onye ahịa (site na telegram_user_id, yana njirimara_custom) | **Kpọtụrụ onye ahịa (site na telegram_user_id, yana custom_attributes)** | Preserve technical term 'custom_attributes'. |
| `enterprise.chatwoot.whatSentItem2` | Mkparịta ụka na akwụkwọ ozi nkeonwe = akụkọ mkparịta ụka zuru oke | **Mkparịta ụka na ihe ndetu nkeonwe = akụkọ mkparịta ụka zuru oke** | 'akwụkwọ ozi nkeonwe' means private letter. 'приватной заметкой' means private note. |
| `enterprise.chatwoot.whatSentItem3Prefix` | E kenyere mkpa niile dị na mkpa dị na | **Mkpado mkpa niile e kenyere na** | Improve phrasing, 'mkpa dị na mkpa dị na' is repetitive. |
| `enterprise.chatwoot.whatSentItem3Code` | àgwà_aha_emere onwe ha. vibevox_tags | **custom_attributes.vibevox_tags** | Preserve technical term 'custom_attributes'. |
| `chat.deleteMessageConfirmText` | Agaghị ewepụ ihe a. A ga-ehichapụ ederede na mgbasa ozi agbakwunyere. | **Agaghị emegharị ihe a. A ga-ehichapụ ederede na mgbasa ozi agbakwunyere.** | 'Agaghị ewepụ' means will not be removed. 'Действие нельзя отменить' means action cannot be undone. |
| `chat.enterpriseOnlyHint` | Ụlọ nkata bụ atụmatụ ụlọ ọrụ. Melite atụmatụ gị na ngalaba "Ọnụahịa". | **Nkata ụlọ bụ atụmatụ ụlọ ọrụ. Melite atụmatụ gị na ngalaba "Ọnụahịa".** | 'Ụlọ nkata' means chat house. 'Чат комнаты' means room chat. |
| `chat.deleteFailed` | Agaghị ehichapụ ozi ahụ | **Ịhichapụ ozi ahụ emeghị** | Improve grammatical awkwardness. |
| `insights.recalc` | Kpọghachi akụkọ ọzọ | **Gbakọọ ọzọ** | 'Kpọghachi akụkọ ọzọ' means recall another story. 'Пересчитать' means recalculate. |
| `insights.summary` | Ọmụmụ ihe malitegharịa | **Nchịkọta** | 'Ọmụmụ ihe malitegharịa' means study resumed. 'Резюме' means summary. |
| `insights.sentiment` | Igodo | **Mmetụta** | 'Igodo' means key. 'Тональность' means tonality/sentiment. |
| `insights.analyzedReplies_one` | Nyochachara ihe nlereanya {{count}} | **Nyochachara nzaghachi {{count}}** | 'ihe nlereanya' means example. 'реплика' means reply/remark. |
| `insights.analyzedReplies_few` | Nyochachara ihe ndị e ji mee ihe atụ {{count}} | **Nyochachara nzaghachi {{count}}** | 'ihe ndị e ji mee ihe atụ' means examples used. 'реплики' means replies/remarks. |
| `insights.analyzedReplies_many` | Nyochachara ihe ndị e ji mee ihe atụ {{count}} | **Nyochachara nzaghachi {{count}}** | 'ihe ndị e ji mee ihe atụ' means examples used. 'реплик' means replies/remarks. |
| `insights.analyzedReplies_other` | Nyochachara ihe ndị e ji mee ihe atụ {{count}} | **Nyochachara nzaghachi {{count}}** | 'ihe ndị e ji mee ihe atụ' means examples used. 'реплик' means replies/remarks. |
| `insights.sentimentValues.positive` | Ezi | **Nke oma** | 'Ezi' means good/true. 'Позитив' means positive. |
| `lobby.copied` | Eṅomiri njikọ ahụ | **E detuolarị njikọ ahụ** | 'Eṅomiri' means imitated. 'Скопирована' means copied. |
| `lobby.andWord` | Na | ** na ** | Add spaces around 'na' for better readability in a sentence. |
| `paywall.subscribe` | Nhazi | **Debanye aha** | 'Nhazi' means arrangement. 'Оформить' means to subscribe/process. |
| `paywall.featureMinutes` | Nsụgharị nkeji {{count}} | **{{count}} nkeji ntụgharị asụsụ** | Improve word order for 'minutes of translation'. |
| `paywall.topupNoSubInfo` | ℹ Ị nweghị ndenye aha na-arụ ọrụ. A ga-agbakwunye na nzụta gị maka €19/ọnwa—nkeji iri isii dị na atụmatụ gị, yabụ enweghị ụgwọ ọzọ. | **ℹ Ị nweghị ndenye aha na-arụ ọrụ. A ga-agbakwunye Plus €19/ọnwa na nzụta gị—nkeji iri isii dị na atụmatụ gị, yabụ enweghị ụgwọ ọzọ.** | Preserve 'Plus' and improve phrasing. |
| `paywall.topupPlusLine` | Tụnyere Tarifụ ({{count}} nkeji gụnyere) | **Atụmatụ Plus ({{count}} nkeji gụnyere)** | 'Tụnyere Tarifụ' means Compared to plan. 'Тариф Plus' means Plus plan. |
| `billingPage.balanceLabel` | Nhazi gị | **Nguzozi gị** | 'Nhazi' means arrangement. 'Баланс' means balance. |
| `billingPage.tierLabel` | Nye ọnụego | **Atụmatụ** | 'Nye ọnụego' means give rate. 'Тариф' means plan/tariff. |
| `billingPage.canceled` | Ndebanye aha e mere maka kagbuo akara maka ya | **E debanyela aha maka ịkagbu** | Improve grammatical awkwardness and conciseness. |
| `billingPage.resumeAutoRenewQuestion` | Ị ga-amaliteghachi mgbanwe ndenye aha na akpaghị aka? | **Ị ga-amaliteghachi mmeghari ohuru ndenye aha na akpaghị aka?** | 'mgbanwe' means change. 'продление' means renewal. |
| `billingPage.resume` | Ọmụmụ ihe malitegharịa | **Maliteghachi** | 'Ọmụmụ ihe malitegharịa' means study resumed. 'Возобновить' means resume. |
| `billingPage.resumeTooltip` | Malitegharịa mmelite akpaka nke ndenye aha. | **Malitegharịa mmeghari ohuru akpaka nke ndenye aha.** | 'mmelite' means update. 'продление' means renewal. |
| `billingPage.resumeFailed` | Emeghị ka ndenye aha gị dị ọhụrụ | **Ịmaliteghachi ndenye aha emeghị** | 'dị ọhụrụ' means new/fresh. 'Не удалось возобновить' means failed to resume. |
| `billingPage.stripeOpening` | Ịkwụ ụgwọ mmeghe... | **Anyị na-emepe ịkwụ ụgwọ...** | 'Ịkwụ ụgwọ mmeghe' is a noun phrase. 'Открываем оплату' is a verb phrase. |
| `billingPage.checkoutFailed` | Emeghị ka ịkwụ ụgwọ ahụ dị mfe: {{error}} | **Ịmepe ịkwụ ụgwọ emeghị: {{error}}** | 'dị mfe' means easy. 'Не удалось открыть оплату' means failed to open payment. |
| `billingPage.topupCarried` | E yigharịrị oge | **E bugharịala** | 'E yigharịrị oge' means postponed. 'Перенесено' means carried over/transferred. |
| `billingPage.tierPlusName` | Gụnyere | **Plus** | Preserve brand/tier name 'Plus'. |
| `billingPage.tierStandardName` | Ọkọlọtọ | **Standard** | Preserve brand/tier name 'Standard'. |
| `billingPage.featureCountWithMinutes` | Ntụgharị nkeji {{count}} kwa ọnwa | **{{count}} nkeji ntụgharị asụsụ kwa ọnwa** | Improve word order for 'minutes of translation'. |
| `billingPage.featureSip` | Nkwukọrịta ekwentị SIP (na-abata na na-apụ apụ) | **SIP telephony (na-abata na na-apụ apụ)** | Preserve 'SIP telephony' as a technical term. |
| `billingPage.featureLearnHub` | AI Learning Hub — asụsụ nke ya | **AI Learning Hub — dialects nke ya** | 'asụsụ' means language. 'диалекты' means dialects. |
| `billingPage.featureBranding` | Akara ụlọ (akara ngosi, agba) | **Ịkpado ụlọ (akara ngosi, agba)** | 'Akara ụlọ' means house mark. 'Брендирование комнат' means room branding. |
| `billingPage.featureRollover` | Na-ebuga nkeji ole na ole ruo ọnwa na-abịa | **Ịbugharị nkeji ruo ọnwa na-abịa** | 'nkeji ole na ole' means a few minutes. 'Перенос минут' means transfer of minutes. |
| `billingPage.featureTelegramAuth` | Ikike Telegram + njikọ na kaadị | **Njikike Telegram + njikọ na kaadị** | 'Ikike' means authority. 'Авторизация' means authorization. |
| `billingPage.featureSmartTags` | Nkpado mkpa nke ọma | **Nkpado mkpa nwere ọgụgụ isi** | 'nke ọma' means well. 'Умное тегирование' means smart tagging. |
| `billingPage.ctaSubscribePlus` | Nweta mgbakwunye | **Debanye aha Plus** | 'Nweta mgbakwunye' means get addition. 'Оформить Plus' means subscribe to Plus. |
| `billingPage.ctaSubscribeStandard` | Ụkpụrụ Iwu | **Debanye aha Standard** | 'Ụkpụrụ Iwu' means legal standard. 'Оформить Standard' means subscribe to Standard. |
| `billingPage.faqQ3` | Gịnị ka ụlọ ọrụ gụnyere? | **Gịnị ka Enterprise gụnyere?** | Preserve brand/tier name 'Enterprise'. |
| `billingPage.faqQ4` | Kedu onye na-enye ọrụ ekwentị SIP ị chọrọ? | **Kedu onye na-enye ọrụ SIP telephony ị chọrọ?** | Preserve 'SIP telephony' as a technical term. |
| `billingPage.faqA4` | Ọ bụla nke dabara na RFC: Zadarma, OnlinePBX, Akara ngosi/FreePBX, wdg. VibeVox na-emepụta ogwe aka na-apụ apụ na akpaghị aka. | **Ọ bụla nke dabara na RFC: Zadarma, OnlinePBX, Asterisk/FreePBX, wdg. VibeVox na-emepụta outbound trunk na akpaghị aka.** | Preserve brand name 'Asterisk' and technical term 'outbound trunk'. |
| `billingPage.renewsOn` | ndọtị {{date}} | **Mmeghari ohuru {{date}}** | 'ndọtị' means extension. 'продление' means renewal. |
| `billingPage.autoRenewCancelledHint` | Oge nke atụmatụ gị dị irè ruo ụbọchị a; ị nwere ike ịzụta ndị ọzọ. Pịa "Resume" ma ọ bụrụ na ị gbanwee obi gị. | **Oge nke atụmatụ gị dị irè ruo ụbọchị a; ị nwere ike ịzụta ndị ọzọ. Pịa "Maliteghachi" ma ọ bụrụ na ị gbanwee obi gị.** | Translate English word 'Resume'. |
| `auth.login.googleSignInFailed` | Ịbanyeghị site na Google agaghị | **Ịbanye site na Google emeghị** | Improve grammatical awkwardness. |
| `auth.register.registerFailed` | Ịdenye aha agaghị | **Ịdenye aha emeghị** | Improve grammatical awkwardness. |
| `auth.register.agreementAnd` | Na | ** na ** | Add spaces around 'na' for better readability in a sentence. |
| `auth.forgot.backToLogin` | ← Laghachi n'ọnụ ụzọ ámá | **← Laghachi na nbanye** | 'ọnụ ụzọ ámá' means gate. 'к входу' means to login. |
| `auth.forgot.sendFailed` | Ezipụghị ozi-e agaghị | **Ịzipụ ozi-e emeghị** | Improve grammatical awkwardness. |
| `postCallInsights.subtitle` | Nghọta azụmaahịa · mgbe oku gasịrị | **Enterprise insights · mgbe oku gasịrị** | Preserve 'Enterprise' as a tier name. |
| `postCallInsights.analyzing` | Ka anyị nyochaa mkparịta ụka ahụ... | **Anyị na-enyocha mkparịta ụka ahụ...** | 'Ka anyị nyochaa' means let's analyze. 'Анализируем' means analyzing. |
| `postCallInsights.metricSentiment` | Ọnọdụ | **Mmetụta** | 'Ọnọdụ' means situation. 'Настроение' means mood/sentiment. |
| `postCallInsights.summary` | Ọmụmụ ihe malitegharịa | **Nchịkọta** | 'Ọmụmụ ihe malitegharịa' means study resumed. 'Резюме' means summary. |
| `settingsMore.balance` | Nha nke nkeji | **Nguzozi nkeji** | 'Nha' means size. 'Баланс минут' means balance of minutes. |

⚠ 8 fix(es) skipped (no-op, missing path, or would break placeholders).
