# LLM Review: Thai (th)

**Model:** gemini-2.5-flash  
**Took:** 394.9s  
**Fixes proposed:** 94 (valid after placeholder-check: 93)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | ห้องพัก | **ห้อง** | Incorrect word sense; 'ห้องพัก' implies a hotel room, 'ห้อง' is for digital rooms. |
| `rooms.tabs.questFlow` | เควสต์โฟลว์ | **Quest Flow** | Brand name 'Quest Flow' must be preserved exactly. |
| `rooms.tabs.vibeAdd` | ไวบ์แอด | **VibeAdd** | Brand name 'VibeAdd' must be preserved exactly. |
| `rooms.noRoomsInCategory` | ขณะนี้ยังไม่มีห้องพักในหมวดหมู่นี้ | **ขณะนี้ยังไม่มีห้องในหมวดหมู่นี้** | Incorrect word sense; 'ห้องพัก' implies a hotel room, 'ห้อง' is for digital rooms. |
| `balance.label` | สมดุล | **ยอดคงเหลือ** | Incorrect word sense; 'สมดุล' is for general balance, 'ยอดคงเหลือ' for account balance. |
| `languagePicker.searchPlaceholder` | กำลังค้นหาภาษา... | **ค้นหาภาษา...** | Grammatically awkward for a placeholder; 'ค้นหาภาษา' is more natural. |
| `settings.themeDarkSub` | อะบิส ออโรร่า (ดาร์ค) | **Abyss Aurora (Dark)** | Brand name 'Abyss Aurora' must be preserved exactly. |
| `settings.themeLightSub` | แสงออโรร่าบนเมฆ (แสง) | **Cloud Aurora (Light)** | Brand name 'Cloud Aurora' must be preserved exactly. |
| `partner.title` | Partner program | **โปรแกรมพันธมิตร** | English text; should be translated to Thai. |
| `partner.subtitle` | Share your link and earn | **แชร์ลิงก์ของคุณและรับรายได้** | English text; should be translated to Thai. |
| `partner.yourLink` | Your link | **ลิงก์ของคุณ** | English text; should be translated to Thai. |
| `partner.copy` | Copy | **คัดลอก** | English text; should be translated to Thai (verb form). |
| `partner.copied` | ✓ Link copied | **✓ คัดลอกลิงก์แล้ว** | English text; should be translated to Thai. |
| `partner.stats.clicks` | Clicks | **จำนวนการคลิก** | English text; should be translated to Thai. |
| `partner.stats.registrations` | Sign-ups | **จำนวนการลงทะเบียน** | English text; should be translated to Thai. |
| `partner.stats.paid` | Payments | **การชำระเงิน** | English text; should be translated to Thai. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}} ผู้ใช้ · {{minutes}} นาที** | English text; should be translated to Thai. |
| `partner.terms` | Program terms | **ข้อกำหนดของโปรแกรม** | English text; should be translated to Thai. |
| `partner.contact` | Contact us | **ติดต่อเรา** | English text; should be translated to Thai. |
| `partner.termsModalTitle` | Partner program terms | **ข้อกำหนดของโปรแกรมพันธมิตร** | English text; should be translated to Thai. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **ยังไม่ได้กำหนดข้อกำหนดของโปรแกรม โปรดติดต่อ SuperAdmin** | English text; should be translated to Thai. |
| `partner.loadError` | Failed to load partner data | **ไม่สามารถโหลดข้อมูลพันธมิตรได้** | English text; should be translated to Thai. |
| `moreSheet.enterprise.sub` | กุญแจเจมินี, Quest Flow, แท็ก, CRM | **Gemini Key, Quest Flow, แท็ก, CRM** | Brand name 'Gemini' and technical term 'Key' should be preserved. |
| `call.geminiLive` | เจมินี่ ไลฟ์ | **Gemini Live** | Brand name 'Gemini Live' must be preserved exactly. |
| `call.backToRooms` | กลับไปที่รายการห้องพัก | **กลับไปที่รายการห้อง** | Incorrect word sense; 'ห้องพัก' implies a hotel room, 'ห้อง' is for digital rooms. |
| `coach.thinking` | ปัญญาประดิษฐ์คิดว่า... | **AI กำลังคิด...** | Grammatically awkward; 'AI กำลังคิด' means 'AI is thinking'. |
| `billing.quotaExhausted` | เวลาแปลหมดลงแล้ว | **นาทีแปลหมดลงแล้ว** | More precise given the context of 'minutes'. |
| `billing.lowBalance` | เหลือเวลาแปล {{n}} นาที | **เหลือนาทีแปล {{n}} นาที** | More precise given the context of 'minutes'. |
| `sip.subtitle` | การตั้งค่าช่องทางสำหรับการโทรเข้าและโทรออก | **การตั้งค่า SIP trunk สำหรับการโทรเข้าและโทรออก** | Technical term 'SIP trunk' should be used. |
| `sip.loginShort` | เข้าสู่ระบบ | **ล็อกอิน** | Incorrect word sense; 'เข้าสู่ระบบ' is a verb, 'ล็อกอิน' (transliteration) is a noun. |
| `sip.callerIdLabel` | แสดงหมายเลขผู้โทร (ไม่บังคับ) | **Caller ID (ไม่บังคับ)** | Technical term 'Caller ID' must be preserved. |
| `sip.incoming.activeHint` | ระบบแปลภาษาของ The Bridge จะรับฟังบทสนทนาในห้อง และทุกการสนทนาจะถูกแปลแบบเรียลไทม์ | **บอทแปลภาษาจะรับฟังบทสนทนาในห้อง และทุกการสนทนาจะถูกแปลแบบเรียลไทม์** | More natural phrasing; 'Bridge' is not a brand name. |
| `sip.outbound.noTrunkHint` | กรอกแบบฟอร์ม "สร้าง SIP Trunk ใหม่" ที่ด้านบนของหน้า - VibeVox จะใช้ผู้ให้บริการ SIP ของคุณ (เช่น Zadarma, OnlinePBX เป็นต้น) สำหรับการโทรออก | **กรอกแบบฟอร์ม "สร้าง SIP Trunk ใหม่" ที่ด้านบนของหน้า - VibeVox จะใช้ SIP provider ของคุณ (Zadarma, OnlinePBX, …) สำหรับการโทรออก** | Technical term 'SIP provider' should be preserved. |
| `sip.howTo.step1` | รับข้อมูลประจำตัวของ SIP trunk จากผู้ให้บริการของคุณ (Zadarma, OnlinePBX, Asterisk) | **รับข้อมูลประจำตัวของ SIP trunk จาก SIP provider ของคุณ (Zadarma, OnlinePBX, Asterisk)** | Technical term 'SIP provider' should be preserved. |
| `sip.danger.deleteInboundHint` | ระบบ LiveKit ในส่วนของสายรับสายขาเข้าและกฎการส่งสายจะถูกลบออก จะไม่สามารถรับสายเรียกเข้าได้อีกต่อไป | **LiveKit inbound trunk และ dispatch rule จะถูกลบออก จะไม่สามารถรับสายเรียกเข้าได้อีกต่อไป** | Technical terms 'inbound trunk' and 'dispatch rule' should be preserved. |
| `sip.outbound2.rateInfo` | ค่าใช้จ่ายต่อนาทีสำหรับการโทรออกจะถูกกำหนดโดยผู้ให้บริการ SIP ของคุณ | **ค่าใช้จ่ายต่อนาทีสำหรับการโทรออกจะถูกกำหนดโดย SIP provider ของคุณ** | Technical term 'SIP provider' should be preserved. |
| `sip.confirm.deleteInboundBody` | การดำเนินการนี้ไม่สามารถย้อนกลับได้ กฎการเชื่อมต่อขาเข้าและกฎการส่งใน LiveKit Cloud จะถูกลบออก | **การดำเนินการนี้ไม่สามารถย้อนกลับได้ inbound trunk และ dispatch rule ใน LiveKit Cloud จะถูกลบออก** | Technical terms 'inbound trunk' and 'dispatch rule' should be preserved. |
| `enterprise.tabs.gemini` | เจมินี API | **Gemini API** | Brand name 'Gemini' must be preserved exactly. |
| `enterprise.tabs.questFlow` | เควสต์โฟลว์ | **Quest Flow** | Brand name 'Quest Flow' must be preserved exactly. |
| `enterprise.tabs.chatwoot` | ระบบ CRM (แชทวูท) | **CRM (Chatwoot)** | Brand name 'Chatwoot' must be preserved exactly. |
| `enterprise.apiKey.copy` | สำเนา | **คัดลอก** | Incorrect word sense; 'สำเนา' is a noun (a copy), 'คัดลอก' is a verb (to copy). |
| `enterprise.gemini.heading` | คีย์ API ของ Google Gemini | **Google Gemini API Key** | Brand name 'Gemini' and technical term 'API Key' should be preserved. |
| `enterprise.gemini.aiStudioLink` | เอไอ สตูดิโอ | **AI Studio** | Brand name 'AI Studio' must be preserved exactly. |
| `enterprise.gemini.errEnterKey` | ป้อนรหัส API ของ Gemini ของคุณ | **ป้อน Gemini API Key ของคุณ** | Brand name 'Gemini' and technical term 'API Key' should be preserved. |
| `enterprise.gemini.successValid` | รหัสถูกต้อง - สามารถใช้งาน Gemini API ได้ | **Key ถูกต้อง - สามารถใช้งาน Gemini API ได้** | Using transliterated 'Key' for consistency with technical terms. |
| `enterprise.gemini.confirmDeleteTitle` | ลบคีย์ Gemini ต่อผู้เช่าแต่ละรายออกหรือไม่? | **ลบ Per-tenant Gemini Key หรือไม่?** | Technical terms 'Per-tenant Gemini Key' should be preserved. |
| `enterprise.gemini.telegram.botFatherLabel` | @บอทฟาเธอร์ | **@BotFather** | Brand name '@BotFather' must be preserved exactly. |
| `enterprise.gemini.telegram.leadStartCmd` | /เริ่ม | **/start** | Command '/start' must be preserved exactly. |
| `enterprise.prompt.kbHeading` | ฐานข้อมูลความรู้ — ไฟล์ TXT / Word / Excel / CSV | **ฐานความรู้ — TXT / Word / Excel / CSV** | Technical terms 'TXT / Word / Excel / CSV' should be preserved. |
| `enterprise.questFlow.heading` | เควสต์โฟลว์ | **Quest Flow** | Brand name 'Quest Flow' must be preserved exactly. |
| `enterprise.questFlow.subtitle` | AI ตอบกลับลูกค้าผ่านบอท Telegram และ Inbound API | **AI ตอบกลับลูกค้าผ่าน Telegram bot และ Inbound API** | Technical terms 'Telegram bot' and 'Inbound API' should be preserved. |
| `enterprise.questFlow.promptLabel` | ข้อความแจ้งเตือน Quest Flow | **Quest Flow Prompt** | Brand name 'Quest Flow' and technical term 'Prompt' should be preserved. |
| `enterprise.questFlow.kbLabel` | ฐานความรู้ของ Quest Flow | **Quest Flow Knowledge Base** | Brand name 'Quest Flow' and technical term 'Knowledge Base' should be preserved. |
| `enterprise.questFlow.headerLead` | AI สนทนากับลูกค้าแต่ละรายโดยตรงผ่านบอท Telegram ที่เชื่อมต่อกับ Quest Flow | **AI สนทนากับลูกค้าแต่ละรายโดยตรงผ่าน Telegram bot ที่เชื่อมต่อกับ Quest Flow** | Technical term 'Telegram bot' should be preserved. |
| `enterprise.questFlow.keysHeading` | คีย์ API ของ Quest Flow | **Quest Flow API Keys** | Brand name 'Quest Flow' and technical term 'API Keys' should be preserved. |
| `enterprise.questFlow.keysLead` | แต่ละคีย์คือรหัสลับที่คุณใส่เข้าไปในบล็อก HTTP ของ Quest Flow ในแต่ละเชน VibeVox จะใช้รหัสนี้ในการระบุบัญชีของคุณ คุณสามารถสร้างคีย์ได้หลายคีย์สำหรับเชนต่างๆ | **แต่ละ Key คือรหัสลับที่คุณใส่เข้าไปใน HTTP block ของ Quest Flow ในแต่ละ Flow VibeVox จะใช้รหัสนี้ในการระบุบัญชีของคุณ คุณสามารถสร้าง Key ได้หลาย Key สำหรับหลาย Flow** | Technical terms 'Key', 'HTTP block', and 'Flow' should be preserved/transliterated. |
| `enterprise.questFlow.errDelete` | Delete error | **ข้อผิดพลาดในการลบ** | English text; should be translated to Thai. |
| `enterprise.questFlow.deleteTitle` | Delete | **ลบ** | English text; should be translated to Thai. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **ลบ Key ใช่ไหม?** | English text; should be translated to Thai, preserving 'Key'. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **Key จะถูกลบอย่างถาวร Quest Flow จะหยุดทำงานผ่าน Key นี้ — คุณจะต้องสร้าง Key ใหม่และแทนที่ใน Flow** | English text; should be translated to Thai, preserving technical terms. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **ลบ** | English text; should be translated to Thai. |
| `enterprise.questFlow.promptHeading` | ข้อความแจ้งเตือนสำหรับการสนทนาใน Telegram | **Prompt สำหรับ Telegram Dialogs** | Technical terms 'Prompt' and 'Telegram Dialogs' should be preserved. |
| `enterprise.questFlow.successPromptSaved` | บันทึกข้อความแจ้งเตือน Quest Flow แล้ว | **บันทึก Quest Flow Prompt แล้ว** | Brand name 'Quest Flow' and technical term 'Prompt' should be preserved. |
| `enterprise.chatwoot.heading` | การผสานรวมระบบ CRM (แชทบอท) | **CRM Integration (Chatwoot)** | Technical terms 'CRM Integration' and brand name 'Chatwoot' should be preserved. |
| `enterprise.chatwoot.headingShort` | ระบบ CRM (แชทวูท) | **CRM (Chatwoot)** | Brand name 'Chatwoot' must be preserved exactly. |
| `enterprise.chatwoot.urlFieldLabel` | URL ของ Chatwoot (แบบติดตั้งเองหรือ app.chatwoot.com) | **Chatwoot URL (self-hosted หรือ app.chatwoot.com)** | Technical terms 'Chatwoot URL', 'self-hosted', and 'app.chatwoot.com' should be preserved. |
| `enterprise.chatwoot.tokenFieldLabel` | โทเค็นการเข้าถึงของเอเจนต์ (จาก โปรไฟล์ → โทเค็นการเข้าถึง) | **Agent Access Token (จาก Profile → Access Token)** | Technical terms 'Agent Access Token', 'Profile', and 'Access Token' should be preserved. |
| `enterprise.chatwoot.tokenPlaceholder` | โทเค็นการเข้าถึงของเอเจนต์ | **Agent Access Token** | Technical term 'Agent Access Token' should be preserved. |
| `enterprise.chatwoot.whatSentItem1` | ข้อมูลติดต่อลูกค้า (โดยใช้ Telegram_user_id พร้อมคุณสมบัติที่กำหนดเอง) | **ข้อมูลติดต่อลูกค้า (โดยใช้ telegram_user_id พร้อม custom_attributes)** | Technical terms 'telegram_user_id' and 'custom_attributes' should be preserved. |
| `enterprise.chatwoot.whatSentItem2` | บทสนทนาพร้อมบันทึกส่วนตัว = ประวัติการสนทนาทั้งหมด | **Conversation พร้อมบันทึกส่วนตัว = ประวัติการสนทนาทั้งหมด** | Technical term 'Conversation' should be preserved. |
| `enterprise.chatwoot.whatSentItem3Code` | แท็กคุณสมบัติแบบกำหนดเองของไวเบว็อกซ์ | **custom_attributes.vibevox_tags** | Technical term 'custom_attributes.vibevox_tags' must be preserved exactly. |
| `enterprise.chatwoot.docsLabel` | เอกสารประกอบการใช้งาน API ของ Chatwoot | **Chatwoot API Documentation** | Technical terms 'Chatwoot API Documentation' should be preserved. |
| `chat.backToRooms` | ← กลับไปที่ห้องพัก | **← กลับไปที่ห้อง** | Incorrect word sense; 'ห้องพัก' implies a hotel room, 'ห้อง' is for digital rooms. |
| `chat.telegramBadge` | โทรเลข | **Telegram** | Brand name 'Telegram' must be preserved exactly. |
| `insights.leadScore` | คะแนนนำ | **Lead Score** | Technical term 'Lead Score' must be preserved exactly. |
| `postCallInsights.subtitle` | องค์กร · ข้อมูลเชิงลึกหลังการโทร | **Enterprise · Post-Call Insights** | Technical terms 'Enterprise' and 'Post-Call Insights' should be preserved. |
| `postCallInsights.analyzing` | มาวิเคราะห์บทสนทนานี้กัน... | **กำลังวิเคราะห์บทสนทนา...** | Grammatically awkward; 'กำลังวิเคราะห์' means 'analyzing'. |
| `postCallInsights.metricEngagement` | การว่าจ้าง | **การมีส่วนร่วม** | Incorrect word sense; 'การว่าจ้าง' means employment, 'การมีส่วนร่วม' for engagement. |
| `postCallInsights.summary` | ประวัติย่อ | **สรุป** | Incorrect word sense; 'ประวัติย่อ' means resume, 'สรุป' for summary. |
| `postCallInsights.metricLeadScore` | คะแนนนำ | **Lead Score** | Technical term 'Lead Score' must be preserved exactly. |
| `postCallInsights.close` | ปิดประตูและกลับเข้าห้องพัก | **ปิดและกลับเข้าห้อง** | Incorrect word sense; 'ห้องพัก' implies a hotel room, 'ห้อง' is for digital rooms. Also shortened for brevity. |
| `paywall.buyStandard` | มาตรฐาน – 29 ยูโร/เดือน (120 นาที) | **Standard – 29 ยูโร/เดือน (120 นาที)** | Brand name 'Standard' must be preserved exactly. |
| `paywall.featureHd` | เสียงคุณภาพสูง วิดีโอ และโค้ช AI | **HD-voices, Video, AI Coach** | Technical terms 'HD-voices' and 'AI Coach' should be preserved. |
| `billingPage.featureHd` | เสียงพากย์ HD (อาโอเอเด, ชารอน, โคเร) | **HD-voices (Aoede, Charon, Kore)** | Technical term 'HD-voices' and brand names 'Aoede, Charon, Kore' should be preserved. |
| `billingPage.featureLearnHub` | ศูนย์การเรียนรู้ AI — ภาษาถิ่นเฉพาะของตนเอง | **AI Learning Hub — ภาษาถิ่นเฉพาะของตนเอง** | Technical term 'AI Learning Hub' should be preserved. |
| `billingPage.featureCRM` | บัตรลูกค้าพร้อมระบบจดจำอัตโนมัติ | **CRM Client Cards with Auto-Recognition** | Technical terms 'CRM Client Cards' and 'Auto-Recognition' should be preserved. |
| `billingPage.featureTelegramAuth` | การอนุญาตใช้งาน Telegram + การเชื่อมโยงกับบัตร | **Telegram Authorization + Card Linking** | Technical terms 'Telegram Authorization' and 'Card Linking' should be preserved. |
| `billingPage.featureCalendar` | ปฏิทิน Google - การนัดหมายลูกค้า | **Google Calendar - Customer Appointments** | Brand name 'Google Calendar' and technical term 'Customer Appointments' should be preserved. |
| `billingPage.featureCRMExport` | ส่งออกไปยัง CRM (Chatwoot + API) | **Export to CRM (Chatwoot + API)** | Technical terms 'Export', 'CRM', 'Chatwoot', and 'API' should be preserved. |
| `billingPage.featureQuestFlow` | การผสานรวมกับ questflow.pro (แอปพลิเคชันขนาดเล็ก) | **Integration with questflow.pro (Mini-Application)** | Technical terms 'Integration', 'questflow.pro', and 'Mini-Application' should be preserved. |
| `billingPage.faqA3` | ระบบ AI ครบวงจร: บัตรลูกค้าพร้อมระบบจดจำอัตโนมัติ, การอนุญาตผ่าน Telegram, ข้อความแจ้งเตือนส่วนบุคคล, Google Calendar, การติดแท็กความต้องการอัจฉริยะ, การส่งออกข้อมูลไปยัง CRM, การผสานรวมกับ questflow.pro และแท็บผู้ดูแลระบบแยกต่างหาก | **Full AI Stack: CRM Client Cards with Auto-Recognition, Telegram Authorization, Personal AI Prompts, Google Calendar, Smart Needs Tagging, Export to CRM, Integration with questflow.pro, Separate Admin Tab** | Technical terms 'Full AI Stack', 'CRM Client Cards', 'Auto-Recognition', 'Telegram Authorization', 'Personal AI Prompts', 'Google Calendar', 'Smart Needs Tagging', 'Export', 'CRM', 'Integration', 'questflow.pro', and 'Separate Admin Tab' should be preserved. |
| `billingPage.faqQ4` | คุณต้องการใช้ผู้ให้บริการโทรศัพท์ SIP รายใด? | **คุณต้องการใช้ SIP telephony provider รายใด?** | Technical term 'SIP telephony provider' should be preserved. |
| `billingPage.faqA4` | ระบบใดๆ ที่เป็นไปตามมาตรฐาน RFC เช่น Zadarma, OnlinePBX, Asterisk/FreePBX เป็นต้น VibeVox จะสร้าง Trunk ขาออกโดยอัตโนมัติ | **ระบบใดๆ ที่เป็นไปตามมาตรฐาน RFC เช่น Zadarma, OnlinePBX, Asterisk/FreePBX เป็นต้น VibeVox จะสร้าง Outbound Trunk โดยอัตโนมัติ** | Technical terms 'RFC' and 'Outbound Trunk' should be preserved. |

⚠ 1 fix(es) skipped (no-op, missing path, or would break placeholders).
