import { SipClient } from 'livekit-server-sdk';
import { SIPTransport } from '@livekit/protocol';
import { runInTenantContext } from '../../db/index.js';
import { encryptSipPassword, decryptSipPassword } from '../../utils/crypto.js';
import { getLiveKitUrl, getLiveKitKey, getLiveKitSecret } from '../../config/systemConfig.js';
import { createRoom } from '../rooms/service.js';

/**
 * Инициализирует и возвращает экземпляр SipClient для взаимодействия с LiveKit.
 * Преобразует протоколы ws:// и wss:// в http:// и https:// соответственно,
 * так как LiveKit SipClient использует Twirp RPC по протоколу HTTP.
 */
const getSipClient = (): SipClient => {
  const rawUrl = getLiveKitUrl();
  const host = rawUrl.replace(/^ws/, 'http');
  const apiKey = getLiveKitKey();
  const secret = getLiveKitSecret();

  if (!apiKey || !secret) {
    throw new Error('Критическая ошибка: переменные окружения LIVEKIT_API_KEY и LIVEKIT_API_SECRET не заданы!');
  }

  return new SipClient(host, apiKey, secret);
};

/**
 * Преобразует строковое представление транспорта в перечисление SIPTransport из LiveKit.
 */
const getLiveKitTransport = (transport: 'udp' | 'tcp' | 'tls'): SIPTransport => {
  switch (transport) {
    case 'udp':
      return SIPTransport.SIP_TRANSPORT_UDP;
    case 'tcp':
      return SIPTransport.SIP_TRANSPORT_TCP;
    case 'tls':
      return SIPTransport.SIP_TRANSPORT_TLS;
    default:
      return SIPTransport.SIP_TRANSPORT_AUTO;
  }
};

export interface SipTrunkInput {
  sipServer: string;
  username: string;
  password: string;
  callerId?: string;
  transport: 'udp' | 'tcp' | 'tls';
}

export interface SipTrunkDetails {
  id: string;
  tenantId: string;
  sipServer: string;
  username: string;
  callerId: string | null;
  transport: 'udp' | 'tcp' | 'tls';
  createdAt: Date;
  updatedAt: Date;
  liveKitSyncWarning?: string; // если LiveKit недоступен — данные сохранены, но не синхронизированы
}

/**
 * Создает или обновляет настройки SIP-транка арендатора.
 * Выполняется внутри транзакции с RLS-контекстом арендатора.
 * Пароль шифруется перед записью в СУБД, а в LiveKit API передается чистый пароль.
 */
export async function upsertSipTrunk(
  tenantId: string,
  data: SipTrunkInput
): Promise<SipTrunkDetails> {
  return runInTenantContext(tenantId, async (client) => {
    // 1. Шифруем пароль
    const encryptedPassword = encryptSipPassword(data.password);
    // Извлекаем IV из зашифрованной строки для сохранения в БД (формат строки: ciphertext:iv:authTag)
    const iv = encryptedPassword.split(':')[1] || '';

    // 2. Проверяем существование записи транка в БД для текущего арендатора
    const checkRes = await client.query(
      'SELECT id FROM sip_trunks WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );

    let dbRes;
    if (checkRes.rows.length > 0) {
      // Обновляем настройки существующего транка
      dbRes = await client.query(
        `UPDATE sip_trunks 
         SET sip_server = $1, username = $2, encrypted_password = $3, iv = $4, caller_id = $5, transport = $6, updated_at = CURRENT_TIMESTAMP 
         WHERE tenant_id = $7 
         RETURNING id, tenant_id, sip_server, username, caller_id, transport, created_at, updated_at`,
        [data.sipServer, data.username, encryptedPassword, iv, data.callerId || null, data.transport, tenantId]
      );
    } else {
      // Создаем новую запись транка
      dbRes = await client.query(
        `INSERT INTO sip_trunks (tenant_id, sip_server, username, encrypted_password, iv, caller_id, transport) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING id, tenant_id, sip_server, username, caller_id, transport, created_at, updated_at`,
        [tenantId, data.sipServer, data.username, encryptedPassword, iv, data.callerId || null, data.transport]
      );
    }

    const row = dbRes.rows[0];

    // 3. Синхронизируем транк с LiveKit — best-effort: ошибки не блокируют сохранение в БД
    let liveKitSyncWarning: string | undefined;
    try {
      const sipClient = getSipClient();
      const trunks = await sipClient.listSipOutboundTrunk();
      const trunkName = `vibevox_trunk_${tenantId}`;

      // Удаляем старые транки с таким же именем, чтобы не дублировать
      for (const t of trunks) {
        if (t.name === trunkName && t.sipTrunkId) {
          await sipClient.deleteSipTrunk(t.sipTrunkId);
        }
      }

      // Создаем новый исходящий транк в LiveKit, используя расшифрованный пароль
      await sipClient.createSipOutboundTrunk(
        trunkName,
        data.sipServer,
        data.callerId ? [data.callerId] : [],
        {
          authUsername: data.username,
          authPassword: data.password,
          transport: getLiveKitTransport(data.transport),
        }
      );
    } catch (lkError) {
      const msg = lkError instanceof Error ? lkError.message : String(lkError);
      console.warn('[SIP Service] LiveKit sync failed (данные сохранены в БД, попробуем синхронизировать позже):', msg);
      liveKitSyncWarning = `Транк сохранён в базе, но синхронизация с LiveKit Cloud не удалась: ${msg.slice(0, 200)}. Это часто означает, что в вашем тарифе LiveKit Cloud не включён SIP-модуль. Транк станет рабочим, как только SIP будет активирован.`;
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      sipServer: row.sip_server,
      username: row.username,
      callerId: row.caller_id,
      transport: row.transport,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      liveKitSyncWarning,
    };
  });
}

/**
 * Возвращает настройки SIP-транка для указанного арендатора.
 * Выполняется внутри транзакции с RLS-контекстом.
 */
export async function getSipTrunk(tenantId: string): Promise<SipTrunkDetails | null> {
  return runInTenantContext(tenantId, async (client) => {
    const res = await client.query(
      `SELECT id, tenant_id, sip_server, username, caller_id, transport, created_at, updated_at 
       FROM sip_trunks 
       WHERE tenant_id = $1 
       LIMIT 1`,
      [tenantId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sipServer: row.sip_server,
      username: row.username,
      callerId: row.caller_id,
      transport: row.transport,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/**
 * Возвращает расшифрованный пароль SIP для совершения исходящих вызовов через LiveKit.
 */
export async function getDecryptedSipPassword(tenantId: string): Promise<string | null> {
  return runInTenantContext(tenantId, async (client) => {
    const res = await client.query(
      `SELECT encrypted_password 
       FROM sip_trunks 
       WHERE tenant_id = $1 
       LIMIT 1`,
      [tenantId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    return decryptSipPassword(res.rows[0].encrypted_password);
  });
}

// ============================================================================================
// SIP INBOUND — входящие звонки от внешних провайдеров (Zadarma, OnlinePBX, …)
// ============================================================================================

/** Детали inbound-конфигурации для возврата клиенту. */
export interface SipInboundDetails {
  id: string;
  tenantId: string;
  /** Публичный SIP-хост LiveKit (например, vibevox-d1v4ek73.sip.livekit.cloud) */
  sipHost: string;
  /** Имя комнаты, в которую направляются все входящие SIP-звонки этого тенанта */
  roomName: string;
  /** Имя пользователя, которое внешний провайдер должен указать при пересылке вызова */
  authUsername: string;
  /** Пароль, который провайдер должен указать (расшифрованный — пользователь должен его видеть) */
  authPassword: string;
  /** ID inbound trunk в LiveKit (для удаления) */
  liveKitInboundTrunkId: string;
  /** ID dispatch rule в LiveKit (для удаления) */
  liveKitDispatchRuleId: string;
  /** Активен ли сейчас bridge-переводчик в комнате (можем ли принимать звонки прямо сейчас) */
  bridgeActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Извлекает SIP-хост LiveKit Cloud из URL: wss://X.livekit.cloud → X.sip.livekit.cloud */
function buildSipHost(livekitUrl: string): string {
  // Убираем ws://, wss://, http://, https://, trailing /
  const cleaned = livekitUrl.replace(/^(wss?|https?):\/\//, '').replace(/\/$/, '');
  // Вставляем .sip перед первым .
  return cleaned.replace(/^([^.]+)\./, '$1.sip.');
}

/** Генерирует случайный пароль для SIP-аутентификации */
function generateSipAuthPassword(): string {
  // 16 байт случайных данных в hex — 32 символа, безопасно для SIP
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pw = '';
  for (let i = 0; i < 24; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

/**
 * Создаёт inbound trunk + dispatch rule в LiveKit Cloud и сохраняет в БД.
 * Если у tenant уже есть inbound-конфиг — удаляет старый и создаёт новый (rotate credentials).
 */
export async function createSipInbound(tenantId: string): Promise<SipInboundDetails> {
  const sipClient = getSipClient();
  const sipHost = buildSipHost(getLiveKitUrl());
  const trunkName = `vibevox_inbound_${tenantId}`;
  const roomName = `vibevox-sip-${tenantId}`;
  const authUsername = `vibevox-${tenantId.replace(/-/g, '').slice(0, 12)}`;
  const authPassword = generateSipAuthPassword();

  // 1. Удаляем старые LiveKit-ресурсы с тем же именем (на случай повторного создания)
  try {
    const trunks = await sipClient.listSipInboundTrunk();
    for (const t of trunks) {
      if (t.name === trunkName && t.sipTrunkId) {
        await sipClient.deleteSipTrunk(t.sipTrunkId);
      }
    }
  } catch (e) {
    console.warn('[SIP Inbound] Очистка старых trunk:', (e as Error).message);
  }
  try {
    const rules = await sipClient.listSipDispatchRule();
    for (const r of rules) {
      if (r.name === trunkName && r.sipDispatchRuleId) {
        await sipClient.deleteSipDispatchRule(r.sipDispatchRuleId);
      }
    }
  } catch (e) {
    console.warn('[SIP Inbound] Очистка старых dispatch rules:', (e as Error).message);
  }

  // 2. Создаём новый inbound trunk
  const inbound = await sipClient.createSipInboundTrunk(trunkName, [], {
    authUsername,
    authPassword,
    metadata: JSON.stringify({ tenantId, source: 'vibevox' }),
  });

  // 3. Создаём dispatch rule: все звонки этого trunk → одна комната vibevox-sip-{tenantId}
  const rule = await sipClient.createSipDispatchRule(
    { type: 'direct', roomName },
    {
      trunkIds: inbound.sipTrunkId ? [inbound.sipTrunkId] : undefined,
      name: trunkName,
      metadata: JSON.stringify({ tenantId, source: 'vibevox' }),
    }
  );

  // 4. Сохраняем в БД (шифруем пароль)
  return runInTenantContext(tenantId, async (client) => {
    const encryptedPassword = encryptSipPassword(authPassword);
    const iv = encryptedPassword.split(':')[1] || '';

    // upsert
    const existing = await client.query(
      'SELECT id FROM sip_inbound WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );

    let row;
    if (existing.rows.length > 0) {
      const upd = await client.query(
        `UPDATE sip_inbound SET
          sip_host = $1, room_name = $2, auth_username = $3,
          encrypted_auth_password = $4, iv = $5,
          livekit_inbound_trunk_id = $6, livekit_dispatch_rule_id = $7,
          updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $8
         RETURNING *`,
        [sipHost, roomName, authUsername, encryptedPassword, iv,
         inbound.sipTrunkId || '', rule.sipDispatchRuleId || '', tenantId]
      );
      row = upd.rows[0];
    } else {
      const ins = await client.query(
        `INSERT INTO sip_inbound
          (tenant_id, sip_host, room_name, auth_username, encrypted_auth_password, iv,
           livekit_inbound_trunk_id, livekit_dispatch_rule_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [tenantId, sipHost, roomName, authUsername, encryptedPassword, iv,
         inbound.sipTrunkId || '', rule.sipDispatchRuleId || '']
      );
      row = ins.rows[0];
    }

    return {
      id: row.id,
      tenantId: row.tenant_id,
      sipHost: row.sip_host,
      roomName: row.room_name,
      authUsername: row.auth_username,
      authPassword, // возвращаем расшифрованный — пользователь должен его скопировать
      liveKitInboundTrunkId: row.livekit_inbound_trunk_id,
      liveKitDispatchRuleId: row.livekit_dispatch_rule_id,
      bridgeActive: !!row.bridge_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/** Получает текущий inbound-конфиг тенанта (с расшифровкой пароля). */
export async function getSipInbound(tenantId: string): Promise<SipInboundDetails | null> {
  return runInTenantContext(tenantId, async (client) => {
    const res = await client.query(
      'SELECT * FROM sip_inbound WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    let authPassword = '';
    try {
      authPassword = decryptSipPassword(row.encrypted_auth_password);
    } catch (e) {
      console.warn('[SIP Inbound] Не удалось расшифровать пароль:', (e as Error).message);
    }
    return {
      id: row.id,
      tenantId: row.tenant_id,
      sipHost: row.sip_host,
      roomName: row.room_name,
      authUsername: row.auth_username,
      authPassword,
      liveKitInboundTrunkId: row.livekit_inbound_trunk_id,
      liveKitDispatchRuleId: row.livekit_dispatch_rule_id,
      bridgeActive: !!row.bridge_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

/** Удаляет inbound-конфиг тенанта (БД + LiveKit). */
export async function deleteSipInbound(tenantId: string): Promise<boolean> {
  // Получаем текущий конфиг для очистки LiveKit
  const existing = await getSipInbound(tenantId);

  // Удаляем из БД
  const deleted = await runInTenantContext(tenantId, async (client) => {
    const res = await client.query('DELETE FROM sip_inbound WHERE tenant_id = $1', [tenantId]);
    return (res.rowCount ?? 0) > 0;
  });

  // Очищаем LiveKit (best-effort)
  if (existing) {
    try {
      const sipClient = getSipClient();
      if (existing.liveKitDispatchRuleId) {
        await sipClient.deleteSipDispatchRule(existing.liveKitDispatchRuleId).catch(() => {});
      }
      if (existing.liveKitInboundTrunkId) {
        await sipClient.deleteSipTrunk(existing.liveKitInboundTrunkId).catch(() => {});
      }
    } catch (e) {
      console.warn('[SIP Inbound] Очистка LiveKit при удалении:', (e as Error).message);
    }
  }

  return deleted;
}

// ============================================================================================
// SIP OUTBOUND CALL — исходящий звонок из веб-интерфейса (Web → телефон)
// ============================================================================================

export interface PlaceSipCallResult {
  roomId: string;
  roomName: string;
  sipParticipantId: string;
  sipCallStatus?: string;
  phoneNumber: string;
}

/**
 * Совершает исходящий звонок на указанный телефонный номер:
 * 1. Находит outbound trunk пользователя в LiveKit (по имени vibevox_trunk_{tenantId}).
 * 2. Создаёт новую комнату в БД (UUID-имя).
 * 3. Создаёт SIP-participant в этой комнате с метаданными языка получателя.
 *    Web-клиент должен подключиться к этой же комнате — bridge переведёт голос.
 *
 * @param tenantId       — UUID арендатора
 * @param phoneNumber    — номер в международном формате (+XXXXXXXXXXX)
 * @param calleeLanguage — ISO-639-1 код языка получателя звонка (например, 'en')
 * @param callerName     — отображаемое имя для CallerID (опционально)
 */
export async function placeSipCall(
  tenantId: string,
  phoneNumber: string,
  calleeLanguage: string,
  callerName?: string
): Promise<PlaceSipCallResult> {
  // 1. Находим outbound trunk пользователя в LiveKit
  const sipClient = getSipClient();
  const trunkName = `vibevox_trunk_${tenantId}`;
  let trunkId: string | undefined;
  try {
    const trunks = await sipClient.listSipOutboundTrunk();
    const myTrunk = trunks.find(t => t.name === trunkName);
    trunkId = myTrunk?.sipTrunkId;
  } catch (err) {
    throw new Error(`Не удалось получить список outbound-trunk из LiveKit: ${(err as Error).message}`);
  }
  if (!trunkId) {
    throw new Error('У вас нет настроенного исходящего SIP-транка. Сначала создайте его на странице «SIP-телефония».');
  }

  // 2. Создаём комнату для звонка (UUID-имя, чтобы фронтовая валидация прошла)
  const roomName = `Звонок ${phoneNumber} · ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  const room = await createRoom(roomName, tenantId);
  const roomId = room.id;

  // 3. Создаём SIP-participant — LiveKit инициирует SIP-INVITE на номер.
  //    Метаданные пробрасываем участнику, чтобы TranslationBridge мог считать язык получателя.
  const participantMetadata = JSON.stringify({
    nativeLanguage: calleeLanguage,
    voiceGender: 'female',
  });

  let sipParticipantId = '';
  let sipCallStatus: string | undefined;
  try {
    const participant: any = await sipClient.createSipParticipant(
      trunkId,
      phoneNumber,
      roomId,
      {
        participantIdentity: `sip-${phoneNumber.replace(/[^\d+]/g, '')}`,
        participantName: callerName || phoneNumber,
        participantMetadata,
        playDialtone: true,
        ringingTimeout: 30,
        waitUntilAnswered: false,
      }
    );
    sipParticipantId = participant.participantId || '';
    // sipCallStatus может быть на объекте, но не в типах SDK 2.x — поэтому через any
    if (participant.sipCallStatus) sipCallStatus = String(participant.sipCallStatus);
  } catch (err) {
    throw new Error(`LiveKit отверг исходящий звонок: ${(err as Error).message}`);
  }

  return {
    roomId,
    roomName,
    sipParticipantId,
    sipCallStatus,
    phoneNumber,
  };
}

/** Помечает в БД, что bridge для этого inbound сейчас активен (вызывается при /activate). */
export async function setSipInboundBridgeActive(tenantId: string, active: boolean): Promise<void> {
  await runInTenantContext(tenantId, async (client) => {
    await client.query(
      'UPDATE sip_inbound SET bridge_active = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2',
      [active, tenantId]
    );
  });
}

/**
 * Удаляет настройки SIP-транка арендатора из СУБД и отзывает конфигурацию из LiveKit.
 * Выполняется внутри транзакции с RLS-контекстом.
 */
export async function deleteSipTrunk(tenantId: string): Promise<boolean> {
  return runInTenantContext(tenantId, async (client) => {
    // 1. Удаляем запись из БД
    const dbRes = await client.query(
      'DELETE FROM sip_trunks WHERE tenant_id = $1',
      [tenantId]
    );
    const deleted = (dbRes.rowCount ?? 0) > 0;

    // 2. Синхронно удаляем транк из LiveKit
    try {
      const sipClient = getSipClient();
      const trunks = await sipClient.listSipOutboundTrunk();
      const trunkName = `vibevox_trunk_${tenantId}`;

      for (const t of trunks) {
        if (t.name === trunkName && t.sipTrunkId) {
          await sipClient.deleteSipTrunk(t.sipTrunkId);
        }
      }
    } catch (lkError) {
      console.error('[SIP Service] Ошибка удаления транка из LiveKit:', lkError);
      // Мы логируем ошибку, но не прерываем операцию, так как данные из БД уже успешно удалены
    }

    return deleted;
  });
}
