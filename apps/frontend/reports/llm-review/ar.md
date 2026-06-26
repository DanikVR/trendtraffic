# LLM Review: Arabic (ar)

**Model:** gemini-2.5-flash  
**Took:** 225.9s  
**Fixes proposed:** 200 (valid after placeholder-check: 195)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.billing` | التعريفات الجمركية | **الأسعار** | Wrong word sense. 'التعريفات الجمركية' means customs tariffs, not pricing plans. |
| `nav.home` | بيت | **الرئيسية** | 'بيت' is too literal. 'الرئيسية' is standard for 'Home' in UI. |
| `rooms.searchPlaceholder` | يبحث... | **بحث...** | 'يبحث' is a present tense verb. 'بحث' is better for a placeholder. |
| `rooms.create` | يخلق | **إنشاء** | 'يخلق' is a verb. 'إنشاء' (create - noun) is better for a button label. |
| `rooms.tabs.questFlow` | مسار المهمة | **Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `rooms.live` | يعيش | **مباشر** | 'يعيش' is a verb. 'مباشر' is correct for 'Live' status. |
| `rooms.actions.open` | تسجيل الدخول | **فتح** | 'تسجيل الدخول' means 'Log in'. 'فتح' is correct for 'Open' a room. |
| `rooms.actions.delete` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `rooms.confirmDelete.confirm` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `common.cancel` | يلغي | **إلغاء** | 'يلغي' is a verb. 'إلغاء' (cancel - noun) is better for a button label. |
| `common.confirm` | يتأكد | **تأكيد** | 'يتأكد' is a verb. 'تأكيد' (confirm - noun) is better for a button label. |
| `common.save` | يحفظ | **حفظ** | 'يحفظ' is a verb. 'حفظ' (save - noun) is better for a button label. |
| `common.delete` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `common.close` | يغلق | **إغلاق** | 'يغلق' is a verb. 'إغلاق' (close - noun) is better for a button label. |
| `common.back` | خلف | **رجوع** | 'خلف' means 'behind'. 'رجوع' is correct for 'Back' button. |
| `common.search` | يبحث | **بحث** | 'يبحث' is a verb. 'بحث' (search - noun) is better for a label. |
| `common.open` | يفتح | **فتح** | 'يفتح' is a verb. 'فتح' (open - noun) is better for a button label. |
| `common.select` | يختار | **اختيار** | 'يختار' is a verb. 'اختيار' (select - noun) is better for a button label. |
| `common.edit` | يتغير | **تعديل** | 'يتغير' is a verb. 'تعديل' (edit - noun) is better for a button label. |
| `common.tryAgain` | يكرر | **إعادة المحاولة** | 'يكرر' is a verb. 'إعادة المحاولة' is better for 'Try again'. |
| `common.success` | مستعد | **تم** | 'مستعد' means 'ready'. 'تم' is better for 'Success/Done'. |
| `balance.minutes_few` | {{count}} دقيقة | **{{count}} دقائق** | Incorrect plural form for Arabic (3-10 minutes). |
| `balance.minutesShort` | مين | **دقيقة** | 'مين' is a transliteration. 'دقيقة' is the correct local equivalent for 'min'. |
| `balance.openPlans` | التعريفات المفتوحة والتوازن | **عرض الأسعار والرصيد** | Wrong word sense. 'التعريفات المفتوحة' is incorrect. 'عرض الأسعار' is better for 'Open Plans'. |
| `balance.tariffs` | التعريفات الجمركية | **الأسعار** | Wrong word sense. 'التعريفات الجمركية' means customs tariffs, not pricing plans. |
| `tier.trial` | محاكمة | **تجريبي** | Wrong word sense. 'محاكمة' means court trial, not free trial period. |
| `tier.plus` | زائد | **Plus** | Brand name 'Plus' should not be translated. |
| `tier.standard` | معيار | **Standard** | Brand name 'Standard' should not be translated. |
| `tier.standardYearly` | سنوي | **Yearly** | Brand name 'Yearly' should not be translated. |
| `tier.enterprise` | مَشرُوع | **Enterprise** | Brand name 'Enterprise' should not be translated. 'مَشرُوع' means project. |
| `languagePicker.searchPlaceholder` | البحث عن اللغة... | **بحث عن لغة...** | 'البحث عن اللغة' is a verb. 'بحث عن لغة' is better for a placeholder. |
| `sidebar.logoAria` | فايب فوكس - الصفحة الرئيسية | **VibeVox - الصفحة الرئيسية** | Brand name 'VibeVox' should be preserved. |
| `moreSheet.enterprise.sub` | مفتاح جيميني، كويست فلو، الوسوم، إدارة علاقات العملاء | **Gemini مفتاح, Quest Flow, الوسوم, CRM** | Brand names 'Gemini', 'Quest Flow', 'CRM' should be preserved. |
| `call.aiSubtitles` | ترجمة الذكاء الاصطناعي | **ترجمات الذكاء الاصطناعي** | 'ترجمة الذكاء الاصطناعي' means 'AI translation'. 'ترجمات الذكاء الاصطناعي' is better for 'AI Subtitles'. |
| `call.geminiLive` | برج الجوزاء مباشر | **Gemini Live** | Brand name 'Gemini' should be preserved and not translated as 'برج الجوزاء' (constellation). |
| `call.toPlayground` | 🎯 إلى مكب النفايات | **🎯 إلى ساحة التدريب** | Wrong word sense. 'مكب النفايات' means landfill, not training ground. |
| `call.more` | بالإضافة إلى ذلك | **المزيد** | 'بالإضافة إلى ذلك' is too long and not suitable for a 'More' button. |
| `coach.copy` | ينسخ | **نسخ** | 'ينسخ' is a verb. 'نسخ' (copy - noun) is better for a button label. |
| `coach.pin` | احفظها | **تثبيت** | 'احفظها' means 'save it'. 'تثبيت' (pin - noun) is correct for 'Pin'. |
| `coach.close` | يغلق | **إغلاق** | 'يغلق' is a verb. 'إغلاق' (close - noun) is better for a button label. |
| `roomActions.translation.disableSub` | لن يتم بعد الآن شطب محاضر الاجتماعات | **لن يتم خصم الدقائق بعد الآن** | Wrong word sense. 'محاضر الاجتماعات' means meeting minutes (document), not time minutes. |
| `roomActions.subtitles.show` | عرض الترجمة | **عرض الترجمات** | 'الترجمة' is singular. 'الترجمات' is plural and more accurate for subtitles. |
| `roomActions.subtitles.hide` | إخفاء الترجمة | **إخفاء الترجمات** | 'الترجمة' is singular. 'الترجمات' is plural and more accurate for subtitles. |
| `billing.createRoomFailed` | فشل في خلق مساحة | **فشل إنشاء الغرفة** | Wrong word sense. 'خلق مساحة' is not 'create room'. |
| `billing.createRoomError` | خطأ في إنشاء الغرف | **خطأ في إنشاء الغرفة** | Incorrect plural form. 'الغرف' is plural, should be singular 'الغرفة'. |
| `partner.title` | Partner program | **برنامج الشراكة** | Not translated when it should be. |
| `partner.subtitle` | Share your link and earn | **شارك رابطك واكسب** | Not translated when it should be. |
| `partner.yourLink` | Your link | **رابطك** | Not translated when it should be. |
| `partner.copy` | Copy | **نسخ** | Not translated when it should be. |
| `partner.copied` | ✓ Link copied | **✓ تم نسخ الرابط** | Not translated when it should be. |
| `partner.stats.clicks` | Clicks | **النقرات** | Not translated when it should be. |
| `partner.stats.registrations` | Sign-ups | **التسجيلات** | Not translated when it should be. |
| `partner.stats.paid` | Payments | **المدفوعات** | Not translated when it should be. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} مستخدم · {{minutes}} دقيقة** | Not translated when it should be. 'min' should be localized. |
| `partner.terms` | Program terms | **شروط البرنامج** | Not translated when it should be. |
| `partner.contact` | Contact us | **اتصل بنا** | Not translated when it should be. |
| `partner.termsModalTitle` | Partner program terms | **شروط برنامج الشراكة** | Not translated when it should be. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **لم يتم تحديد شروط البرنامج بعد. يرجى الاتصال بـ SuperAdmin.** | Not translated when it should be. |
| `partner.loadError` | Failed to load partner data | **فشل تحميل بيانات الشراكة** | Not translated when it should be. |
| `sip.editTrunk` | تغيير إعدادات صندوق السيارة | **تغيير إعدادات خط SIP** | Wrong word sense. 'صندوق السيارة' means car trunk, not SIP trunk. |
| `sip.transport` | ينقل | **النقل** | 'ينقل' is a verb. 'النقل' (transport - noun) is better for a label. |
| `sip.trunkId` | معرف الصندوق | **معرف خط SIP** | Wrong word sense. 'الصندوق' means box, not SIP trunk. |
| `sip.savingShort` | توفير… | **جارٍ الحفظ...** | 'توفير' is not the best translation for 'saving' (verb in progress). |
| `sip.createTrunk` | أنشئ جذعًا | **إنشاء خط SIP** | Wrong word sense. 'جذعًا' means tree trunk, not SIP trunk. |
| `sip.incoming.create` | أنشئ عنوان SIP للمكالمات الواردة | **إنشاء عنوان SIP للمكالمات الواردة** | 'أنشئ' is imperative. 'إنشاء' (create - noun) is better for a label. |
| `sip.incoming.translationRoom` | غرف الترجمة | **غرفة الترجمة** | Incorrect plural form. 'غرف الترجمة' is plural, should be singular 'غرفة الترجمة'. |
| `sip.incoming.stop` | قف | **إيقاف** | 'قف' is imperative. 'إيقاف' (stop - noun) is better for a button label. |
| `sip.incoming.activate` | فعل | **تفعيل** | 'فعل' is imperative. 'تفعيل' (activate - noun) is better for a button label. |
| `sip.incoming.show` | يعرض | **عرض** | 'يعرض' is a verb. 'عرض' (show - noun) is better for a button label. |
| `sip.incoming.hide` | يخفي | **إخفاء** | 'يخفي' is a verb. 'إخفاء' (hide - noun) is better for a button label. |
| `sip.incoming.copy` | ينسخ | **نسخ** | 'ينسخ' is a verb. 'نسخ' (copy - noun) is better for a button label. |
| `sip.toasts.saveFailed` | فشل حفظ الجذع | **فشل حفظ خط SIP** | Wrong word sense. 'الجذع' means tree trunk, not SIP trunk. |
| `sip.toasts.deleted` | تم حذف الجذع. | **تم حذف خط SIP.** | Wrong word sense. 'الجذع' means tree trunk, not SIP trunk. |
| `sip.toasts.deleteFailed` | فشل حذف الجذع | **فشل حذف خط SIP** | Wrong word sense. 'الجذع' means tree trunk, not SIP trunk. |
| `sip.tenantOnly.hint2` | قم بتسجيل الدخول كمستخدم عادي لديه معرف المستأجر الخاص به لإنشاء جذع. | **قم بتسجيل الدخول كمستخدم عادي لديه معرف المستأجر الخاص به لإنشاء خط SIP.** | Wrong word sense. 'جذع' means tree trunk, not SIP trunk. |
| `sip.danger.deleteTrunk` | حذف الجذع | **حذف خط SIP** | Wrong word sense. 'الجذع' means tree trunk, not SIP trunk. |
| `sip.outbound2.callButton` | يتصل | **اتصال** | 'يتصل' is a verb. 'اتصال' (call - noun) is better for a button label. |
| `enterprise.page.upsellBody` | هنا يمكنك تكوين: مفتاح Gemini API شخصي، وموجه وقاعدة معرفية، والتكامل مع Quest Flow + روبوت Telegram، والاتصال بنظام إدارة علاقات العملاء Chatwoot. | **هنا يمكنك تكوين: مفتاح Gemini API شخصي، وموجه وقاعدة معرفية، والتكامل مع Quest Flow + روبوت Telegram، والاتصال بـ Chatwoot CRM.** | Brand names 'Telegram' and 'CRM' should be preserved. |
| `enterprise.page.upsellCta` | انتقل إلى التعريفات | **انتقل إلى الأسعار** | Wrong word sense. 'التعريفات' means tariffs, not pricing plans. |
| `enterprise.tabs.questFlow` | مسار المهمة | **Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.common.saveAndCheck` | احفظ وتحقق | **حفظ وتحقق** | 'احفظ' is imperative. 'حفظ' (save - noun) is better for a button label. |
| `enterprise.common.delete` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `enterprise.common.lastCheck` | آخر تحديث: {{when}} | **آخر فحص: {{when}}** | 'تحديث' means update. 'فحص' is better for 'check'. |
| `enterprise.common.save` | يحفظ | **حفظ** | 'يحفظ' is a verb. 'حفظ' (save - noun) is better for a button label. |
| `enterprise.common.test` | امتحان | **اختبار** | 'امتحان' means exam. 'اختبار' is better for 'test'. |
| `enterprise.common.saving` | توفير… | **جارٍ الحفظ...** | 'توفير' is not the best translation for 'saving' (verb in progress). |
| `enterprise.common.saved` | أنقذ | **تم الحفظ** | 'أنقذ' means 'rescued'. 'تم الحفظ' (saved - passive) is correct. |
| `enterprise.common.copy` | ينسخ | **نسخ** | 'ينسخ' is a verb. 'نسخ' (copy - noun) is better for a button label. |
| `enterprise.common.show` | يعرض | **عرض** | 'يعرض' is a verb. 'عرض' (show - noun) is better for a button label. |
| `enterprise.common.hide` | يخفي | **إخفاء** | 'يخفي' is a verb. 'إخفاء' (hide - noun) is better for a button label. |
| `enterprise.apiKey.copy` | ينسخ | **نسخ** | 'ينسخ' is a verb. 'نسخ' (copy - noun) is better for a button label. |
| `enterprise.apiKey.show` | يعرض | **عرض** | 'يعرض' is a verb. 'عرض' (show - noun) is better for a button label. |
| `enterprise.apiKey.hide` | يخفي | **إخفاء** | 'يخفي' is a verb. 'إخفاء' (hide - noun) is better for a button label. |
| `enterprise.gemini.leadSuffix` | . يتم استخدامه بدلاً من الرقم العالمي لجميع مكالمات Gemini على حسابك. | **. يتم استخدامه بدلاً من المفتاح العام لجميع مكالمات Gemini على حسابك.** | Wrong word sense. 'الرقم العالمي' means global number, not global key. |
| `enterprise.gemini.aiStudioLink` | استوديو الذكاء الاصطناعي | **AI Studio** | Brand name 'AI Studio' should not be translated. |
| `enterprise.gemini.statusNotChecked` | غير موثق | **لم يتم التحقق منه** | 'غير موثق' means undocumented. 'لم يتم التحقق منه' is better for 'Not checked'. |
| `enterprise.gemini.lastCheckLabel` | آخر تحديث: {{when}} | **آخر فحص: {{when}}** | 'تحديث' means update. 'فحص' is better for 'check'. |
| `enterprise.gemini.saveLabel` | احفظ وتحقق | **حفظ وتحقق** | 'احفظ' is imperative. 'حفظ' (save - noun) is better for a button label. |
| `enterprise.gemini.savingLabel` | توفير… | **جارٍ الحفظ...** | 'توفير' is not the best translation for 'saving' (verb in progress). |
| `enterprise.gemini.deleteLabel` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `enterprise.gemini.confirmDeleteCta` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `enterprise.gemini.telegram.leadStartCmd` | /يبدأ | **/start** | Command '/start' should be preserved. |
| `enterprise.gemini.telegram.saveLabel` | يحفظ | **حفظ** | 'يحفظ' is a verb. 'حفظ' (save - noun) is better for a button label. |
| `enterprise.gemini.telegram.savingLabel` | توفير… | **جارٍ الحفظ...** | 'توفير' is not the best translation for 'saving' (verb in progress). |
| `enterprise.gemini.telegram.testLabel` | امتحان | **اختبار** | 'امتحان' means exam. 'اختبار' is better for 'test'. |
| `enterprise.gemini.telegram.testingLabel` | خوذة… | **جارٍ الإرسال...** | Wrong word sense. 'خوذة' means helmet. 'جارٍ الإرسال' is better for 'Sending...'. |
| `enterprise.gemini.telegram.lastBroadcast` | آخر رسالة بريدية: تم تسليمها من {{total}} | **آخر رسالة بريدية: تم تسليم {{sent}} من {{total}}** | Missing placeholder variable '{{sent}}'. |
| `enterprise.prompt.subtitle` | خدمة التنبيهات وقاعدة المعرفة الخاصة بالنسخ في غرف الفيديو فقط | **موجه وقاعدة المعرفة الخاصة بالنسخ في غرف الفيديو فقط** | 'خدمة التنبيهات' means 'alerts service'. 'موجه' is correct for 'prompt'. |
| `enterprise.prompt.promptLabel` | توجيهات النظام (النبرة، الأسلوب، المفردات) | **موجه النظام (النبرة، الأسلوب، المفردات)** | 'توجيهات النظام' means 'system directives'. 'موجه النظام' is correct for 'system prompt'. |
| `enterprise.prompt.hideDefault` | يخفي | **إخفاء** | 'يخفي' is a verb. 'إخفاء' (hide - noun) is better for a button label. |
| `enterprise.prompt.headerLeadBold2` | "وفقًا لطلبك" | **«وفقًا لموجهك»** | 'طلبك' means 'your request'. 'موجهك' is correct for 'your prompt'. |
| `enterprise.prompt.contextLeadBold` | "وفقًا لطلبك" | **«وفقًا لموجهك»** | 'طلبك' means 'your request'. 'موجهك' is correct for 'your prompt'. |
| `enterprise.prompt.promptPlaceholder` | مطلبك... | **موجهك...** | 'مطلبك' means 'your request'. 'موجهك' is correct for 'your prompt'. |
| `enterprise.prompt.savingPromptLabel` | توفير… | **جارٍ الحفظ...** | 'توفير' is not the best translation for 'saving' (verb in progress). |
| `enterprise.prompt.successPromptSaved` | تم حفظ الطلب. | **تم حفظ الموجه.** | 'الطلب' means 'request'. 'الموجه' is correct for 'prompt'. |
| `enterprise.prompt.kbCharsSuffix` | الرموز | **أحرف** | 'الرموز' means symbols. 'أحرف' is correct for characters. |
| `enterprise.prompt.kbUploading` | تحميل… | **جارٍ التحميل...** | 'تحميل' is a noun. 'جارٍ التحميل' is better for 'uploading' (verb in progress). |
| `enterprise.prompt.confirmKbDeleteCta` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `enterprise.prompt.presetsHeading` | شرح بأسلوب سهل الفهم | **نغمات الشرح المتاحة** | Wrong word sense. 'شرح بأسلوب سهل الفهم' means 'explanation in an easy-to-understand style'. 'نغمات الشرح المتاحة' is better for 'Available explanation tones'. |
| `enterprise.prompt.presetsLeadBold` | "وفقًا لطلبك" | **«وفقًا لموجهك»** | 'طلبك' means 'your request'. 'موجهك' is correct for 'your prompt'. |
| `enterprise.prompt.presetsLeadPart2` | يستخدم هذا الأمر ما أدخلته من الحقل أعلاه. | **يستخدم موجهك من الحقل أعلاه.** | 'هذا الأمر' means 'this command'. 'موجهك' is correct for 'your prompt'. |
| `enterprise.questFlow.heading` | مسار المهمة | **Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.promptLabel` | نظام توجيه تدفق المهام | **موجه نظام Quest Flow** | 'نظام توجيه تدفق المهام' means 'Quest Flow guidance system'. 'موجه نظام Quest Flow' is better for 'Quest Flow System Prompt'. |
| `enterprise.questFlow.kbLabel` | قاعدة معارف مسار المهمة | **قاعدة معارف Quest Flow** | Brand name 'Quest Flow' should not be translated. |
| `enterprise.questFlow.tagsLabel` | يحتاج إلى علامات | **علامات الاحتياجات** | 'يحتاج إلى علامات' means 'needs tags'. 'علامات الاحتياجات' is better for 'Needs tags'. |
| `enterprise.questFlow.keysLead` | كل مفتاح هو سرّ تُدخله في كتلة Quest Flow HTTP الخاصة بسلسلة الكتل. يستخدمه VibeVox لتحديد حسابك. يمكنك إنشاء عدة مفاتيح لسلاسل كتل مختلفة. | **كل مفتاح هو سرّ تُدخله في كتلة Quest Flow HTTP الخاصة بسلسلة Quest Flow. يستخدمه VibeVox لتحديد حسابك. يمكنك إنشاء عدة مفاتيح لسلاسل Quest Flow مختلفة.** | Wrong word sense. 'سلسلة الكتل' means blockchain, not Quest Flow chain. |
| `enterprise.questFlow.errDelete` | Delete error | **خطأ في الحذف** | Not translated when it should be. |
| `enterprise.questFlow.copyKey` | ينسخ | **نسخ** | 'ينسخ' is a verb. 'نسخ' (copy - noun) is better for a button label. |
| `enterprise.questFlow.deleteTitle` | Delete | **حذف** | Not translated when it should be. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **حذف المفتاح؟** | Not translated when it should be. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **سيتم حذف المفتاح نهائيًا. سيتوقف Quest Flow عن العمل من خلاله — ستحتاج إلى إنشاء مفتاح جديد واستبداله في السلسلة.** | Not translated when it should be. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **حذف** | Not translated when it should be. |
| `enterprise.questFlow.promptHeading` | إشعار لمحادثات تيليجرام | **موجه لمحادثات تيليجرام** | 'إشعار' means 'notification'. 'موجه' is correct for 'prompt'. |
| `enterprise.questFlow.promptLeadBold2` | إذا قمت بتعبئة نموذجك | **إذا قمت بملء موجهك الخاص** | 'نموذجك' means 'your form'. 'موجهك الخاص' is better for 'your own prompt'. |
| `enterprise.questFlow.promptLead3` | - سيتم دمجها مع التوجيه الأساسي وقاعدة المعرفة. | **- سيتم دمجها مع الموجه الأساسي وقاعدة المعرفة.** | 'التوجيه' means 'guidance'. 'الموجه الأساسي' is correct for 'base prompt'. |
| `enterprise.questFlow.promptPlaceholder` | مطلبك... | **موجهك...** | 'مطلبك' means 'your request'. 'موجهك' is correct for 'your prompt'. |
| `enterprise.questFlow.savingPromptLabel` | توفير… | **جارٍ الحفظ...** | 'توفير' is not the best translation for 'saving' (verb in progress). |
| `enterprise.questFlow.savePromptLabel` | يحفظ | **حفظ** | 'يحفظ' is a verb. 'حفظ' (save - noun) is better for a button label. |
| `enterprise.questFlow.kbLeadBold2` | متفرق | **منفصلة** | 'متفرق' means 'scattered'. 'منفصلة' is correct for 'separate'. |
| `enterprise.questFlow.kbCharsSuffix` | الرموز | **أحرف** | 'الرموز' means symbols. 'أحرف' is correct for characters. |
| `enterprise.questFlow.kbDeleteTitle` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `enterprise.questFlow.kbUploading` | تحميل… | **جارٍ التحميل...** | 'تحميل' is a noun. 'جارٍ التحميل' is better for 'uploading' (verb in progress). |
| `enterprise.questFlow.confirmKbDeleteCta` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `enterprise.questFlow.tagsHeading` | يحتاج إلى علامات | **علامات الاحتياجات** | 'يحتاج إلى علامات' means 'needs tags'. 'علامات الاحتياجات' is better for a label. |
| `enterprise.chatwoot.configHeading` | إعدادات | **التكوين** | 'إعدادات' means settings. 'التكوين' is better for 'Configuration'. |
| `enterprise.chatwoot.savingLabel` | توفير… | **جارٍ الحفظ...** | 'توفير' is not the best translation for 'saving' (verb in progress). |
| `enterprise.chatwoot.saveLabel` | يحفظ | **حفظ** | 'يحفظ' is a verb. 'حفظ' (save - noun) is better for a button label. |
| `chat.refreshShort` | ينعش | **تحديث** | 'ينعش' is a verb. 'تحديث' (refresh - noun) is better for a button label. |
| `chat.send` | يرسل | **إرسال** | 'يرسل' is a verb. 'إرسال' (send - noun) is better for a button label. |
| `chat.deleteMessage` | حذف الرسائل | **حذف الرسالة** | Incorrect plural form. 'الرسائل' is plural, should be singular 'الرسالة'. |
| `chat.telegramBadge` | برقية | **Telegram** | Brand name 'Telegram' should not be translated. |
| `chat.analyzeTooltip` | تحليل الحوار | **بدء تحليل الحوار** | 'تحليل الحوار' is a noun. 'بدء تحليل الحوار' is better for 'Start analysis'. |
| `insights.recalc` | إعادة سرد | **إعادة الحساب** | Wrong word sense. 'إعادة سرد' means re-narrate, not recalculate. |
| `insights.summary` | سيرة ذاتية | **ملخص** | 'سيرة ذاتية' means personal resume. 'ملخص' is better for a summary. |
| `insights.sentiment` | مفتاح | **النبرة** | 'مفتاح' means key. 'النبرة' is better for 'Sentiment/Tone'. |
| `insights.analyzedReplies_few` | تم تحليل نسخ {{count}} | **تم تحليل {{count}} ردود** | Wrong word sense and incorrect plural form. |
| `insights.analyzedReplies_many` | تم تحليل نسخ {{count}} | **تم تحليل {{count}} ردود** | Wrong word sense and incorrect plural form. |
| `insights.analyzedReplies_other` | تم تحليل نسخ {{count}} | **تم تحليل {{count}} ردود** | Wrong word sense and incorrect plural form. |
| `lobby.connect` | يتصل | **اتصال** | 'يتصل' is a verb. 'اتصال' (connect - noun) is better for a button label. |
| `paywall.buyPlus` | بالإضافة إلى ذلك - 19 يورو شهريًا (60 دقيقة) | **Plus — 19 يورو شهريًا (60 دقيقة)** | Brand name 'Plus' should not be translated. |
| `paywall.buyStandard` | قياسي - 29 يورو شهريًا (120 دقيقة) | **Standard — 29 يورو شهريًا (120 دقيقة)** | Brand name 'Standard' should not be translated. |
| `paywall.subscribe` | تصميم | **اشترك** | 'تصميم' means 'design'. 'اشترك' (subscribe - imperative) is better for a button. |
| `paywall.featureMinutes` | ترجمة دقيقة {{count}} | **{{count}} دقيقة ترجمة** | Incorrect word order and meaning. Should be '{{count}} minutes of translation'. |
| `paywall.topupPlusLine` | بالإضافة إلى التعريفة (يشمل ذلك {{count}} دقيقة) | **خطة Plus (تتضمن {{count}} دقيقة)** | Wrong word sense. 'بالإضافة إلى التعريفة' is incorrect. 'خطة Plus' is better. |
| `paywall.close` | يغلق | **إغلاق** | 'يغلق' is a verb. 'إغلاق' (close - noun) is better for a button label. |
| `confirmModal.ok` | نعم | **موافق** | 'نعم' means 'Yes'. 'موافق' is correct for 'OK'. |
| `confirmModal.cancel` | يلغي | **إلغاء** | 'يلغي' is a verb. 'إلغاء' (cancel - noun) is better for a button label. |
| `confirmModal.confirm` | يتأكد | **تأكيد** | 'يتأكد' is a verb. 'تأكيد' (confirm - noun) is better for a button label. |
| `confirmModal.delete` | يمسح | **حذف** | 'يمسح' is a verb. 'حذف' (delete - noun) is better for a button label. |
| `postCallInsights.analyzing` | دعونا نحلل المحادثة... | **جارٍ تحليل المحادثة...** | 'دعونا نحلل' is imperative. 'جارٍ تحليل' is better for 'analyzing' (present continuous). |
| `postCallInsights.summary` | سيرة ذاتية | **ملخص** | 'سيرة ذاتية' means personal resume. 'ملخص' is better for a summary. |
| `postCallInsights.close` | أغلق الغرفة وعد إليها | **إغلاق والعودة إلى الغرف** | Incorrect translation of 'return to rooms'. 'أغلق الغرفة وعد إليها' means 'Close the room and return to it'. |
| `postCallInsights.subtitlesHiddenByHost` | قام المنظم بإخفاء الترجمة. | **قام المنظم بإخفاء الترجمات.** | Incorrect plural form. 'الترجمة' is singular, should be plural 'الترجمات'. |
| `billingPage.tierLabel` | معدل | **الخطة** | 'معدل' means 'rate'. 'الخطة' is better for a subscription tier. |
| `billingPage.cancel` | يلغي | **إلغاء** | 'يلغي' is a verb. 'إلغاء' (cancel - noun) is better for a button label. |
| `billingPage.resume` | سيرة ذاتية | **استئناف** | 'سيرة ذاتية' means personal resume. 'استئناف' is correct for 'resume'. |
| `billingPage.promoApply` | يتقدم | **تطبيق** | 'يتقدم' is a verb. 'تطبيق' (apply - noun) is better for a button label. |
| `billingPage.tierPlusName` | زائد | **Plus** | Brand name 'Plus' should not be translated. |
| `billingPage.tierStandardName` | معيار | **Standard** | Brand name 'Standard' should not be translated. |
| `billingPage.tierEnterpriseName` | مَشرُوع | **Enterprise** | Brand name 'Enterprise' should not be translated. 'مَشرُوع' means project. |
| `billingPage.featureAllPlus` | جميعها من بلس | **جميعها من Plus** | Brand name 'Plus' should not be translated. |
| `billingPage.featureAllStandard` | جميعها من الفئة القياسية | **جميعها من Standard** | Brand name 'Standard' should not be translated. |
| `billingPage.featurePersonalPrompts` | تنبيهات الذكاء الاصطناعي الشخصية | **موجهات الذكاء الاصطناعي الشخصية** | 'تنبيهات' means 'alerts'. 'موجهات' is correct for 'prompts'. |
| `billingPage.ctaSubscribePlus` | احصل على بلس | **اشترك في Plus** | Brand name 'Plus' should not be translated. 'احصل على' is imperative. |
| `billingPage.ctaSubscribeStandard` | معيار الطلب | **اشترك في Standard** | Brand name 'Standard' should not be translated. 'معيار الطلب' means 'request standard'. |
| `billingPage.languagesCount_few` | لغة {{count}} | **{{count}} لغات** | Incorrect plural form for Arabic (3-10 languages). |
| `billingPage.languagesCount_many` | لغات {{count}} | **{{count}} لغة** | Incorrect plural form for Arabic (11-99 languages). |
| `billingPage.languagesCount_other` | لغات {{count}} | **{{count}} لغة** | Incorrect plural form for Arabic (11-99, 100+ ending in 11-99 languages). |
| `billingPage.faqA3` | مجموعة الذكاء الاصطناعي الكاملة: بطاقات العملاء مع التعرف التلقائي، وتفويض Telegram، والمطالبات الشخصية، وتقويم Google، ووضع علامات ذكية على الاحتياجات، وتصدير CRM، والتكامل مع questflow.pro، وعلامة تبويب إدارية منفصلة. | **مجموعة الذكاء الاصطناعي الكاملة: بطاقات العملاء مع التعرف التلقائي، وتفويض Telegram، والموجهات الشخصية، وتقويم Google، ووضع علامات ذكية على الاحتياجات، وتصدير CRM، والتكامل مع questflow.pro، وعلامة تبويب إدارية منفصلة.** | 'المطالبات' means 'demands'. 'الموجهات' is correct for 'prompts'. |
| `billingPage.presetHours` | {{count}}h | **{{count}}س** | Unit 'h' should be localized to 'س' (hours). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}د** | Unit 'm' should be localized to 'د' (minutes). |
| `billingPage.renewsOn` | امتداد {{date}} | **تجديد {{date}}** | 'امتداد' means 'extension'. 'تجديد' is correct for 'renewal'. |
| `billingPage.searchResultsCount_few` | تم العثور على: {{count}} لغة | **تم العثور على: {{count}} لغات** | Incorrect plural form for Arabic (3-10 languages). |
| `auth.login.registerLink` | يسجل | **تسجيل** | 'يسجل' is a verb. 'تسجيل' (register - noun) is better for a link/button. |
| `auth.register.submit` | يسجل | **تسجيل** | 'يسجل' is a verb. 'تسجيل' (register - noun) is better for a button. |

⚠ 5 fix(es) skipped (no-op, missing path, or would break placeholders).
