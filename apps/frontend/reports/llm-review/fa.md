# LLM Review: Persian (fa)

**Model:** gemini-2.5-flash  
**Took:** 734.3s  
**Fixes proposed:** 154 (valid after placeholder-check: 143)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `rooms.tabs.questFlow` | جریان کوئست | **Quest Flow** | Brand name must be preserved. |
| `rooms.tabs.vibeAdd` | ویبی‌اد | **VibeAdd** | Brand name must be preserved. |
| `tier.trial` | محاکمه | **دوره آزمایشی** | Wrong word sense: 'محاکمه' means legal trial. 'دوره آزمایشی' is correct for subscription. |
| `tier.enterprise` | تصدی | **سازمانی** | 'تصدی' is less common for a business tier name. 'سازمانی' is more appropriate. |
| `moreSheet.sip.sub` | راه اندازی صندوق عقب | **راه‌اندازی ترانک** | 'صندوق عقب' is wrong word sense; 'ترانک' is the correct technical term. |
| `moreSheet.enterprise.sub` | کلید جمینی، کوئست فلو، برچسب‌ها، CRM | **کلید Gemini، Quest Flow، برچسب‌ها، CRM** | Brand names (Gemini, Quest Flow, CRM) must be preserved. |
| `call.geminiLive` | جمینی زنده | **Gemini Live** | Brand name 'Gemini' must be preserved. |
| `call.toPlayground` | 🎯 به محل دفن زباله | **🎯 به زمین تمرین** | 'محل دفن زباله' is wrong word sense; 'زمین تمرین' is correct for training ground. |
| `call.more` | علاوه بر این | **بیشتر** | 'علاوه بر این' is an adverb, 'بیشتر' is a better translation for 'More' in a menu context. |
| `settings.themeDarkSub` | شفق قطبی (تاریک) | **Abyss Aurora (تاریک)** | Brand name 'Abyss Aurora' must be preserved. |
| `settings.themeLightSub` | شفق قطبی ابری (نور) | **Cloud Aurora (نور)** | Brand name 'Cloud Aurora' must be preserved. |
| `partner.title` | Partner program | **برنامه همکاری** | English string, needs translation. |
| `partner.subtitle` | Share your link and earn | **لینک خود را به اشتراک بگذارید و کسب درآمد کنید** | English string, needs translation. |
| `partner.yourLink` | Your link | **لینک شما** | English string, needs translation. |
| `partner.copy` | Copy | **کپی** | English string, needs translation. |
| `partner.copied` | ✓ Link copied | **✓ لینک کپی شد** | English string, needs translation. |
| `partner.stats.clicks` | Clicks | **کلیک‌ها** | English string, needs translation. |
| `partner.stats.registrations` | Sign-ups | **ثبت‌نام‌ها** | English string, needs translation. |
| `partner.stats.paid` | Payments | **پرداخت‌ها** | English string, needs translation. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} کاربر · {{minutes}} دقیقه** | English string, needs translation. Placeholders preserved. |
| `partner.terms` | Program terms | **شرایط برنامه** | English string, needs translation. |
| `partner.contact` | Contact us | **تماس با ما** | English string, needs translation. |
| `partner.termsModalTitle` | Partner program terms | **شرایط برنامه همکاری** | English string, needs translation. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **شرایط برنامه هنوز تنظیم نشده است. لطفاً با SuperAdmin تماس بگیرید.** | English string, needs translation. |
| `partner.loadError` | Failed to load partner data | **بارگیری داده‌های همکاری ناموفق بود** | English string, needs translation. |
| `sip.subtitle` | راه اندازی ترانک برای تماس های ورودی و خروجی | **راه‌اندازی ترانک برای تماس‌های ورودی و خروجی** | 'صندوق عقب' is wrong word sense; 'ترانک' is the correct technical term. |
| `sip.transport` | حمل و نقل | **انتقال** | 'حمل و نقل' is too general; 'انتقال' is more appropriate for network transport. |
| `sip.trunkId` | شناسه صندوق عقب | **شناسه ترانک** | 'صندوق عقب' is wrong word sense; 'ترانک' is the correct technical term. |
| `sip.createTrunk` | یک صندوق عقب ایجاد کنید | **ایجاد ترانک** | 'صندوق عقب' is wrong word sense; 'ترانک' is the correct technical term. |
| `sip.toasts.saveFailed` | ذخیره صندوق عقب ناموفق بود | **ذخیره ترانک ناموفق بود** | 'صندوق عقب' is wrong word sense; 'ترانک' is the correct technical term. |
| `sip.toasts.deleted` | صندوق عقب حذف شده است. | **ترانک حذف شده است.** | 'صندوق عقب' is wrong word sense; 'ترانک' is the correct technical term. |
| `sip.danger.deleteTrunk` | حذف صندوق عقب | **حذف ترانک** | 'صندوق عقب' is wrong word sense; 'ترانک' is the correct technical term. |
| `enterprise.page.upsellBody` | در اینجا می‌توانید موارد زیر را پیکربندی کنید: یک کلید API شخصی Gemini، یک پایگاه دانش و اعلان، ادغام با ربات تلگرام Quest Flow + و اتصال به Chatwoot CRM. | **در اینجا می‌توانید موارد زیر را پیکربندی کنید: یک کلید API شخصی Gemini، یک پایگاه دانش و اعلان، ادغام با ربات Telegram Quest Flow + و اتصال به Chatwoot CRM.** | Brand names (Gemini, Quest Flow, Telegram, Chatwoot, CRM) must be preserved. |
| `enterprise.tabs.gemini` | API جمینی | **Gemini API** | Brand name 'Gemini' must be preserved. |
| `enterprise.tabs.questFlow` | جریان کوئست | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.tabs.chatwoot` | CRM (چت ووت) | **CRM (Chatwoot)** | Brand names (CRM, Chatwoot) must be preserved. |
| `enterprise.gemini.heading` | کلید API گوگل جمینی | **Google Gemini API کلید** | Brand names (Google, Gemini, API) must be preserved. |
| `enterprise.gemini.aiStudioLink` | استودیو هوش مصنوعی | **AI Studio** | Brand name 'AI Studio' must be preserved. |
| `enterprise.gemini.keyPlaceholder` | آیزاسی... | **AIzaSy...** | Placeholder for an API key should be preserved exactly (Latin characters). |
| `enterprise.gemini.errEnterKey` | کلید API جمینی خود را وارد کنید | **کلید Gemini API خود را وارد کنید** | Brand name 'Gemini' must be preserved. |
| `enterprise.gemini.successValid` | کلید معتبر است - رابط برنامه‌نویسی نرم‌افزار Gemini در دسترس است. | **کلید معتبر است - Gemini API در دسترس است.** | Brand name 'Gemini' must be preserved. |
| `enterprise.gemini.confirmDeleteTitle` | کلید Gemini مخصوص هر مستاجر حذف می‌شود؟ | **کلید Gemini مخصوص هر مستاجر حذف شود؟** | Brand name 'Gemini' must be preserved. |
| `enterprise.gemini.telegram.heading` | ربات تلگرام برای اطلاع رسانی | **ربات Telegram برای اطلاع رسانی** | Brand name 'Telegram' must be preserved. |
| `enterprise.gemini.telegram.botFatherLabel` | @بات‌فادر | **@BotFather** | Brand name '@BotFather' must be preserved. |
| `enterprise.gemini.telegram.leadStartCmd` | /شروع | **/start** | Command '/start' should be preserved as is. |
| `enterprise.gemini.telegram.tokenLabel` | توکن ربات تلگرام | **توکن ربات Telegram** | Brand name 'Telegram' must be preserved. |
| `enterprise.gemini.telegram.tokenPlaceholder` | ۱۲۳۴۵۶۷۸۹:ABCdefGHIjklMNO... | **123456789:ABCdefGHIjklMNO...** | Placeholder should be preserved exactly (Latin numbers). |
| `enterprise.gemini.telegram.successTestSingle` | ✓ پیام تحویل داده شد. تلگرام را بررسی کنید. | **✓ پیام تحویل داده شد. Telegram را بررسی کنید.** | Brand name 'Telegram' must be preserved. |
| `enterprise.gemini.telegram.successTestMany` | ✓ پیام به گیرندگان {{count}} تحویل داده شد. لطفاً تلگرام را بررسی کنید. | **✓ پیام به گیرندگان {{count}} تحویل داده شد. لطفاً Telegram را بررسی کنید.** | Brand name 'Telegram' must be preserved. |
| `enterprise.gemini.telegram.successUnlinked` | ربات از حالت قفل خارج شده است. | **ربات از حالت اتصال خارج شد.** | 'از حالت قفل خارج شده است' is wrong word sense; 'از حالت اتصال خارج شد' is correct for unlinking. |
| `enterprise.gemini.telegram.testingLabel` | کلاه ایمنی… | **در حال ارسال...** | 'کلاه ایمنی' is completely wrong word sense; 'در حال ارسال...' is correct for 'Sending...'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | باز کردن | **جدا کردن** | 'باز کردن' is ambiguous; 'جدا کردن' is clearer for unlinking. |
| `enterprise.prompt.subtitle` | پایگاه دانش و سرعت بالا برای رونویسی فقط در اتاق‌های ویدیو | **پایگاه دانش و پرامپت فقط برای رونویسی در اتاق‌های ویدیو** | 'سرعت بالا' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.warning` | با کوئست فلو اشتباه نشود | **با Quest Flow اشتباه نشود** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.prompt.promptLabel` | راهنمای سیستم (لحن، سبک، واژگان) | **پرامپت سیستم (لحن، سبک، واژگان)** | 'راهنمای سیستم' is wrong word sense; 'پرامپت سیستم' is correct for 'system prompt'. |
| `enterprise.prompt.savePrompt` | ذخیره اعلان | **ذخیره پرامپت** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.defaultLabel` | اعلان پیش‌فرض VibeVox | **پرامپت پیش‌فرض VibeVox** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. Brand name 'VibeVox' preserved. |
| `enterprise.prompt.headerLeadBold1` | فقط برای رمزگشایی پیام‌ها در اتاق‌های ویدیویی | **فقط برای رونویسی پیام‌ها در اتاق‌های ویدیویی** | 'رمزگشایی' implies decryption; 'رونویسی' is more accurate for transcription. |
| `enterprise.prompt.headerLeadPart2` | - وقتی روی یک پیام در چت کلیک می‌کنید و یک آهنگ را انتخاب می‌کنید | **- وقتی روی یک پیام در چت کلیک می‌کنید و یک لحن را انتخاب می‌کنید** | 'آهنگ' is wrong word sense; 'لحن' is correct for 'tone'. |
| `enterprise.prompt.headerLeadBold2` | «طبق درخواست شما» | **«طبق پرامپت شما»** | 'درخواست' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.contextHeading` | متن / اعلان | **متن / پرامپت** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.contextLeadPart1` | زمانی استفاده می‌شود که در یک چت روم ویدیویی روی یک پیام کلیک می‌کنید و یک آهنگ را انتخاب می‌کنید. | **زمانی استفاده می‌شود که در یک چت روم ویدیویی روی یک پیام کلیک می‌کنید و یک لحن را انتخاب می‌کنید.** | 'آهنگ' is wrong word sense; 'لحن' is correct for 'tone'. |
| `enterprise.prompt.contextLeadBold` | «طبق درخواست شما» | **«طبق پرامپت شما»** | 'درخواست' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.extendNoteText` | با قوانین/سبک/اصطلاحات خاص خود - آنها با اعلان پیش‌فرض بالا و پایگاه دانش ترکیب خواهند شد. | **با قوانین/سبک/اصطلاحات خاص خود - آنها با پرامپت پیش‌فرض بالا و پایگاه دانش ترکیب خواهند شد.** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.promptPlaceholder` | پیام شما ... | **پرامپت شما ...** | 'پیام' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.savePromptLabel` | ذخیره اعلان | **ذخیره پرامپت** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.successPromptSaved` | اعلان ذخیره شد. | **پرامپت ذخیره شد.** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.kbCharsSuffix` | نمادها | **کاراکتر** | 'نمادها' is wrong word sense; 'کاراکتر' is correct for 'characters'. |
| `enterprise.prompt.presetsLeadBold` | «طبق درخواست شما» | **«طبق پرامپت شما»** | 'درخواست' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.prompt.presetsLeadPart2` | از دستور شما در فیلد بالا استفاده می‌کند. | **از پرامپت شما در فیلد بالا استفاده می‌کند.** | 'دستور' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.questFlow.heading` | جریان کوئست | **Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.subtitle` | پاسخ‌های هوش مصنوعی به مشتریان از طریق ربات‌های تلگرام و API ورودی | **پاسخ‌های هوش مصنوعی به مشتریان از طریق ربات‌های Telegram و Inbound API** | Brand names (Telegram, API) must be preserved. |
| `enterprise.questFlow.warning` | اگر فیلد خالی باشد، از اعلان عمومی VibeVox استفاده می‌شود. | **اگر فیلد خالی باشد، از پرامپت عمومی VibeVox استفاده می‌شود.** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. Brand name 'VibeVox' preserved. |
| `enterprise.questFlow.promptLabel` | اعلان سیستم جریان کوئست | **پرامپت سیستم Quest Flow** | Brand name 'Quest Flow' must be preserved. 'اعلان' is wrong word sense; 'پرامپت' is correct. |
| `enterprise.questFlow.kbLabel` | پایگاه دانش کوئست فلو | **پایگاه دانش Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.headerLead` | گفتگوی هوش مصنوعی با هر مشتری به صورت جداگانه از طریق یک ربات تلگرام متصل به Quest Flow. | **گفتگوی هوش مصنوعی با هر مشتری به صورت جداگانه از طریق یک ربات Telegram متصل به Quest Flow.** | Brand names (Telegram, Quest Flow) must be preserved. |
| `enterprise.questFlow.keysHeading` | کلیدهای API کوئست فلو | **کلیدهای API Quest Flow** | Brand names (API, Quest Flow) must be preserved. |
| `enterprise.questFlow.keysLead` | هر کلید، یک راز است که شما در بلوک HTTP کوئست فلو از یک زنجیره وارد می‌کنید. ویب‌واکس از آن برای شناسایی حساب شما استفاده می‌کند. می‌توانید چندین کلید برای زنجیره‌های مختلف ایجاد کنید. | **هر کلید، یک راز است که شما در بلوک HTTP Quest Flow از یک زنجیره وارد می‌کنید. VibeVox از آن برای شناسایی حساب شما استفاده می‌کند. می‌توانید چندین کلید برای زنجیره‌های مختلف ایجاد کنید.** | Brand names (HTTP, Quest Flow, VibeVox) must be preserved. |
| `enterprise.questFlow.errDelete` | Delete error | **خطای حذف** | English string, needs translation. |
| `enterprise.questFlow.deleteTitle` | Delete | **حذف** | English string, needs translation. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **کلید حذف شود؟** | English string, needs translation. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **کلید برای همیشه حذف خواهد شد. Quest Flow از طریق آن کار نخواهد کرد — باید یک کلید جدید ایجاد کرده و آن را در جریان جایگزین کنید.** | English string, needs translation. Brand name 'Quest Flow' preserved. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **حذف** | English string, needs translation. |
| `enterprise.questFlow.promptHeading` | درخواست برای مکالمات تلگرام | **پرامپت برای مکالمات Telegram** | 'درخواست' is wrong word sense; 'پرامپت' is correct for 'prompt'. Brand name 'Telegram' preserved. |
| `enterprise.questFlow.promptLead2` | — از اعلان عمومی VibeVox استفاده می‌شود (در زیر). | **— از پرامپت عمومی VibeVox استفاده می‌شود (در زیر).** | 'اعلان' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. Brand name 'VibeVox' preserved. |
| `enterprise.questFlow.promptLead3` | - با دستورالعمل اولیه و پایگاه دانش ترکیب خواهد شد. | **- با پرامپت اولیه و پایگاه دانش ترکیب خواهد شد.** | 'دستورالعمل' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.questFlow.promptPlaceholder` | پیام شما ... | **پرامپت شما ...** | 'پیام' is wrong word sense; 'پرامپت' is the correct term for 'prompt'. |
| `enterprise.questFlow.successPromptSaved` | اعلان جریان کوئست ذخیره شد. | **پرامپت Quest Flow ذخیره شد.** | Brand name 'Quest Flow' must be preserved. 'اعلان' is wrong word sense; 'پرامپت' is correct. |
| `enterprise.questFlow.kbHeading` | پایگاه دانش برای کوئست فلو | **پایگاه دانش برای Quest Flow** | Brand name 'Quest Flow' must be preserved. |
| `enterprise.questFlow.kbCharsSuffix` | نمادها | **کاراکتر** | 'نمادها' is wrong word sense; 'کاراکتر' is correct for 'characters'. |
| `enterprise.chatwoot.heading` | ادغام CRM (چت ووت) | **ادغام CRM (Chatwoot)** | Brand names (CRM, Chatwoot) must be preserved. |
| `enterprise.chatwoot.urlLabel` | آدرس اینترنتی چت ووت (برای مثال، https://app.chatwoot.com) | **URL Chatwoot (برای مثال، https://app.chatwoot.com)** | Brand name 'Chatwoot' must be preserved. |
| `enterprise.chatwoot.headingShort` | CRM (چت ووت) | **CRM (Chatwoot)** | Brand names (CRM, Chatwoot) must be preserved. |
| `enterprise.chatwoot.urlFieldLabel` | آدرس اینترنتی Chatwoot (خود میزبان یا app.chatwoot.com) | **Chatwoot URL (خود میزبان یا app.chatwoot.com)** | Brand name 'Chatwoot' must be preserved. |
| `enterprise.chatwoot.whatSentItem3Code` | برچسب‌های_ویب_وو_اکس_ویژگی‌های_سفارشی | **custom_attributes.vibevox_tags** | Code/variable name must be preserved exactly. |
| `enterprise.chatwoot.docsLabel` | مستندات API چت‌وت | **مستندات Chatwoot API** | Brand names (Chatwoot, API) must be preserved. |
| `chat.telegramBadge` | تلگرام | **Telegram** | Brand name 'Telegram' must be preserved. |
| `insights.sentiment` | کلید | **لحن** | 'کلید' is wrong word sense; 'لحن' is correct for tone/sentiment. |
| `insights.engagement` | نامزدی | **مشارکت** | 'نامزدی' is wrong word sense; 'مشارکت' is correct for user engagement. |
| `insights.leadScore` | امتیاز سرب | **امتیاز سرنخ** | 'سرب' is wrong word sense; 'سرنخ' is correct for sales lead. |
| `insights.analyzedReplies_one` | کپی {{count}} مورد تجزیه و تحلیل قرار گرفت | **{{count}} پاسخ مورد تجزیه و تحلیل قرار گرفت** | 'کپی' is wrong word sense; 'پاسخ' is correct for reply/utterance. |
| `insights.analyzedReplies_few` | کپی‌های {{count}} مورد تجزیه و تحلیل قرار گرفتند | **{{count}} پاسخ مورد تجزیه و تحلیل قرار گرفتند** | 'کپی' is wrong word sense; 'پاسخ' is correct for replies/utterances. |
| `insights.analyzedReplies_many` | کپی‌های {{count}} مورد تجزیه و تحلیل قرار گرفتند | **{{count}} پاسخ مورد تجزیه و تحلیل قرار گرفتند** | 'کپی' is wrong word sense; 'پاسخ' is correct for replies/utterances. |
| `insights.analyzedReplies_other` | کپی‌های {{count}} مورد تجزیه و تحلیل قرار گرفتند | **{{count}} پاسخ مورد تجزیه و تحلیل قرار گرفتند** | 'کپی' is wrong word sense; 'پاسخ' is correct for replies/utterances. |
| `lobby.shareSuccessHint` | ✓ لینک کپی شده است. آن را از طریق تلگرام / واتس‌اپ / ایمیل برای مخاطب خود ارسال کنید. اکنون می‌توانید صفحه را ببندید - لینک همیشه کار می‌کند. | **✓ لینک کپی شده است. آن را از طریق Telegram / WhatsApp / ایمیل برای مخاطب خود ارسال کنید. اکنون می‌توانید صفحه را ببندید - لینک همیشه کار می‌کند.** | Brand names (Telegram, WhatsApp) must be preserved. |
| `paywall.buyPlus` | بعلاوه — ۱۹ یورو در ماه (۶۰ دقیقه) | **Plus — ۱۹ یورو در ماه (۶۰ دقیقه)** | Brand name 'Plus' must be preserved. |
| `paywall.buyStandard` | استاندارد - ۲۹ یورو در ماه (۱۲۰ دقیقه) | **Standard — ۲۹ یورو در ماه (۱۲۰ دقیقه)** | Brand name 'Standard' must be preserved. |
| `paywall.subscribe` | طراحی | **اشتراک** | 'طراحی' is wrong word sense; 'اشتراک' is correct for 'subscribe'. |
| `paywall.topupNote` | بلافاصله پس از پرداخت، مبلغ صورتحساب به موجودی شما اضافه خواهد شد. | **دقایق بلافاصله پس از پرداخت به موجودی شما اضافه خواهد شد.** | 'مبلغ صورتحساب' is wrong word sense; 'دقایق' is correct for 'minutes'. |
| `paywall.topupNoSubInfo` | ℹ شما اشتراک فعالی ندارید. هزینه پلاس به مبلغ ۱۹ یورو در ماه به خرید شما اضافه می‌شود—۶۰ دقیقه شامل طرح شما می‌شود، بنابراین هزینه اضافی وجود ندارد. | **ℹ شما اشتراک فعالی ندارید. هزینه Plus به مبلغ ۱۹ یورو در ماه به خرید شما اضافه می‌شود—۶۰ دقیقه شامل طرح شما می‌شود، بنابراین هزینه اضافی وجود ندارد.** | Brand name 'Plus' must be preserved. |
| `paywall.topupPlusLine` | تعرفه پلاس (شامل دقیقه {{count}}) | **تعرفه Plus (شامل دقیقه {{count}})** | Brand name 'Plus' must be preserved. |
| `paywall.stripeNote` | پرداخت‌ها توسط Stripe محافظت می‌شوند. صورت‌حساب‌ها پس از پرداخت به طور خودکار به حساب شما منظور می‌شوند. | **پرداخت‌ها توسط Stripe محافظت می‌شوند. دقایق پس از پرداخت به طور خودکار به حساب شما منظور می‌شوند.** | 'صورت‌حساب‌ها' is wrong word sense; 'دقایق' is correct for 'minutes'. Brand name 'Stripe' preserved. |
| `postCallInsights.subtitle` | بینش‌های پس از تماس سازمانی | **Enterprise · بینش‌های پس از تماس** | Brand name 'Enterprise' must be preserved. 'post-call insights' is a specific term. |
| `postCallInsights.analyzing` | بیایید گفتگو را تحلیل کنیم... | **در حال تحلیل گفتگو هستیم...** | 'بیایید' is wrong grammar/tone; 'در حال تحلیل گفتگو هستیم...' is correct for 'We are analyzing'. |
| `postCallInsights.metricSentiment` | خلق و خو | **احساسات** | 'خلق و خو' is wrong word sense; 'احساسات' is correct for 'sentiment'. |
| `postCallInsights.metricEngagement` | نامزدی | **مشارکت** | 'نامزدی' is wrong word sense; 'مشارکت' is correct for user engagement. |
| `billingPage.tierLabel` | نرخ | **تعرفه** | 'نرخ' is less appropriate; 'تعرفه' is correct for a pricing plan. |
| `billingPage.resume` | رزومه | **از سر گرفتن** | 'رزومه' is wrong word sense; 'از سر گرفتن' is correct for resuming. |
| `billingPage.topupCarriedTooltip` | دقایق بازی از دوره قبل منتقل می‌شوند. آنها ابتدا مصرف می‌شوند. | **دقایق، منتقل شده از دوره قبل. آنها ابتدا مصرف می‌شوند.** | 'دقایق بازی' is wrong word sense; 'دقایق' is correct for 'minutes'. |
| `billingPage.topupCarried` | به تعویق افتاد | **منتقل شده** | 'به تعویق افتاد' is wrong word sense; 'منتقل شده' is correct for 'carried over'. |
| `billingPage.tierPlusName` | پلاس | **Plus** | Brand name 'Plus' must be preserved. |
| `billingPage.tierStandardName` | استاندارد | **Standard** | Brand name 'Standard' must be preserved. |
| `billingPage.tierEnterpriseName` | تصدی | **سازمانی** | 'تصدی' is less common for a business tier name. 'سازمانی' is more appropriate. |
| `billingPage.featureHd` | صداهای ترجمه HD (آئوده، شارون، کره) | **صداهای ترجمه HD (Aoede, Charon, Kore)** | Brand names (Aoede, Charon, Kore) must be preserved. |
| `billingPage.featureAllPlus` | همه از پلاس | **همه از Plus** | Brand name 'Plus' must be preserved. |
| `billingPage.featureAllStandard` | همه از استاندارد | **همه از Standard** | Brand name 'Standard' must be preserved. |
| `billingPage.featureTelegramAuth` | مجوز تلگرام + لینک دادن به کارت | **مجوز Telegram + لینک دادن به کارت** | Brand name 'Telegram' must be preserved. |
| `billingPage.featurePersonalPrompts` | پیام‌های شخصی هوش مصنوعی | **پرامپت‌های شخصی هوش مصنوعی** | 'پیام‌ها' is wrong word sense; 'پرامپت‌ها' is correct for 'prompts'. |
| `billingPage.featureCalendar` | تقویم گوگل - قرار ملاقات با مشتری | **Google Calendar — قرار ملاقات با مشتری** | Brand name 'Google' must be preserved. |
| `billingPage.ctaSubscribePlus` | پلاس دریافت کنید | **Plus دریافت کنید** | Brand name 'Plus' must be preserved. |
| `billingPage.ctaSubscribeStandard` | سفارش استاندارد | **Standard سفارش دهید** | Brand name 'Standard' must be preserved. |
| `billingPage.ctaContactWhatsApp` | تماس از طریق واتس‌اپ | **تماس از طریق WhatsApp** | Brand name 'WhatsApp' must be preserved. |
| `billingPage.faqQ3` | اینترپرایز شامل چه چیزهایی می‌شود؟ | **Enterprise شامل چه چیزهایی می‌شود؟** | Brand name 'Enterprise' must be preserved. |
| `billingPage.faqA3` | مجموعه کامل هوش مصنوعی: کارت‌های مشتری با تشخیص خودکار، مجوز تلگرام، پیام‌های شخصی‌سازی‌شده، تقویم گوگل، برچسب‌گذاری هوشمند نیازها، خروجی CRM، ادغام با questflow.pro و یک تب مدیریت جداگانه. | **مجموعه کامل هوش مصنوعی: کارت‌های مشتری با تشخیص خودکار، مجوز Telegram، پرامپت‌های شخصی‌سازی‌شده، Google Calendar، برچسب‌گذاری هوشمند نیازها، خروجی CRM، ادغام با questflow.pro و یک تب مدیریت جداگانه.** | Brand names (Telegram, Google, CRM, questflow.pro) must be preserved. 'پیام‌ها' is wrong word sense; 'پرامپت‌ها' is correct. |
| `billingPage.presetHours` | {{count}}h | **{{count}}س** | English abbreviation; should be Persian ('س' for ساعت). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}د** | English abbreviation; should be Persian ('د' for دقیقه). |
| `billingPage.renewsOn` | پسوند {{date}} | **تمدید {{date}}** | 'پسوند' is wrong word sense; 'تمدید' is correct for 'renewal'. |
| `billingPage.autoRenewCancelledHint` | صورتجلسات طرح شما تا این تاریخ معتبر است؛ می‌توانید صورتجلسات بیشتری خریداری کنید. در صورت تغییر نظر، روی «ادامه» کلیک کنید. | **دقایق طرح شما تا این تاریخ معتبر است؛ می‌توانید دقایق بیشتری خریداری کنید. در صورت تغییر نظر، روی «از سر گرفتن» کلیک کنید.** | 'صورتجلسات' is less natural; 'دقایق' is better. 'ادامه' is less precise than 'از سر گرفتن' for 'resume'. |
| `auth.common.googleSignIn` | با گوگل وارد شوید | **با Google وارد شوید** | Brand name 'Google' must be preserved. |
| `auth.common.googleSignUp` | ثبت نام از طریق گوگل | **ثبت نام از طریق Google** | Brand name 'Google' must be preserved. |
| `auth.login.googleSignInFailed` | ورود از طریق گوگل انجام نشد | **ورود از طریق Google انجام نشد** | Brand name 'Google' must be preserved. |
| `auth.googleCallback.loading` | تأیید ورود شما از طریق گوگل… | **تأیید ورود شما از طریق Google…** | Brand name 'Google' must be preserved. |
| `footer.copyright` | وایب وکس © {{year}} | **VibeVox © {{year}}** | Brand name 'VibeVox' must be preserved. |

⚠ 11 fix(es) skipped (no-op, missing path, or would break placeholders).
