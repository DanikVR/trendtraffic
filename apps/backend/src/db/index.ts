import pg, { type PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// Путь к файлу локального бэкапа базы данных в рабочей директории.
// DB_FALLBACK_FILE позволяет изолировать стор: тесты пишут в СВОЙ файл, чтобы не
// драться за один db_fallback.json с запущенным dev-сервером. Параллельные писатели
// в один файл (тесты + dev + облачная синхронизация Google Drive) — и были причиной
// порчи: оборванная не атомарная запись оставляла файл забитым NUL-байтами.
const FALLBACK_FILE = process.env.DB_FALLBACK_FILE
  ? path.resolve(process.env.DB_FALLBACK_FILE)
  : path.join(process.cwd(), 'db_fallback.json');
// Бэкап последнего НЕпустого состояния — из него автоматически восстанавливаемся,
// если основной файл окажется повреждён (NUL-байты от оборванной записи и т.п.).
const FALLBACK_BACKUP = FALLBACK_FILE + '.bak';

// Метка времени для имён temp/карантинных файлов — без двоеточий (запрещены в путях Windows).
function fallbackStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Глобальное состояние in-memory БД
interface FallbackData {
  users: any[];
  tenants: any[];
  user_profiles: any[];
  rooms: any[];
  dialect_rules: any[];
  sip_trunks: any[];
  sip_inbound: any[];
  subscriptions: any[];
  promo_codes: any[];
  // ENTERPRISE v0.10.0
  room_messages: any[];
  tenant_quest_flow_keys: any[];
  tenant_mcp_keys: any[];
  tenant_need_tags: any[];
  client_tag_assignments: any[];
  // OMNICHANNEL Фаза 1 — связка «канал арендатора ↔ инбокс Chatwoot»
  channel_inboxes: any[];
  // OMNICHANNEL Фаза 2 — цепочки + их сессии
  flows: any[];
  flow_sessions: any[];
  // Чёрный список удалённых аккаунтов (нельзя зарегистрироваться/войти заново)
  account_blocklist: any[];
  // v1.0.6 — Партнёрская программа
  partners: any[];
  referral_clicks: any[];
  referrals: any[];
  partner_program_settings: any; // singleton (объект, не массив)
}

let fallbackActive = false;
let fallbackLoaded = false;
let fallbackData: FallbackData = {
  users: [],
  tenants: [],
  user_profiles: [],
  rooms: [],
  dialect_rules: [],
  sip_trunks: [],
  sip_inbound: [],
  subscriptions: [],
  promo_codes: [],
  room_messages: [],
  tenant_quest_flow_keys: [],
  tenant_mcp_keys: [],
  tenant_need_tags: [],
  client_tag_assignments: [],
  channel_inboxes: [],
  flows: [],
  flow_sessions: [],
  account_blocklist: [],
  partners: [],
  referral_clicks: [],
  referrals: [],
  partner_program_settings: { terms_text: '', whatsapp_contact: '+380637610482', updated_at: null, updated_by: null }
};

// Функция для генерации UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Гарантируем, что все коллекции инициализированы (после загрузки из файла/бэкапа).
function normalizeFallbackArrays() {
  fallbackData.users = fallbackData.users || [];
  fallbackData.tenants = fallbackData.tenants || [];
  fallbackData.user_profiles = fallbackData.user_profiles || [];
  fallbackData.rooms = fallbackData.rooms || [];
  fallbackData.dialect_rules = fallbackData.dialect_rules || [];
  fallbackData.sip_trunks = fallbackData.sip_trunks || [];
  fallbackData.sip_inbound = fallbackData.sip_inbound || [];
  fallbackData.subscriptions = fallbackData.subscriptions || [];
  fallbackData.promo_codes = fallbackData.promo_codes || [];
  // ENTERPRISE v0.10.0
  fallbackData.room_messages = fallbackData.room_messages || [];
  fallbackData.tenant_quest_flow_keys = fallbackData.tenant_quest_flow_keys || [];
  fallbackData.tenant_mcp_keys = fallbackData.tenant_mcp_keys || [];
  fallbackData.tenant_need_tags = fallbackData.tenant_need_tags || [];
  fallbackData.client_tag_assignments = fallbackData.client_tag_assignments || [];
  fallbackData.channel_inboxes = fallbackData.channel_inboxes || [];
  fallbackData.flows = fallbackData.flows || [];
  fallbackData.flow_sessions = fallbackData.flow_sessions || [];
  fallbackData.account_blocklist = fallbackData.account_blocklist || [];
  fallbackData.partners = fallbackData.partners || [];
  fallbackData.referral_clicks = fallbackData.referral_clicks || [];
  fallbackData.referrals = fallbackData.referrals || [];
  fallbackData.partner_program_settings = fallbackData.partner_program_settings || {
    terms_text: '',
    whatsapp_contact: '+380637610482',
    updated_at: null,
    updated_by: null
  };
}

// Файл считается ПОВРЕЖДЁННЫМ, если он пуст или состоит только из NUL/пробельных байтов.
// Именно так выглядит оборванная (не атомарная) запись: размер сохранён, а данные не
// сброшены на диск → файл забит NUL. Молча принять это за «нет данных» нельзя — иначе
// следующая запись затрёт остатки и пользователи исчезнут безвозвратно (это и случилось).
function looksCorrupt(raw: string): boolean {
  if (raw.length === 0) return true;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c !== 0 && c !== 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return false;
  }
  return true;
}

// Читает, валидирует и применяет состояние из файла. Бросает при повреждении/невалидном JSON.
function loadFallbackFromFile(file: string): void {
  const raw = fs.readFileSync(file, 'utf-8');
  if (looksCorrupt(raw)) {
    throw new Error(`файл повреждён: ${raw.length} байт из NUL/пробелов (оборванная запись)`);
  }
  fallbackData = JSON.parse(raw);
  normalizeFallbackArrays();
}

// Атомарная запись: temp-файл в той же папке → fsync → rename. Переименование в пределах
// одного тома атомарно, поэтому читатель (и облачная синхронизация Google Drive) видит либо
// старый, либо новый файл ЦЕЛИКОМ, но никогда «полузаписанный». Это устраняет причину
// NUL-порчи при обрыве записи (рестарт tsx watch, kill процесса, конфликт с синком).
function atomicWriteFile(file: string, contents: string): void {
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.${path.basename(file)}.tmp-${process.pid}-${fallbackStamp()}`);
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, contents, 'utf-8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

// Загрузка локальных данных
function ensureFallbackLoaded() {
  if (fallbackLoaded) return;
  if (fs.existsSync(FALLBACK_FILE)) {
    try {
      loadFallbackFromFile(FALLBACK_FILE);
    } catch (e: any) {
      // ОСНОВНОЙ ФАЙЛ ПОВРЕЖДЁН. Нельзя молча стартовать с пустой БД и затем затереть
      // остатки — это безвозвратная потеря пользователей. Поэтому: (1) карантинируем
      // повреждённый файл, (2) пытаемся восстановиться из .bak, (3) громко логируем.
      console.error('\n======================================================================');
      console.error('🔴 [VibeVox Auto-DB] db_fallback.json ПОВРЕЖДЁН:', e?.message || e);
      let quarantine: string | null = `${FALLBACK_FILE}.corrupt-${fallbackStamp()}`;
      try {
        fs.renameSync(FALLBACK_FILE, quarantine);
        console.error('🗄  Повреждённый файл отложен для разбора/восстановления:', quarantine);
      } catch (re: any) {
        quarantine = null;
        console.error('⚠️  Не удалось отложить повреждённый файл:', re?.message || re);
      }
      let recovered = false;
      if (fs.existsSync(FALLBACK_BACKUP)) {
        try {
          loadFallbackFromFile(FALLBACK_BACKUP);
          recovered = true;
          console.error(`✅  ВОССТАНОВЛЕНО из бэкапа ${FALLBACK_BACKUP} (пользователей: ${fallbackData.users.length})`);
          // Записываем восстановленные данные обратно в основной файл (атомарно).
          fallbackLoaded = true; // чтобы saveFallbackData не зациклил ensureFallbackLoaded
          try { atomicWriteFile(FALLBACK_FILE, JSON.stringify(fallbackData, null, 2)); } catch { /* best-effort */ }
        } catch (be: any) {
          console.error('⚠️  Бэкап тоже не читается:', be?.message || be);
        }
      }
      if (!recovered) {
        normalizeFallbackArrays(); // стартуем с дефолтного пустого состояния
        console.error('⚠️  Бэкапа нет (или он тоже повреждён) — стартуем с ПУСТОЙ локальной БД.');
        if (quarantine) {
          console.error('    Если данные были важны — восстановите их из истории версий Google Drive');
          console.error('    или из файла ' + quarantine + ' ДО повторной регистрации (иначе затрутся).');
        }
      }
      console.error('======================================================================\n');
    }
  }
  fallbackLoaded = true;
}

// Сохранение локальных данных (атомарно + бэкап последнего НЕпустого состояния)
function saveFallbackData() {
  ensureFallbackLoaded();
  try {
    const json = JSON.stringify(fallbackData, null, 2);
    atomicWriteFile(FALLBACK_FILE, json);
    // Бэкапим только НЕпустое состояние — чтобы .bak всегда хранил последний осмысленный
    // снимок и из него можно было восстановиться, даже если основной файл занулят.
    const isEmpty =
      fallbackData.users.length === 0 &&
      fallbackData.tenants.length === 0 &&
      fallbackData.subscriptions.length === 0 &&
      fallbackData.rooms.length === 0;
    if (!isEmpty) {
      try { atomicWriteFile(FALLBACK_BACKUP, json); } catch { /* best-effort */ }
    }
  } catch (e) {
    console.error('[VibeVox Auto-DB] Ошибка при записи db_fallback.json:', e);
  }
}

// Активация режима авто-БД
function activateFallback(reason: string) {
  if (fallbackActive) return;
  fallbackActive = true;
  ensureFallbackLoaded();
  console.log('\n======================================================================');
  console.log('⚠️  [VibeVox Auto-DB] PostgreSQL недоступен на localhost:5432!');
  console.log(`🔍  Причина: ${reason}`);
  console.log('🚀  АВТОМАТИЧЕСКИ активирован прозрачный In-Memory & JSON File fallback.');
  console.log(`💾  Данные будут сохраняться в файл: ${FALLBACK_FILE}`);
  console.log('✅  Вы можете полноценно регистрировать пользователей, создавать комнаты');
  console.log('    и тестировать глоссарии прямо сейчас без установки базы данных!');
  console.log('======================================================================\n');
}

// Эмулятор выполнения SQL-запросов
function runMockQuery(text: string, values: any[] = []): { rows: any[]; rowCount?: number } {
  ensureFallbackLoaded();
  const trimmed = text.trim();

  // ============================================================================
  // КАСКАД УДАЛЕНИЯ АККАУНТА — выполняется ПЕРВЫМ (до loose SELECT-handler'ов вида
  // "FROM <table> WHERE ...", которые иначе перехватили бы эти DELETE и ничего не
  // удалили). ВСЕ ключи/привязки tenant'а обязаны исчезать вместе с аккаунтом —
  // иначе осиротевший Quest Flow-ключ продолжит аутентифицировать запросы по хэшу.
  // ============================================================================
  if (/DELETE\s+FROM\s+tenant_quest_flow_keys\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tid = values[0];
    const before = fallbackData.tenant_quest_flow_keys.length;
    fallbackData.tenant_quest_flow_keys = fallbackData.tenant_quest_flow_keys.filter((k: any) => k.tenant_id !== tid);
    const removed = before - fallbackData.tenant_quest_flow_keys.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  if (/DELETE\s+FROM\s+tenant_mcp_keys\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tid = values[0];
    const before = fallbackData.tenant_mcp_keys.length;
    fallbackData.tenant_mcp_keys = fallbackData.tenant_mcp_keys.filter((k: any) => k.tenant_id !== tid);
    const removed = before - fallbackData.tenant_mcp_keys.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  if (/DELETE\s+FROM\s+tenant_need_tags\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tid = values[0];
    const tagIds = fallbackData.tenant_need_tags.filter((t: any) => t.tenant_id === tid).map((t: any) => t.id);
    const before = fallbackData.tenant_need_tags.length;
    fallbackData.tenant_need_tags = fallbackData.tenant_need_tags.filter((t: any) => t.tenant_id !== tid);
    if (tagIds.length) {
      fallbackData.client_tag_assignments = (fallbackData.client_tag_assignments || []).filter((a: any) => !tagIds.includes(a.tag_id));
    }
    const removed = before - fallbackData.tenant_need_tags.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  if (/DELETE\s+FROM\s+sip_trunks\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tid = values[0];
    const before = fallbackData.sip_trunks.length;
    fallbackData.sip_trunks = fallbackData.sip_trunks.filter((s: any) => s.tenant_id !== tid);
    const removed = before - fallbackData.sip_trunks.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  if (/DELETE\s+FROM\s+user_profiles\s+WHERE\s+user_id\s*=\s*\$1/is.test(trimmed)) {
    const uid = values[0];
    const before = fallbackData.user_profiles.length;
    fallbackData.user_profiles = fallbackData.user_profiles.filter((p: any) => p.user_id !== uid);
    const removed = before - fallbackData.user_profiles.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  if (/DELETE\s+FROM\s+rooms\s+WHERE\s+creator_tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tid = values[0];
    const roomIds = fallbackData.rooms.filter((r: any) => r.creator_tenant_id === tid).map((r: any) => r.id);
    const before = fallbackData.rooms.length;
    fallbackData.rooms = fallbackData.rooms.filter((r: any) => r.creator_tenant_id !== tid);
    if (roomIds.length) {
      fallbackData.room_messages = (fallbackData.room_messages || []).filter((m: any) => !roomIds.includes(m.room_id));
      fallbackData.client_tag_assignments = (fallbackData.client_tag_assignments || []).filter((a: any) => !roomIds.includes(a.room_id));
    }
    const removed = before - fallbackData.rooms.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  // DELETE FROM partners WHERE user_id = $1 — профиль партнёра + каскад его referrals (по partner_id) и кликов (по коду).
  if (/DELETE\s+FROM\s+partners\s+WHERE\s+user_id\s*=\s*\$1/is.test(trimmed)) {
    const uid = values[0];
    const partner = fallbackData.partners.find((p: any) => p.user_id === uid);
    if (!partner) return { rows: [], rowCount: 0 };
    fallbackData.referrals = (fallbackData.referrals || []).filter((r: any) => r.partner_id !== partner.id);
    fallbackData.referral_clicks = (fallbackData.referral_clicks || []).filter((c: any) => c.partner_code !== partner.code);
    fallbackData.partners = fallbackData.partners.filter((p: any) => p.user_id !== uid);
    saveFallbackData();
    return { rows: [], rowCount: 1 };
  }
  // DELETE FROM referrals WHERE referred_user_id = $1 — атрибуция этого юзера как привлечённого.
  if (/DELETE\s+FROM\s+referrals\s+WHERE\s+referred_user_id\s*=\s*\$1/is.test(trimmed)) {
    const uid = values[0];
    const before = fallbackData.referrals.length;
    fallbackData.referrals = (fallbackData.referrals || []).filter((r: any) => r.referred_user_id !== uid);
    const removed = before - fallbackData.referrals.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  // DELETE FROM referral_clicks WHERE partner_code = $1 — сброс/удаление статистики партнёра.
  if (/DELETE\s+FROM\s+referral_clicks\s+WHERE\s+partner_code\s*=\s*\$1/is.test(trimmed)) {
    const code = values[0];
    const before = fallbackData.referral_clicks.length;
    fallbackData.referral_clicks = (fallbackData.referral_clicks || []).filter((c: any) => c.partner_code !== code);
    const removed = before - fallbackData.referral_clicks.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  // DELETE FROM referrals WHERE partner_id = $1 — сброс статистики партнёра (обнулить регистрации/оплаты).
  if (/DELETE\s+FROM\s+referrals\s+WHERE\s+partner_id\s*=\s*\$1/is.test(trimmed)) {
    const pid = values[0];
    const before = fallbackData.referrals.length;
    fallbackData.referrals = (fallbackData.referrals || []).filter((r: any) => r.partner_id !== pid);
    const removed = before - fallbackData.referrals.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  // DELETE FROM partners WHERE id = $1 (+ каскад referrals/clicks) — удаление партнёра из админки.
  if (/DELETE\s+FROM\s+partners\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const pid = values[0];
    const partner = fallbackData.partners.find((p: any) => p.id === pid);
    if (!partner) return { rows: [], rowCount: 0 };
    fallbackData.referrals = (fallbackData.referrals || []).filter((r: any) => r.partner_id !== pid);
    fallbackData.referral_clicks = (fallbackData.referral_clicks || []).filter((c: any) => c.partner_code !== partner.code);
    fallbackData.partners = fallbackData.partners.filter((p: any) => p.id !== pid);
    saveFallbackData();
    return { rows: [], rowCount: 1 };
  }

  // 1. SELECT * FROM users WHERE email = $1
  if (/SELECT \* FROM users WHERE email = \$1/i.test(trimmed)) {
    const email = values[0];
    const user = fallbackData.users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
    return { rows: user ? [user] : [] };
  }

  // 2. SELECT id FROM users WHERE email = $1
  if (/SELECT id FROM users WHERE email = \$1/i.test(trimmed)) {
    const email = values[0];
    const user = fallbackData.users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
    return { rows: user ? [{ id: user.id }] : [] };
  }

  // 3. INSERT INTO tenants
  if (/INSERT INTO tenants/i.test(trimmed)) {
    const name = values[0];
    // v0.9.4: больше НЕ выдумываем фейковые cus_mock_* — это ломало реальный Stripe
    // checkout (No such customer). Customer создаётся лениво при первом /checkout.
    const newTenant = {
      id: generateUUID(),
      name: name,
      stripe_customer_id: values[1] || null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_status: null
    };
    fallbackData.tenants.push(newTenant);
    saveFallbackData();
    return { rows: [newTenant] };
  }

  // 4. INSERT INTO users
  if (/INSERT INTO users/i.test(trimmed)) {
    let tenant_id = '';
    let email = '';
    let password_hash = null;
    let google_id = null;
    let role = 'user';

    // В реальных запросах у нас порядок: (tenant_id, email, password_hash, role) или (tenant_id, email, google_id, role)
    if (trimmed.includes('tenant_id') && trimmed.includes('email')) {
      tenant_id = values[0];
      email = values[1];
      
      if (trimmed.includes('google_id')) {
        google_id = values[2];
        role = 'tenant_admin'; // хардкод роли из запроса регистрации Google
      } else if (trimmed.includes('password_hash')) {
        password_hash = values[2];
        role = 'tenant_admin'; // хардкод роли из запроса регистрации Email
      }
    } else {
      // Резервный разбор на случай старого/упрощенного формата
      email = values[0];
      password_hash = values[1];
      role = values[2] || 'user';
      tenant_id = values[3];
      google_id = values[4] || null;
    }

    const newUser = {
      id: generateUUID(),
      email,
      password_hash,
      role,
      tenant_id,
      google_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackData.users.push(newUser);
    saveFallbackData();
    // Возвращаем И camelCase И snake_case — auth/router читает tenant_id, остальные tenantId
    return { rows: [{
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      tenantId: newUser.tenant_id,
      tenant_id: newUser.tenant_id,
    }] };
  }

  // 5. INSERT INTO user_profiles
  if (/INSERT INTO user_profiles/i.test(trimmed)) {
    const user_id = values[0];
    const display_name = values[1];
    const avatar_url = values[2];
    const newProfile = { user_id, display_name, avatar_url };
    fallbackData.user_profiles.push(newProfile);
    saveFallbackData();
    return { rows: [newProfile] };
  }

  // 6. UPDATE users SET google_id
  if (/UPDATE users SET google_id = \$1/i.test(trimmed)) {
    const googleId = values[0];
    const userId = values[1];
    const user = fallbackData.users.find(u => u.id === userId);
    if (user) {
      user.google_id = googleId;
      user.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: user ? [user] : [] };
  }

  // 6.5 INSERT INTO rooms (channel_chat — generic канал, OMNICHANNEL Фаза 0).
  //     Layout: id,name,creator_tenant_id,expires_at,kind,channel_type,
  //     channel_account_id,channel_conversation_id,channel_username,
  //     channel_display_name,chatwoot_conversation_id. Срабатывает РАНЬШЕ общего
  //     INSERT-handler'а (отличие — наличие колонки channel_type), telegram-вставки не задевает.
  if (/INSERT\s+INTO\s+rooms/i.test(trimmed) && /channel_type/i.test(trimmed)) {
    const id = values[0] || generateUUID();
    const rawExp = values[3] || new Date(Date.now() + 24 * 60 * 60 * 1000);
    const expires_at = rawExp instanceof Date && !isNaN(rawExp.getTime())
      ? rawExp.toISOString()
      : (typeof rawExp === 'string' && !isNaN(new Date(rawExp).getTime())
          ? new Date(rawExp).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    const newRoom: any = {
      id,
      name: values[1],
      creator_tenant_id: values[2],
      kind: (values[4] as string) || 'channel_chat',
      channel_type: (values[5] as string) || null,
      channel_account_id: (values[6] as string) || null,
      channel_conversation_id: (values[7] as string) || null,
      channel_username: (values[8] as string) || null,
      channel_display_name: (values[9] as string) || null,
      chatwoot_conversation_id: (values[10] as string) || null,
      telegram_user_id: null,
      telegram_bot_id: null,
      telegram_username: null,
      telegram_display_name: null,
      settings: { translationEnabled: true, subtitlesEnabled: true },
      transcripts: [],
      insights: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at,
    };
    fallbackData.rooms.push(newRoom);
    saveFallbackData();
    return { rows: [{ ...newRoom }] };
  }

  // 7. INSERT INTO rooms
  // Две формы:
  //  - Legacy (4 параметра): (id, name, creator_tenant_id, expires_at) — video-комнаты
  //  - ENTERPRISE v0.10.0 (8+ параметров): + (kind, telegram_user_id, telegram_bot_id,
  //    telegram_username, telegram_display_name) — для telegram_chat auto-комнат
  if (/INSERT INTO rooms/i.test(trimmed)) {
    const id = values[0] || generateUUID();
    const name = values[1];
    const creator_tenant_id = values[2];

    const rawExpiresVal = values[3] || new Date(Date.now() + 24 * 60 * 60 * 1000);
    const expires_at = rawExpiresVal instanceof Date && !isNaN(rawExpiresVal.getTime())
      ? rawExpiresVal.toISOString()
      : (typeof rawExpiresVal === 'string' && !isNaN(new Date(rawExpiresVal).getTime())
          ? new Date(rawExpiresVal).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

    // ENTERPRISE-поля (читаются только если переданы — обратная совместимость)
    const kind: string = (values[4] as string) || 'video';
    const telegram_user_id: string | null = (values[5] as string) || null;
    const telegram_bot_id: string | null = (values[6] as string) || null;
    const telegram_username: string | null = (values[7] as string) || null;
    const telegram_display_name: string | null = (values[8] as string) || null;

    const newRoom: any = {
      id,
      name,
      creator_tenant_id,
      kind,
      telegram_user_id,
      telegram_bot_id,
      telegram_username,
      telegram_display_name,
      settings: { translationEnabled: true, subtitlesEnabled: true },
      transcripts: [],
      insights: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at
    };
    fallbackData.rooms.push(newRoom);
    saveFallbackData();
    return {
      rows: [{
        id: newRoom.id,
        name: newRoom.name,
        creator_tenant_id: newRoom.creator_tenant_id,
        kind: newRoom.kind,
        telegram_user_id: newRoom.telegram_user_id,
        telegram_bot_id: newRoom.telegram_bot_id,
        telegram_username: newRoom.telegram_username,
        telegram_display_name: newRoom.telegram_display_name,
        created_at: newRoom.created_at,
        expires_at: newRoom.expires_at
      }]
    };
  }

  // UPDATE rooms SET settings = $1 WHERE id = $2
  if (/UPDATE\s+rooms\s+SET\s+settings/is.test(trimmed)) {
    const newSettings = typeof values[0] === 'string' ? JSON.parse(values[0]) : values[0];
    const id = values[1];
    const room: any = fallbackData.rooms.find(r => r.id === id);
    if (room) {
      room.settings = newSettings;
      room.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // UPDATE rooms SET transcripts = $1 WHERE id = $2
  if (/UPDATE\s+rooms\s+SET\s+transcripts/is.test(trimmed)) {
    const transcripts = typeof values[0] === 'string' ? JSON.parse(values[0]) : values[0];
    const id = values[1];
    const room: any = fallbackData.rooms.find(r => r.id === id);
    if (room) {
      room.transcripts = transcripts;
      room.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // UPDATE rooms SET insights = $1 WHERE id = $2
  if (/UPDATE\s+rooms\s+SET\s+insights/is.test(trimmed)) {
    const insights = typeof values[0] === 'string' ? JSON.parse(values[0]) : values[0];
    const id = values[1];
    const room: any = fallbackData.rooms.find(r => r.id === id);
    if (room) {
      room.insights = insights;
      room.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // SELECT settings FROM rooms WHERE id = $1
  if (/SELECT\s+settings\s+FROM\s+rooms\s+WHERE\s+id\s*=\s*\$1/i.test(trimmed)) {
    const id = values[0];
    const room: any = fallbackData.rooms.find(r => r.id === id);
    return { rows: room ? [{ settings: room.settings || { translationEnabled: true, subtitlesEnabled: true } }] : [] };
  }

  // 8. SELECT * FROM rooms WHERE id = $1 (включая creator_tenant_id, settings, transcripts)
  if (/FROM rooms WHERE id = \$1/i.test(trimmed)) {
    const id = values[0];
    const room = fallbackData.rooms.find(r => r.id === id);
    return { rows: room ? [room] : [] };
  }

  // 8.1 SELECT rooms WHERE creator_tenant_id = $1 (list creator's rooms)
  //     ВАЖНО: исключаем find-запрос telegram_chat-комнаты (он содержит
  //     `telegram_bot_id = $2`). Иначе этот общий handler перехватывал его и
  //     возвращал ВСЕ комнаты тенанта → findOrCreateTelegramChatRoom брал [0]
  //     (самую свежую) и все Telegram-клиенты «сливались» в одну комнату
  //     (или диалог прилипал к видео-комнате). Конкретный handler — ниже, в
  //     ENTERPRISE-секции (поиск по тройке tenant+bot+user).
  if (/FROM\s+rooms\s+WHERE\s+creator_tenant_id\s*=\s*\$1/i.test(trimmed)
      && !/telegram_bot_id\s*=\s*\$2/i.test(trimmed)
      && !/channel_account_id\s*=\s*\$3/i.test(trimmed)) {
    const tid = values[0];
    const rooms = fallbackData.rooms.filter((r) => r.creator_tenant_id === tid);
    // sort by created_at DESC
    rooms.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
    return { rows: rooms };
  }

  // 8.2 UPDATE rooms SET name = $1 WHERE id = $2 (rename)
  if (/UPDATE\s+rooms\s+SET\s+name\s*=\s*\$1/i.test(trimmed)) {
    const newName = values[0];
    const id = values[1];
    const room: any = fallbackData.rooms.find(r => r.id === id);
    if (room) {
      room.name = newName;
      room.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // 8.3 DELETE FROM rooms WHERE id = $1 (hard delete)
  if (/DELETE\s+FROM\s+rooms\s+WHERE\s+id\s*=\s*\$1/i.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.rooms.findIndex(r => r.id === id);
    if (idx !== -1) {
      fallbackData.rooms.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ══ dialect_rules (AI Learning Hub) ══════════════════════════════════════════
  // Обработчики ДОЛЖНЫ совпадать с реальным SQL из modules/dialects/router.ts,
  // translation/bridge.ts и quest_flow/transcribe.ts. Порядок важен: счётчики и
  // точечные SELECT — РАНЬШЕ общего «FROM dialect_rules» (иначе общий перехватит всё),
  // а soft-delete UPDATE — РАНЬШЕ общего UPDATE.
  const parseGlossaryVal = (v: any): any => {
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return undefined; } }
    return v ?? undefined;
  };

  // 9a. Счётчики по языкам: SELECT language_code, COUNT(*) ... FROM dialect_rules ... GROUP BY language_code
  if (/SELECT\s+language_code\s*,\s*COUNT\([\s\S]*?\bFROM\s+dialect_rules/i.test(trimmed)) {
    const byLang: Record<string, number> = {};
    for (const r of fallbackData.dialect_rules) {
      if (r.is_active === false) continue;
      byLang[r.language_code] = (byLang[r.language_code] || 0) + 1;
    }
    return { rows: Object.entries(byLang).map(([language_code, count]) => ({ language_code, count })) };
  }

  // 9b. Точечный SELECT по id (test-sample): ... FROM dialect_rules WHERE id = $1 ...
  if (/FROM\s+dialect_rules\s+WHERE\s+id\s*=\s*\$1/i.test(trimmed)) {
    const rule = fallbackData.dialect_rules.find(r => r.id === values[0] && r.is_active !== false);
    return { rows: rule ? [rule] : [] };
  }

  // 9c. SELECT по языку (список с фильтром, /instruction-мёрж, bridge, transcribe).
  //     Покрывает обе формы WHERE: «language_code = $1 ...» и «is_active = TRUE AND language_code = $1».
  if (/FROM\s+dialect_rules\s+WHERE[\s\S]*language_code\s*=\s*\$1/i.test(trimmed)) {
    let rows = fallbackData.dialect_rules.filter(r => r.language_code === values[0] && r.is_active !== false);
    if (/compiled_instruction\s*!=\s*''/i.test(trimmed)) {
      rows = rows.filter(r => (r.compiled_instruction || '') !== '');
    }
    // ORDER BY updated_at DESC (ISO-строки сортируются лексикографически).
    rows = rows.slice().sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    const limitMatch = trimmed.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1], 10));
    return { rows };
  }

  // 9d. Общий список: SELECT * FROM dialect_rules [WHERE is_active = TRUE] [ORDER BY created_at DESC]
  if (/FROM\s+dialect_rules/i.test(trimmed)) {
    const onlyActive = /is_active\s*=\s*TRUE/i.test(trimmed);
    let rows = fallbackData.dialect_rules.filter(r => (onlyActive ? r.is_active !== false : true));
    rows = rows.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return { rows };
  }

  // 10. INSERT INTO dialect_rules (language_code, dialect_name, prompt_hints, glossary, compiled_instruction)
  if (/INSERT INTO dialect_rules/i.test(trimmed)) {
    const newRule = {
      id: generateUUID(),
      language_code: values[0],
      dialect_name: values[1],
      prompt_hints: values[2] ?? '',
      glossary: parseGlossaryVal(values[3]) ?? {},
      compiled_instruction: values[4] ?? '',   // РАНЬШЕ НЕ СОХРАНЯЛОСЬ → бот не получал инструкцию
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackData.dialect_rules.push(newRule);
    saveFallbackData();
    return { rows: [newRule] };
  }

  // 11. Soft-delete: UPDATE dialect_rules SET is_active = FALSE ... WHERE id = $1
  //     (ДОЛЖЕН идти раньше общего UPDATE: единственный параметр — id.)
  if (/UPDATE\s+dialect_rules\s+SET\s+is_active\s*=\s*FALSE/i.test(trimmed)) {
    const rule = fallbackData.dialect_rules.find(r => r.id === values[0]);
    if (rule) { rule.is_active = false; rule.updated_at = new Date().toISOString(); saveFallbackData(); }
    return { rows: rule ? [{ id: rule.id }] : [] };
  }

  // 12. Полное обновление (PUT): SET language_code=COALESCE($1,..), ..., is_active=COALESCE($6,..) WHERE id=$7
  if (/UPDATE\s+dialect_rules/i.test(trimmed)) {
    const id = values[values.length - 1];
    const rule = fallbackData.dialect_rules.find(r => r.id === id);
    if (rule) {
      if (values[0] != null) rule.language_code = values[0];
      if (values[1] != null) rule.dialect_name = values[1];
      if (values[2] != null) rule.prompt_hints = values[2];
      const g = parseGlossaryVal(values[3]); if (g !== undefined) rule.glossary = g;
      if (values[4] != null) rule.compiled_instruction = values[4];
      if (values[5] != null) rule.is_active = values[5];
      rule.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: rule ? [rule] : [] };
  }

  // 13. DELETE FROM dialect_rules (hard delete — на случай прямого удаления)
  if (/DELETE FROM dialect_rules/i.test(trimmed)) {
    const idx = fallbackData.dialect_rules.findIndex(r => r.id === values[0]);
    if (idx !== -1) {
      fallbackData.dialect_rules.splice(idx, 1);
      saveFallbackData();
    }
    return { rows: [], rowCount: idx !== -1 ? 1 : 0 };
  }

  // 15. SELECT id FROM tenants WHERE stripe_customer_id = $1
  if (/FROM tenants WHERE stripe_customer_id = \$1/i.test(trimmed)) {
    const stripeCustId = values[0];
    const tenant = fallbackData.tenants.find(t => t.stripe_customer_id === stripeCustId);
    return { rows: tenant ? [tenant] : [] };
  }

  // SELECT custom_prompt, knowledge_base, knowledge_base_filename FROM tenants WHERE id = $1
  if (/SELECT\s+custom_prompt[\s\S]+FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/i.test(trimmed)) {
    const id = values[0];
    const tenant: any = fallbackData.tenants.find(t => t.id === id);
    if (!tenant) return { rows: [] };
    return { rows: [{
      custom_prompt: tenant.custom_prompt || '',
      knowledge_base: tenant.knowledge_base || '',
      knowledge_base_filename: tenant.knowledge_base_filename || null,
    }] };
  }

  // UPDATE tenants SET custom_prompt = $1, knowledge_base = $2, knowledge_base_filename = $3 WHERE id = $4
  if (/UPDATE\s+tenants\s+SET\s+custom_prompt\s*=\s*\$1,\s*knowledge_base/is.test(trimmed)) {
    const id = values[3];
    const tenant: any = fallbackData.tenants.find(t => t.id === id);
    if (tenant) {
      tenant.custom_prompt = values[0] || '';
      tenant.knowledge_base = values[1] || null;
      tenant.knowledge_base_filename = values[2] || null;
      saveFallbackData();
    }
    return { rows: [] };
  }

  // UPDATE tenants SET custom_prompt = $1 WHERE id = $2 (без KB)
  if (/UPDATE\s+tenants\s+SET\s+custom_prompt\s*=\s*\$1[\s\S]+WHERE\s+id\s*=\s*\$2/i.test(trimmed)) {
    const id = values[1];
    const tenant: any = fallbackData.tenants.find(t => t.id === id);
    if (tenant) {
      tenant.custom_prompt = values[0] || '';
      saveFallbackData();
    }
    return { rows: [] };
  }

  // UPDATE tenants SET knowledge_base = NULL, knowledge_base_filename = NULL WHERE id = $1
  if (/UPDATE\s+tenants\s+SET\s+knowledge_base\s*=\s*NULL/is.test(trimmed)) {
    const id = values[0];
    const tenant: any = fallbackData.tenants.find(t => t.id === id);
    if (tenant) {
      tenant.knowledge_base = null;
      tenant.knowledge_base_filename = null;
      saveFallbackData();
    }
    return { rows: [] };
  }

  // 15.1. SELECT * FROM tenants WHERE id = $1 (для админских отчётов)
  if (/FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/i.test(trimmed)) {
    const id = values[0];
    const tenant = fallbackData.tenants.find(t => t.id === id);
    return { rows: tenant ? [tenant] : [] };
  }

  // 15.2. SELECT all users + tenants + subscriptions (для админского /api/admin/users)
  // Маркер запроса: `FROM users u LEFT JOIN tenants` — собирает плоскую таблицу.
  if (/FROM\s+users\s+u\s+LEFT\s+JOIN\s+tenants/i.test(trimmed)) {
    const rows = fallbackData.users.map((u: any) => {
      const tenant = fallbackData.tenants.find((t: any) => t.id === u.tenant_id) || {};
      const sub = fallbackData.subscriptions.find((s: any) => s.tenant_id === u.tenant_id) || {};
      return {
        user_id: u.id,
        email: u.email,
        role: u.role,
        google_id: u.google_id,
        user_created_at: u.created_at,
        tenant_id: u.tenant_id,
        tenant_name: tenant.name || null,
        tenant_status: tenant.status || null,
        stripe_customer_id: tenant.stripe_customer_id || null,
        tier: sub.tier || null,
        sub_status: sub.status || null,
        billing_period: sub.billing_period || null,
        translation_minutes_balance: sub.translation_minutes_balance ?? null,
        rollover_seconds: sub.rollover_seconds ?? null,
        current_period_end: sub.current_period_end || null,
        total_paid_minutes: sub.total_paid_minutes ?? 0,
        last_payment_minutes: sub.last_payment_minutes ?? null,
        last_payment_at: sub.last_payment_at || null,
        // v0.9.5: cancel flow
        stripe_subscription_id: sub.stripe_subscription_id || null,
        cancel_at_period_end: !!sub.cancel_at_period_end,
        canceled_by: sub.canceled_by || null,
        canceled_at: sub.canceled_at || null,
      };
    });
    return { rows };
  }

  // 16. UPDATE tenants SET — ТОЛЬКО stripe legacy-sync с 5 параметрами.
  // Раньше regex был слишком общим (`UPDATE tenants SET`) и перехватывал ВСЕ
  // UPDATE'ы tenants (включая enterprise gemini, telegram_bot_token, chatwoot
  // и т.д. v0.10.0+), не давая моим точным handler'ам отработать.
  // Теперь требуем явное упоминание stripe_subscription_id или stripe_price_id.
  if (/UPDATE\s+tenants\s+SET[\s\S]*?(stripe_subscription_id|stripe_price_id|subscription_status)/i.test(trimmed)) {
    const id = values[4];
    const tenant = fallbackData.tenants.find(t => t.id === id);
    if (tenant) {
      tenant.stripe_subscription_id = values[1];
      tenant.stripe_price_id = values[2];
      tenant.subscription_status = values[3];
      saveFallbackData();
    }
    return { rows: tenant ? [tenant] : [] };
  }

  // ── SIP TRUNKS ──────────────────────────────────────────────
  // ВАЖНО: запросы из service.ts многострочные — используем \s+ для пробелов/переносов.
  // 17. SELECT id FROM sip_trunks WHERE tenant_id = $1
  if (/SELECT\s+id\s+FROM\s+sip_trunks\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const trunk = fallbackData.sip_trunks.find(t => t.tenant_id === tenantId);
    return { rows: trunk ? [{ id: trunk.id }] : [] };
  }

  // 18. SELECT ... FROM sip_trunks WHERE tenant_id = $1 (полные поля)
  //     ВАЖНО: явно требуем SELECT в начале, иначе DELETE FROM sip_trunks ниже захватится сюда
  if (/^SELECT\b[\s\S]*?FROM\s+sip_trunks\s+WHERE\s+tenant_id\s*=\s*\$1/i.test(trimmed)) {
    const tenantId = values[0];
    const trunk = fallbackData.sip_trunks.find(t => t.tenant_id === tenantId);
    return { rows: trunk ? [trunk] : [] };
  }

  // 19. SELECT encrypted_password FROM sip_trunks WHERE tenant_id = $1
  //     (специальный кейс для getDecryptedSipPassword — уже покрыт предыдущим, но на всякий)

  // 20. INSERT INTO sip_trunks
  if (/INSERT\s+INTO\s+sip_trunks/is.test(trimmed)) {
    const newTrunk = {
      id: generateUUID(),
      tenant_id: values[0],
      sip_server: values[1],
      username: values[2],
      encrypted_password: values[3],
      iv: values[4],
      caller_id: values[5],
      transport: values[6],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    fallbackData.sip_trunks.push(newTrunk);
    saveFallbackData();
    return { rows: [newTrunk] };
  }

  // 21. UPDATE sip_trunks SET ... WHERE tenant_id = $7
  if (/UPDATE\s+sip_trunks\s+SET/is.test(trimmed)) {
    const tenantId = values[6];
    const trunk = fallbackData.sip_trunks.find(t => t.tenant_id === tenantId);
    if (trunk) {
      trunk.sip_server = values[0];
      trunk.username = values[1];
      trunk.encrypted_password = values[2];
      trunk.iv = values[3];
      trunk.caller_id = values[4];
      trunk.transport = values[5];
      trunk.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: trunk ? [trunk] : [] };
  }

  // ── SIP INBOUND ─────────────────────────────────────────────
  // SELECT id FROM sip_inbound WHERE tenant_id = $1
  if (/SELECT\s+id\s+FROM\s+sip_inbound\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const row = fallbackData.sip_inbound.find(r => r.tenant_id === tenantId);
    return { rows: row ? [{ id: row.id }] : [] };
  }
  // SELECT * FROM sip_inbound WHERE tenant_id = $1
  if (/^SELECT\b[\s\S]*?FROM\s+sip_inbound\s+WHERE\s+tenant_id\s*=\s*\$1/i.test(trimmed)) {
    const tenantId = values[0];
    const row = fallbackData.sip_inbound.find(r => r.tenant_id === tenantId);
    return { rows: row ? [row] : [] };
  }
  // INSERT INTO sip_inbound (tenant_id, sip_host, room_name, auth_username,
  //   encrypted_auth_password, iv, livekit_inbound_trunk_id, livekit_dispatch_rule_id)
  if (/INSERT\s+INTO\s+sip_inbound/is.test(trimmed)) {
    const row = {
      id: generateUUID(),
      tenant_id: values[0],
      sip_host: values[1],
      room_name: values[2],
      auth_username: values[3],
      encrypted_auth_password: values[4],
      iv: values[5],
      livekit_inbound_trunk_id: values[6],
      livekit_dispatch_rule_id: values[7],
      bridge_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fallbackData.sip_inbound.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  // UPDATE sip_inbound SET ... WHERE tenant_id = $8 (rotate credentials)
  if (/UPDATE\s+sip_inbound\s+SET[\s\S]+sip_host[\s\S]+WHERE\s+tenant_id\s*=\s*\$8/is.test(trimmed)) {
    const tenantId = values[7];
    const row = fallbackData.sip_inbound.find(r => r.tenant_id === tenantId);
    if (row) {
      row.sip_host = values[0];
      row.room_name = values[1];
      row.auth_username = values[2];
      row.encrypted_auth_password = values[3];
      row.iv = values[4];
      row.livekit_inbound_trunk_id = values[5];
      row.livekit_dispatch_rule_id = values[6];
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: row ? [row] : [] };
  }
  // UPDATE sip_inbound SET bridge_active = $1 WHERE tenant_id = $2
  if (/UPDATE\s+sip_inbound\s+SET\s+bridge_active/is.test(trimmed)) {
    const tenantId = values[1];
    const row = fallbackData.sip_inbound.find(r => r.tenant_id === tenantId);
    if (row) {
      row.bridge_active = values[0];
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }
  // DELETE FROM sip_inbound WHERE tenant_id = $1
  if (/DELETE\s+FROM\s+sip_inbound\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const idx = fallbackData.sip_inbound.findIndex(r => r.tenant_id === tenantId);
    if (idx !== -1) {
      fallbackData.sip_inbound.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ── SUBSCRIPTIONS ────────────────────────────────────────────
  // SELECT ... FROM subscriptions WHERE tenant_id = $1
  if (/^SELECT\b[\s\S]*?FROM\s+subscriptions\s+WHERE\s+tenant_id\s*=\s*\$1/i.test(trimmed)) {
    const tenantId = values[0];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    return { rows: row ? [row] : [] };
  }
  // INSERT INTO subscriptions ... ON CONFLICT (tenant_id) DO UPDATE | DO NOTHING
  if (/INSERT\s+INTO\s+subscriptions/is.test(trimmed)) {
    // Поддерживаемые формы:
    //  (a) 9-10 параметров (v0.9.5): tenant_id, stripe_sub_id, tier, status, balance, rollover,
    //      period_end, billing_period, cancel_at_period_end, [isRenewal] — webhook ренью.
    //  (b) 7 параметров: tenant_id, stripe_subscription_id, tier, status, balance, period_end, billing_period
    //  (c) 4 параметра: tenant_id, tier, status, balance — новый формат из auth/register и ensureSubscription
    //  (d) 1 параметр + хардкод: тенант с хардкод-trial/inactive/0 в самом SQL (legacy)
    let row: any;
    const hasRolloverColumn = /rollover_seconds/i.test(trimmed) && /cancel_at_period_end/i.test(trimmed);
    if (hasRolloverColumn && values.length >= 9) {
      row = {
        id: generateUUID(),
        tenant_id: values[0],
        stripe_subscription_id: values[1],
        tier: values[2],
        status: values[3],
        translation_minutes_balance: values[4],
        rollover_seconds: values[5],
        current_period_end: values[6] instanceof Date ? values[6].toISOString() : values[6],
        billing_period: values[7],
        cancel_at_period_end: !!values[8],
      };
    } else if (values.length >= 7) {
      row = {
        id: generateUUID(),
        tenant_id: values[0],
        stripe_subscription_id: values[1],
        tier: values[2],
        status: values[3],
        translation_minutes_balance: values[4],
        current_period_end: values[5] instanceof Date ? values[5].toISOString() : values[5],
        billing_period: values[6],
      };
    } else if (values.length >= 4) {
      row = {
        id: generateUUID(),
        tenant_id: values[0],
        tier: values[1],
        status: values[2],
        translation_minutes_balance: Number(values[3]) || 0,
        billing_period: 'monthly',
      };
    } else {
      // Legacy: единственный параметр (tenant_id), остальное в SQL
      row = {
        id: generateUUID(),
        tenant_id: values[0],
        tier: 'trial',
        status: 'inactive',
        translation_minutes_balance: 0,
        billing_period: 'monthly',
      };
    }
    // v0.9.5: rollover_seconds выставляется выше в 9-param ветке; для остальных — default 0.
    if (row.rollover_seconds === undefined) row.rollover_seconds = 0;
    if (row.cancel_at_period_end === undefined) row.cancel_at_period_end = false;
    row.total_paid_minutes = row.total_paid_minutes ?? 0;
    row.last_payment_minutes = row.last_payment_minutes ?? null;
    row.last_payment_at = row.last_payment_at ?? null;
    row.created_at = new Date().toISOString();
    row.updated_at = new Date().toISOString();

    // ON CONFLICT — DO NOTHING если в SQL это указано, иначе DO UPDATE
    const doNothing = /ON\s+CONFLICT[\s\S]+DO\s+NOTHING/i.test(trimmed);
    const existingIdx = fallbackData.subscriptions.findIndex(r => r.tenant_id === row.tenant_id);
    if (existingIdx >= 0) {
      if (!doNothing) {
        fallbackData.subscriptions[existingIdx] = { ...fallbackData.subscriptions[existingIdx], ...row };
        saveFallbackData();
      }
      return { rows: [fallbackData.subscriptions[existingIdx]] };
    } else {
      fallbackData.subscriptions.push(row);
      saveFallbackData();
      return { rows: [row] };
    }
  }
  // UPDATE subscriptions SET translation_minutes_balance = translation_minutes_balance ± $1 WHERE tenant_id = $2 [AND balance >= $1] [RETURNING ...]
  // Этот хэндлер обслуживает И начисление (topup: + $1), И АТОМАРНОЕ списание аудио
  // (deductAudioBalance: - $1 WHERE balance >= $1 RETURNING). Раньше он ВСЕГДА делал
  // `+ add` и возвращал {rows:[]} — из-за пустого RETURNING deductAudioBalance считал
  // это «недостаточно баланса» и кидал InsufficientBalanceError (нужно 2, доступно 1000001).
  // Теперь различаем знак, чтим guard `>= $1` и отдаём строку для RETURNING (как настоящий PG).
  if (/UPDATE\s+subscriptions\s+SET\s+translation_minutes_balance\s*=\s*translation_minutes_balance/is.test(trimmed)) {
    const amount = Number(values[0]) || 0;
    const tenantId = values[1];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    if (!row) return { rows: [] };
    const isSubtract = /translation_minutes_balance\s*-\s*\$1/is.test(trimmed);
    const guardsBalance = /translation_minutes_balance\s*>=\s*\$1/is.test(trimmed);
    const hasReturning = /\bRETURNING\b/i.test(trimmed);
    const current = Number(row.translation_minutes_balance) || 0;
    if (isSubtract) {
      // Атомарное списание: при WHERE balance >= $1 и нехватке — строка не матчится (PG отдал бы 0 строк).
      if (guardsBalance && current < amount) return { rows: [] };
      row.translation_minutes_balance = current - amount;
    } else {
      row.translation_minutes_balance = current + amount;
    }
    row.updated_at = new Date().toISOString();
    saveFallbackData();
    return { rows: hasReturning ? [{ translation_minutes_balance: row.translation_minutes_balance }] : [] };
  }
  // UPDATE subscriptions SET translation_minutes_balance = $1 WHERE tenant_id = $2 (прямое присваивание для учёта)
  if (/UPDATE\s+subscriptions\s+SET\s+translation_minutes_balance\s*=\s*\$1/is.test(trimmed)) {
    const newBalance = Number(values[0]) || 0;
    const tenantId = values[1];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    if (row) {
      row.translation_minutes_balance = newBalance;
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }
  // UPDATE subscriptions SET tier, status, billing_period, translation_minutes_balance (админ-смена тарифа с минутами)
  if (/UPDATE\s+subscriptions\s+SET\s+tier\s*=\s*\$1[\s\S]+translation_minutes_balance\s*=\s*\$4/is.test(trimmed)) {
    const newTier = values[0];
    const newStatus = values[1];
    const newPeriod = values[2];
    const newBalance = Number(values[3]) || 0;
    const tenantId = values[4];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    if (row) {
      row.tier = newTier;
      row.status = newStatus;
      row.billing_period = newPeriod;
      row.translation_minutes_balance = newBalance;
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }
  // UPDATE subscriptions SET tier, status, billing_period (только тариф, без перезаписи баланса)
  if (/UPDATE\s+subscriptions\s+SET\s+tier\s*=\s*\$1[\s\S]+billing_period\s*=\s*\$3[\s\S]+WHERE\s+tenant_id\s*=\s*\$4/is.test(trimmed)) {
    const newTier = values[0];
    const newStatus = values[1];
    const newPeriod = values[2];
    const tenantId = values[3];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    if (row) {
      row.tier = newTier;
      row.status = newStatus;
      row.billing_period = newPeriod;
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }
  // DELETE FROM subscriptions WHERE tenant_id = $1
  if (/DELETE\s+FROM\s+subscriptions\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const idx = fallbackData.subscriptions.findIndex(r => r.tenant_id === tenantId);
    if (idx !== -1) {
      fallbackData.subscriptions.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  // DELETE FROM users WHERE tenant_id = $1 (каскадное удаление при удалении tenant)
  if (/DELETE\s+FROM\s+users\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const before = fallbackData.users.length;
    fallbackData.users = fallbackData.users.filter(u => u.tenant_id !== tenantId);
    const removed = before - fallbackData.users.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  // DELETE FROM users WHERE id = $1 (одиночное удаление, без tenant)
  if (/DELETE\s+FROM\s+users\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      fallbackData.users.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  // DELETE FROM tenants WHERE id = $1
  if (/DELETE\s+FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.tenants.findIndex(t => t.id === id);
    if (idx !== -1) {
      fallbackData.tenants.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  // ── account_blocklist (чёрный список удалённых аккаунтов) ──────────────────
  // INSERT ... ON CONFLICT(email) — upsert по email (ON CONFLICT в fallback игнорируем).
  if (/INSERT\s+INTO\s+account_blocklist/is.test(trimmed)) {
    const email = String(values[0] || '').trim().toLowerCase();
    if (email) {
      const existing = fallbackData.account_blocklist.find(b => b.email === email);
      const rec = {
        email,
        google_id: values[1] ?? null,
        reason: values[2] ?? null,
        blocked_by: values[3] ?? null,
        blocked_at: new Date().toISOString(),
      };
      if (existing) Object.assign(existing, rec);
      else fallbackData.account_blocklist.push(rec);
      saveFallbackData();
    }
    return { rows: [], rowCount: 1 };
  }
  // DELETE FROM account_blocklist WHERE email = $1 (разблокировка) — до общего SELECT ниже
  if (/DELETE\s+FROM\s+account_blocklist\s+WHERE\s+email\s*=\s*\$1/is.test(trimmed)) {
    const email = String(values[0] || '').trim().toLowerCase();
    const before = fallbackData.account_blocklist.length;
    fallbackData.account_blocklist = fallbackData.account_blocklist.filter(b => b.email !== email);
    const removed = before - fallbackData.account_blocklist.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  // SELECT ... FROM account_blocklist WHERE email = $1 (проверка блокировки)
  if (/FROM\s+account_blocklist\s+WHERE\s+email\s*=\s*\$1/is.test(trimmed)) {
    const email = String(values[0] || '').trim().toLowerCase();
    const found = fallbackData.account_blocklist.filter(b => b.email === email);
    return { rows: found, rowCount: found.length };
  }
  // SELECT ... FROM account_blocklist (список заблокированных)
  if (/SELECT[\s\S]*FROM\s+account_blocklist/is.test(trimmed)) {
    const rows = [...fallbackData.account_blocklist].sort((a, b) =>
      String(b.blocked_at || '').localeCompare(String(a.blocked_at || '')));
    return { rows, rowCount: rows.length };
  }

  // v0.9.5: UPDATE subscriptions SET cancel_at_period_end = TRUE/FALSE, canceled_by, canceled_at
  if (/UPDATE\s+subscriptions\s+SET\s+cancel_at_period_end\s*=\s*TRUE/is.test(trimmed)) {
    const canceledBy = values[0];
    const tenantId = values[1];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    if (row) {
      row.cancel_at_period_end = true;
      row.canceled_by = canceledBy;
      row.canceled_at = new Date().toISOString();
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [], rowCount: row ? 1 : 0 };
  }
  if (/UPDATE\s+subscriptions\s+SET\s+cancel_at_period_end\s*=\s*FALSE/is.test(trimmed)) {
    const tenantId = values[0];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    if (row) {
      row.cancel_at_period_end = false;
      row.canceled_by = null;
      row.canceled_at = null;
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [], rowCount: row ? 1 : 0 };
  }

  // UPDATE subscriptions SET payment stats (total_paid_minutes, last_payment_minutes, last_payment_at)
  // используется хуками биллинга и админским credit
  if (/UPDATE\s+subscriptions\s+SET\s+total_paid_minutes/is.test(trimmed)) {
    // values: [add_minutes_to_total, last_payment_minutes, tenant_id]
    const addTotal = Number(values[0]) || 0;
    const lastPaymentMin = Number(values[1]) || 0;
    const tenantId = values[2];
    const row = fallbackData.subscriptions.find(r => r.tenant_id === tenantId);
    if (row) {
      row.total_paid_minutes = (row.total_paid_minutes || 0) + addTotal;
      row.last_payment_minutes = lastPaymentMin;
      row.last_payment_at = new Date().toISOString();
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }
  // SELECT all subscriptions (для админских отчётов / сводки)
  if (/^SELECT\b[\s\S]*?FROM\s+subscriptions(?!\s+WHERE\s+tenant_id)/i.test(trimmed)) {
    return { rows: [...fallbackData.subscriptions] };
  }

  // ── TENANTS: обновление stripe_customer_id ─────────────────
  if (/UPDATE\s+tenants\s+SET\s+stripe_customer_id/is.test(trimmed)) {
    const customerId = values[0];
    const tenantId = values[1];
    const t = fallbackData.tenants.find(x => x.id === tenantId);
    if (t) {
      t.stripe_customer_id = customerId;
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/SELECT\s+stripe_customer_id\s+FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const t = fallbackData.tenants.find(x => x.id === tenantId);
    return { rows: t ? [{ stripe_customer_id: t.stripe_customer_id || null }] : [] };
  }

  // ── PROMO CODES ───────────────────────────────────────────────
  if (/^SELECT\b[\s\S]*?FROM\s+promo_codes/i.test(trimmed)) {
    return { rows: [...fallbackData.promo_codes] };
  }
  if (/INSERT\s+INTO\s+promo_codes/is.test(trimmed)) {
    const row = {
      id: generateUUID(),
      code: values[0],
      discount_type: values[1] || 'percentage',
      discount_value: values[2],
      max_redemptions: values[3] ?? null,
      redemptions_count: 0,
      expires_at: values[4] ?? null,
      stripe_coupon_id: values[5] ?? null,
      stripe_promotion_code_id: values[6] ?? null,
      created_at: new Date().toISOString(),
    };
    fallbackData.promo_codes.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  if (/DELETE\s+FROM\s+promo_codes\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.promo_codes.findIndex(r => r.id === id);
    if (idx !== -1) {
      fallbackData.promo_codes.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // 22. DELETE FROM sip_trunks
  if (/DELETE\s+FROM\s+sip_trunks\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const idx = fallbackData.sip_trunks.findIndex(t => t.tenant_id === tenantId);
    if (idx !== -1) {
      fallbackData.sip_trunks.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ============================================================================================
  // ENTERPRISE v0.10.0 — fallback-handlers для Enterprise-таблиц
  // ============================================================================================

  // ── ROOMS: поиск telegram_chat-комнаты по тройке (tenant, bot, user) ─────
  if (/FROM\s+rooms\s+WHERE\s+creator_tenant_id\s*=\s*\$1\s+AND\s+telegram_bot_id\s*=\s*\$2\s+AND\s+telegram_user_id\s*=\s*\$3/is.test(trimmed)) {
    const [tenantId, botId, userId] = values;
    const room = fallbackData.rooms.find(
      (r: any) =>
        r.creator_tenant_id === tenantId &&
        String(r.telegram_bot_id) === String(botId) &&
        String(r.telegram_user_id) === String(userId) &&
        r.kind === 'telegram_chat'
    );
    return { rows: room ? [room] : [] };
  }

  // ── ROOMS: обновление telegram-метаданных клиента (username/display_name).
  //    findOrCreateTelegramChatRoom вызывает это, когда клиент сменил @username
  //    или имя — чтобы идентификация в UI оставалась актуальной.
  if (/UPDATE\s+rooms\s+SET\s+telegram_username/is.test(trimmed)) {
    const id = values[2];
    const r: any = fallbackData.rooms.find((x: any) => x.id === id);
    if (r) {
      r.telegram_username = values[0] ?? r.telegram_username ?? null;
      r.telegram_display_name = values[1] ?? r.telegram_display_name ?? null;
      r.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // ── ROOMS: поиск channel_chat-комнаты по (tenant, channel_type, account, conversation) [OMNICHANNEL] ──
  if (/FROM\s+rooms\s+WHERE\s+creator_tenant_id\s*=\s*\$1\s+AND\s+channel_type\s*=\s*\$2\s+AND\s+channel_account_id\s*=\s*\$3\s+AND\s+channel_conversation_id\s*=\s*\$4/is.test(trimmed)) {
    const [tenantId, chType, accId, convId] = values;
    const room = fallbackData.rooms.find(
      (r: any) =>
        r.creator_tenant_id === tenantId &&
        String(r.channel_type) === String(chType) &&
        String(r.channel_account_id) === String(accId) &&
        String(r.channel_conversation_id) === String(convId) &&
        r.kind === 'channel_chat'
    );
    return { rows: room ? [room] : [] };
  }

  // ── ROOMS: обновление channel-метаданных (username/display_name) [OMNICHANNEL] ──
  if (/UPDATE\s+rooms\s+SET\s+channel_username/is.test(trimmed)) {
    const id = values[2];
    const r: any = fallbackData.rooms.find((x: any) => x.id === id);
    if (r) {
      r.channel_username = values[0] ?? r.channel_username ?? null;
      r.channel_display_name = values[1] ?? r.channel_display_name ?? null;
      r.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // ── CHANNEL_INBOXES [OMNICHANNEL Фаза 1] ──────────────────────────────────
  if (/INSERT\s+INTO\s+channel_inboxes/i.test(trimmed)) {
    fallbackData.channel_inboxes = fallbackData.channel_inboxes || [];
    let cfg: any = values[5];
    if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch { cfg = {}; } }
    const row = {
      id: values[0] || generateUUID(),
      tenant_id: values[1],
      channel_type: values[2],
      external_id: values[3] || null,
      chatwoot_inbox_id: values[4] != null ? String(values[4]) : null,
      config: cfg || {},
      enabled: values[6] !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fallbackData.channel_inboxes.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  if (/FROM\s+channel_inboxes\s+WHERE\s+chatwoot_inbox_id\s*=\s*\$1/i.test(trimmed)) {
    const cwId = String(values[0]);
    const row = (fallbackData.channel_inboxes || []).find(
      (x: any) => String(x.chatwoot_inbox_id) === cwId && x.enabled !== false
    );
    return { rows: row ? [row] : [] };
  }
  if (/FROM\s+channel_inboxes\s+WHERE\s+tenant_id\s*=\s*\$1/i.test(trimmed)) {
    const tid = values[0];
    return { rows: (fallbackData.channel_inboxes || []).filter((x: any) => x.tenant_id === tid) };
  }

  // ── FLOWS [OMNICHANNEL Фаза 2] ────────────────────────────────────────────
  if (/INSERT\s+INTO\s+flows/i.test(trimmed)) {
    fallbackData.flows = fallbackData.flows || [];
    const row = {
      id: values[0] || generateUUID(),
      tenant_id: values[1],
      name: values[2] || 'Без названия',
      status: 'draft',
      graph: { nodes: [], edges: [] },
      channel_type: values[3] || null,
      chatwoot_inbox_id: values[4] != null ? String(values[4]) : null,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fallbackData.flows.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  if (/SELECT[\s\S]*FROM\s+flows\s+WHERE\s+tenant_id\s*=\s*\$1\s+AND\s+id\s*=\s*\$2/i.test(trimmed)) {
    const row = (fallbackData.flows || []).find((f: any) => f.tenant_id === values[0] && f.id === values[1]);
    return { rows: row ? [row] : [] };
  }
  if (/SELECT[\s\S]*FROM\s+flows\s+WHERE\s+tenant_id\s*=\s*\$1\s+AND\s+status/i.test(trimmed)) {
    const list = (fallbackData.flows || []).filter((f: any) => f.tenant_id === values[0] && f.status === 'active');
    return { rows: list };
  }
  if (/SELECT[\s\S]*FROM\s+flows\s+WHERE\s+tenant_id\s*=\s*\$1/i.test(trimmed)) {
    const list = (fallbackData.flows || []).filter((f: any) => f.tenant_id === values[0]);
    list.sort((a: any, b: any) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return { rows: list };
  }
  if (/UPDATE\s+flows\s+SET\s+name/i.test(trimmed)) {
    const tid = values[6], id = values[7];
    const f: any = (fallbackData.flows || []).find((x: any) => x.tenant_id === tid && x.id === id);
    if (f) {
      f.name = values[0];
      f.status = values[1];
      let g = values[2];
      if (typeof g === 'string') { try { g = JSON.parse(g); } catch { g = f.graph; } }
      f.graph = g;
      f.channel_type = values[3] || null;
      f.chatwoot_inbox_id = values[4] != null ? String(values[4]) : null;
      f.is_default = values[5] === true || values[5] === 'true';
      f.updated_at = new Date().toISOString();
      saveFallbackData();
      return { rows: [f] };
    }
    return { rows: [] };
  }
  if (/DELETE\s+FROM\s+flows\s+WHERE\s+tenant_id\s*=\s*\$1\s+AND\s+id\s*=\s*\$2/i.test(trimmed)) {
    fallbackData.flows = fallbackData.flows || [];
    const before = fallbackData.flows.length;
    fallbackData.flows = fallbackData.flows.filter((f: any) => !(f.tenant_id === values[0] && f.id === values[1]));
    const removed = before - fallbackData.flows.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }

  // ── FLOW_SESSIONS [OMNICHANNEL Фаза 2] ────────────────────────────────────
  if (/INSERT\s+INTO\s+flow_sessions/i.test(trimmed)) {
    fallbackData.flow_sessions = fallbackData.flow_sessions || [];
    let vars: any = values[5];
    if (typeof vars === 'string') { try { vars = JSON.parse(vars); } catch { vars = {}; } }
    const row = {
      id: values[0] || generateUUID(),
      room_id: values[1],
      tenant_id: values[2] || null,
      flow_id: values[3] || null,
      current_node_id: values[4] || null,
      status: 'active',
      variables: vars || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fallbackData.flow_sessions.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  if (/FROM\s+flow_sessions\s+WHERE\s+room_id\s*=\s*\$1\s+AND\s+status/i.test(trimmed)) {
    const row = (fallbackData.flow_sessions || []).find((s: any) => s.room_id === values[0] && s.status === 'active');
    return { rows: row ? [row] : [] };
  }
  if (/UPDATE\s+flow_sessions\s+SET\s+current_node_id/i.test(trimmed)) {
    const id = values[3];
    const s: any = (fallbackData.flow_sessions || []).find((x: any) => x.id === id);
    if (s) {
      s.current_node_id = values[0] ?? null;
      let v: any = values[1];
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = s.variables; } }
      s.variables = v || {};
      s.status = values[2] || 'active';
      s.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // ── ROOM_MESSAGES ────────────────────────────────────────────────────────
  if (/INSERT\s+INTO\s+room_messages/is.test(trimmed)) {
    const row = {
      id: generateUUID(),
      room_id: values[0],
      sender: values[1],
      source: values[2] || 'chat',
      kind: values[3] || 'text',
      content: values[4] || null,
      media_url: values[5] || null,
      media_mime: values[6] || null,
      media_size: values[7] || null,
      language_detected: values[8] || null,
      dialect_detected: values[9] || null,
      metadata: typeof values[10] === 'string' ? JSON.parse(values[10]) : (values[10] || null),
      created_at: new Date().toISOString(),
    };
    fallbackData.room_messages.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  // ── OUTBOX (admin → client): pending admin-сообщения в telegram_chat-комнатах.
  //    Эмулирует SQL JOIN room_messages × rooms из enterprise_chat/outbox.ts.
  //    Без этого handler'а getPendingOutbox в fallback ВСЕГДА возвращал [] —
  //    сообщения/медиа владельца не доставлялись клиенту в Telegram через Quest Flow.
  if (/FROM\s+room_messages\s+m\s+JOIN\s+rooms\s+r/is.test(trimmed)
      && /m\.sender\s*=\s*'admin'/i.test(trimmed)
      && /outbox_status/i.test(trimmed)) {
    const tenantId = values[0];
    const tgRooms = fallbackData.rooms.filter(
      (r: any) => r.creator_tenant_id === tenantId && r.kind === 'telegram_chat'
    );
    const roomById = new Map<string, any>(tgRooms.map((r: any) => [r.id, r] as [string, any]));
    const rows = fallbackData.room_messages
      .filter((m: any) => roomById.has(m.room_id) && m.sender === 'admin')
      .filter((m: any) => {
        const meta = typeof m.metadata === 'string'
          ? (() => { try { return JSON.parse(m.metadata); } catch { return null; } })()
          : (m.metadata || null);
        const status = meta && meta.outbox_status;
        return !status || status === 'pending';
      })
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((m: any) => {
        const r: any = roomById.get(m.room_id);
        return {
          id: m.id,
          room_id: m.room_id,
          kind: m.kind,
          content: m.content,
          media_url: m.media_url,
          media_mime: m.media_mime,
          metadata: m.metadata,
          created_at: m.created_at,
          telegram_bot_id: r ? r.telegram_bot_id : null,
          telegram_user_id: r ? r.telegram_user_id : null,
        };
      });
    return { rows };
  }
  // ── OUTBOX ack (шаг 1): SELECT m.id, m.metadata ... JOIN rooms ... WHERE m.id=$1 AND r.creator_tenant_id=$2
  if (/FROM\s+room_messages\s+m\s+JOIN\s+rooms\s+r/is.test(trimmed)
      && /m\.id\s*=\s*\$1/i.test(trimmed)) {
    const messageId = values[0];
    const tenantId = values[1];
    const m: any = fallbackData.room_messages.find((x: any) => x.id === messageId);
    if (!m) return { rows: [] };
    const r: any = fallbackData.rooms.find((rr: any) => rr.id === m.room_id);
    if (!r || r.creator_tenant_id !== tenantId) return { rows: [] };
    return { rows: [{ id: m.id, metadata: m.metadata }] };
  }
  // ── OUTBOX ack (шаг 2): UPDATE room_messages SET metadata = $1 WHERE id = $2 (пометка 'sent')
  if (/UPDATE\s+room_messages\s+SET\s+metadata\s*=\s*\$1\s+WHERE\s+id\s*=\s*\$2/is.test(trimmed)) {
    const meta = typeof values[0] === 'string'
      ? (() => { try { return JSON.parse(values[0]); } catch { return values[0]; } })()
      : values[0];
    const id = values[1];
    const m: any = fallbackData.room_messages.find((x: any) => x.id === id);
    if (m) {
      m.metadata = meta;
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  if (/FROM\s+room_messages\s+WHERE\s+room_id\s*=\s*\$1\s+AND\s+source\s*=\s*'transcript'/is.test(trimmed)) {
    // delete все transcripts по room_id (специальная форма из rooms/transcripts handler)
    const roomId = values[0];
    const before = fallbackData.room_messages.length;
    fallbackData.room_messages = fallbackData.room_messages.filter(
      (m: any) => !(m.room_id === roomId && m.source === 'transcript')
    );
    const removed = before - fallbackData.room_messages.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  if (/FROM\s+room_messages\s+WHERE\s+room_id\s*=\s*\$1/is.test(trimmed)) {
    const roomId = values[0];
    const rows = fallbackData.room_messages
      .filter((m: any) => m.room_id === roomId)
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
    return { rows };
  }
  // SELECT FROM room_messages WHERE id = $1 (для DELETE preflight в enterprise_chat)
  if (/FROM\s+room_messages\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const msg = fallbackData.room_messages.find((m: any) => m.id === id);
    return { rows: msg ? [msg] : [] };
  }
  if (/DELETE\s+FROM\s+room_messages\s+WHERE\s+room_id\s*=\s*\$1/is.test(trimmed)) {
    const roomId = values[0];
    const before = fallbackData.room_messages.length;
    fallbackData.room_messages = fallbackData.room_messages.filter((m: any) => m.room_id !== roomId);
    const removed = before - fallbackData.room_messages.length;
    if (removed > 0) saveFallbackData();
    return { rows: [], rowCount: removed };
  }
  // DELETE FROM room_messages WHERE id = $1 (удаление одного сообщения)
  if (/DELETE\s+FROM\s+room_messages\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.room_messages.findIndex((m: any) => m.id === id);
    if (idx !== -1) {
      fallbackData.room_messages.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ── TENANT_QUEST_FLOW_KEYS ───────────────────────────────────────────────
  if (/INSERT\s+INTO\s+tenant_quest_flow_keys/is.test(trimmed)) {
    const row = {
      id: generateUUID(),
      tenant_id: values[0],
      api_key_hash: values[1],
      api_key_prefix: values[2],
      label: values[3] || null,
      created_at: new Date().toISOString(),
      last_used_at: null,
      revoked_at: null,
    };
    fallbackData.tenant_quest_flow_keys.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  // SELECT tenant_id FROM tenant_quest_flow_keys WHERE id = $1
  // Preflight-проверка владельца в revokeKey/deleteKey. Без этого handler'а запрос
  // проваливался до дефолтной заглушки ({rows:[]}), owner оказывался undefined, и
  // revoke/delete ВСЕГДА возвращали 404 в fallback-режиме (ключи нельзя было удалить).
  if (/^SELECT\b[\s\S]*?FROM\s+tenant_quest_flow_keys\s+WHERE\s+id\s*=\s*\$1/i.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.tenant_quest_flow_keys.find((k: any) => k.id === id);
    return { rows: row ? [row] : [] };
  }
  if (/FROM\s+tenant_quest_flow_keys\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    // listKeys фильтрует "revoked_at IS NULL" — отозванные ключи не должны
    // показываться в UI (как в реальном Postgres). Без этого revoke не «прятал» ключ.
    const onlyActive = /revoked_at\s+IS\s+NULL/i.test(trimmed);
    const rows = fallbackData.tenant_quest_flow_keys
      .filter((k: any) => k.tenant_id === tenantId && (!onlyActive || !k.revoked_at))
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
    return { rows };
  }
  if (/FROM\s+tenant_quest_flow_keys\s+WHERE\s+api_key_hash\s*=\s*\$1/is.test(trimmed)) {
    const hash = values[0];
    const row = fallbackData.tenant_quest_flow_keys.find(
      (k: any) => k.api_key_hash === hash && !k.revoked_at
    );
    return { rows: row ? [row] : [] };
  }
  if (/UPDATE\s+tenant_quest_flow_keys\s+SET\s+last_used_at/is.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.tenant_quest_flow_keys.find((k: any) => k.id === id);
    if (row) {
      row.last_used_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/UPDATE\s+tenant_quest_flow_keys\s+SET\s+revoked_at/is.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.tenant_quest_flow_keys.find((k: any) => k.id === id);
    if (row) {
      row.revoked_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [], rowCount: row ? 1 : 0 };
  }
  if (/DELETE\s+FROM\s+tenant_quest_flow_keys\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.tenant_quest_flow_keys.findIndex((k: any) => k.id === id);
    if (idx !== -1) {
      fallbackData.tenant_quest_flow_keys.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ── TENANT_MCP_KEYS (по образцу tenant_quest_flow_keys + столбец scopes) ──────
  if (/INSERT\s+INTO\s+tenant_mcp_keys/is.test(trimmed)) {
    const row = {
      id: generateUUID(),
      tenant_id: values[0],
      api_key_hash: values[1],
      api_key_prefix: values[2],
      label: values[3] || null,
      scopes: values[4] || '[]',
      created_at: new Date().toISOString(),
      last_used_at: null,
      revoked_at: null,
    };
    fallbackData.tenant_mcp_keys.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  if (/^SELECT\b[\s\S]*?FROM\s+tenant_mcp_keys\s+WHERE\s+id\s*=\s*\$1/i.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.tenant_mcp_keys.find((k: any) => k.id === id);
    return { rows: row ? [row] : [] };
  }
  if (/FROM\s+tenant_mcp_keys\s+WHERE\s+api_key_hash\s*=\s*\$1/is.test(trimmed)) {
    const hash = values[0];
    const row = fallbackData.tenant_mcp_keys.find((k: any) => k.api_key_hash === hash && !k.revoked_at);
    return { rows: row ? [row] : [] };
  }
  if (/FROM\s+tenant_mcp_keys\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const onlyActive = /revoked_at\s+IS\s+NULL/i.test(trimmed);
    const rows = fallbackData.tenant_mcp_keys
      .filter((k: any) => k.tenant_id === tenantId && (!onlyActive || !k.revoked_at))
      .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
    return { rows };
  }
  if (/UPDATE\s+tenant_mcp_keys\s+SET\s+last_used_at/is.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.tenant_mcp_keys.find((k: any) => k.id === id);
    if (row) { row.last_used_at = new Date().toISOString(); saveFallbackData(); }
    return { rows: [] };
  }
  if (/UPDATE\s+tenant_mcp_keys\s+SET\s+revoked_at/is.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.tenant_mcp_keys.find((k: any) => k.id === id);
    if (row) { row.revoked_at = new Date().toISOString(); saveFallbackData(); }
    return { rows: [], rowCount: row ? 1 : 0 };
  }
  if (/DELETE\s+FROM\s+tenant_mcp_keys\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.tenant_mcp_keys.findIndex((k: any) => k.id === id);
    if (idx !== -1) {
      fallbackData.tenant_mcp_keys.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ── TENANT_NEED_TAGS ─────────────────────────────────────────────────────
  if (/INSERT\s+INTO\s+tenant_need_tags/is.test(trimmed)) {
    const row = {
      id: generateUUID(),
      tenant_id: values[0],
      name: values[1],
      description: values[2] || null,
      color: values[3] || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    fallbackData.tenant_need_tags.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  if (/FROM\s+tenant_need_tags\s+WHERE\s+tenant_id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const rows = fallbackData.tenant_need_tags
      .filter((t: any) => t.tenant_id === tenantId)
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
    return { rows };
  }
  if (/FROM\s+tenant_need_tags\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.tenant_need_tags.find((t: any) => t.id === id);
    return { rows: row ? [row] : [] };
  }
  if (/UPDATE\s+tenant_need_tags\s+SET/is.test(trimmed)) {
    const id = values[values.length - 1];
    const row = fallbackData.tenant_need_tags.find((t: any) => t.id === id);
    if (row) {
      if (values[0] !== undefined) row.name = values[0];
      if (values[1] !== undefined) row.description = values[1];
      if (values[2] !== undefined) row.color = values[2];
      row.updated_at = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: row ? [row] : [] };
  }
  if (/DELETE\s+FROM\s+tenant_need_tags\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.tenant_need_tags.findIndex((t: any) => t.id === id);
    if (idx !== -1) {
      fallbackData.tenant_need_tags.splice(idx, 1);
      // каскадно удаляем assignments
      fallbackData.client_tag_assignments = fallbackData.client_tag_assignments.filter(
        (a: any) => a.tag_id !== id
      );
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ── CLIENT_TAG_ASSIGNMENTS ───────────────────────────────────────────────
  if (/INSERT\s+INTO\s+client_tag_assignments/is.test(trimmed)) {
    // ON CONFLICT (tag_id, room_id) DO NOTHING — деталь учтена через find
    const tag_id = values[0];
    const room_id = values[1];
    const existing = fallbackData.client_tag_assignments.find(
      (a: any) => a.tag_id === tag_id && a.room_id === room_id
    );
    if (existing) {
      return { rows: [existing], rowCount: 0 };
    }
    const row = {
      id: generateUUID(),
      tag_id,
      room_id,
      detected_in_message_id: values[2] || null,
      confidence: values[3] != null ? Number(values[3]) : null,
      detected_at: new Date().toISOString(),
      sent_to_crm: false,
    };
    fallbackData.client_tag_assignments.push(row);
    saveFallbackData();
    return { rows: [row] };
  }
  if (/FROM\s+client_tag_assignments\s+WHERE\s+room_id\s*=\s*\$1/is.test(trimmed)) {
    const roomId = values[0];
    const rows = fallbackData.client_tag_assignments.filter((a: any) => a.room_id === roomId);
    return { rows };
  }
  if (/UPDATE\s+client_tag_assignments\s+SET\s+sent_to_crm/is.test(trimmed)) {
    const id = values[0];
    const row = fallbackData.client_tag_assignments.find((a: any) => a.id === id);
    if (row) {
      row.sent_to_crm = true;
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/DELETE\s+FROM\s+client_tag_assignments\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const idx = fallbackData.client_tag_assignments.findIndex((a: any) => a.id === id);
    if (idx !== -1) {
      fallbackData.client_tag_assignments.splice(idx, 1);
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // ── TENANTS: ENTERPRISE-поля. Разделены по конкретности — раньше общий regex
  //    `gemini_api_key` матчил И save (3 values), И status update (2 values), И last_check (1 value),
  //    и затирал encrypted ключ значением status'а. Это была причина «ключ пропадает после
  //    валидации».

  // Full save: UPDATE tenants SET gemini_api_key_encrypted = $1, gemini_api_key_status = $2 WHERE id = $3
  if (/UPDATE\s+tenants\s+SET\s+gemini_api_key_encrypted\s*=\s*\$1\s*,\s*gemini_api_key_status\s*=\s*\$2/is.test(trimmed)) {
    const tenantId = values[2];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.gemini_api_key_encrypted = values[0];
      t.gemini_api_key_status = values[1];
      t.gemini_api_key_last_check = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }

  // Only status: UPDATE tenants SET gemini_api_key_status = $1 WHERE id = $2
  if (/UPDATE\s+tenants\s+SET\s+gemini_api_key_status\s*=\s*\$1\s+WHERE\s+id\s*=\s*\$2/is.test(trimmed)) {
    const tenantId = values[1];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.gemini_api_key_status = values[0];
      saveFallbackData();
    }
    return { rows: [] };
  }

  // Only last_check: UPDATE tenants SET gemini_api_key_last_check = NOW() WHERE id = $1
  if (/UPDATE\s+tenants\s+SET\s+gemini_api_key_last_check\s*=\s*NOW\(\)\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const tenantId = values[0];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.gemini_api_key_last_check = new Date().toISOString();
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/UPDATE\s+tenants\s+SET\s+chatwoot_url_encrypted/is.test(trimmed)) {
    const tenantId = values[values.length - 1];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.chatwoot_url_encrypted = values[0];
      t.chatwoot_token_encrypted = values[1];
      if (values.length >= 4) t.chatwoot_enabled = !!values[2];
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/UPDATE\s+tenants\s+SET\s+chatwoot_enabled/is.test(trimmed)) {
    const tenantId = values[1];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.chatwoot_enabled = !!values[0];
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/UPDATE\s+tenants\s+SET\s+owner_telegram_id/is.test(trimmed)) {
    const tenantId = values[1];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.owner_telegram_id = values[0];
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/UPDATE\s+tenants\s+SET\s+owner_telegram_bot_token_encrypted/is.test(trimmed)) {
    const tenantId = values[1];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.owner_telegram_bot_token_encrypted = values[0];
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/SELECT\s+owner_telegram_bot_token_encrypted\s+FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const t: any = fallbackData.tenants.find((x) => x.id === id);
    return { rows: t ? [{ owner_telegram_bot_token_encrypted: t.owner_telegram_bot_token_encrypted || null }] : [] };
  }
  // owner_telegram_subscribers (массив подписчиков)
  if (/UPDATE\s+tenants\s+SET\s+owner_telegram_subscribers/is.test(trimmed)) {
    const tenantId = values[1];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.owner_telegram_subscribers = typeof values[0] === 'string' ? JSON.parse(values[0]) : values[0];
      saveFallbackData();
    }
    return { rows: [] };
  }
  if (/SELECT\s+owner_telegram_subscribers\s+FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const t: any = fallbackData.tenants.find((x) => x.id === id);
    return { rows: t ? [{ owner_telegram_subscribers: t.owner_telegram_subscribers || [] }] : [] };
  }
  if (/UPDATE\s+tenants\s+SET\s+questflow_prompt/is.test(trimmed)) {
    const tenantId = values[values.length - 1];
    const t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (t) {
      t.questflow_prompt = values[0];
      if (values.length >= 4) {
        t.questflow_knowledge_base = values[1] || null;
        t.questflow_kb_filename = values[2] || null;
      }
      saveFallbackData();
    }
    return { rows: [] };
  }
  // Преобразование изображений (Фаза 1): модель + пресеты. Чтение — через общий
  // `FROM tenants WHERE id=$1` handler (возвращает весь tenant с этими полями).
  if (/UPDATE\s+tenants\s+SET\s+questflow_image_model/is.test(trimmed)) {
    const tenantId = values[values.length - 1];
    let t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (!t) { t = { id: tenantId }; fallbackData.tenants.push(t); } // upsert: супер-админ (global_admin) без строки tenant
    t.questflow_image_model = values[0];
    saveFallbackData();
    return { rows: [] };
  }
  if (/UPDATE\s+tenants\s+SET\s+questflow_image_presets/is.test(trimmed)) {
    const tenantId = values[values.length - 1];
    let t: any = fallbackData.tenants.find((x) => x.id === tenantId);
    if (!t) { t = { id: tenantId }; fallbackData.tenants.push(t); } // upsert: супер-админ (global_admin) без строки tenant
    t.questflow_image_presets = values[0];
    saveFallbackData();
    return { rows: [] };
  }
  if (/SELECT\s+gemini_api_key_encrypted[\s\S]*?FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const t: any = fallbackData.tenants.find((x) => x.id === id);
    if (!t) return { rows: [] };
    return { rows: [{
      gemini_api_key_encrypted: t.gemini_api_key_encrypted || null,
      gemini_api_key_status: t.gemini_api_key_status || null,
      gemini_api_key_last_check: t.gemini_api_key_last_check || null,
    }] };
  }
  if (/SELECT\s+chatwoot_url_encrypted[\s\S]*?FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const t: any = fallbackData.tenants.find((x) => x.id === id);
    if (!t) return { rows: [] };
    return { rows: [{
      chatwoot_url_encrypted: t.chatwoot_url_encrypted || null,
      chatwoot_token_encrypted: t.chatwoot_token_encrypted || null,
      chatwoot_enabled: !!t.chatwoot_enabled,
    }] };
  }
  if (/SELECT\s+owner_telegram_id\s+FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const t: any = fallbackData.tenants.find((x) => x.id === id);
    if (!t) return { rows: [] };
    return { rows: [{ owner_telegram_id: t.owner_telegram_id || null }] };
  }
  if (/SELECT\s+questflow_prompt[\s\S]*?FROM\s+tenants\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const id = values[0];
    const t: any = fallbackData.tenants.find((x) => x.id === id);
    if (!t) return { rows: [] };
    return { rows: [{
      questflow_prompt: t.questflow_prompt || '',
      questflow_knowledge_base: t.questflow_knowledge_base || '',
      questflow_kb_filename: t.questflow_kb_filename || null,
    }] };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // v1.0.6 — ПАРТНЁРСКАЯ ПРОГРАММА (fallback handlers)
  // ─────────────────────────────────────────────────────────────────────────

  // partners: SELECT code FROM partners WHERE id = $1 (reset/delete endpoints — получить код по id)
  if (/SELECT\s+code\s+FROM\s+partners\s+WHERE\s+id\s*=\s*\$1/is.test(trimmed)) {
    const pid = values[0];
    const p = fallbackData.partners.find((x: any) => x.id === pid);
    return { rows: p ? [{ code: p.code }] : [] };
  }
  // partners: найти партнёра по user_id (ensurePartnerForUser, шаг 1)
  if (/SELECT\s+id,\s*code,\s*status\s+FROM\s+partners\s+WHERE\s+user_id\s*=\s*\$1/is.test(trimmed)) {
    const userId = values[0];
    const p = fallbackData.partners.find((x: any) => x.user_id === userId);
    return { rows: p ? [{ id: p.id, code: p.code, status: p.status }] : [] };
  }

  // partners: создать / upsert по user_id (ensurePartnerForUser, шаг 2)
  if (/INSERT\s+INTO\s+partners\s*\(\s*user_id,\s*code\s*\)/is.test(trimmed)) {
    const userId = values[0];
    const code = values[1];
    // Уникальность кода — если занят, имитируем SQL unique violation
    if (fallbackData.partners.some((x: any) => x.code === code && x.user_id !== userId)) {
      const err: any = new Error('duplicate key value violates unique constraint "partners_code_key"');
      err.code = '23505';
      err.constraint = 'partners_code_key';
      throw err;
    }
    // ON CONFLICT (user_id) DO UPDATE — если уже есть, возвращаем как есть
    let existing = fallbackData.partners.find((x: any) => x.user_id === userId);
    if (!existing) {
      existing = {
        id: generateUUID(),
        user_id: userId,
        code,
        status: 'active',
        notes: null,
        created_at: new Date().toISOString()
      };
      fallbackData.partners.push(existing);
      saveFallbackData();
    }
    return { rows: [{ id: existing.id, code: existing.code, status: existing.status }] };
  }

  // partners: проверить, существует ли активный код (track-click sanity check)
  if (/SELECT\s+1\s+FROM\s+partners\s+WHERE\s+code\s*=\s*\$1\s+AND\s+status\s*=\s*'active'/is.test(trimmed)) {
    const code = values[0];
    const exists = fallbackData.partners.some((x: any) => x.code === code && x.status === 'active');
    return { rows: exists ? [{ '?column?': 1 }] : [] };
  }

  // partners: найти активного партнёра по коду (attributeRegistration)
  if (/SELECT\s+p\.id\s+FROM\s+partners\s+p\s+JOIN\s+users\s+u/is.test(trimmed)) {
    const code = values[0];
    const excludeUserId = values[1];
    const p = fallbackData.partners.find((x: any) => x.code === code && x.status === 'active' && x.user_id !== excludeUserId);
    if (!p) return { rows: [] };
    const u = fallbackData.users.find((x: any) => x.id === p.user_id);
    if (!u) return { rows: [] };
    return { rows: [{ id: p.id }] };
  }

  // partners: PATCH /:id — обновить status и/или notes
  if (/UPDATE\s+partners\s+SET\s+/is.test(trimmed) && /RETURNING\s+id,\s*code,\s*status,\s*notes/is.test(trimmed)) {
    // Последний value — это id, остальные — обновляемые поля в порядке появления
    const id = values[values.length - 1];
    const p = fallbackData.partners.find((x: any) => x.id === id);
    if (!p) return { rows: [] };
    // Простой разбор: ищем status = $N и notes = $N в SQL
    const statusMatch = trimmed.match(/status\s*=\s*\$(\d+)/i);
    const notesMatch = trimmed.match(/notes\s*=\s*\$(\d+)/i);
    if (statusMatch) p.status = values[parseInt(statusMatch[1], 10) - 1];
    if (notesMatch) p.notes = values[parseInt(notesMatch[1], 10) - 1];
    saveFallbackData();
    return { rows: [{ id: p.id, code: p.code, status: p.status, notes: p.notes }] };
  }

  // partners: admin GET / — список с агрегатами (JOIN или LEFT JOIN users — показываем и осиротевших)
  if (/FROM\s+partners\s+p\s+(?:LEFT\s+)?JOIN\s+users\s+u\s+ON\s+u\.id\s*=\s*p\.user_id/is.test(trimmed)
      && /LEFT\s+JOIN\s+\(/is.test(trimmed)) {
    const rows = fallbackData.partners.map((p: any) => {
      const u = fallbackData.users.find((x: any) => x.id === p.user_id);
      const clicks = fallbackData.referral_clicks.filter((c: any) => c.partner_code === p.code).length;
      const refs = fallbackData.referrals.filter((r: any) => r.partner_id === p.id);
      const paidUsers = refs.filter((r: any) => r.first_paid_at).length;
      const paidMinutes = refs.reduce((s: number, r: any) => s + (r.total_paid_minutes || 0), 0);
      return {
        id: p.id,
        code: p.code,
        status: p.status,
        notes: p.notes,
        created_at: p.created_at,
        user_id: p.user_id,
        email: u?.email ?? null,
        tenant_id: u?.tenant_id ?? null,
        clicks,
        registrations: refs.length,
        paid_users: paidUsers,
        paid_minutes: paidMinutes,
      };
    });
    // ORDER BY p.created_at DESC
    rows.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
    return { rows };
  }

  // referral_clicks: COUNT для одной партнёрки (getPartnerStats)
  if (/SELECT\s+COUNT\(\*\)::int\s+AS\s+n\s+FROM\s+referral_clicks\s+WHERE\s+partner_code\s*=\s*\$1/is.test(trimmed)) {
    const code = values[0];
    const n = fallbackData.referral_clicks.filter((c: any) => c.partner_code === code).length;
    return { rows: [{ n }] };
  }

  // referral_clicks: INSERT (track-click handler)
  if (/INSERT\s+INTO\s+referral_clicks\s*\(\s*partner_code/is.test(trimmed)) {
    fallbackData.referral_clicks.push({
      id: fallbackData.referral_clicks.length + 1,
      partner_code: values[0],
      ip_hash: values[1],
      user_agent: values[2],
      referer: values[3],
      created_at: new Date().toISOString()
    });
    saveFallbackData();
    return { rows: [], rowCount: 1 };
  }

  // referrals: агрегаты по одной партнёрке (getPartnerStats)
  if (/SELECT[\s\S]+FROM\s+referrals\s+WHERE\s+partner_id\s*=\s*\$1/is.test(trimmed)
      && /registrations[\s\S]+paid_users/is.test(trimmed)) {
    const pid = values[0];
    const refs = fallbackData.referrals.filter((r: any) => r.partner_id === pid);
    return {
      rows: [{
        registrations: refs.length,
        paid_users: refs.filter((r: any) => r.first_paid_at).length,
        paid_minutes: refs.reduce((s: number, r: any) => s + (r.total_paid_minutes || 0), 0)
      }]
    };
  }

  // referrals: INSERT (attributeRegistration, ON CONFLICT DO NOTHING)
  if (/INSERT\s+INTO\s+referrals\s*\(\s*partner_id,\s*referred_user_id,\s*source/is.test(trimmed)) {
    const partnerId = values[0];
    const userId = values[1];
    const source = values[2];
    if (fallbackData.referrals.some((r: any) => r.referred_user_id === userId)) {
      return { rows: [], rowCount: 0 };
    }
    fallbackData.referrals.push({
      id: generateUUID(),
      partner_id: partnerId,
      referred_user_id: userId,
      source,
      registered_at: new Date().toISOString(),
      first_paid_at: null,
      total_paid_minutes: 0
    });
    saveFallbackData();
    return { rows: [], rowCount: 1 };
  }

  // referrals: UPDATE (creditReferralPayment)
  if (/UPDATE\s+referrals\s+SET\s+total_paid_minutes/is.test(trimmed)) {
    const minutes = values[0];
    const userId = values[1];
    const r = fallbackData.referrals.find((x: any) => x.referred_user_id === userId);
    if (r) {
      r.total_paid_minutes = (r.total_paid_minutes || 0) + minutes;
      if (!r.first_paid_at) r.first_paid_at = new Date().toISOString();
      saveFallbackData();
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  // partner_program_settings: SELECT singleton
  if (/SELECT\s+terms_text,\s*whatsapp_contact,\s*updated_at\s+FROM\s+partner_program_settings\s+WHERE\s+id\s*=\s*1/is.test(trimmed)) {
    const s = fallbackData.partner_program_settings || {};
    return { rows: [{
      terms_text: s.terms_text || '',
      whatsapp_contact: s.whatsapp_contact || '',
      updated_at: s.updated_at || null
    }]};
  }

  // partner_program_settings: seed INSERT (миграция) — игнорируем, синглтон уже создан в init
  if (/INSERT\s+INTO\s+partner_program_settings\s*\([\s\S]*?\)\s*VALUES\s*\(\s*1,/is.test(trimmed)
      && /ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+NOTHING/is.test(trimmed)) {
    // Сохраняем дефолты, если ничего не задано
    if (!fallbackData.partner_program_settings || !fallbackData.partner_program_settings.whatsapp_contact) {
      fallbackData.partner_program_settings = {
        terms_text: values[1] ?? '',
        whatsapp_contact: values[2] ?? '+380637610482',
        updated_at: new Date().toISOString(),
        updated_by: null
      };
      saveFallbackData();
    }
    return { rows: [], rowCount: 0 };
  }

  // partner_program_settings: UPSERT (PUT /program)
  if (/INSERT\s+INTO\s+partner_program_settings/is.test(trimmed)
      && /ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+UPDATE/is.test(trimmed)) {
    const termsText = values[0];
    const whatsapp = values[1];
    const updaterUuid = values[2];
    const prev = fallbackData.partner_program_settings || {};
    fallbackData.partner_program_settings = {
      terms_text: (termsText !== null && termsText !== undefined) ? termsText : (prev.terms_text || ''),
      whatsapp_contact: (whatsapp !== null && whatsapp !== undefined && whatsapp !== '') ? whatsapp : (prev.whatsapp_contact || '+380637610482'),
      updated_at: new Date().toISOString(),
      updated_by: updaterUuid
    };
    saveFallbackData();
    return { rows: [], rowCount: 1 };
  }

  // creditReferralPayment lookup: SELECT id FROM users WHERE tenant_id = $1 LIMIT 1
  if (/SELECT\s+id\s+FROM\s+users\s+WHERE\s+tenant_id\s*=\s*\$1\s+LIMIT\s+1/is.test(trimmed)) {
    const tenantId = values[0];
    const u = fallbackData.users.find((x: any) => x.tenant_id === tenantId);
    return { rows: u ? [{ id: u.id }] : [] };
  }

  // 22. CREATE TABLE, BEGIN, COMMIT, ROLLBACK, SET LOCAL, SELECT 1, CREATE INDEX
  if (/CREATE TABLE|CREATE INDEX|CREATE UNIQUE|BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT 1/i.test(trimmed)) {
    return { rows: [] };
  }

  // Дефолтный заглушечный ответ
  return { rows: [] };
}

// ── Конфигурация подключения к PostgreSQL ───────────────────────────
// Поддерживаются ДВА способа задать БД (приоритет у DATABASE_URL):
//   • DATABASE_URL=postgres://user:pass@host:5432/db?sslmode=require  (удобно для VPS/хостинга)
//   • отдельные DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
// SSL для удалённой БД: DB_SSL=true (или sslmode=require внутри DATABASE_URL).
//   По умолчанию rejectUnauthorized=false (managed PG часто с self-signed сертификатом);
//   для строгой проверки сертификата задайте DB_SSL_REJECT_UNAUTHORIZED=true.
function resolveSsl(): false | { rejectUnauthorized: boolean } {
  const v = (process.env.DB_SSL || '').toLowerCase();
  const fromUrl = !!process.env.DATABASE_URL && /sslmode=require/i.test(process.env.DATABASE_URL);
  const on = v === 'true' || v === 'require' || v === '1' || fromUrl;
  if (!on) return false;
  return { rejectUnauthorized: (process.env.DB_SSL_REJECT_UNAUTHORIZED || '').toLowerCase() === 'true' };
}

function buildPoolConfig(): PoolConfig {
  // Блок 1 (C5): в production требуем явные креды БД — никакого хардкод-фолбэка
  // пароля. Либо DATABASE_URL, либо DB_PASSWORD должны быть заданы.
  if (process.env.NODE_ENV === 'production'
      && !process.env.DATABASE_URL?.trim()
      && !process.env.DB_PASSWORD?.trim()) {
    throw new Error(
      '[FATAL] В production задайте DATABASE_URL или DB_PASSWORD (см. apps/backend/.env.example). ' +
      'Хардкод-фолбэк пароля БД запрещён.',
    );
  }
  const ssl = resolveSsl();
  const common: PoolConfig = {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    // Удалённой БД нужно больше времени на коннект, чем локальной (было 2000).
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '10000', 10),
    ...(ssl ? { ssl } : {}),
  };
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ...common };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'vibevox_admin',
    password: process.env.DB_PASSWORD || 'vibevox_secure_pass', // фолбэк ТОЛЬКО для dev (в prod выше throw)
    database: process.env.DB_NAME || 'vibevox_db',
    ...common,
  };
}

// КРИТИЧНО ДЛЯ ПРОДА: если true — при ошибке подключения НЕ уходим в JSON-fallback,
// а пробрасываем ошибку. Без этого при неверных кредах/недоступной БД сервис тихо
// начнёт писать в локальный db_fallback.json, и вы будете думать что работаете с
// настоящей БД. На VPS ВСЕГДА ставьте DB_DISABLE_FALLBACK=true.
//
// БЕЗОПАСНОСТЬ ДАННЫХ (защита от потери пользовательской БД): в production
// (NODE_ENV=production) fallback запрещён ВСЕГДА — даже если DB_DISABLE_FALLBACK
// забыли выставить. Это гарантирует, что кратковременная недоступность Postgres
// НИКОГДА не приведёт к тихой записи данных в эфемерный db_fallback.json (и их
// потере при следующем рестарте/деплое). В проде нет легитимного сценария fallback.
const FALLBACK_DISABLED =
  (process.env.DB_DISABLE_FALLBACK || '').toLowerCase() === 'true' ||
  process.env.NODE_ENV === 'production';

/** Ошибка именно подключения (а не SQL) — только такие триггерят fallback. */
function isConnError(err: any): boolean {
  return err?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED') || err?.syscall === 'connect';
}

// Инициализация пула подключений к PostgreSQL
const realPool = new Pool(buildPoolConfig());

// Прокси для пула для обработки ошибок подключения и переключения на fallback
const poolProxy = {
  query: async (text: string, values?: any[]) => {
    if (fallbackActive) {
      return runMockQuery(text, values);
    }
    try {
      return await realPool.query(text, values);
    } catch (err: any) {
      if (!FALLBACK_DISABLED && isConnError(err)) {
        activateFallback(err.message || String(err));
        return runMockQuery(text, values);
      }
      throw err;
    }
  },
  connect: async () => {
    if (fallbackActive) {
      return {
        query: async (text: string, values?: any[]) => runMockQuery(text, values),
        release: () => {}
      };
    }
    try {
      const client = await realPool.connect();
      // Оборачиваем клиент для ловли ошибок выполнения
      const clientProxy = {
        query: async (text: string, values?: any[]) => {
          try {
            return await client.query(text, values);
          } catch (err: any) {
            if (!FALLBACK_DISABLED && isConnError(err)) {
              activateFallback(err.message || String(err));
              return runMockQuery(text, values);
            }
            throw err;
          }
        },
        release: () => {
          client.release();
        }
      };
      return clientProxy;
    } catch (err: any) {
      if (!FALLBACK_DISABLED && isConnError(err)) {
        activateFallback(err.message || String(err));
        return {
          query: async (text: string, values?: any[]) => runMockQuery(text, values),
          release: () => {}
        };
      }
      throw err;
    }
  }
};

// Запуск проверки и создания таблиц при старте бэкенда
poolProxy.query(`
  CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      creator_tenant_id UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL
  );
`).then(() => {
  if (!fallbackActive) {
    console.log('[DB] Таблица rooms проверена/создана успешно в PostgreSQL');
  }
}).catch(err => {
  // Если ошибка подключения, мы уже переключились на fallback в poolProxy.query
  if (!fallbackActive) {
    console.warn('[DB] Предупреждение при автосоздании таблицы rooms:', err.message);
  }
});

/**
 * Функция-обертка для выполнения SQL-запросов в транзакционном контексте конкретного арендатора.
 */
export async function runInTenantContext<T>(
  tenantId: string,
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await poolProxy.connect();
  try {
    if (!fallbackActive) {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
    }

    const result = await callback(client);

    if (!fallbackActive) {
      await client.query('COMMIT');
    }
    return result;
  } catch (error) {
    if (!fallbackActive) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================================
// v0.9.2: Helper'ы для принудительной синхронизации fallback JSON с pg-операциями.
// Когда PostgreSQL доступен, pool.query идёт в pg и НЕ триггерит fallback handlers,
// поэтому db_fallback.json устаревает. После рестарта (если pg временно недоступен)
// fallback читает старый JSON — и «удалённые» записи возвращаются. Эти helper'ы вызываются
// ВСЕГДА из service-функций delete/update — независимо от того, в pg запрос ушёл или в mock.
// ============================================================================================

// ============================================================================================
// ENTERPRISE v0.10.3: helpers для room_messages — те же причины что и для rooms (v0.9.2).
// Когда PG доступен, INSERT/DELETE идут в реальный PG, и fallback JSON устаревает. После
// рестарта backend'а (если PG временно недоступен) fallback читает старый JSON и удалённые
// сообщения «воскресают». Эти helper'ы вызываются ИЗ service-функций ВСЕГДА.
// ============================================================================================

export function removeMessageFromFallback(messageId: string): boolean {
  ensureFallbackLoaded();
  const idx = fallbackData.room_messages.findIndex((m: any) => m.id === messageId);
  if (idx === -1) return false;
  fallbackData.room_messages.splice(idx, 1);
  saveFallbackData();
  return true;
}

export function addMessageToFallback(msg: any): void {
  ensureFallbackLoaded();
  // Дедуп по id (на случай если уже есть)
  const existingIdx = fallbackData.room_messages.findIndex((m: any) => m.id === msg.id);
  if (existingIdx !== -1) {
    fallbackData.room_messages[existingIdx] = msg;
  } else {
    fallbackData.room_messages.push(msg);
  }
  saveFallbackData();
}

export function removeRoomFromFallback(roomId: string): boolean {
  ensureFallbackLoaded();
  const idx = fallbackData.rooms.findIndex((r) => r.id === roomId);
  if (idx === -1) return false;
  fallbackData.rooms.splice(idx, 1);
  saveFallbackData();
  return true;
}

export function renameRoomInFallback(roomId: string, name: string): boolean {
  ensureFallbackLoaded();
  const room: any = fallbackData.rooms.find((r) => r.id === roomId);
  if (!room) return false;
  room.name = name;
  room.updated_at = new Date().toISOString();
  saveFallbackData();
  return true;
}

export function removeUserFromFallback(userId: string): boolean {
  ensureFallbackLoaded();
  const idx = fallbackData.users.findIndex((u) => u.id === userId);
  if (idx === -1) return false;
  const u = fallbackData.users[idx];
  fallbackData.users.splice(idx, 1);
  // Профиль пользователя (user-scoped).
  fallbackData.user_profiles = (fallbackData.user_profiles || []).filter((p: any) => p.user_id !== userId);
  // Партнёрка (user-scoped, вне tenant): профиль партнёра + его referrals/клики, плюс
  // атрибуция этого юзера как привлечённого.
  const partner = (fallbackData.partners || []).find((p: any) => p.user_id === userId);
  if (partner) {
    fallbackData.referrals = (fallbackData.referrals || []).filter((r: any) => r.partner_id !== partner.id);
    fallbackData.referral_clicks = (fallbackData.referral_clicks || []).filter((c: any) => c.partner_code !== partner.code);
    fallbackData.partners = fallbackData.partners.filter((p: any) => p.user_id !== userId);
  }
  fallbackData.referrals = (fallbackData.referrals || []).filter((r: any) => r.referred_user_id !== userId);
  // Полный каскад по tenant'у: подписка + ВСЕ ключи/привязки + комнаты с их данными.
  // Должен совпадать с явными DELETE в admin/users.ts, чтобы ничего не «осиротело».
  if (u.tenant_id) {
    const tid = u.tenant_id;
    fallbackData.tenants = fallbackData.tenants.filter((t: any) => t.id !== tid);
    fallbackData.subscriptions = fallbackData.subscriptions.filter((s: any) => s.tenant_id !== tid);
    fallbackData.tenant_quest_flow_keys = (fallbackData.tenant_quest_flow_keys || []).filter((k: any) => k.tenant_id !== tid);
    fallbackData.tenant_need_tags = (fallbackData.tenant_need_tags || []).filter((t: any) => t.tenant_id !== tid);
    fallbackData.sip_trunks = (fallbackData.sip_trunks || []).filter((s: any) => s.tenant_id !== tid);
    const roomIds = (fallbackData.rooms || []).filter((r: any) => r.creator_tenant_id === tid).map((r: any) => r.id);
    fallbackData.rooms = (fallbackData.rooms || []).filter((r: any) => r.creator_tenant_id !== tid);
    if (roomIds.length) {
      fallbackData.room_messages = (fallbackData.room_messages || []).filter((m: any) => !roomIds.includes(m.room_id));
      fallbackData.client_tag_assignments = (fallbackData.client_tag_assignments || []).filter((a: any) => !roomIds.includes(a.room_id));
    }
  }
  saveFallbackData();
  return true;
}

// Экспортируем проксированный пул как дефолтный экспорт
export default poolProxy as any;
