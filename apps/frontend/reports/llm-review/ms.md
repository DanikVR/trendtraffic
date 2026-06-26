# LLM Review: Malay (ms)

**Model:** gemini-2.5-flash  
**Took:** 197.4s  
**Fixes proposed:** 125 (valid after placeholder-check: 119)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | Aliran Pencarian | **Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `rooms.actions.open` | Log masuk | **Masuk** | 'Log masuk' means 'log in to an account'; 'Masuk' means 'enter/join a room'. |
| `common.edit` | Perubahan | **Ubah** | 'Perubahan' is a noun (change); 'Ubah' is the verb (edit/change). |
| `common.success` | Sedia | **Berjaya** | 'Sedia' means 'ready'; 'Berjaya' means 'successful' for a success message. |
| `balance.openPlans` | Tarif dan keseimbangan terbuka | **Buka tarif dan baki** | Improved phrasing for 'Open plans and balance'. |
| `tier.plus` | Tambahan | **Plus** | Brand/tier name 'Plus' should be preserved, not translated. |
| `tier.standard` | Piawai | **Standard** | Brand/tier name 'Standard' should be preserved, not translated. |
| `tier.standardYearly` | Tahunan | **Yearly** | Brand/tier name 'Yearly' should be preserved, not translated. |
| `moreSheet.sip.sub` | Menyediakan batang | **Tetapan Trunk** | 'Batang' is too literal for 'trunk' in telephony. 'Trunk' should be preserved. |
| `moreSheet.enterprise.sub` | Kunci Gemini, Aliran Pencarian, tag, CRM | **Kunci Gemini, Quest Flow, tag, CRM** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `moreSheet.admin.sub` | Menyediakan integrasi dan perkhidmatan | **Konfigurasi integrasi dan perkhidmatan** | 'Menyediakan' means 'to provide'; 'Konfigurasi' means 'configuration/setting up'. |
| `call.muted` | Tiada bunyi | **Dibisukan** | 'Tiada bunyi' means 'no sound'; 'Dibisukan' means 'muted'. |
| `call.toPlayground` | 🎯 Ke tapak pelupusan sampah | **🎯 Ke tapak latihan** | 'Tapak pelupusan sampah' means 'landfill'; 'tapak latihan' is 'training ground'. |
| `call.roomFull` | 🚫 Bilik ini telah diduduki - sudah ada 2 peserta di dalamnya | **🚫 Bilik penuh — sudah ada 2 peserta di dalamnya** | 'Diduduki' is strong; 'penuh' (full) is more natural for a room. |
| `call.validating` | Menguji sambungan selamat VibeVox… | **Mengesahkan sambungan selamat VibeVox…** | 'Menguji' means 'testing'; 'Mengesahkan' means 'validating'. |
| `call.expandPeer` | Kembangkan rakan sepertuturan | **Kembangkan rakan bicara** | 'Rakan sepertuturan' is formal; 'rakan bicara' is more natural for 'conversation partner'. |
| `call.expandPeerSub` | Rakan sembang skrin penuh, anda berada di sudut | **Rakan bicara skrin penuh, anda di sudut** | 'Rakan sembang' is 'chat friend'; 'rakan bicara' is more consistent for 'conversation partner'. |
| `call.more` | Tambahan pula | **Lagi** | 'Tambahan pula' means 'furthermore'; 'Lagi' means 'more' for a button label. |
| `roomActions.translation.disableSub` | Minit tidak akan dihapuskan lagi | **Minit tidak akan dikenakan lagi** | 'Dihapuskan' means 'deleted'; 'dikenakan' means 'charged/debited'. |
| `settings.themeLight` | Tema cahaya | **Tema terang** | 'Cahaya' is light (noun); 'terang' is light (adjective). |
| `settings.themeLightSub` | Aurora Awan (Cahaya) | **Aurora Awan (Terang)** | 'Cahaya' is light (noun); 'terang' is light (adjective). |
| `partner.title` | Partner program | **Program Rakan Kongsi** | English phrase 'Partner program' should be translated. |
| `partner.subtitle` | Share your link and earn | **Kongsi pautan anda dan jana pendapatan** | English phrase should be translated. |
| `partner.yourLink` | Your link | **Pautan anda** | English phrase should be translated. |
| `partner.copy` | Copy | **Salin** | English word should be translated. |
| `partner.copied` | ✓ Link copied | **✓ Pautan disalin** | English phrase should be translated. |
| `partner.stats.clicks` | Clicks | **Klik** | English word should be translated. |
| `partner.stats.registrations` | Sign-ups | **Pendaftaran** | English word should be translated. |
| `partner.stats.paid` | Payments | **Pembayaran** | English word should be translated. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} pengguna · {{minutes}} min** | English word 'users' should be translated. |
| `partner.terms` | Program terms | **Syarat program** | English phrase should be translated. |
| `partner.contact` | Contact us | **Hubungi kami** | English phrase should be translated. |
| `partner.termsModalTitle` | Partner program terms | **Syarat program rakan kongsi** | English phrase should be translated. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **Syarat program belum ditetapkan lagi. Sila hubungi SuperAdmin.** | English sentence should be translated. |
| `partner.loadError` | Failed to load partner data | **Gagal memuatkan data rakan kongsi** | English phrase should be translated. |
| `sip.subtitle` | Menyediakan trunk untuk panggilan masuk dan keluar | **Konfigurasi Trunk untuk panggilan masuk dan keluar** | 'Menyediakan' means 'to provide'; 'Konfigurasi' means 'configuration'. 'Trunk' preserved. |
| `sip.newTrunk` | Batang SIP baharu | **SIP Trunk baharu** | 'Batang' is too literal for 'trunk'. 'SIP Trunk' should be preserved. |
| `sip.editTrunk` | Tukar tetapan trunk | **Ubah tetapan Trunk** | 'Trunk' should be preserved as a technical term. |
| `sip.loginLabel` | Nama pengguna (log masuk SIP) | **Nama pengguna (SIP login)** | 'SIP login' is a technical term and should be preserved. |
| `sip.loginShort` | Log masuk | **Login** | 'Log masuk' is a verb; 'Login' (noun) is often preserved as a technical term. |
| `sip.callerIdLabel` | ID Pemanggil (pilihan) | **Caller ID (pilihan)** | 'Caller ID' is a technical term and should be preserved. |
| `sip.createTrunk` | Buat batang | **Cipta Trunk** | 'Batang' is too literal for 'trunk'. 'Trunk' should be preserved. |
| `sip.incoming.emptyHint` | Cipta URI SIP + log masuk/kata laluan yang unik supaya pelanggan boleh menghubungi anda dari mana-mana telefon dan VibeVox akan menterjemahkan suara anda secara automatik dalam masa nyata. | **Cipta URI SIP + login/kata laluan yang unik supaya pelanggan boleh menghubungi anda dari mana-mana telefon dan VibeVox akan menterjemahkan suara anda secara automatik dalam masa nyata.** | 'Login' is a technical term and should be preserved. |
| `sip.incoming.pausedHint` | Aktifkan penerimaan untuk membolehkan VibeVox mula meneruskan panggilan masuk. | **Aktifkan penerimaan untuk membolehkan VibeVox mula menterjemah panggilan masuk.** | 'Meneruskan' means 'to continue'; 'menterjemah' means 'to translate'. |
| `sip.outbound.noTrunkTitle` | Pertama, sediakan trunk SIP keluar | **Pertama, konfigurasi SIP Trunk keluar** | 'Sediakan' means 'to prepare'; 'konfigurasi' means 'configure'. 'SIP Trunk' should be preserved. |
| `sip.outbound.noTrunkHint` | Isi borang "New SIP Trunk" di bahagian atas halaman - VibeVox akan menggunakan pembekal SIP anda (Zadarma, OnlinePBX, dll.) untuk panggilan keluar. | **Isi borang "SIP Trunk baharu" di bahagian atas halaman - VibeVox akan menggunakan pembekal SIP anda (Zadarma, OnlinePBX, dll.) untuk panggilan keluar.** | 'New SIP Trunk' is a UI string, should be translated while preserving 'SIP Trunk'. |
| `sip.outbound.configureFirst` | Pertama, sediakan trunk SIP keluar (borang di atas) | **Pertama, konfigurasi SIP Trunk keluar (borang di atas)** | 'Sediakan' means 'to prepare'; 'konfigurasi' means 'configure'. 'SIP Trunk' should be preserved. |
| `sip.howTo.heading` | Cara menyediakan | **Cara mengkonfigurasi** | 'Menyediakan' means 'to provide'; 'mengkonfigurasi' means 'to configure'. |
| `sip.howTo.step1` | Dapatkan kelayakan trunk SIP daripada pembekal anda (Zadarma, OnlinePBX, Asterisk). | **Dapatkan kelayakan SIP Trunk daripada pembekal anda (Zadarma, OnlinePBX, Asterisk).** | 'SIP Trunk' should be preserved as a technical term. |
| `sip.howTo.step3` | VibeVox akan mencipta trunk SIP keluar secara automatik dalam LiveKit Cloud. | **VibeVox akan mencipta SIP Trunk keluar secara automatik dalam LiveKit Cloud.** | 'SIP Trunk' should be preserved as a technical term. |
| `sip.toasts.saved` | Tetapan trunk SIP disimpan | **Tetapan SIP Trunk disimpan** | 'SIP Trunk' should be preserved as a technical term. |
| `sip.toasts.saveFailed` | Gagal menyimpan batang | **Gagal menyimpan Trunk** | 'Batang' is too literal for 'trunk'. 'Trunk' should be preserved. |
| `sip.toasts.deleted` | Batangnya telah dipadamkan. | **Trunk telah dipadamkan.** | 'Batangnya' is too literal for 'trunk'. 'Trunk' should be preserved. |
| `sip.toasts.deleteFailed` | Gagal memadamkan batang | **Gagal memadamkan Trunk** | 'Batang' is too literal for 'trunk'. 'Trunk' should be preserved. |
| `sip.tenantOnly.title` | Trunk SIP dikonfigurasikan pada peringkat penyewa | **SIP Trunk dikonfigurasi pada peringkat penyewa** | 'SIP Trunk' should be preserved as a technical term. |
| `sip.tenantOnly.hint2` | Log masuk sebagai pengguna biasa yang mempunyai tenantId mereka sendiri untuk mencipta trunk. | **Log masuk sebagai pengguna biasa yang mempunyai tenantId mereka sendiri untuk mencipta Trunk.** | 'Trunk' should be preserved as a technical term. |
| `sip.connected` | Trunk SIP disimpan dan disegerakkan dengan LiveKit | **SIP Trunk disimpan dan disegerakkan dengan LiveKit** | 'SIP Trunk' should be preserved as a technical term. |
| `sip.danger.deleteTrunk` | Padam batang | **Padam Trunk** | 'Batang' is too literal for 'trunk'. 'Trunk' should be preserved. |
| `sip.danger.deleteTrunkHint` | Konfigurasi akan dipadamkan. Panggilan keluar akan berhenti sehingga anda mencipta semula trunk. | **Konfigurasi akan dipadamkan. Panggilan keluar akan berhenti sehingga anda mencipta semula Trunk.** | 'Trunk' should be preserved as a technical term. |
| `sip.outbound2.callButton` | Panggilan | **Hubungi** | 'Panggilan' is a noun (call); 'Hubungi' is the verb (call/contact). |
| `sip.confirm.deleteTrunkTitle` | Padamkan batang SIP? | **Padamkan SIP Trunk?** | 'Batang' is too literal for 'trunk'. 'SIP Trunk' should be preserved. |
| `sip.confirm.deleteTrunkBody` | Tindakan ini tidak boleh dipulihkan. Setelah dipadam, panggilan keluar akan berhenti sehingga trunk baharu dibuat. | **Tindakan ini tidak boleh dipulihkan. Setelah dipadam, panggilan keluar akan berhenti sehingga Trunk baharu dibuat.** | 'Trunk' should be preserved as a technical term. |
| `sip.confirm.deleteInboundBody` | Tindakan ini tidak boleh dipulihkan. Peraturan trunk dan penghantaran masuk dalam LiveKit Cloud akan dipadamkan. | **Tindakan ini tidak boleh dipulihkan. Peraturan Trunk dan penghantaran masuk dalam LiveKit Cloud akan dipadamkan.** | 'Trunk' should be preserved as a technical term. |
| `enterprise.tabs.questFlow` | Aliran Pencarian | **Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.gemini.leadSuffix` | Digunakan dan bukannya panggilan global untuk semua panggilan Gemini pada akaun anda. | **. Digunakan menggantikan kunci global untuk semua panggilan Gemini pada akaun anda.** | Improved phrasing for 'Used instead of global calls'. |
| `enterprise.gemini.telegram.leadStartCmd` | /mula | **/start** | Telegram command '/start' should be preserved, not translated. |
| `enterprise.gemini.telegram.successSavedNoBroadcast` | ✓ Bot @{{username}} telah disimpan. Sesiapa yang menghantar mesej /mula akan menerima pemberitahuan. | **✓ Bot @{{username}} telah disimpan. Sesiapa yang menghantar mesej /start akan menerima pemberitahuan.** | Telegram command '/start' should be preserved, not translated. |
| `enterprise.gemini.telegram.successUnlinked` | Bot itu dilonggarkan. | **Bot itu dinyahpautkan.** | 'Dilonggarkan' means 'loosened'; 'dinyahpautkan' means 'unlinked'. |
| `enterprise.gemini.telegram.testingLabel` | Topi keledar… | **Menghantar…** | 'Topi keledar' means 'helmet'; 'Menghantar' means 'Sending...'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | Lepaskan | **Nyahpautkan** | 'Lepaskan' means 'release'; 'Nyahpautkan' means 'unlink'. |
| `enterprise.gemini.telegram.lastBroadcast` | Surat-menyurat terkini: dihantar {{sent}} daripada {{total}} | **Siaran terakhir: dihantar {{sent}} daripada {{total}}** | 'Surat-menyurat' means 'correspondence'; 'Siaran' means 'broadcast/mailing'. |
| `enterprise.prompt.warning` | Jangan dikelirukan dengan Aliran Misi | **Jangan dikelirukan dengan Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.prompt.headerLeadBold2` | "Menurut permintaan anda" | **"Menurut gesaan anda"** | 'Permintaan' means 'request'; 'gesaan' means 'prompt'. |
| `enterprise.prompt.contextLeadBold` | "Menurut permintaan anda" | **"Menurut gesaan anda"** | 'Permintaan' means 'request'; 'gesaan' means 'prompt'. |
| `enterprise.prompt.promptPlaceholder` | Arahan anda... | **Gesaan anda...** | 'Arahan' means 'instruction'; 'gesaan' means 'prompt'. |
| `enterprise.questFlow.heading` | Aliran Pencarian | **Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.promptLabel` | Gesaan Sistem Aliran Pencarian | **Gesaan Sistem Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.kbLabel` | Pangkalan Pengetahuan Aliran Misi | **Pangkalan Pengetahuan Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.tagsLabel` | Memerlukan Tag | **Tag Keperluan** | Improved phrasing for 'Tags of needs'. |
| `enterprise.questFlow.keysHeading` | Kekunci API Aliran Pencarian | **Kunci API Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.errDelete` | Delete error | **Ralat pemadaman** | English phrase should be translated. |
| `enterprise.questFlow.deleteTitle` | Delete | **Padam** | English word should be translated. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **Padam kunci?** | English phrase should be translated. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Kunci akan dipadamkan secara kekal. Quest Flow akan berhenti berfungsi melaluinya — anda perlu mencipta kunci baharu dan menggantikannya dalam aliran.** | English sentence should be translated. 'Quest Flow' preserved. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **Padam** | English word should be translated. |
| `enterprise.questFlow.promptLead1` | Menentukan BAGAIMANA AI berkomunikasi dengan pelanggan melalui Aliran Quest: nada, gaya, apa yang perlu dikenal pasti. | **Menentukan BAGAIMANA AI berkomunikasi dengan pelanggan melalui Quest Flow: nada, gaya, apa yang perlu dikenal pasti.** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.promptLeadBold2` | Jika anda mengisi borang anda | **Jika anda mengisi gesaan anda sendiri** | 'Borang anda' means 'your form'; 'gesaan anda sendiri' means 'your own prompt'. |
| `enterprise.questFlow.promptPlaceholder` | Arahan anda... | **Gesaan anda...** | 'Arahan' means 'instruction'; 'gesaan' means 'prompt'. |
| `enterprise.questFlow.successPromptSaved` | Gesaan Aliran Misi disimpan. | **Gesaan Quest Flow disimpan.** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.kbHeading` | Pangkalan Pengetahuan untuk Aliran Misi | **Pangkalan Pengetahuan untuk Quest Flow** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.confirmKbDeleteBody` | Pangkalan pengetahuan Aliran Misi akan dikosongkan. Tindakan ini tidak boleh dibuat asal. | **Pangkalan pengetahuan Quest Flow akan dikosongkan. Tindakan ini tidak boleh dibuat asal.** | Brand/product name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.tagsHeading` | Memerlukan Tag | **Tag Keperluan** | Improved phrasing for 'Tags of needs'. |
| `enterprise.chatwoot.accountIdLabel` | ID Akaun (id_akaun) | **ID Akaun (account_id)** | Technical term 'account_id' should be preserved, not translated. |
| `enterprise.chatwoot.tokenFieldLabel` | Token Akses Ejen (daripada Profil → Token Akses) | **Agent Access Token (daripada Profil → Access Token)** | Technical terms 'Agent Access Token' and 'Access Token' should be preserved. |
| `enterprise.chatwoot.tokenPlaceholder` | Token akses ejen | **Agent access token** | Technical term 'Agent access token' should be preserved. |
| `enterprise.chatwoot.whatSentItem2` | Perbualan dengan nota peribadi = sejarah dialog penuh | **Conversation dengan nota peribadi = sejarah dialog penuh** | Technical term 'Conversation' should be preserved, not translated. |
| `enterprise.chatwoot.whatSentItem3Code` | atribut_tersuai.tag_vibevox | **custom_attributes.vibevox_tags** | Technical term 'custom_attributes.vibevox_tags' should be preserved. |
| `chat.enterpriseOnlyHint` | Bilik sembang ialah ciri Perusahaan. Tingkatkan pelan anda di bahagian "Harga". | **Bilik sembang ialah ciri Perusahaan. Tingkatkan pelan anda di bahagian "Tarif".** | 'Harga' means 'price'; 'Tarif' means 'tariff/plan'. |
| `insights.sentiment` | Kunci | **Sentimen** | 'Kunci' means 'key'; 'Sentimen' means 'sentiment'. |
| `insights.engagement` | Pertunangan | **Penglibatan** | 'Pertunangan' means 'marriage engagement'; 'Penglibatan' means 'involvement/engagement'. |
| `postCallInsights.analyzing` | Jom kita analisis perbualan tersebut... | **Menganalisis perbualan…** | 'Jom kita' means 'Let's'; direct verb 'Menganalisis' is more appropriate. |
| `postCallInsights.metricSentiment` | Suasana hati | **Sentimen** | 'Suasana hati' means 'mood'; 'Sentimen' means 'sentiment'. |
| `postCallInsights.metricEngagement` | Pertunangan | **Penglibatan** | 'Pertunangan' means 'marriage engagement'; 'Penglibatan' means 'involvement/engagement'. |
| `lobby.languageHint` | Anda akan mendengar dan melihat sari kata daripada rakan sepasukan anda dalam bahasa tersebut. | **Anda akan mendengar dan melihat sari kata daripada rakan bicara anda dalam bahasa tersebut.** | 'Rakan sepasukan' means 'teammate'; 'rakan bicara' is 'conversation partner'. |
| `lobby.shareHint` | Salin dan hantar kepada rakan seperjuangan anda untuk menjemput mereka ke mesyuarat. | **Salin dan hantar kepada rakan bicara anda untuk menjemput mereka ke mesyuarat.** | 'Rakan seperjuangan' means 'comrade'; 'rakan bicara' is 'conversation partner'. |
| `lobby.shareSuccessHint` | ✓ Pautan telah disalin. Hantarkan kepada kenalan anda melalui Telegram / WhatsApp / E-mel. Anda boleh menutup halaman sekarang—pautan sentiasa berfungsi. | **✓ Pautan telah disalin. Hantarkan kepada rakan bicara anda melalui Telegram / WhatsApp / E-mel. Anda boleh menutup halaman sekarang—pautan sentiasa berfungsi.** | 'Kenalan' means 'contact'; 'rakan bicara' is 'conversation partner'. |
| `paywall.subscribe` | Reka Bentuk | **Langgan** | 'Reka Bentuk' means 'design'; 'Langgan' means 'subscribe'. |
| `paywall.featureHd` | Suara HD, video, Jurulatih AI | **Suara HD, video, AI Coach** | Brand/product name 'AI Coach' should be preserved, not translated. |
| `paywall.topupNoSubInfo` | ℹ Anda tidak mempunyai langganan aktif. Tambahan akan ditambahkan pada pembelian anda dengan harga €19/bulan—60 minit disertakan dengan pelan anda, jadi tiada caj tambahan. | **ℹ Anda tidak mempunyai langganan aktif. Plus akan ditambahkan pada pembelian anda dengan harga €19/bulan—60 minit disertakan dengan pelan anda, jadi tiada caj tambahan.** | Brand/tier name 'Plus' should be preserved, not translated. |
| `paywall.topupPlusLine` | Tarif Tambahan (termasuk {{count}} min) | **Tarif Plus (termasuk {{count}} min)** | Brand/tier name 'Plus' should be preserved, not translated. |
| `billingPage.resume` | Resume | **Sambung semula** | English word 'Resume' should be translated. |
| `billingPage.stripeOpening` | Pembayaran pembukaan... | **Membuka pembayaran…** | Improved phrasing for 'Opening payment...' |
| `billingPage.topupCarried` | Ditangguhkan | **Dipindahkan** | 'Ditangguhkan' means 'postponed'; 'Dipindahkan' means 'carried over'. |
| `billingPage.tierPlusName` | Tambahan | **Plus** | Brand/tier name 'Plus' should be preserved, not translated. |
| `billingPage.tierStandardName` | Piawai | **Standard** | Brand/tier name 'Standard' should be preserved, not translated. |
| `billingPage.featureLearnHub` | Hab Pembelajaran AI — dialeknya sendiri | **AI Learning Hub — dialeknya sendiri** | Brand/product name 'AI Learning Hub' should be preserved, not translated. |
| `billingPage.ctaSubscribeStandard` | Pesanan Standard | **Dapatkan Standard** | 'Pesanan' means 'order'; 'Dapatkan' means 'get/subscribe'. 'Standard' is a brand name. |
| `billingPage.faqA4` | Mana-mana yang mematuhi RFC: Zadarma, OnlinePBX, Asterisk/FreePBX, dsb. VibeVox mencipta trunk keluar secara automatik. | **Mana-mana yang mematuhi RFC: Zadarma, OnlinePBX, Asterisk/FreePBX, dsb. VibeVox mencipta Trunk keluar secara automatik.** | 'Trunk' should be preserved as a technical term. |
| `billingPage.renewsOn` | sambungan {{date}} | **pembaharuan {{date}}** | 'Sambungan' means 'connection'; 'pembaharuan' means 'renewal'. |

⚠ 6 fix(es) skipped (no-op, missing path, or would break placeholders).
