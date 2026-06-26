# LLM Review: Javanese (jv)

**Model:** gemini-2.5-flash  
**Took:** 169.4s  
**Fixes proposed:** 73 (valid after placeholder-check: 73)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | Aliran Misi | **Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `tier.trial` | Sidang | **Uji Coba** | Incorrect word sense for 'Trial' (subscription context). |
| `tier.standardYearly` | Saben taun | **Yearly** | Brand name 'Yearly' should not be translated. |
| `moreSheet.enterprise.sub` | Kunci Gemini, Aliran Quest, tag, CRM | **Kunci Gemini, Quest Flow, tag, CRM** | Brand name 'Quest Flow' should not be translated. |
| `call.toPlayground` | 🎯 Menyang TPA | **🎯 Menyang papan latihan** | Incorrect word sense for 'Playground' (training ground, not landfill). |
| `roomActions.translation.disableSub` | Risalah ora bakal diilangi maneh | **Menit ora bakal diilangi maneh** | Incorrect word sense for 'Минуты' (time minutes, not meeting minutes). |
| `settings.themeDarkSub` | Aurora Jurang (Peteng) | **Abyss Aurora (Peteng)** | Brand name 'Abyss Aurora' should not be translated. |
| `settings.themeLightSub` | Aurora Awan (Cahya) | **Cloud Aurora (Cahya)** | Brand name 'Cloud Aurora' should not be translated. |
| `partner.subtitle` | Share your link and earn | **Nuduhake pranala sampeyan lan entuk dhuwit** | English text found in Javanese translation. |
| `partner.yourLink` | Your link | **Pranala sampeyan** | English text found in Javanese translation. |
| `partner.copy` | Copy | **Salin** | English text found in Javanese translation. |
| `partner.copied` | ✓ Link copied | **✓ Pranala disalin** | English text found in Javanese translation. |
| `partner.stats.clicks` | Clicks | **Klik** | English text found in Javanese translation. |
| `partner.stats.registrations` | Sign-ups | **Registrasi** | English text found in Javanese translation. |
| `partner.stats.paid` | Payments | **Pembayaran** | English text found in Javanese translation. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} panganggo · {{minutes}} menit** | English text and 'min' should be translated to Javanese 'menit'. |
| `partner.terms` | Program terms | **Katentuan program** | English text found in Javanese translation. |
| `partner.contact` | Contact us | **Hubungi kita** | English text found in Javanese translation. |
| `partner.termsModalTitle` | Partner program terms | **Katentuan program mitra** | English text found in Javanese translation. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Katentuan program durung disetel. Mangga hubungi SuperAdmin.** | English text found in Javanese translation. |
| `partner.loadError` | Failed to load partner data | **Gagal mbukak data mitra** | English text found in Javanese translation. |
| `sip.newTrunk` | Bagasi SIP anyar | **Trunk SIP anyar** | Incorrect word sense for 'trunk' (telephony term). Should be preserved or translated as 'jalur'. |
| `sip.editTrunk` | Owah setelan bagasi | **Owah setelan trunk** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.trunkId` | ID bagasi | **ID trunk** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.createTrunk` | Nggawe bagasi | **Nggawe trunk** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.outbound.noTrunkTitle` | Kapisan, nyetel trunk SIP metu | **Kapisan, nyetel SIP trunk metu** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.outbound.noTrunkHint` | Isi formulir "New SIP Trunk" ing sisih ndhuwur kaca - VibeVox bakal nggunakake panyedhiya SIP sampeyan (Zadarma, OnlinePBX, lsp.) kanggo telpon metu. | **Isi formulir "Trunk SIP Anyar" ing sisih ndhuwur kaca - VibeVox bakal nggunakake panyedhiya SIP sampeyan (Zadarma, OnlinePBX, lsp.) kanggo telpon metu.** | UI label 'New SIP Trunk' should be translated, and 'trunk' should be preserved. |
| `sip.outbound.configureFirst` | Kapisan, nyetel trunk SIP metu (formulir ing ndhuwur) | **Kapisan, nyetel SIP trunk metu (formulir ing ndhuwur)** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.howTo.step1` | Entukna kredensial trunk SIP saka panyedhiya sampeyan (Zadarma, OnlinePBX, Asterisk). | **Entukna kredensial SIP trunk saka panyedhiya sampeyan (Zadarma, OnlinePBX, Asterisk).** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.howTo.step3` | VibeVox bakal kanthi otomatis nggawe trunk SIP metu ing LiveKit Cloud. | **VibeVox bakal kanthi otomatis nggawe SIP trunk metu ing LiveKit Cloud.** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.toasts.saved` | Setelan trunk SIP disimpen | **Setelan SIP trunk disimpen** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.toasts.saveFailed` | Gagal nyimpen bagasi | **Gagal nyimpen trunk** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.toasts.deleted` | Bagean kasebut wis dibusak. | **Trunk wis dibusak.** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.toasts.deleteFailed` | Gagal mbusak batang | **Gagal mbusak trunk** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.tenantOnly.title` | Trunk SIP dikonfigurasi ing tingkat penyewa | **SIP trunk dikonfigurasi ing tingkat penyewa** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.tenantOnly.hint2` | Mlebu minangka panganggo biasa sing duwe tenantId dhewe kanggo nggawe trunk. | **Mlebu minangka panganggo biasa sing duwe tenantId dhewe kanggo nggawe SIP trunk.** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.connected` | Trunk SIP disimpen lan disinkronake karo LiveKit | **SIP trunk disimpen lan disinkronake karo LiveKit** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.danger.deleteTrunk` | Busak bagasi | **Busak trunk** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.danger.deleteTrunkHint` | Konfigurasi kasebut bakal dibusak. Telpon metu bakal mandheg nganti sampeyan nggawe maneh trunk. | **Konfigurasi kasebut bakal dibusak. Telpon metu bakal mandheg nganti sampeyan nggawe maneh SIP trunk.** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.danger.deleteInboundHint` | Aturan trunk lan pengiriman LiveKit bakal dibusak. Telpon mlebu ora bakal ditampa maneh. | **LiveKit inbound trunk lan aturan pengiriman bakal dibusak. Telpon mlebu ora bakal ditampa maneh.** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.confirm.deleteTrunkTitle` | Mbusak batang SIP? | **Mbusak SIP trunk?** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.confirm.deleteTrunkBody` | Tindakan iki ora bisa dibatalake. Sawise dibusak, telpon metu bakal mandheg nganti ana telpon anyar digawe. | **Tindakan iki ora bisa dibatalake. Sawise dibusak, telpon metu bakal mandheg nganti SIP trunk anyar digawe.** | Incorrect word sense for 'trunk' (telephony term). |
| `sip.confirm.deleteInboundBody` | Tindakan iki ora bisa dibatalake. Aturan trunk lan dispatch mlebu ing LiveKit Cloud bakal dibusak. | **Tindakan iki ora bisa dibatalake. LiveKit inbound trunk + dispatch rule ing LiveKit Cloud bakal dibusak.** | Incorrect word sense for 'trunk' (telephony term). |
| `enterprise.page.upsellBody` | Ing kene sampeyan bisa ngatur: kunci API Gemini pribadi, prompt lan basis kawruh, integrasi karo bot Quest Flow + Telegram, lan nyambung menyang Chatwoot CRM. | **Ing kene sampeyan bisa ngatur: kunci API Gemini pribadi, prompt lan basis kawruh, integrasi karo Quest Flow + bot Telegram, lan nyambung menyang Chatwoot CRM.** | Brand name 'Quest Flow' should not be translated, and 'Telegram-bot' is a compound term. |
| `enterprise.tabs.questFlow` | Aliran Misi | **Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.gemini.keyPlaceholder` | IzaSy... | **AIzaSy...** | Placeholder 'AIzaSy...' should be preserved. |
| `enterprise.gemini.telegram.leadStartCmd` | /wiwiti | **/start** | Command '/start' should be preserved, not translated. |
| `enterprise.gemini.telegram.testingLabel` | Helm… | **Ngirim…** | Incorrect translation for 'Шлём...' (Sending...). |
| `enterprise.questFlow.heading` | Aliran Misi | **Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.promptLabel` | Pitunjuk Sistem Aliran Quest | **Pitunjuk Sistem Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.kbLabel` | Basis Kawruh Aliran Misi | **Basis Kawruh Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.keysHeading` | Kunci API Aliran Quest | **Kunci API Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.errDelete` | Delete error | **Kasalahan mbusak** | English text found in Javanese translation. |
| `enterprise.questFlow.deleteTitle` | Delete | **Busak** | English text found in Javanese translation. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Busak kunci?** | English text found in Javanese translation. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Kunci bakal dibusak permanen. Quest Flow ora bakal bisa digunakake maneh liwat iki — sampeyan kudu nggawe kunci anyar lan ngganti ing alur.** | English text found in Javanese translation. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Busak** | English text found in Javanese translation. |
| `enterprise.questFlow.successPromptSaved` | Pitunjuk Alur Misi wis disimpen. | **Pitunjuk Quest Flow wis disimpen.** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.kbHeading` | Basis Kawruh kanggo Alur Quest | **Basis Kawruh kanggo Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `insights.sentiment` | Kunci | **Tonalitas** | Incorrect word sense for 'Тональность' (sentiment/tonality). |
| `paywall.subscribe` | Desain | **Ndhaptar** | Incorrect word sense for 'Оформить' (subscribe/register). |
| `paywall.featureMinutes` | Terjemahan min {{count}} | **{{count}} menit terjemahan** | Placeholder order is unnatural and 'min' should be 'menit'. |
| `paywall.topupCta` | Tuku {{count}} minimal · €{{price}} | **Tuku {{count}} menit · €{{price}}** | Incorrect word 'minimal' for 'minutes'. |
| `paywall.topupPlusLine` | Tarif Plus ({{count}} minimal kalebu) | **Tarif Plus ({{count}} menit kalebu)** | Incorrect word 'minimal' for 'minutes'. |
| `paywall.topupFreeLine` | ↳ {{count}} min gratis nganggo tarif | **↳ {{count}} menit gratis nganggo tarif** | Abbreviation 'min' should be 'menit'. |
| `paywall.topupAddon` | Tuku tambahan {{count}} min × €0.17 | **Tuku tambahan {{count}} menit × €0.17** | Abbreviation 'min' should be 'menit'. |
| `billingPage.tierLabel` | Rating | **Tarif** | Incorrect word sense for 'Тариф' (pricing plan/tariff). |
| `billingPage.resume` | Resume | **Nerusake** | English text found in Javanese translation. |
| `billingPage.topupCarried` | Ditundha | **Digawa** | Incorrect word sense for 'Перенесено' (carried over). |
| `billingPage.ctaSubscribePlus` | Entuk Plus | **Ndhaptar Plus** | Incorrect word sense for 'Оформить' (subscribe/register). |
| `billingPage.ctaSubscribeStandard` | Standar Pesenan | **Ndhaptar Standard** | Incorrect word sense for 'Оформить' (subscribe/register). |
| `billingPage.faqA4` | Sembarang sing tundhuk karo RFC: Zadarma, OnlinePBX, Asterisk/FreePBX, lan liya-liyane. VibeVox nggawe trunk metu kanthi otomatis. | **Sembarang sing tundhuk karo RFC: Zadarma, OnlinePBX, Asterisk/FreePBX, lan liya-liyane. VibeVox nggawe outbound trunk kanthi otomatis.** | Incorrect word sense for 'trunk' (telephony term). |
| `billingPage.autoRenewCancelledHint` | Risalah rencana sampeyan valid nganti tanggal iki; sampeyan bisa tuku sing luwih akeh. Klik "Nerusake" yen sampeyan ngganti pikiran. | **Menit rencana sampeyan valid nganti tanggal iki; sampeyan bisa tuku sing luwih akeh. Klik "Nerusake" yen sampeyan ngganti pikiran.** | Incorrect word sense for 'Минуты' (time minutes, not meeting minutes). |
