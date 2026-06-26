# LLM Review: Sundanese (su)

**Model:** gemini-2.5-flash  
**Took:** 164.6s  
**Fixes proposed:** 79 (valid after placeholder-check: 66)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | Aliran Misi | **Quest Flow** | Brand name should be preserved. |
| `balance.openPlans` | Tarif sareng kasaimbangan kabuka | **Buka tarif sareng kasaimbangan** | Grammatical correction for verb 'open'. |
| `tier.trial` | Sidang | **Uji Coba** | Wrong word sense for 'Trial' (legal vs. subscription). |
| `tier.plus` | Ditambah | **Plus** | Brand name should be preserved. |
| `tier.standard` | Standar | **Standard** | Brand name should be preserved. |
| `tier.standardYearly` | Taunan | **Yearly** | Brand name should be preserved. |
| `sidebar.logoAria` | VibeVox — Imah | **VibeVox — Ka Imah** | More precise translation for 'to home'. |
| `moreSheet.enterprise.sub` | Konci Gemini, Aliran Quest, tag, CRM | **Konci Gemini, Quest Flow, tag, CRM** | Brand name 'Quest Flow' should be preserved. |
| `call.toPlayground` | 🎯 Ka TPA | **🎯 Ka tempat latihan** | Wrong word sense. 'TPA' means landfill, not training ground. |
| `settings.themeDarkSub` | Aurora Jurang (Poék) | **Abyss Aurora (Poék)** | Brand name 'Abyss Aurora' should be preserved. |
| `settings.themeLightSub` | Aurora Awan (Cahaya) | **Cloud Aurora (Cahaya)** | Brand name 'Cloud Aurora' should be preserved. |
| `partner.title` | Partner program | **Program Mitra** | English phrase, should be translated. |
| `partner.subtitle` | Share your link and earn | **Bagikeun tautan anjeun sareng kéngingkeun** | English phrase, should be translated. |
| `partner.yourLink` | Your link | **Tautan anjeun** | English phrase, should be translated. |
| `partner.copy` | Copy | **Salin** | English word, should be translated. |
| `partner.copied` | ✓ Link copied | **✓ Tautan disalin** | English phrase, should be translated. |
| `partner.stats.clicks` | Clicks | **Klik** | English word, should be translated. |
| `partner.stats.registrations` | Sign-ups | **Pendaftaran** | English word, should be translated. |
| `partner.stats.paid` | Payments | **Pamayaran** | English word, should be translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} pangguna · {{minutes}} menit** | English words, should be translated. Placeholders preserved. |
| `partner.terms` | Program terms | **Sarat program** | English phrase, should be translated. |
| `partner.contact` | Contact us | **Hubungi kami** | English phrase, should be translated. |
| `partner.termsModalTitle` | Partner program terms | **Sarat program mitra** | English phrase, should be translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Sarat program teu acan disetel. Mangga hubungi SuperAdmin.** | English phrase, should be translated. |
| `partner.loadError` | Failed to load partner data | **Gagal ngamuat data mitra** | English phrase, should be translated. |
| `sip.newTrunk` | Kotak SIP anyar | **Trunk SIP anyar** | Wrong word sense ('kotak' means box). 'Trunk' is a technical term. |
| `sip.editTrunk` | Robah setélan bagasi | **Robah setélan trunk** | Wrong word sense ('bagasi' means luggage). 'Trunk' is a technical term. |
| `sip.trunkId` | ID bagasi | **ID trunk** | Wrong word sense ('bagasi' means luggage). 'Trunk' is a technical term. |
| `sip.createTrunk` | Jieun batang | **Jieun trunk** | Consistency with 'trunk' as a technical term. |
| `sip.outbound.noTrunkHint` | Eusian formulir "New SIP Trunk" di luhur kaca - VibeVox bakal nganggo panyadia SIP anjeun (Zadarma, OnlinePBX, jsb.) pikeun telepon kaluar. | **Eusian formulir "Trunk SIP Anyar" di luhur kaca - VibeVox bakal nganggo panyadia SIP anjeun (Zadarma, OnlinePBX, jsb.) pikeun telepon kaluar.** | English phrase 'New SIP Trunk' should be translated. |
| `sip.toasts.saved` | Setélan batang SIP disimpen | **Setélan trunk SIP disimpen** | Consistency with 'trunk' as a technical term. |
| `sip.toasts.saveFailed` | Gagal nyimpen bagasi | **Gagal nyimpen trunk** | Wrong word sense ('bagasi' means luggage). 'Trunk' is a technical term. |
| `sip.toasts.deleted` | Batokna geus dihapus. | **Trunk geus dihapus.** | Wrong word sense ('batok' means skull/shell). 'Trunk' is a technical term. |
| `sip.toasts.deleteFailed` | Gagal ngahapus batang | **Gagal ngahapus trunk** | Consistency with 'trunk' as a technical term. |
| `sip.danger.deleteTrunk` | Hapus batang | **Hapus trunk** | Consistency with 'trunk' as a technical term. |
| `sip.confirm.deleteTrunkTitle` | Hapus batang SIP? | **Hapus trunk SIP?** | Consistency with 'trunk' as a technical term. |
| `enterprise.tabs.questFlow` | Aliran Misi | **Quest Flow** | Brand name should be preserved. |
| `enterprise.gemini.keyPlaceholder` | IzaSy... | **AIzaSy...** | Placeholder example should be preserved exactly. |
| `enterprise.gemini.telegram.leadStartCmd` | /mimiti | **/start** | Command '/start' should be preserved exactly. |
| `enterprise.gemini.telegram.testingLabel` | Helm… | **Ngirimkeun...** | Wrong word sense. 'Helm' means helmet, not sending. |
| `enterprise.questFlow.heading` | Aliran Misi | **Quest Flow** | Brand name should be preserved. |
| `enterprise.questFlow.promptLabel` | Prompt Sistem Aliran Quest | **Prompt Sistem Quest Flow** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.kbLabel` | Basis Pangaweruh Aliran Quest | **Basis Pangaweruh Quest Flow** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.keysHeading` | Konci API Aliran Quest | **Konci API Quest Flow** | Brand name 'Quest Flow' should be preserved. |
| `enterprise.questFlow.errDelete` | Delete error | **Kasalahan ngahapus** | English phrase, should be translated. |
| `enterprise.questFlow.deleteTitle` | Delete | **Hapus** | English word, should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Hapus konci?** | English phrase, should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Aliran Misi will stop working through it — you will need to create a new key and replace it in the flow. | **Konci bakal dihapus sacara permanén. Quest Flow moal tiasa dianggo deui ngalangkungan éta — anjeun kedah ngadamel konci énggal sareng ngagentosna dina aliran.** | English phrase, should be translated. Brand name 'Quest Flow' preserved. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Hapus** | English word, should be translated. |
| `enterprise.questFlow.successPromptSaved` | Pesenan Aliran Pancén disimpen. | **Prompt Quest Flow disimpen.** | Wrong word sense ('Pesenan' means order). Brand name 'Quest Flow' preserved. |
| `enterprise.questFlow.kbHeading` | Basis Pangaweruh pikeun Aliran Quest | **Basis Pangaweruh pikeun Quest Flow** | Brand name 'Quest Flow' should be preserved. |
| `insights.summary` | CV | **Ringkesan** | Wrong word sense. 'CV' means curriculum vitae, not summary. |
| `insights.sentiment` | Konci | **Nada** | Wrong word sense. 'Konci' means key, not sentiment/tone. |
| `insights.engagement` | Pacaran | **Keterlibatan** | Wrong word sense. 'Pacaran' means dating, not engagement/involvement. |
| `postCallInsights.metricEngagement` | Pacaran | **Keterlibatan** | Wrong word sense. 'Pacaran' means dating, not engagement/involvement. |
| `postCallInsights.summary` | CV | **Ringkesan** | Wrong word sense. 'CV' means curriculum vitae, not summary. |
| `paywall.buyStandard` | Standar – €29/bulan (120 menit) | **Standard — €29/bulan (120 menit)** | Brand name 'Standard' should be preserved. |
| `paywall.subscribe` | Desain | **Ngalanggan** | Wrong word sense. 'Desain' means design, not subscribe/arrange. |
| `billingPage.tierLabel` | Nilai | **Tarif** | Wrong word sense. 'Nilai' means value, not tariff/plan. |
| `billingPage.resume` | CV | **Teraskeun** | Wrong word sense. 'CV' means curriculum vitae, not resume/renew. |
| `billingPage.autoRenewCancelledHint` | Risalah rencana anjeun valid dugi ka tanggal ieu; anjeun tiasa mésér anu sanésna. Klik "Neraskeun" upami anjeun ngarobih pikiran. | **Menit rencana anjeun valid dugi ka tanggal ieu; anjeun tiasa mésér anu sanésna. Klik "Neraskeun" upami anjeun ngarobih pikiran.** | Wrong word sense ('Risalah' means meeting minutes). 'Menit' for time minutes. |
| `billingPage.tierPlusName` | Ditambah | **Plus** | Brand name 'Plus' should be preserved. |
| `billingPage.tierStandardName` | Standar | **Standard** | Brand name 'Standard' should be preserved. |
| `billingPage.featureAllStandard` | Sadayana ti Standar | **Sadayana ti Standard** | Brand name 'Standard' should be preserved. |
| `billingPage.ctaSubscribePlus` | Kéngingkeun Plus | **Ngalanggan Plus** | More appropriate translation for 'Оформить Plus' (subscribe/arrange Plus). |
| `billingPage.ctaSubscribeStandard` | Standar Pesenan | **Ngalanggan Standard** | Wrong word sense ('Pesenan' means order). Brand name 'Standard' preserved. |

⚠ 13 fix(es) skipped (no-op, missing path, or would break placeholders).
