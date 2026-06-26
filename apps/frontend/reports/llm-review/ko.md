# LLM Review: Korean (ko)

**Model:** gemini-2.5-flash  
**Took:** 210.2s  
**Fixes proposed:** 204 (valid after placeholder-check: 202)  
**Applied:** yes

| Path | Current | Proposed | Reason |
|---|---|---|---|
| `nav.rooms` | 객실 | **방** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `nav.createRoom` | 방을 만드세요 | **방 만들기** | 만드세요 (mandeuseyo) is a polite imperative; 만들기 (mandeulgi) is better for a button label. |
| `nav.billing` | 관세 | **요금제** | 관세 (gwanse) means customs duty; 요금제 (yogemje) is correct for pricing plans. |
| `nav.home` | 집 | **홈** | 집 (jip) means a dwelling; 홈 (hom) is common for UI navigation 'Home'. |
| `rooms.title` | 번역실 | **번역 방** | 번역실 (beonyeoksil) sounds like a physical room; 번역 방 (beonyeok bang) is better for virtual rooms. |
| `rooms.searchPlaceholder` | 찾다... | **검색...** | 찾다 (chatda) is a verb; 검색 (geomsaek) is a noun, more natural for a placeholder. |
| `rooms.create` | 만들다 | **만들기** | 만들다 (mandeulda) is a verb; 만들기 (mandeulgi) is better for a button label. |
| `rooms.empty` | 현재 운영 중인 객실이 없습니다. | **현재 운영 중인 방이 없습니다.** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `rooms.noRoomsInCategory` | 해당 카테고리의 객실은 아직 없습니다. | **해당 카테고리의 방은 아직 없습니다.** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `rooms.participants` | 참가자들 | **참가자** | 참가자들 (chamgajadeul) is explicitly plural; 참가자 (chamgaja) is often used as collective/singular in labels. |
| `rooms.live` | 살다 | **라이브** | 살다 (salda) means 'to live' (verb); 라이브 (raibeu) is correct for 'Live' status. |
| `rooms.closed` | 닫은 | **닫힘** | 닫은 (dadeun) is a past participle; 닫힘 (dathim) is better for a status label. |
| `rooms.actions.open` | 로그인 | **입장** | 로그인 (rogeuin) means 'log in'; 입장 (ipjang) means 'enter' (a room). |
| `rooms.toasts.linkCopied` | 회의실 링크가 복사되었습니다. | **방 링크가 복사되었습니다.** | 회의실 (hoeuisil) is a meeting room; 방 (bang) is more consistent with virtual rooms. |
| `common.confirm` | 확인하다 | **확인** | 확인하다 (hwaginhada) is a verb; 확인 (hwagin) is better for a button label. |
| `common.save` | 구하다 | **저장** | 구하다 (guhada) means 'to save/rescue'; 저장 (jeojang) is correct for 'save' (data). |
| `common.back` | 뒤쪽에 | **뒤로** | 뒤쪽에 (dwijjeoge) means 'at the back'; 뒤로 (dwiro) is correct for a 'Back' button. |
| `common.search` | 찾다 | **검색** | 찾다 (chatda) is a verb; 검색 (geomsaek) is a noun, better for a button label. |
| `common.open` | 열려 있는 | **열기** | 열려 있는 (yeollyeo inneun) is an adjective; 열기 (yeolgi) is better for a button label. |
| `common.select` | 선택하다 | **선택** | 선택하다 (seontaekhada) is a verb; 선택 (seontaek) is better for a button label. |
| `common.edit` | 변화 | **수정** | 변화 (byeonhwa) means 'change' (noun); 수정 (sujeong) is correct for 'edit'. |
| `common.tryAgain` | 반복하다 | **다시 시도** | 반복하다 (banbokhada) means 'to repeat'; 다시 시도 (dasi sido) is correct for 'try again'. |
| `common.success` | 준비가 된 | **완료** | 준비가 된 (junbiga doen) means 'ready'; 완료 (wanryo) is correct for 'done/success'. |
| `balance.label` | 균형 | **잔액** | 균형 (gyunhyeong) means 'balance' (equilibrium); 잔액 (janaek) is correct for account balance. |
| `balance.minutesShort` | 최소 | **분** | 최소 (choeso) means 'minimum'; 분 (bun) is correct for 'minutes'. |
| `balance.openPlans` | 개방형 관세 및 잔액 | **요금제 및 잔액 보기** | 관세 (gwanse) is wrong; 개방형 (gaebanghyeong) is awkward. '요금제 및 잔액 보기' is more natural. |
| `balance.tariffs` | 관세 | **요금제** | 관세 (gwanse) means customs duty; 요금제 (yogemje) is correct for pricing plans. |
| `tier.trial` | 재판 | **체험** | 재판 (jaepan) means 'court trial'; 체험 (cheheom) is correct for 'free trial'. |
| `tier.plus` | 을 더한 | **Plus** | Preserve brand/tier name 'Plus'. |
| `tier.standard` | 기준 | **Standard** | Preserve brand/tier name 'Standard'. |
| `languagePicker.searchPlaceholder` | 언어를 검색 중... | **언어 검색...** | 검색 중 (geomsaek jung) means 'searching now'; 언어 검색 (eoneo geomsaek) is better for a placeholder. |
| `moreSheet.sip.sub` | 트렁크 설치 | **트렁크 설정** | 설치 (seolchi) means 'installation'; 설정 (seoljeong) means 'configuration'. |
| `moreSheet.createRoomAria` | 번역실을 만드세요 | **번역 방 만들기** | 번역실 (beonyeoksil) and 만드세요 (mandeuseyo) issues. Consistent with other room/create fixes. |
| `call.you` | 너 | **본인** | 너 (neo) is informal 'you'; 본인 (bonin) is more appropriate for UI context. |
| `call.toPlayground` | 🎯 매립지로 | **🎯 훈련장으로** | 매립지 (maeripji) means 'landfill'; 훈련장 (hunryeonjang) is correct for 'training ground'. |
| `call.expandPeer` | 대화 상대자를 확장하세요 | **대화 상대 확장** | 확장하세요 (hwakjanghaseyo) is a polite imperative; 확장 (hwakjang) is better for a button label. |
| `call.expandPeerSub` | 상대방은 전체 화면으로 나오고, 당신은 화면 구석에 있습니다. | **상대방은 전체 화면, 본인은 화면 구석** | 당신은 (dangsineun) can be awkward; 본인은 (bonineun) is more natural and concise. |
| `call.more` | 또한 | **더보기** | 또한 (ttohan) means 'also'; 더보기 (deobogi) is correct for a 'More' button. |
| `call.validating` | VibeVox 보안 연결 테스트 중… | **VibeVox 보안 연결 확인 중…** | 테스트 중 (teseuteu jung) means 'testing'; 확인 중 (hwagin jung) is better for 'validating'. |
| `call.backToRooms` | 객실 목록으로 돌아가기 | **방 목록으로 돌아가기** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `call.connecting` | 객실에 연결 중… | **방에 연결 중…** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `call.translatorJoining` | 인공지능 번역기 출시… | **AI 번역기 시작 중…** | 출시 (chulsi) means 'release' (a product); 시작 중 (sijak jung) is better for 'starting' a process. |
| `call.cameraBlocked` | 카메라 및 마이크 사용 금지 | **카메라 또는 마이크가 허용되지 않습니다.** | 사용 금지 (sayong geumji) means 'prohibited'; 허용되지 않습니다 (heoyongdoeji aneupnida) is better for 'not permitted'. |
| `coach.thinking` | AI는 생각한다... | **AI가 생각 중…** | 생각한다 (saenggakhada) is declarative; 생각 중 (saenggak jung) is better for 'thinking...'. |
| `coach.yourReply` | 당신의 답변 | **귀하의 답변** | 당신의 (dangsineui) can be informal; 귀하의 (gwihaui) is more formal and appropriate for UI. |
| `coach.pin` | 핀으로 고정하세요 | **고정** | 고정하세요 (gojeonghaseyo) is a polite imperative; 고정 (gojeong) is better for a button label. |
| `roomActions.translation.disableSub` | 이제 회의록은 무효 처리되지 않습니다. | **번역 시간이 더 이상 차감되지 않습니다.** | 회의록 (hoeuirok) means 'meeting minutes'; 'minutes' here refers to time units. '번역 시간' is correct. |
| `billing.createRoomFailed` | 공간을 만드는 데 실패했습니다. | **방을 만드는 데 실패했습니다.** | 공간 (gonggan) means 'space'; 방 (bang) is more appropriate for virtual rooms. |
| `partner.title` | Partner program | **파트너 프로그램** | Translate brand/product name to Korean. |
| `partner.subtitle` | Share your link and earn | **링크를 공유하고 수익을 얻으세요** | Translate to Korean. |
| `partner.yourLink` | Your link | **귀하의 링크** | Translate to Korean. |
| `partner.copy` | Copy | **복사** | Translate to Korean. |
| `partner.copied` | ✓ Link copied | **✓ 링크가 복사되었습니다.** | Translate to Korean. |
| `partner.stats.clicks` | Clicks | **클릭 수** | Translate to Korean. |
| `partner.stats.registrations` | Sign-ups | **가입** | Translate to Korean. |
| `partner.stats.paid` | Payments | **결제** | Translate to Korean. |
| `partner.stats.paidUnit` | {{users}} users · {{minutes}} min | **{{users}}명 · {{minutes}}분** | Translate to Korean, preserve placeholders. |
| `partner.terms` | Program terms | **프로그램 약관** | Translate to Korean. |
| `partner.contact` | Contact us | **문의하기** | Translate to Korean. |
| `partner.termsModalTitle` | Partner program terms | **파트너 프로그램 약관** | Translate to Korean. |
| `partner.termsEmpty` | Program terms are not set yet. Please contact SuperAdmin. | **프로그램 약관이 아직 설정되지 않았습니다. SuperAdmin에게 문의하세요.** | Translate to Korean. |
| `partner.loadError` | Failed to load partner data | **파트너 데이터 로드에 실패했습니다.** | Translate to Korean. |
| `toneMenu.explainIn` | 어조를 설명하세요 | **어조로 설명** | 설명하세요 (seolmyeonghaseyo) is a polite imperative; 설명 (seolmyeong) is better for a menu item. |
| `toneMenu.anotherTone` | 다른 분위기 | **다른 어조** | 분위기 (bunwigi) means 'atmosphere'; 어조 (eojo) is correct for 'tone'. |
| `toneMenu.tone` | 음정 | **어조** | 음정 (eumjeong) means 'musical pitch'; 어조 (eojo) is correct for 'tone' (of voice/writing). |
| `sip.subtitle` | 수신 및 발신 통화용 회선 설정 | **수신 및 발신 통화용 트렁크 설정** | 회선 (hoeseon) means 'line'; 트렁크 (teureongkeu) is the preserved technical term. |
| `sip.editTrunk` | 트렁크 설정을 변경합니다 | **트렁크 설정 변경** | 변경합니다 (byeongyeonghamnida) is declarative; 변경 (byeongyeong) is better for a label. |
| `sip.serverShort` | 섬기는 사람 | **서버** | 섬기는 사람 (seomgineun saram) means 'a person who serves'; 서버 (seobeo) is correct for 'server'. |
| `sip.transport` | 수송 | **전송** | 수송 (susong) means 'physical transportation'; 전송 (jeonsong) is correct for network 'transport'. |
| `sip.savingShort` | 절약… | **저장 중…** | 절약 (jeoryak) means 'saving money'; 저장 중 (jeojang jung) is correct for 'saving' data. |
| `sip.createTrunk` | 트렁크를 만드세요 | **트렁크 만들기** | 만드세요 (mandeuseyo) is a polite imperative; 만들기 (mandeulgi) is better for a button label. |
| `sip.incoming.create` | 수신 전화를 위한 SIP 주소를 생성합니다. | **수신 SIP 주소 생성** | 생성합니다 (saengseonghamnida) is declarative; 생성 (saengseong) is better for a button label. |
| `sip.incoming.creating` | 저희는 만들고 있습니다… | **생성 중…** | 만들고 있습니다 (mandeulgo itseupnida) means 'we are making'; 생성 중 (saengseong jung) is better for 'creating...'. |
| `sip.incoming.active` | 수신 전화가 들어오고 있습니다. | **수신 전화 활성** | 들어오고 있습니다 (deureoogo itseupnida) means 'coming in'; 활성 (hwalseong) is better for 'active' status. |
| `sip.incoming.activeHint` | 브리지 통역기는 회의실의 대화를 듣고 모든 통화를 실시간으로 통역합니다. | **브리지 통역기는 방의 대화를 듣고 모든 통화를 실시간으로 통역합니다.** | 회의실 (hoeuisil) is a meeting room; 방 (bang) is more consistent with virtual rooms. |
| `sip.incoming.pausedHint` | 수신 기능을 활성화하여 VibeVox가 수신 전화를 착신 전환하도록 설정하세요. | **수신 기능을 활성화하여 VibeVox가 수신 전화를 번역하도록 시작하세요.** | 착신 전환 (chaksin jeonhwan) means 'call forwarding'; the original means 'start translating'. |
| `sip.incoming.translationRoom` | 번역실 | **번역 방** | 번역실 (beonyeoksil) sounds like a physical room; 번역 방 (beonyeok bang) is better for virtual rooms. |
| `sip.incoming.stop` | 멈추다 | **중지** | 멈추다 (meomchuda) means 'to stop' (verb); 중지 (jungji) is better for a button label. |
| `sip.incoming.show` | 보여주다 | **표시** | 보여주다 (boyeojuda) means 'to show' (verb); 표시 (pyosi) is better for a button label. |
| `sip.incoming.hide` | 숨다 | **숨기기** | 숨다 (sumda) means 'to hide' (intransitive); 숨기기 (sumgigi) is better for a button label. |
| `sip.outbound.noTrunkTitle` | 먼저 발신 SIP 트렁크를 설정합니다. | **발신 SIP 트렁크를 먼저 설정하세요.** | 설정합니다 (seoljeonghamnida) is declarative; 설정하세요 (seoljeonghaseyo) is a polite imperative, more natural for instructions. |
| `sip.outbound.configureFirst` | 먼저, 발신 SIP 트렁크를 설정합니다(위 양식 참조). | **발신 SIP 트렁크를 먼저 설정하세요 (위 양식 참조).** | 설정합니다 (seoljeonghamnida) is declarative; 설정하세요 (seoljeonghaseyo) is a polite imperative, more natural for instructions. |
| `sip.outbound.calling` | 저희는 {{number}}에 전화를 걸고 있습니다… | **{{number}}에 전화 거는 중…** | 저희는 (jeohuineun) means 'we'; 전화 거는 중 (jeonhwa geoneun jung) is more concise for 'calling...'. |
| `sip.toasts.deleted` | 트렁크 부분이 삭제되었습니다. | **트렁크가 삭제되었습니다.** | 부분 (bubun) means 'part'; it's redundant here. |
| `sip.sections.security` | 안전 | **보안** | 안전 (anjeon) means 'safety'; 보안 (boan) is correct for 'security'. |
| `sip.sections.providerData` | SIP 제공업체에 대한 세부 정보 | **SIP 제공업체 데이터** | 세부 정보 (sebu jeongbo) means 'details'; 데이터 (deiteo) or 정보 (jeongbo) is more direct. |
| `sip.danger.deleteTrunkHint` | 설정이 삭제됩니다. 회선을 다시 생성할 때까지 발신 통화가 중단됩니다. | **설정이 삭제됩니다. 트렁크를 다시 생성할 때까지 발신 통화가 중단됩니다.** | 회선 (hoeseon) means 'line'; 트렁크 (teureongkeu) is the preserved technical term. |
| `sip.danger.deleteInbound` | 수신 전화에 대한 SIP 주소를 제거하세요. | **수신 SIP 주소 삭제** | 제거하세요 (jegeohaseyo) is a polite imperative; 삭제 (sakje) is better for a label. |
| `sip.danger.deleteInboundHint` | LiveKit 수신 회선 및 배차 규칙이 제거됩니다. 더 이상 수신 전화를 받을 수 없습니다. | **LiveKit 수신 트렁크 및 배차 규칙이 제거됩니다. 더 이상 수신 전화를 받을 수 없습니다.** | 회선 (hoeseon) means 'line'; 트렁크 (teureongkeu) is the preserved technical term. |
| `sip.outbound2.callButton` | 부르다 | **전화 걸기** | 부르다 (bureuda) means 'to call' (a name); 전화 걸기 (jeonhwa geolgi) is correct for 'make a phone call'. |
| `sip.outbound2.callingButton` | 저희가 전화드립니다... | **전화 거는 중…** | 저희가 전화드립니다 (jeohuiga jeonhwadeurimnida) means 'we are calling'; 전화 거는 중 (jeonhwa geoneun jung) is more concise. |
| `sip.confirm.deleteTrunkBody` | 이 작업은 되돌릴 수 없습니다. 삭제되면 새 회선이 생성될 때까지 발신 통화가 중단됩니다. | **이 작업은 되돌릴 수 없습니다. 삭제되면 새 트렁크가 생성될 때까지 발신 통화가 중단됩니다.** | 회선 (hoeseon) means 'line'; 트렁크 (teureongkeu) is the preserved technical term. |
| `sip.confirm.deleteInboundTitle` | 수신되는 IP 주소에서 SIP 주소를 제거하시겠습니까? | **수신 SIP 주소를 삭제하시겠습니까?** | Remove 'IP 주소에서' which is not in the source and redundant. |
| `enterprise.page.upsellCta` | 관세표로 이동 | **요금제로 이동** | 관세표 (gwansepyo) means 'tariff table' (for customs); 요금제 (yogemje) is correct for pricing plans. |
| `enterprise.tabs.prompts` | 팁 | **프롬프트** | 팁 (tip) means 'tip' (advice); 프롬프트 (peureompeuteu) is correct for AI prompts. |
| `enterprise.common.save` | 구하다 | **저장** | 구하다 (guhada) means 'to save/rescue'; 저장 (jeojang) is correct for 'save' (data). |
| `enterprise.common.test` | 시험 | **테스트** | 시험 (siheom) means 'exam/academic test'; 테스트 (teseuteu) is correct for a functional 'test'. |
| `enterprise.common.saving` | 절약… | **저장 중…** | 절약 (jeoryak) means 'saving money'; 저장 중 (jeojang jung) is correct for 'saving' data. |
| `enterprise.common.pasteApiKey` | API 키를 입력하세요 | **API 키를 붙여넣으세요** | 입력하세요 (ipnyeokhaseyo) means 'enter'; 붙여넣으세요 (butyeoneoeuseyo) is correct for 'paste'. |
| `enterprise.common.show` | 보여주다 | **표시** | 보여주다 (boyeojuda) means 'to show' (verb); 표시 (pyosi) is better for a button label. |
| `enterprise.common.hide` | 숨다 | **숨기기** | 숨다 (sumda) means 'to hide' (intransitive); 숨기기 (sumgigi) is better for a button label. |
| `enterprise.apiKey.pastePlaceholder` | API 키를 입력하세요 | **API 키를 붙여넣으세요** | 입력하세요 (ipnyeokhaseyo) means 'enter'; 붙여넣으세요 (butyeoneoeuseyo) is correct for 'paste'. |
| `enterprise.apiKey.show` | 보여주다 | **표시** | 보여주다 (boyeojuda) means 'to show' (verb); 표시 (pyosi) is better for a button label. |
| `enterprise.apiKey.hide` | 숨다 | **숨기기** | 숨다 (sumda) means 'to hide' (intransitive); 숨기기 (sumgigi) is better for a button label. |
| `enterprise.gemini.leadSuffix` | 계정의 모든 제미니 통화에 대해 글로벌 코드 대신 사용됩니다. | **계정의 모든 제미니 통화에 대해 글로벌 키 대신 사용됩니다.** | 코드 (kodeu) means 'code'; 키 (ki) is correct for 'key'. |
| `enterprise.gemini.savingLabel` | 절약… | **저장 중…** | 절약 (jeoryak) means 'saving money'; 저장 중 (jeojang jung) is correct for 'saving' data. |
| `enterprise.gemini.telegram.errEnterToken` | 봇 토큰을 삽입하세요 | **봇 토큰을 붙여넣으세요** | 삽입하세요 (sabiphaseyo) means 'insert'; 붙여넣으세요 (butyeoneoeuseyo) is correct for 'paste'. |
| `enterprise.gemini.telegram.successUnlinked` | 로봇의 묶인 끈이 풀렸습니다. | **봇 연결이 해제되었습니다.** | Literal translation of 'untied string'; '연결 해제됨' (yeon-gyeoldoejim) is correct for 'unlinked'. |
| `enterprise.gemini.telegram.saveLabel` | 구하다 | **저장** | 구하다 (guhada) means 'to save/rescue'; 저장 (jeojang) is correct for 'save' (data). |
| `enterprise.gemini.telegram.testingLabel` | 헬멧… | **전송 중…** | 헬멧 (helmet) means 'helmet'; 전송 중 (jeonsong jung) is correct for 'sending...'. |
| `enterprise.gemini.telegram.confirmUnlinkCta` | 풀다 | **연결 해제** | 풀다 (pulda) means 'to untie'; 연결 해제 (yeon-gyeoldoeje) is correct for 'unlink'. |
| `enterprise.gemini.telegram.lastBroadcast` | 최신 메일 발송: {{total}}에서 {{sent}}일에 발송됨 | **최신 발송: {{total}} 중 {{sent}}개 전달됨** | 메일 발송 (meil balsong) is specific to email; '일' (il) for day is wrong. '중' (jung) for 'out of' and '개' (gae) for count. |
| `enterprise.prompt.heading` | 팁 | **프롬프트** | 팁 (tip) means 'tip' (advice); 프롬프트 (peureompeuteu) is correct for AI prompts. |
| `enterprise.prompt.subtitle` | 화상 회의실에서만 사용 가능한 녹취록 작성 안내 및 지식 기반 | **화상 방에서만 사용 가능한 녹취록 작성 안내 및 지식 기반** | 회의실 (hoeuisil) is a meeting room; 방 (bang) is more consistent with virtual rooms. |
| `enterprise.prompt.promptLabel` | 시스템 안내 메시지(어조, 스타일, 어휘) | **시스템 프롬프트(어조, 스타일, 어휘)** | 안내 메시지 (annae mesiji) means 'guidance message'; 프롬프트 (peureompeuteu) is correct for AI prompts. |
| `enterprise.prompt.hideDefault` | 숨다 | **숨기기** | 숨다 (sumda) means 'to hide' (intransitive); 숨기기 (sumgigi) is better for a button label. |
| `enterprise.prompt.headerLeadBold1` | 화상 회의실에서 메시지 암호 해독에만 사용 가능 | **화상 방에서 메시지 암호 해독에만 사용 가능** | 회의실 (hoeuisil) is a meeting room; 방 (bang) is more consistent with virtual rooms. |
| `enterprise.prompt.headerLeadPart2` | - 채팅에서 메시지를 클릭하고 알림음을 선택할 때 | **- 채팅에서 메시지를 클릭하고 어조를 선택할 때** | 알림음 (allimeum) means 'notification sound'; 어조 (eojo) is correct for 'tone'. |
| `enterprise.prompt.contextLeadPart1` | 화상 채팅에서 메시지를 클릭하고 알림음을 선택할 때 사용됩니다. | **화상 채팅에서 메시지를 클릭하고 어조를 선택할 때 사용됩니다.** | 알림음 (allimeum) means 'notification sound'; 어조 (eojo) is correct for 'tone'. |
| `enterprise.prompt.savingPromptLabel` | 절약… | **저장 중…** | 절약 (jeoryak) means 'saving money'; 저장 중 (jeojang jung) is correct for 'saving' data. |
| `enterprise.prompt.kbLead` | 카탈로그, FAQ, 가격표, 규정 또는 안내 자료 등의 문서를 업로드하세요. 서버에서 콘텐츠가 분석(Word/Excel/CSV → 텍스트)되어 AI가 화상 회의실 메시지 텍스트 변환 시 통합합니다. 파일 크기 제한: 50MB / 데이터베이스 저장 용량: 50만 자. | **카탈로그, FAQ, 가격표, 규정 또는 안내 자료 등의 문서를 업로드하세요. 서버에서 콘텐츠가 분석(Word/Excel/CSV → 텍스트)되어 AI가 화상 방 메시지 텍스트 변환 시 통합합니다. 파일 크기 제한: 50MB / 데이터베이스 저장 용량: 50만 자.** | 회의실 (hoeuisil) is a meeting room; 방 (bang) is more consistent with virtual rooms. |
| `enterprise.prompt.kbCharsSuffix` | 기호 | **문자** | 기호 (giho) means 'symbol'; 문자 (munja) is correct for 'character' count. |
| `enterprise.prompt.presetsHeading` | 이해하기 쉬운 설명 어조 | **사용 가능한 설명 어조** | 이해하기 쉬운 (ihaeha-gi swiun) means 'easy to understand'; 사용 가능한 (sayong ganeunghan) is correct for 'available'. |
| `enterprise.questFlow.warning` | 해당 필드가 비어 있으면 일반적인 VibeVox 안내 메시지가 사용됩니다. | **해당 필드가 비어 있으면 일반적인 VibeVox 프롬프트가 사용됩니다.** | 안내 메시지 (annae mesiji) means 'guidance message'; 프롬프트 (peureompeuteu) is correct for AI prompts. |
| `enterprise.questFlow.tagsLabel` | 태그 필요 | **니즈 태그** | 필요 (piryo) means 'need'; 니즈 태그 (nijeu taeg) is more natural for 'needs tags'. |
| `enterprise.questFlow.createKey` | 키를 생성하세요 | **키 생성** | 생성하세요 (saengseonghaseyo) is a polite imperative; 생성 (saengseong) is better for a button label. |
| `enterprise.questFlow.creatingKey` | 저희는 만들고 있습니다… | **생성 중…** | 만들고 있습니다 (mandeulgo itseupnida) means 'we are making'; 생성 중 (saengseong jung) is better for 'creating...'. |
| `enterprise.questFlow.errDelete` | Delete error | **삭제 오류** | Translate to Korean. |
| `enterprise.questFlow.savedKeyConfirm` | 나는 열쇠를 저장해 두었다 | **나는 키를 저장했습니다** | 열쇠 (yeolsoe) means 'physical key'; 키 (ki) is correct for 'API key'. |
| `enterprise.questFlow.deleteTitle` | Delete | **삭제** | Translate to Korean. |
| `enterprise.questFlow.confirmDeleteTitle` | Delete key? | **키를 삭제하시겠습니까?** | Translate to Korean. |
| `enterprise.questFlow.confirmDeleteBody` | The key will be deleted permanently. Quest Flow will stop working through it — you will need to create a new key and replace it in the flow. | **키는 영구적으로 삭제되며 복구할 수 없습니다. Quest Flow는 해당 키를 통해 작동을 멈출 것이므로, 새 키를 생성하여 플로우에서 교체해야 합니다.** | Translate to Korean. |
| `enterprise.questFlow.confirmDeleteCta` | Delete | **삭제** | Translate to Korean. |
| `enterprise.questFlow.promptHeading` | 텔레그램 대화 시작 프롬프트 | **텔레그램 대화 프롬프트** | 시작 (sijak) means 'start'; it's redundant here. '프롬프트' is sufficient. |
| `enterprise.questFlow.promptLead2` | — 일반적인 VibeVox 안내 메시지가 사용됩니다(아래 참조). | **— 일반적인 VibeVox 프롬프트가 사용됩니다(아래 참조).** | 안내 메시지 (annae mesiji) means 'guidance message'; 프롬프트 (peureompeuteu) is correct for AI prompts. |
| `enterprise.questFlow.promptLeadBold2` | 만약 당신이 양식을 작성한다면 | **만약 직접 작성한다면** | 양식을 작성한다면 (yangsigeul jakseonghandamyeon) means 'if you fill out the form'; 직접 작성한다면 (jikjeop jakseonghandamyeon) is better for 'if you fill out your own'. |
| `enterprise.questFlow.savingPromptLabel` | 절약… | **저장 중…** | 절약 (jeoryak) means 'saving money'; 저장 중 (jeojang jung) is correct for 'saving' data. |
| `enterprise.questFlow.savePromptLabel` | 구하다 | **저장** | 구하다 (guhada) means 'to save/rescue'; 저장 (jeojang) is correct for 'save' (data). |
| `enterprise.questFlow.kbHeading` | 퀘스트 흐름 관련 지식 기반 | **퀘스트 플로우 지식 기반** | 흐름 관련 (heureum gwallyeon) means 'flow related'; 플로우 (peullou) is the preserved term. |
| `enterprise.questFlow.kbLead3` | "힌트" 섹션에서 발췌 - 비디오 텍스트 변환 시. 제한 사항: 파일 크기 50MB / 데이터베이스 문자 수 50만 개. | **프롬프트 섹션과 별개입니다 - 비디오 텍스트 변환 시 사용됩니다. 제한 사항: 파일 크기 50MB / 데이터베이스 문자 수 50만 개.** | 힌트 (hint) is wrong for 'Подсказки' (prompts). '프롬프트 섹션' is correct. |
| `enterprise.questFlow.kbCharsSuffix` | 기호 | **문자** | 기호 (giho) means 'symbol'; 문자 (munja) is correct for 'character' count. |
| `enterprise.questFlow.tagsHeading` | 태그 필요 | **니즈 태그** | 필요 (piryo) means 'need'; 니즈 태그 (nijeu taeg) is more natural for 'needs tags'. |
| `enterprise.questFlow.tagsLead` | AI는 대화에서 일치하는 항목을 감지하면 고객에게 이러한 태그를 할당합니다. 태그는 고객의 객실 카드에 표시되고 CRM으로 전송됩니다(섹션 4). | **AI는 대화에서 일치하는 항목을 감지하면 고객에게 이러한 태그를 할당합니다. 태그는 고객의 방 카드에 표시되고 CRM으로 전송됩니다(섹션 4).** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `enterprise.chatwoot.save` | 구하다 | **저장** | 구하다 (guhada) means 'to save/rescue'; 저장 (jeojang) is correct for 'save' (data). |
| `enterprise.chatwoot.whatSentItem3Prefix` | 모든 할당된 필요 태그 | **모든 할당된 니즈 태그** | 필요 태그 (piryo taeg) means 'need tags'; 니즈 태그 (nijeu taeg) is more natural for 'needs tags'. |
| `chat.videoRoomBadge` | 비디오룸 | **비디오 방** | 비디오룸 (bidiorum) is fine, but 비디오 방 (bidio bang) is more consistent with '방'. |
| `chat.tone` | 음정 | **어조** | 음정 (eumjeong) means 'musical pitch'; 어조 (eojo) is correct for 'tone' (of voice/writing). |
| `chat.backToRooms` | ← 객실 목록으로 돌아가기 | **← 방 목록으로 돌아가기** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `chat.enterpriseOnlyHint` | 채팅방은 기업용 기능입니다. "가격" 섹션에서 요금제를 업그레이드하세요. | **채팅방은 기업용 기능입니다. "요금제" 섹션에서 요금제를 업그레이드하세요.** | 가격 (gagyeok) means 'price'; 요금제 (yogemje) is correct for 'tariffs/plans'. |
| `insights.recalc` | 다시 세기 | **재분석** | 다시 세기 (dasi segi) means 'recount'; 재분석 (jaebunseok) is correct for 'reanalyze'. |
| `insights.summary` | 재개하다 | **요약** | 재개하다 (jaegaehada) means 'to resume'; 요약 (yoyak) is correct for 'summary'. |
| `insights.sentiment` | 열쇠 | **감성** | 열쇠 (yeolsoe) means 'key'; 감성 (gamseong) is correct for 'sentiment'. |
| `insights.engagement` | 약혼 | **참여도** | 약혼 (yakon) means 'marriage engagement'; 참여도 (chamyeodo) is correct for 'involvement/engagement'. |
| `insights.analyzedReplies_one` | {{count}} 복제본 분석됨 | **{{count}}개 발화 분석됨** | 복제본 (bokjebon) means 'replica'; 발화 (balhwa) is correct for 'utterance/turn'. |
| `insights.analyzedReplies_few` | {{count}} 복제본 분석됨 | **{{count}}개 발화 분석됨** | 복제본 (bokjebon) means 'replica'; 발화 (balhwa) is correct for 'utterance/turn'. |
| `insights.analyzedReplies_many` | {{count}} 복제본 분석됨 | **{{count}}개 발화 분석됨** | 복제본 (bokjebon) means 'replica'; 발화 (balhwa) is correct for 'utterance/turn'. |
| `insights.analyzedReplies_other` | {{count}} 복제본 분석됨 | **{{count}}개 발화 분석됨** | 복제본 (bokjebon) means 'replica'; 발화 (balhwa) is correct for 'utterance/turn'. |
| `insights.sentimentValues.positive` | 긍정적인 | **긍정** | 긍정적인 (geungjeongjeogin) is an adjective; 긍정 (geungjeong) is a noun, better for a value label. |
| `insights.sentimentValues.neutral` | 중립적 | **중립** | 중립적 (jungnipjeok) is an adjective; 중립 (jungnip) is a noun, better for a value label. |
| `insights.sentimentValues.negative` | 부정적인 | **부정** | 부정적인 (bujeongjeogin) is an adjective; 부정 (bujeong) is a noun, better for a value label. |
| `insights.leadValues.hot` | 더운 | **뜨거운** | 더운 (deoun) means 'hot' (weather); 뜨거운 (tteugeoun) is better for 'hot' (lead). |
| `insights.leadValues.cold` | 추운 | **차가운** | 추운 (chuun) means 'cold' (weather); 차가운 (chagaun) is better for 'cold' (lead). |
| `insights.thinking` | AI가 대화를 분석합니다... | **AI가 대화를 분석 중…** | 분석합니다 (bunseokhamnida) is declarative; 분석 중 (bunseok jung) is better for 'analyzing...'. |
| `lobby.languageHint` | 상대방의 음성과 음성을 해당 언어로 듣고 볼 수 있습니다. | **상대방의 음성과 자막을 해당 언어로 듣고 볼 수 있습니다.** | 음성과 음성을 (eumseong-gwa eumseong-eul) means 'voice and voice'; should be 'voice and subtitles'. |
| `lobby.connect` | 연결하다 | **연결** | 연결하다 (yeon-gyeoldoehada) is a verb; 연결 (yeon-gyeoldoe) is better for a button label. |
| `lobby.shareHint` | 상대방에게 사본을 보내 회의에 초대하세요. | **상대방에게 링크를 보내 회의에 초대하세요.** | 사본 (sabun) means 'copy' (of a document); 링크 (ringkeu) is correct for 'link'. |
| `paywall.buyPlus` | 추가 요금 — 월 19유로 (60분) | **Plus — 월 19유로 (60분)** | 추가 요금 (chuga yogem) means 'additional charge'; 'Plus' is a tier name. |
| `paywall.buyStandard` | 일반 요금제 – 월 29유로 (최소 120분) | **Standard — 월 29유로 (120분)** | 최소 (choeso) means 'minimum'; 'Standard' is a tier name. '분' is correct for minutes. |
| `paywall.subscribe` | 설계 | **구독** | 설계 (seolgye) means 'design'; 구독 (gudok) is correct for 'subscribe'. |
| `paywall.topupCta` | 최소 구매 금액 {{count}} · €{{price}} | **{{count}}분 구매 · €{{price}}** | 최소 구매 금액 (choeso gumae geumaek) means 'minimum purchase amount'; '분 구매' is correct for 'buy minutes'. |
| `paywall.topupPlusLine` | 플러스 요금 ({{count}} 최소 요금 포함) | **플러스 요금 ({{count}}분 포함)** | 최소 요금 (choeso yogem) means 'minimum charge'; 분 (bun) is correct for 'minutes'. |
| `billingPage.topupCarried` | 연기됨 | **이월됨** | 연기됨 (yeon-gidoem) means 'postponed'; 이월됨 (iwoldoem) is correct for 'carried over'. |
| `billingPage.tierPlusName` | 을 더한 | **Plus** | Preserve brand/tier name 'Plus'. |
| `billingPage.tierStandardName` | 기준 | **Standard** | Preserve brand/tier name 'Standard'. |
| `billingPage.featureRooms` | 영상 및 오디오 룸 | **영상 및 오디오 방** | 룸 (rum) is fine, but 방 (bang) is more consistent with virtual rooms. |
| `billingPage.featureLearnHub` | AI 러닝 허브 - 그 자체의 방언들 | **AI 러닝 허브 - 자신만의 방언** | 그 자체의 방언들 (geu jachaeui bang-eondeul) means 'its own dialects'; 자신만의 방언 (jasinmanui bang-eon) is better for 'custom dialects'. |
| `billingPage.featureAllPlus` | 플러스의 모든 제품 | **플러스의 모든 기능** | 제품 (jepum) means 'product'; 기능 (gineung) is better for 'features'. |
| `billingPage.featureAllStandard` | 모두 스탠다드 제품입니다. | **스탠다드의 모든 기능** | 제품입니다 (jepumipnida) means 'is a product'; 기능 (gineung) is better for 'features'. |
| `billingPage.ctaSubscribePlus` | 플러스 받기 | **Plus 구독** | 받기 (batgi) means 'receive'; 구독 (gudok) is correct for 'subscribe'. |
| `billingPage.ctaSubscribeStandard` | 표준 주문 | **Standard 구독** | 주문 (jumun) means 'order'; 구독 (gudok) is correct for 'subscribe'. |
| `billingPage.ctaContact` | 연락하다 | **문의** | 연락하다 (yeonrakhada) is a verb; 문의 (munui) is better for a button label. |
| `billingPage.faqA3` | 완전한 AI 스택: 자동 인식 기능이 있는 고객 카드, 텔레그램 인증, 개인화된 안내 메시지, 구글 캘린더, 스마트 니즈 태깅, CRM 내보내기, questflow.pro와의 통합, 그리고 별도의 관리자 탭이 포함되어 있습니다. | **완전한 AI 스택: 자동 인식 기능이 있는 고객 카드, 텔레그램 인증, 개인화된 프롬프트, 구글 캘린더, 스마트 니즈 태깅, CRM 내보내기, questflow.pro와의 통합, 그리고 별도의 관리자 탭이 포함되어 있습니다.** | 안내 메시지 (annae mesiji) means 'guidance message'; 프롬프트 (peureompeuteu) is correct for AI prompts. |
| `billingPage.presetHours` | {{count}}h | **{{count}}시간** | Use Korean unit '시간' (sigan) for hours. |
| `billingPage.presetMinutes` | {{count}}m | **{{count}}분** | Use Korean unit '분' (bun) for minutes. |
| `billingPage.renewsOn` | 확장 {{date}} | **갱신 {{date}}** | 확장 (hwakjang) means 'expansion'; 갱신 (gaengsin) is correct for 'renewal'. |
| `billingPage.autoRenewCancelledHint` | 사용하시는 통화 시간은 이 날짜까지 유효합니다. 추가 통화 시간은 구매하실 수 있습니다. 통화를 중단하고 싶으시면 "재개"를 클릭하세요. | **사용하시는 통화 시간은 이 날짜까지 유효합니다. 추가 통화 시간은 구매하실 수 있습니다. 마음을 바꾸셨다면 "재개"를 클릭하세요.** | 통화를 중단하고 싶으시면 (tonghwareul jungdanhago sipeusimyeon) means 'if you want to stop the call'; 마음을 바꾸셨다면 (maeumeul bakkusyeotdamyeon) is correct for 'if you change your mind'. |
| `auth.login.loading` | 우리는 진입합니다... | **로그인 중…** | 우리는 진입합니다 (urineun jiniphamnida) means 'we enter'; 로그인 중 (rogeuin jung) is better for 'logging in...'. |
| `auth.login.registerLink` | 등록하다 | **회원가입** | 등록하다 (deungnokhada) is a verb; 회원가입 (hoewongaip) is better for a 'register' link. |
| `auth.register.title` | 계정을 만드세요 | **계정 만들기** | 만드세요 (mandeuseyo) is a polite imperative; 만들기 (mandeulgi) is better for a title. |
| `auth.register.submit` | 등록하다 | **회원가입** | 등록하다 (deungnokhada) is a verb; 회원가입 (hoewongaip) is better for a 'register' button. |
| `auth.register.loading` | 저희는 등록 중입니다… | **등록 중…** | 저희는 등록 중입니다 (jeohuineun deungnok jungimnida) means 'we are registering'; 등록 중 (deungnok jung) is more concise. |
| `auth.forgot.loading` | 배상… | **전송 중…** | 배상 (baesang) means 'compensation'; 전송 중 (jeonsong jung) is correct for 'sending...'. |
| `auth.forgot.backToLogin` | ← 입구로 돌아가기 | **← 로그인으로 돌아가기** | 입구 (ipgu) means 'entrance'; 로그인 (rogeuin) is correct for 'login'. |
| `postCallInsights.analyzing` | 대화를 분석해 봅시다... | **대화 분석 중…** | 분석해 봅시다 (bunseokhae bopsida) means 'let's analyze'; 분석 중 (bunseok jung) is better for 'analyzing...'. |
| `postCallInsights.metricSentiment` | 분위기 | **감성** | 분위기 (bunwigi) means 'atmosphere'; 감성 (gamseong) is correct for 'sentiment'. |
| `postCallInsights.metricEngagement` | 약혼 | **참여도** | 약혼 (yakon) means 'marriage engagement'; 참여도 (chamyeodo) is correct for 'involvement/engagement'. |
| `postCallInsights.summary` | 재개하다 | **요약** | 재개하다 (jaegaehada) means 'to resume'; 요약 (yoyak) is correct for 'summary'. |
| `postCallInsights.close` | 닫고 객실로 돌아가기 | **닫고 방으로 돌아가기** | 객실 (gaeksil) refers to hotel rooms; 방 (bang) is more appropriate for virtual rooms. |
| `settingsMore.subscription` | 신청 | **구독** | 신청 (sincheong) means 'application'; 구독 (gudok) is correct for 'subscription'. |
| `billingPage.title` | 관세 및 결제 | **요금제 및 결제** | 관세 (gwanse) means customs duty; 요금제 (yogemje) is correct for pricing plans. |
| `billingPage.tierLabel` | 비율 | **요금제** | 비율 (biyul) means 'ratio/rate'; 요금제 (yogemje) is correct for 'tariff/plan'. |
| `billingPage.resume` | 재개하다 | **재개** | 재개하다 (jaegaehada) is a verb; 재개 (jaegae) is better for a button label. |

⚠ 2 fix(es) skipped (no-op, missing path, or would break placeholders).
