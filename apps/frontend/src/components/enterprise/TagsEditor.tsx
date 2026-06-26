/**
 * TagsEditor — компонент редактирования тегов потребностей.
 *
 * Self-contained: сам ходит в /api/need-tags за CRUD, не требует пропсов кроме token из store.
 * Позволяет: добавить, редактировать (inline), удалить тег.
 *
 * Используется в Section3QuestFlow (Этап 4) и опционально может быть встроен в любое
 * место Enterprise-настроек.
 */

import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Save, X, Loader2, AlertCircle, Tag as TagIcon } from 'lucide-react';
import { AuroraCard } from '../AuroraCard';
import { AuroraButton } from '../AuroraButton';
import { ConfirmModal } from '../ConfirmModal';
import { useAppStore } from '../../store/useAppStore';

interface Tag {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

const COLORS = [
  '#8B5CF6', // violet
  '#22d3ee', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#3b82f6', // blue
  '#a3a3a3', // gray
];

interface DraftTag {
  name: string;
  description: string;
  color: string;
}

const emptyDraft: DraftTag = { name: '', description: '', color: COLORS[0] };

export function TagsEditor() {
  const { token } = useAppStore();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New tag draft (показывается при клике "Добавить тег")
  const [draft, setDraft] = useState<DraftTag | null>(null);
  const [savingNew, setSavingNew] = useState(false);

  // Inline edit existing tag
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftTag>(emptyDraft);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete in progress
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Кастомный confirm-диалог удаления (вместо браузерного confirm())
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null);

  const headers = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      const res = await fetch('/api/need-tags', { headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTags(data.tags || []);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAdd = () => {
    setDraft({ ...emptyDraft, color: COLORS[tags.length % COLORS.length] });
  };

  const handleSaveNew = async () => {
    if (!draft || !draft.name.trim()) return;
    setSavingNew(true);
    setError(null);
    try {
      const res = await fetch('/api/need-tags', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      const newTag = await res.json();
      setTags((prev) => [...prev, newTag]);
      setDraft(null);
    } catch (e: any) {
      setError(e?.message || 'Ошибка создания тега');
    } finally {
      setSavingNew(false);
    }
  };

  const handleStartEdit = (t: Tag) => {
    setEditingId(t.id);
    setEditDraft({
      name: t.name,
      description: t.description || '',
      color: t.color || COLORS[0],
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSavingEdit(true);
    setError(null);
    try {
      const res = await fetch(`/api/need-tags/${editingId}`, {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify(editDraft),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingId(null);
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSavingEdit(false);
    }
  };

  const requestDelete = (tag: Tag) => {
    setPendingDelete(tag);
  };

  const confirmDelete = async () => {
    const tag = pendingDelete;
    if (!tag) return;
    setPendingDelete(null);
    setDeletingId(tag.id);
    setError(null);
    try {
      const res = await fetch(`/api/need-tags/${tag.id}`, { method: 'DELETE', headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTags((prev) => prev.filter((t) => t.id !== tag.id));
    } catch (e: any) {
      setError(e?.message || 'Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 size={20} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <AuroraCard className="p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} color="#ef4444" className="mt-[2px]" />
            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{error}</span>
            <button onClick={() => setError(null)}><X size={14} style={{ color: 'var(--text-muted)' }} /></button>
          </div>
        </AuroraCard>
      )}

      {tags.length === 0 && !draft && (
        <div className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Пока нет тегов потребностей. Добавьте первый — AI будет искать его в диалогах клиентов.
        </div>
      )}

      {/* List of tags */}
      <div className="space-y-2">
        {tags.map((t) => (
          <div key={t.id} className="rounded-xl p-3"
               style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)' }}>
            {editingId === t.id ? (
              <EditTagRow
                draft={editDraft}
                onChange={setEditDraft}
                onSave={handleSaveEdit}
                onCancel={() => setEditingId(null)}
                saving={savingEdit}
              />
            ) : (
              <ViewTagRow
                tag={t}
                onEdit={() => handleStartEdit(t)}
                onDelete={() => requestDelete(t)}
                deleting={deletingId === t.id}
              />
            )}
          </div>
        ))}
      </div>

      {/* New draft */}
      {draft && (
        <div className="rounded-xl p-3"
             style={{ background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.30)' }}>
          <EditTagRow
            draft={draft}
            onChange={setDraft}
            onSave={handleSaveNew}
            onCancel={() => setDraft(null)}
            saving={savingNew}
          />
        </div>
      )}

      {/* Add button */}
      {!draft && (
        <div>
          <AuroraButton variant="secondary" onClick={handleStartAdd} icon={<Plus size={14} />}>
            Добавить тег
          </AuroraButton>
        </div>
      )}

      {/* In-app confirm-диалог удаления */}
      <ConfirmModal
        open={!!pendingDelete}
        title={pendingDelete ? `Удалить тег «${pendingDelete.name}»?` : ''}
        message="Уже присвоенные клиентам теги тоже исчезнут."
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────

interface ViewTagRowProps {
  tag: Tag;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function ViewTagRow({ tag, onEdit, onDelete, deleting }: ViewTagRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="w-3 h-3 rounded-full"
              style={{ background: tag.color || 'var(--text-muted)' }} />
        <TagIcon size={14} style={{ color: tag.color || 'var(--text-muted)' }} />
        <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>
          {tag.name}
        </span>
      </div>
      <div className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {tag.description || <em style={{ color: 'var(--text-muted)' }}>без описания</em>}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onEdit}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-muted)' }}
                title="Редактировать">
          <Pencil size={13} />
        </button>
        <button onClick={onDelete} disabled={deleting}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(239,68,68,0.16)]"
                style={{ color: '#ef4444' }}
                title="Удалить">
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  );
}

interface EditTagRowProps {
  draft: DraftTag;
  onChange: (d: DraftTag) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function EditTagRow({ draft, onChange, onSave, onCancel, saving }: EditTagRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          autoFocus
          placeholder="Название тега"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value.slice(0, 64) })}
          maxLength={64}
          className="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg text-sm focus:outline-none focus:border-violet-400"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-medium)',
            color: 'var(--text-primary)',
          }}
        />
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...draft, color: c })}
              className="w-5 h-5 rounded-full transition-all"
              style={{
                background: c,
                outline: draft.color === c ? '2px solid var(--text-primary)' : 'none',
                outlineOffset: 1,
              }}
              title={c}
            />
          ))}
        </div>
      </div>
      <textarea
        placeholder="Инструкция для AI: как именно распознать упоминание этой потребности в разговоре. Например: «клиент спрашивает про юридическую помощь, договор, документы, права собственности — присваивай этот тег»."
        value={draft.description}
        onChange={(e) => onChange({ ...draft, description: e.target.value.slice(0, 1000) })}
        maxLength={1000}
        className="w-full min-h-[60px] p-2 rounded-lg text-xs resize-y focus:outline-none focus:border-violet-400"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-medium)',
          color: 'var(--text-primary)',
          fontFamily: 'ui-monospace, monospace',
        }}
      />
      <div className="flex flex-wrap gap-2 justify-end">
        <AuroraButton variant="secondary" onClick={onCancel} disabled={saving} icon={<X size={14} />}>
          Отмена
        </AuroraButton>
        <AuroraButton onClick={onSave} disabled={saving || !draft.name.trim()}
                     icon={saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </AuroraButton>
      </div>
    </div>
  );
}

export default TagsEditor;
