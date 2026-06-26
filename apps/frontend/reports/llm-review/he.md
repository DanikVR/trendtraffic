# LLM Review: Hebrew (he)

**Model:** gemini-2.5-flash  
**Took:** 232.9s  
**Fixes proposed:** 216 (valid after placeholder-check: 215)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.billing` | מכסים | **תעריפים** | Wrong word sense: 'covers' instead of 'tariffs/plans'. |
| `rooms.searchPlaceholder` | לְחַפֵּשׂ... | **חיפוש...** | Infinitive verb used for placeholder; noun form is more natural. |
| `rooms.create` | לִיצוֹר | **צור** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `rooms.tabs.questFlow` | זרימת קווסט | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `rooms.live` | לִחיוֹת | **חי** | Wrong word sense: 'to live' instead of 'live' (active/real-time). |
| `rooms.actions.open` | כְּנִיסָה לַמַעֲרֶכֶת | **היכנס** | Too long and specific ('login to system'); 'enter' is more appropriate. |
| `rooms.actions.chat` | לְשׂוֹחֵחַ | **צ'אט** | Infinitive verb used for button; brand name 'Chat' is more appropriate and shorter. |
| `rooms.actions.delete` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `rooms.actions.copyLink` | העתקת קישור | **העתק קישור** | Noun form used for button; imperative form is more natural. |
| `rooms.actions.rename` | שינוי שם | **שנה שם** | Noun form used for button; imperative form is more natural. |
| `rooms.confirmDelete.confirm` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `common.cancel` | לְבַטֵל | **ביטול** | Infinitive verb used for button; noun form is more common and shorter. |
| `common.confirm` | לְאַשֵׁר | **אישור** | Infinitive verb used for button; noun form is more common and shorter. |
| `common.save` | לְהַצִיל | **שמור** | Wrong word sense: 'to rescue' instead of 'to save' (data). Imperative form is better. |
| `common.delete` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `common.close` | לִסְגוֹר | **סגור** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `common.search` | לְחַפֵּשׂ | **חיפוש** | Infinitive verb used for button; noun form is more common and shorter. |
| `common.open` | לִפְתוֹחַ | **פתח** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `common.select` | לִבחוֹר | **בחר** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `common.edit` | לְשַׁנוֹת | **ערוך** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `common.tryAgain` | לַחֲזוֹר עַל | **נסה שוב** | Literal translation of 'repeat' instead of 'try again'. |
| `balance.label` | לְאַזֵן | **יתרה** | Wrong word sense: 'to balance' instead of 'balance' (noun). |
| `balance.openPlans` | תעריפים פתוחים ואיזון | **פתח תעריפים ויתרה** | Grammatically awkward and wrong word sense for 'balance'. |
| `balance.tariffs` | מכסים | **תעריפים** | Wrong word sense: 'covers' instead of 'tariffs/plans'. |
| `tier.trial` | מִשׁפָּט | **ניסיון** | Wrong word sense: 'legal trial' instead of 'free trial period'. |
| `languagePicker.searchPlaceholder` | מחפש שפה... | **חיפוש שפה...** | Present participle verb used for placeholder; noun form is more natural. |
| `moreSheet.sip.sub` | הקמת תאי מטען | **הגדרת טרנקים** | Wrong word sense: 'cargo compartments' instead of 'SIP trunks'. |
| `call.toPlayground` | 🎯 למזבלה | **🎯 למגרש אימונים** | Wrong word sense: 'dumpster' instead of 'training ground'. |
| `coach.help` | עזרה בתשובה | **עזור לענות** | Noun form used for button; imperative verb form is more natural. |
| `coach.copy` | לְהַעְתִיק | **העתק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `coach.pin` | הצמד את זה | **הצמד** | Too long for a button; shorter imperative form is better. |
| `coach.close` | לִסְגוֹר | **סגור** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `coach.tonePrompts.short` | תשובה במשפט קצר אחד | **ענה במשפט קצר אחד** | Noun form used; imperative verb form is more natural. |
| `roomActions.translation.disableSub` | פרוטוקולים לא יימחקו עוד | **דקות לא יימחקו עוד** | Wrong word sense: 'protocols' instead of 'minutes'. |
| `roomActions.delete` | מחיקת חדר | **מחק חדר** | Noun form used for button; imperative verb form is more natural. |
| `settings.editName` | שינוי שם | **שנה שם** | Noun form used for button; imperative verb form is more natural. |
| `partner.title` | Partner program | **תוכנית שותפים** | Brand name 'Partner program' should be translated. |
| `partner.subtitle` | Share your link and earn | **שתפו את הקישור שלכם והרוויחו** | String was not translated to Hebrew. |
| `partner.yourLink` | Your link | **הקישור שלכם** | String was not translated to Hebrew. |
| `partner.copy` | Copy | **העתק** | String was not translated to Hebrew. |
| `partner.copied` | ✓ Link copied | **✓ הקישור הועתק** | String was not translated to Hebrew. |
| `partner.stats.clicks` | Clicks | **קליקים** | String was not translated to Hebrew. |
| `partner.stats.registrations` | Sign-ups | **הרשמות** | String was not translated to Hebrew. |
| `partner.stats.paid` | Payments | **תשלומים** | String was not translated to Hebrew. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} משתמשים · {{minutes}} דקות** | String was not translated to Hebrew. |
| `partner.terms` | Program terms | **תנאי התוכנית** | String was not translated to Hebrew. |
| `partner.contact` | Contact us | **צרו קשר** | String was not translated to Hebrew. |
| `partner.termsModalTitle` | Partner program terms | **תנאי תוכנית השותפים** | String was not translated to Hebrew. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **תנאי התוכנית עדיין לא הוגדרו. אנא צרו קשר עם מנהל המערכת.** | String was not translated to Hebrew. |
| `partner.loadError` | Failed to load partner data | **טעינת נתוני השותפות נכשלה** | String was not translated to Hebrew. |
| `toneMenu.generationError` | שגיאת דור | **שגיאת יצירה** | Wrong word sense: 'generation' (of people) instead of 'generation' (creation). |
| `sip.subtitle` | הגדרת רשתות שיחות נכנסות ויוצאות | **הגדרת טרנקים לשיחות נכנסות ויוצאות** | Wrong word sense: 'networks' instead of 'trunks'. |
| `sip.newTrunk` | תא מטען SIP חדש | **טרנק SIP חדש** | Wrong word sense: 'cargo compartment' instead of 'SIP trunk'. |
| `sip.editTrunk` | שינוי הגדרות תא המטען | **ערוך הגדרות טרנק** | Wrong word sense for 'trunk' and noun form used for button. |
| `sip.loginLabel` | שם משתמש (כניסה ל-SIP) | **שם משתמש (כניסת SIP)** | Grammatically awkward phrasing for 'SIP login'. |
| `sip.loginShort` | כְּנִיסָה לַמַעֲרֶכֶת | **כניסה** | Too long and specific ('login to system'); 'login' is more appropriate. |
| `sip.trunkId` | מזהה תא המטען | **מזהה טרנק** | Wrong word sense: 'cargo compartment' instead of 'trunk'. |
| `sip.savingShort` | חִסָכוֹן… | **שומרים...** | Wrong word sense: 'saving money' instead of 'saving' (data). |
| `sip.savingChanges` | שמירת שינויים | **שמור שינויים** | Noun form used for button; imperative verb form is more natural. |
| `sip.createTrunk` | צור תא מטען | **צור טרנק** | Wrong word sense: 'cargo compartment' instead of 'trunk'. |
| `sip.deletingShort` | מוחק... | **מוחקים...** | Singular verb form used; plural is more appropriate for 'we are deleting'. |
| `sip.incoming.create` | יצירת כתובת SIP עבור שיחות נכנסות | **צור כתובת SIP לשיחות נכנסות** | Noun form used for button; imperative verb form is more natural. |
| `sip.incoming.pausedHint` | הפעל את הקליטה כדי ש-VibeVox יתחיל להעביר שיחות נכנסות. | **הפעל את הקליטה כדי ש-VibeVox יתחיל לתרגם שיחות נכנסות.** | Wrong word sense: 'to transfer' instead of 'to translate'. |
| `sip.incoming.stop` | לְהַפְסִיק | **עצור** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `sip.incoming.activate` | לְהַפְעִיל | **הפעל** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `sip.incoming.show` | לְהַצִיג | **הצג** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `sip.incoming.hide` | לְהַסתִיר | **הסתר** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `sip.incoming.copy` | לְהַעְתִיק | **העתק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `sip.incoming.reissue` | הוצאה מחודשת | **הנפק מחדש** | Noun form used for button; imperative verb form is more natural. |
| `sip.outbound.lead` | התקשרו למספר טלפון מממשק האינטרנט ו-VibeVox יעביר אוטומטית את השיחה שלכם בזמן אמת. | **התקשרו למספר טלפון מממשק האינטרנט ו-VibeVox יתרגם אוטומטית את השיחה שלכם בזמן אמת.** | Wrong word sense: 'will transfer' instead of 'will translate'. |
| `sip.outbound.configureFirst` | ראשית, הגדר רשת SIP יוצאת (הטופס למעלה) | **ראשית, הגדר טרנק SIP יוצא (הטופס למעלה)** | Wrong word sense: 'network' instead of 'trunk'. |
| `sip.howTo.step1` | קבלו פרטי גישה למערכת SIP מהספק שלכם (Zadarma, OnlinePBX, Asterisk). | **קבלו פרטי גישה לטרנק SIP מהספק שלכם (Zadarma, OnlinePBX, Asterisk).** | Wrong word sense: 'SIP system' instead of 'SIP trunk'. |
| `sip.toasts.saveFailed` | שמירת תא המטען נכשלה | **שמירת הטרנק נכשלה** | Wrong word sense: 'cargo compartment' instead of 'trunk'. |
| `sip.toasts.deleted` | תא המטען נמחק. | **הטרנק נמחק.** | Wrong word sense: 'cargo compartment' instead of 'trunk'. |
| `sip.toasts.deleteFailed` | מחיקת תא המטען נכשלה | **מחיקת הטרנק נכשלה** | Wrong word sense: 'cargo compartment' instead of 'trunk'. |
| `sip.tenantOnly.title` | גזעי SIP מוגדרים ברמת הדייר | **טרנקים של SIP מוגדרים ברמת הדייר** | Wrong word sense: 'roots/stems' instead of 'trunks'. |
| `sip.connected` | רשת ה-SIP נשמרה ומסונכרנת עם LiveKit | **טרנק ה-SIP נשמר ומסונכרן עם LiveKit** | Wrong word sense: 'network' instead of 'trunk'. |
| `sip.danger.deleteTrunk` | מחיקת תא המטען | **מחק טרנק** | Wrong word sense for 'trunk' and noun form used for button. |
| `sip.danger.deleteInbound` | הסרת כתובת SIP עבור שיחות נכנסות | **מחק כתובת SIP לשיחות נכנסות** | Noun form used for button; imperative verb form is more natural. |
| `sip.outbound2.callButton` | שִׂיחָה | **התקשר** | Wrong word sense: 'conversation/call' (noun) instead of 'call' (imperative). |
| `sip.confirm.deleteTrunkTitle` | למחוק את רשת ה-SIP? | **למחוק את טרנק ה-SIP?** | Wrong word sense: 'network' instead of 'trunk'. |
| `sip.confirm.deleteTrunkBody` | פעולה זו אינה הפיכה. לאחר המחיקה, שיחות יוצאות ייפסקו עד ליצירת רשת מטנק חדשה. | **פעולה זו אינה הפיכה. לאחר המחיקה, שיחות יוצאות ייפסקו עד ליצירת טרנק חדש.** | Wrong word sense: 'network from trunk' instead of 'new trunk'. |
| `sip.confirm.deleteInboundTitle` | להסיר כתובת SIP עבור דואר נכנס? | **להסיר כתובת SIP עבור שיחות נכנסות?** | Wrong word sense: 'inbound mail' instead of 'inbound calls'. |
| `enterprise.tabs.prompts` | טיפים | **הנחיות** | Wrong word sense: 'tips' instead of 'prompts'. |
| `enterprise.tabs.questFlow` | זרימת קווסט | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.common.delete` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.common.save` | לְהַצִיל | **שמור** | Wrong word sense: 'to rescue' instead of 'to save' (data). Imperative form is better. |
| `enterprise.common.saving` | חִסָכוֹן… | **שומרים...** | Wrong word sense: 'saving money' instead of 'saving' (data). |
| `enterprise.common.pasteApiKey` | הכנס את מפתח ה-API | **הדבק את מפתח ה-API** | Wrong word sense: 'insert' instead of 'paste'. |
| `enterprise.common.copy` | לְהַעְתִיק | **העתק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.common.show` | לְהַצִיג | **הצג** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.common.hide` | לְהַסתִיר | **הסתר** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.apiKey.pastePlaceholder` | הכנס את מפתח ה-API | **הדבק את מפתח ה-API** | Wrong word sense: 'insert' instead of 'paste'. |
| `enterprise.apiKey.copy` | לְהַעְתִיק | **העתק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.apiKey.show` | לְהַצִיג | **הצג** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.apiKey.hide` | לְהַסתִיר | **הסתר** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.gemini.aiStudioLink` | סטודיו בינה מלאכותית | **AI Studio** | Brand name 'AI Studio' should be preserved, not translated. |
| `enterprise.gemini.keyPlaceholder` | אייזהסי... | **AIzaSy...** | Placeholder should be preserved exactly as in source. |
| `enterprise.gemini.savingLabel` | חִסָכוֹן… | **שומרים...** | Wrong word sense: 'saving money' instead of 'saving' (data). |
| `enterprise.gemini.deleteLabel` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.gemini.confirmDeleteCta` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.gemini.telegram.leadStartCmd` | /הַתחָלָה | **/start** | Command '/start' should be preserved, not translated. |
| `enterprise.gemini.telegram.botUnlink` | ניתוק הקישור של הבוט | **נתק את הבוט** | Noun form used for button; imperative verb form is more natural. |
| `enterprise.gemini.telegram.errEnterToken` | הכנס את אסימון הבוט | **הדבק את אסימון הבוט** | Wrong word sense: 'insert' instead of 'paste'. |
| `enterprise.gemini.telegram.successSavedWithBroadcast` | ✓ הבוט @{{username}} נשמר. הברכה נשלחה למנויי {{sent}}. | **✓ הבוט @{{username}} נשמר. הברכה נשלחה ל-{{sent}} מנויים.** | Grammatical correction for 'to subscribers'. |
| `enterprise.gemini.telegram.successUnlinked` | הבוט לא קשור. | **הבוט נותק.** | Wrong word sense: 'not related' instead of 'unlinked'. |
| `enterprise.gemini.telegram.saveLabel` | לְהַצִיל | **שמור** | Wrong word sense: 'to rescue' instead of 'to save' (data). Imperative form is better. |
| `enterprise.gemini.telegram.savingLabel` | חִסָכוֹן… | **שומרים...** | Wrong word sense: 'saving money' instead of 'saving' (data). |
| `enterprise.gemini.telegram.testingLabel` | קַסדָה… | **שולחים...** | Wrong word sense: 'helmet' instead of 'sending'. |
| `enterprise.gemini.telegram.confirmUnlinkTitle` | לבטל את הקישור של הבוט? | **לנתק את הבוט?** | Noun form used; imperative verb form is more natural. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | לְהַתִיר | **נתק** | Wrong word sense: 'to allow/untie' instead of 'unlink'. Imperative form is better. |
| `enterprise.prompt.heading` | טיפים | **הנחיות** | Wrong word sense: 'tips' instead of 'prompts'. |
| `enterprise.prompt.subtitle` | בסיס ידע והודעה לתמלול בחדרי וידאו בלבד | **הנחיה ובסיס ידע לתמלול בחדרי וידאו בלבד** | Wrong word sense: 'message/notification' instead of 'prompt'. |
| `enterprise.prompt.uploadFile` | העלאת קובץ | **העלה קובץ** | Noun form used for button; imperative verb form is more natural. |
| `enterprise.prompt.hideDefault` | לְהַסתִיר | **הסתר** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.prompt.headerLeadPart2` | - כאשר לוחצים על הודעה בצ'אט ובוחרים צליל | **- כאשר לוחצים על הודעה בצ'אט ובוחרים טון** | Wrong word sense: 'sound' instead of 'tone'. |
| `enterprise.prompt.headerLeadBold2` | "לפי בקשתך" | **"לפי ההנחיה שלך"** | Wrong word sense: 'your request' instead of 'according to your prompt'. |
| `enterprise.prompt.contextLeadPart1` | משמש כשלוחצים על הודעה בצ'אט חדר וידאו ובוחרים צליל | **משמש כשלוחצים על הודעה בצ'אט חדר וידאו ובוחרים טון** | Wrong word sense: 'sound' instead of 'tone'. |
| `enterprise.prompt.contextLeadBold` | "לפי בקשתך" | **"לפי ההנחיה שלך"** | Wrong word sense: 'your request' instead of 'according to your prompt'. |
| `enterprise.prompt.extendNoteText` | עם כללים/סגנון/טרמינולוגיה משלהם - הם ישולבו עם שורת הפקודה המוגדרת כברירת מחדל לעיל ועם מאגר הידע. | **עם כללים/סגנון/טרמינולוגיה משלהם - הם ישולבו עם ההנחיה המוגדרת כברירת מחדל לעיל ועם מאגר הידע.** | Wrong word sense: 'command line' instead of 'default prompt'. |
| `enterprise.prompt.savingPromptLabel` | חִסָכוֹן… | **שומרים...** | Wrong word sense: 'saving money' instead of 'saving' (data). |
| `enterprise.prompt.kbCharsSuffix` | סמלים | **תווים** | Wrong word sense: 'symbols/icons' instead of 'characters'. |
| `enterprise.prompt.kbDeleteTitle` | מחיקת מאגר הידע | **מחק מאגר ידע** | Noun form used for button; imperative verb form is more natural. |
| `enterprise.prompt.kbReplaceFile` | החלפת קובץ | **החלף קובץ** | Noun form used for button; imperative verb form is more natural. |
| `enterprise.prompt.kbUploadFile` | העלאת קובץ | **העלה קובץ** | Noun form used for button; imperative verb form is more natural. |
| `enterprise.prompt.kbUploading` | טְעִינָה… | **מעלים...** | Wrong word sense: 'loading' (noun) instead of 'uploading' (verb). |
| `enterprise.prompt.confirmKbDeleteCta` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.prompt.presetsHeading` | גוונים נגישים של הסבר | **טונים זמינים להסבר** | Wrong word sense: 'shades/hues' instead of 'tones'. |
| `enterprise.prompt.presetsLeadBold` | "לפי בקשתך" | **"לפי ההנחיה שלך"** | Wrong word sense: 'your request' instead of 'according to your prompt'. |
| `enterprise.questFlow.heading` | זרימת קווסט | **Quest Flow** | Brand name 'Quest Flow' should be preserved, not translated. |
| `enterprise.questFlow.promptLabel` | בקשת מערכת זרימת קווסט | **הנחיית מערכת Quest Flow** | Wrong word sense: 'request of' instead of 'prompt of'. |
| `enterprise.questFlow.tagsLabel` | צריך תגיות | **תגיות צרכים** | Grammatically awkward; 'needs tags' is more natural. |
| `enterprise.questFlow.errDelete` | Delete error | **שגיאת מחיקה** | String was not translated to Hebrew. |
| `enterprise.questFlow.copyKey` | לְהַעְתִיק | **העתק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.questFlow.usedOn` | השתמשתי ב-{{date}} | **בשימוש ב-{{date}}** | Wrong verb tense/person: 'I used' instead of 'used on'. |
| `enterprise.questFlow.deleteTitle` | Delete | **מחק** | String was not translated to Hebrew. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **למחוק מפתח?** | String was not translated to Hebrew. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **המפתח יימחק לצמיתות. Quest Flow יפסיק לעבוד דרכו - יהיה עליך ליצור מפתח חדש ולהחליף אותו בזרימה.** | String was not translated to Hebrew. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **מחק** | String was not translated to Hebrew. |
| `enterprise.questFlow.promptHeading` | בקשה לשיחות בטלגרם | **הנחיה לשיחות בטלגרם** | Wrong word sense: 'request' instead of 'prompt'. |
| `enterprise.questFlow.savingPromptLabel` | חִסָכוֹן… | **שומרים...** | Wrong word sense: 'saving money' instead of 'saving' (data). |
| `enterprise.questFlow.savePromptLabel` | לְהַצִיל | **שמור** | Wrong word sense: 'to rescue' instead of 'to save' (data). Imperative form is better. |
| `enterprise.questFlow.kbLead3` | מתוך הקטע "רמזים" - לתמלול וידאו. מגבלה: קובץ 50 מגה-בייט / 500,000 תווים במסד הנתונים. | **מתוך הקטע "הנחיות" - שם לתמלול וידאו. מגבלה: קובץ 50 מגה-בייט / 500,000 תווים במסד הנתונים.** | Wrong word sense: 'hints' instead of 'prompts'. |
| `enterprise.questFlow.kbCharsSuffix` | סמלים | **תווים** | Wrong word sense: 'symbols/icons' instead of 'characters'. |
| `enterprise.questFlow.kbDeleteTitle` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.questFlow.kbReplaceFile` | החלפת קובץ | **החלף קובץ** | Noun form used for button; imperative verb form is more natural. |
| `enterprise.questFlow.kbUploadFile` | העלאת קובץ | **העלה קובץ** | Noun form used for button; imperative verb form is more natural. |
| `enterprise.questFlow.kbUploading` | טְעִינָה… | **מעלים...** | Wrong word sense: 'loading' (noun) instead of 'uploading' (verb). |
| `enterprise.questFlow.confirmKbDeleteCta` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `enterprise.questFlow.tagsHeading` | צריך תגיות | **תגיות צרכים** | Grammatically awkward; 'needs tags' is more natural. |
| `enterprise.chatwoot.heading` | אינטגרציה של CRM (Chatwood) | **אינטגרציה של CRM (Chatwoot)** | Brand name 'Chatwoot' was misspelled. |
| `enterprise.chatwoot.save` | לְהַצִיל | **שמור** | Wrong word sense: 'to rescue' instead of 'to save' (data). Imperative form is better. |
| `enterprise.chatwoot.savingLabel` | חִסָכוֹן… | **שומרים...** | Wrong word sense: 'saving money' instead of 'saving' (data). |
| `enterprise.chatwoot.saveLabel` | לְהַצִיל | **שמור** | Wrong word sense: 'to rescue' instead of 'to save' (data). Imperative form is better. |
| `chat.refreshShort` | לְרַעֲנֵן | **רענן** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `chat.send` | לִשְׁלוֹחַ | **שלח** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `chat.deleteMessage` | מחיקת הודעה | **מחק הודעה** | Noun form used for button; imperative verb form is more natural. |
| `chat.deletingShort` | מוחק... | **מוחקים...** | Singular verb form used; plural is more appropriate for 'we are deleting'. |
| `chat.enterpriseOnlyHint` | חדרי צ'אט הם תכונה של Enterprise. שדרגו את התוכנית שלכם בקטע "תמחור". | **חדרי צ'אט הם תכונה של Enterprise. שדרגו את התוכנית שלכם בקטע "תעריפים".** | Wrong word sense: 'pricing' instead of 'tariffs/plans'. |
| `chat.telegramBadge` | מִברָק | **Telegram** | Brand name 'Telegram' should be preserved, not translated. |
| `insights.recalc` | לְסַפֵּר | **חשב מחדש** | Wrong word sense: 'to tell/narrate' instead of 'recalculate'. |
| `insights.summary` | קוֹרוֹת חַיִים | **סיכום** | Wrong word sense: 'CV/resume' (for a person) instead of 'summary' (of a conversation). |
| `insights.sentiment` | מַפְתֵחַ | **סנטימנט** | Wrong word sense: 'key' instead of 'sentiment'. |
| `insights.engagement` | אירוסין | **מעורבות** | Wrong word sense: 'betrothal' instead of 'involvement/engagement'. |
| `insights.analyzedReplies_one` | העתק {{count}} נותח | **{{count}} תגובה נותחה** | Wrong word sense: 'copy' instead of 'reply'. Also, grammatical order is incorrect. |
| `insights.analyzedReplies_few` | ניתוח של עותקים של {{count}} | **{{count}} תגובות נותחו** | Wrong word sense: 'copies' instead of 'replies'. Also, grammatical phrasing is awkward. |
| `insights.analyzedReplies_many` | ניתוח של עותקים של {{count}} | **{{count}} תגובות נותחו** | Wrong word sense: 'copies' instead of 'replies'. Also, grammatical phrasing is awkward. |
| `insights.analyzedReplies_other` | ניתוח של עותקים של {{count}} | **{{count}} תגובות נותחו** | Wrong word sense: 'copies' instead of 'replies'. Also, grammatical phrasing is awkward. |
| `insights.leadValues.warm` | חַם | **חמים** | Wrong word sense: 'hot' instead of 'warm'. |
| `lobby.languageHint` | תשמע ותראה כתוביות מבן שיחתך באותה שפה. | **תשמע ותראה כתוביות מבן שיחתך בשפה זו.** | Wrong word sense: 'in the same language' instead of 'in this language'. |
| `lobby.connect` | לְחַבֵּר | **התחבר** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `lobby.copyLink` | העתקת קישור | **העתק קישור** | Noun form used for button; imperative verb form is more natural. |
| `lobby.roomFullMsg` | כבר יש משתתף בפגישה. צור קשר עם יוצר הפגישה או בקש משתתף חדש. | **כבר יש משתתף בפגישה. צור קשר עם יוצר הפגישה או צור חדר חדש.** | Wrong word sense: 'request a new participant' instead of 'create a new room'. |
| `paywall.buyPlus` | ועוד — 19 אירו לחודש (60 דקות) | **Plus — €19/חודש (60 דקות)** | Brand name 'Plus' should be preserved, not translated as 'and more'. |
| `paywall.subscribe` | לְעַצֵב | **הירשם** | Wrong word sense: 'to design/style' instead of 'subscribe'. |
| `paywall.topupNoSubInfo` | ℹ אין לך מנוי פעיל. תוספת תתווסף לרכישה שלך תמורת 19 אירו לחודש - 60 דקות כלולות בתוכנית שלך, כך שאין תוספת תשלום. | **ℹ אין לך מנוי פעיל. תוכנית Plus תתווסף לרכישה שלך תמורת 19 אירו לחודש - 60 דקות כלולות בתוכנית שלך, כך שאין תוספת תשלום.** | Wrong word sense: 'addition' instead of 'Plus plan'. |
| `paywall.topupPlusLine` | תעריף פלוס (כולל מינימום {{count}}) | **תעריף Plus (כולל {{count}} דקות)** | Wrong word sense: 'minimum' instead of 'minutes'. Also, 'Plus' should be preserved. |
| `paywall.topupAddon` | רכישה נוספת {{count}} מינימום × €0.17 | **רכישה נוספת {{count}} דקות × €0.17** | Wrong word sense: 'minimum' instead of 'minutes'. |
| `paywall.stripeNote` | התשלומים מוגנים על ידי Stripe. דקות החיוב מזוכות אוטומטית לאחר התשלום. | **התשלומים מוגנים על ידי Stripe. דקות מזוכות אוטומטית לאחר התשלום.** | Grammatically awkward: 'billing minutes' instead of just 'minutes'. |
| `paywall.close` | לִסְגוֹר | **סגור** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `confirmModal.cancel` | לְבַטֵל | **ביטול** | Infinitive verb used for button; noun form is more common and shorter. |
| `confirmModal.confirm` | לְאַשֵׁר | **אישור** | Infinitive verb used for button; noun form is more common and shorter. |
| `confirmModal.delete` | לִמְחוֹק | **מחק** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `postCallInsights.analyzing` | בואו ננתח את השיחה... | **מנתחים את השיחה...** | Wrong phrasing: 'let's analyze' instead of 'analyzing'. |
| `postCallInsights.metricEngagement` | אירוסין | **מעורבות** | Wrong word sense: 'betrothal' instead of 'involvement/engagement'. |
| `postCallInsights.summary` | קוֹרוֹת חַיִים | **סיכום** | Wrong word sense: 'CV/resume' (for a person) instead of 'summary' (of a conversation). |
| `postCallInsights.close` | סגירה וחזרה לחדרים | **סגור וחזור לחדרים** | Noun form used; imperative verb form is more natural. |
| `billingPage.balanceMinutes` | פּרוֹטוֹקוֹל | **דקות** | Wrong word sense: 'protocol' instead of 'minutes'. |
| `billingPage.tierLabel` | קֶצֶב | **תוכנית** | Wrong word sense: 'rhythm/pace' instead of 'plan/tier'. |
| `billingPage.cancel` | לְבַטֵל | **בטל** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `billingPage.resume` | קוֹרוֹת חַיִים | **המשך** | Wrong word sense: 'CV/resume' instead of 'resume/continue'. |
| `billingPage.promoApply` | לִפְנוֹת | **החל** | Wrong word sense: 'to turn/address' instead of 'apply'. |
| `billingPage.topupCarried` | נִדחֶה | **הועבר** | Wrong word sense: 'postponed' instead of 'transferred'. |
| `billingPage.minutesShort` | פּרוֹטוֹקוֹל | **דקות** | Wrong word sense: 'protocol' instead of 'minutes'. |
| `billingPage.tierStandardSummary` | לצוותים ולמתמחים פעילים | **לצוותים ולמשתמשים פעילים** | Wrong word sense: 'interns/specialists' instead of 'users'. |
| `billingPage.tierEnterpriseLabel` | בהסכמה | **בחוזה** | Wrong word sense: 'by agreement/consent' instead of 'by contract'. |
| `billingPage.featureTelegramAuth` | אישור טלגרם + קישור לכרטיס | **אימות טלגרם + קישור לכרטיס** | Wrong word sense: 'confirmation' instead of 'authentication'. |
| `billingPage.featureCRMExport` | ייצוא ל-CRM (Chatwood + API) | **ייצוא ל-CRM (Chatwoot + API)** | Brand name 'Chatwoot' was misspelled. |
| `billingPage.ctaSubscribePlus` | קבל פלוס | **הירשם ל-Plus** | Wrong word sense: 'receive Plus' instead of 'subscribe to Plus'. |
| `billingPage.ctaSubscribeStandard` | הזמנה סטנדרטית | **הירשם ל-Standard** | Noun form used; imperative verb form is more natural. |
| `billingPage.ctaContactWhatsApp` | יצירת קשר דרך וואטסאפ | **צרו קשר בוואטסאפ** | Noun form used; imperative verb form is more natural. |
| `billingPage.ctaContact` | מַגָע | **צרו קשר** | Wrong word sense: 'contact' (noun) instead of 'contact us' (imperative). |
| `billingPage.languagesCount_one` | שפה {{count}} | **{{count}} שפה** | Incorrect word order for number and noun. |
| `billingPage.languagesCount_few` | שפה {{count}} | **{{count}} שפות** | Incorrect word order for number and noun, and incorrect plural form. |
| `billingPage.languagesCount_many` | שפות {{count}} | **{{count}} שפות** | Incorrect word order for number and noun. |
| `billingPage.searchResultsCount_one` | נמצא: שפה {{count}} | **נמצא: {{count}} שפה** | Incorrect word order for number and noun. |
| `billingPage.faqA3` | חבילת בינה מלאכותית מלאה: כרטיסי לקוח עם זיהוי אוטומטי, אישור טלגרם, הנחיות מותאמות אישית, יומן גוגל, תיוג צרכים חכם, ייצוא CRM, אינטגרציה עם questflow.pro וכרטיסיית ניהול נפרדת. | **חבילת בינה מלאכותית מלאה: כרטיסי לקוח עם זיהוי אוטומטי, אימות טלגרם, הנחיות מותאמות אישית, יומן גוגל, תיוג צרכים חכם, ייצוא CRM, אינטגרציה עם questflow.pro וכרטיסיית ניהול נפרדת.** | Wrong word sense: 'confirmation' instead of 'authentication'. |
| `billingPage.faqA4` | כל רשת תואמת RFC: Zadarma, OnlinePBX, Asterisk/FreePBX וכו'. VibeVox יוצר trunk יוצא באופן אוטומטי. | **כל טרנק תואם RFC: Zadarma, OnlinePBX, Asterisk/FreePBX וכו'. VibeVox יוצר trunk יוצא באופן אוטומטי.** | Wrong word sense: 'network' instead of 'trunk'. |
| `billingPage.presetHours` | {{count}}h | **{{count}}ש'** | Unit 'h' should be translated to local equivalent 'ש'' (hours). |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}דק'** | Unit 'm' should be translated to local equivalent 'דק'' (minutes). |
| `billingPage.renewsOn` | סיומת {{date}} | **מתחדש ב-{{date}}** | Wrong word sense: 'ending/suffix' instead of 'renews on'. |
| `auth.login.submit` | כְּנִיסָה לַמַעֲרֶכֶת | **התחבר** | Too long and specific ('login to system'); 'login' is more appropriate. |
| `auth.login.registerLink` | לִרְשׁוֹם | **הירשם** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `auth.register.submit` | לִרְשׁוֹם | **הירשם** | Infinitive verb used for button; imperative form is more natural and shorter. |
| `auth.register.loginLink` | כְּנִיסָה לַמַעֲרֶכֶת | **התחבר** | Too long and specific ('login to system'); 'login' is more appropriate. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
