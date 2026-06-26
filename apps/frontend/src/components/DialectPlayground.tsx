import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Play, Pause, Save, Loader2, RotateCcw,
  Scissors, Volume2, CheckCircle, AlertCircle, X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface DialectPlaygroundProps {
  dialectRuleId?: string;
  languageCode?: string;
  compiledInstruction?: string;
}

const API_BASE = window.location.port === '3000'
  ? 'http://localhost:3001/api/admin/dialects'
  : '/api/admin/dialects';

const LS_KEY = 'vibevox_playground_samples';

interface PlaygroundSample {
  audioFilename: string;
  audioUrl: string;
  clipStartMs: number;
  clipEndMs: number;
  aiTranscript: string;
  aiTranslation: string;
  expectedTranscript: string;
  expectedTranslation: string;
  testedAt: string;
}

export default function DialectPlayground({ dialectRuleId }: DialectPlaygroundProps) {
  const { token } = useAppStore();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFilename, setAudioFilename] = useState('');
  const [duration, setDuration] = useState(0);
  const [clipStart, setClipStart] = useState(0);
  const [clipEnd, setClipEnd] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiTranslation, setAiTranslation] = useState('');
  const [expectedTranscript, setExpectedTranscript] = useState('');
  const [expectedTranslation, setExpectedTranslation] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const samples: PlaygroundSample[] = JSON.parse(raw);
        if (samples.length > 0) {
          const last = samples[samples.length - 1];
          setAudioFilename(last.audioFilename);
          setAudioUrl(last.audioUrl);
          setClipStart(last.clipStartMs / 1000);
          setClipEnd(last.clipEndMs / 1000);
          setAiTranscript(last.aiTranscript);
          setAiTranslation(last.aiTranslation);
          setExpectedTranscript(last.expectedTranscript);
          setExpectedTranslation(last.expectedTranslation);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const saveToLS = useCallback((sample: PlaygroundSample) => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const samples: PlaygroundSample[] = raw ? JSON.parse(raw) : [];
      const idx = samples.findIndex(s => s.audioFilename === sample.audioFilename);
      if (idx >= 0) samples[idx] = sample; else samples.push(sample);
      localStorage.setItem(LS_KEY, JSON.stringify(samples.slice(-20)));
    } catch { /* ignore */ }
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setAudioFile(file);
    const localUrl = URL.createObjectURL(file);
    setAudioUrl(localUrl);
    setTestStatus('idle');
    setAiTranscript(''); setAiTranslation('');
    setExpectedTranscript(''); setExpectedTranslation('');
    setErrorMessage('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', file);
      if (dialectRuleId) formData.append('dialectRuleId', dialectRuleId);
      const res = await fetch(`${API_BASE}/upload-sample`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData });
      if (res.ok) { const data = await res.json(); setAudioFilename(data.filename); if (data.audioUrl) setAudioUrl(data.audioUrl); }
      else { setAudioFilename(file.name); }
    } catch { setAudioFilename(file.name); }
    finally { setUploading(false); }
  }, [dialectRuleId, token]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleTest = useCallback(async () => {
    if (!audioFilename) return;
    setTesting(true); setTestStatus('idle'); setErrorMessage('');
    try {
      const res = await fetch(`${API_BASE}/test-sample`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ audioFilename, dialectRuleId: dialectRuleId || null, clipStartMs: Math.round(clipStart * 1000), clipEndMs: Math.round(clipEnd * 1000) }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiTranscript(data.transcript || ''); setAiTranslation(data.translation || ''); setTestStatus('success');
        saveToLS({ audioFilename, audioUrl, clipStartMs: Math.round(clipStart * 1000), clipEndMs: Math.round(clipEnd * 1000), aiTranscript: data.transcript || '', aiTranslation: data.translation || '', expectedTranscript, expectedTranslation, testedAt: new Date().toISOString() });
      } else { setErrorMessage(data.error || 'Ошибка'); setTestStatus('error'); }
    } catch (err: any) { setErrorMessage(err.message || 'Ошибка сети'); setTestStatus('error'); }
    finally { setTesting(false); }
  }, [audioFilename, dialectRuleId, clipStart, clipEnd, audioUrl, expectedTranscript, expectedTranslation, saveToLS, token]);

  const handleSaveCorrection = useCallback(async () => {
    if (!audioFilename) return;
    setSavingCorrection(true);
    try { await fetch(`${API_BASE}/save-correction`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ audioFilename, expectedTranscript, expectedTranslation }) }); saveToLS({ audioFilename, audioUrl, clipStartMs: Math.round(clipStart * 1000), clipEndMs: Math.round(clipEnd * 1000), aiTranscript, aiTranslation, expectedTranscript, expectedTranslation, testedAt: new Date().toISOString() }); } catch { /* ok */ }
    setSavingCorrection(false);
  }, [audioFilename, expectedTranscript, expectedTranslation, audioUrl, clipStart, clipEnd, aiTranscript, aiTranslation, saveToLS, token]);

  const togglePlay = () => { if (!audioRef.current) return; if (isPlaying) audioRef.current.pause(); else { audioRef.current.currentTime = clipStart; audioRef.current.play(); } setIsPlaying(!isPlaying); };
  const handleTimeUpdate = () => { if (!audioRef.current) return; setCurrentTime(audioRef.current.currentTime); if (audioRef.current.currentTime >= clipEnd) { audioRef.current.pause(); setIsPlaying(false); } };
  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
  const pS = duration > 0 ? (clipStart/duration)*100 : 0;
  const pE = duration > 0 ? (clipEnd/duration)*100 : 100;
  const pH = duration > 0 ? (currentTime/duration)*100 : 0;

  return (
    <div style={{ marginTop: 24 }}>
      <style>{`@media(max-width:640px){.pg-grid{grid-template-columns:1fr!important}}`}</style>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:38, height:38, borderRadius:12, background:'linear-gradient(135deg,#F59E0B,#EF4444)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 16px rgba(245,158,11,0.3)' }}><Scissors size={20} color="#fff" strokeWidth={1.5}/></div>
        <div>
          <h3 style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:18, fontWeight:700, color:'var(--text-primary)', margin:0, letterSpacing:'-0.02em' }}>ИИ-Полигон</h3>
          <p style={{ fontSize:12, color:'var(--text-muted)', margin:'2px 0 0' }}>Загрузите аудио, выделите фрагмент и протестируйте распознавание ИИ</p>
        </div>
      </div>

      {!audioUrl ? (
        <div onDragOver={(e)=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>fileInputRef.current?.click()}
          style={{ border:`2px dashed ${dragOver?'var(--accent-orange)':'var(--border-subtle)'}`, borderRadius:16, padding:'40px 24px', textAlign:'center', cursor:'pointer', background:dragOver?'rgba(245,158,11,0.06)':'var(--bg-tertiary)', transition:'all 0.2s' }}>
          <Upload size={32} strokeWidth={1} style={{ color:'var(--text-muted)', margin:'0 auto 12px' }}/>
          <p style={{ fontSize:14, fontWeight:600, color:'var(--text-secondary)', margin:0 }}>Перетащите аудиофайл сюда</p>
          <p style={{ fontSize:12, color:'var(--text-muted)', margin:'4px 0 0' }}>или нажмите для выбора · WAV, MP3, OGG, WebM</p>
          {uploading && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:12 }}><Loader2 size={16} className="animate-spin" style={{ color:'var(--accent-orange)' }}/><span style={{ fontSize:12, color:'var(--accent-orange)' }}>Загрузка...</span></div>}
          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={(e)=>{const f=e.target.files?.[0];if(f)handleFileSelect(f);e.target.value='';}}/>
        </div>
      ) : (
        <div>
          <div style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)', borderRadius:16, padding:16, marginBottom:16 }}>
            <audio ref={audioRef} src={audioUrl} onLoadedMetadata={()=>{if(audioRef.current){setDuration(audioRef.current.duration);setClipEnd(audioRef.current.duration)}}} onTimeUpdate={handleTimeUpdate} onEnded={()=>setIsPlaying(false)} preload="metadata"/>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <button onClick={togglePlay} style={{ width:40, height:40, borderRadius:12, border:'1px solid var(--border-subtle)', background:'var(--bg-secondary)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-primary)' }}>{isPlaying?<Pause size={18}/>:<Play size={18}/>}</button>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{audioFile?.name||audioFilename}</p>
                <p style={{ fontSize:11, color:'var(--text-muted)', margin:'2px 0 0' }}>{fmt(currentTime)} / {fmt(duration)}</p>
              </div>
              <button onClick={()=>{setAudioUrl('');setAudioFile(null);setAudioFilename('');setTestStatus('idle');setAiTranscript('');setAiTranslation('')}} style={{ width:32, height:32, borderRadius:8, border:'none', background:'rgba(248,113,113,0.1)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#F87171' }}><X size={16}/></button>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><Scissors size={13} strokeWidth={1.5} style={{ color:'var(--accent-orange)' }}/><span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'var(--text-muted)' }}>Таймкоды клиппинга</span></div>
              <div style={{ height:8, borderRadius:4, position:'relative', overflow:'hidden', background:`linear-gradient(to right, var(--bg-secondary) 0%, var(--bg-secondary) ${pS}%, var(--accent-green) ${pS}%, var(--accent-green) ${pE}%, var(--bg-secondary) ${pE}%, var(--bg-secondary) 100%)`, marginBottom:8 }}>
                <div style={{ position:'absolute', top:0, bottom:0, width:2, background:'#fff', left:`${pH}%`, transition:'left 0.1s linear', boxShadow:'0 0 4px rgba(255,255,255,0.5)' }}/>
              </div>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:120 }}><label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' as const }}>Начало (сек)</label><input type="number" className="aurora-input" min={0} max={clipEnd} step={0.1} value={clipStart.toFixed(1)} onChange={(e)=>setClipStart(Math.max(0,Math.min(clipEnd,parseFloat(e.target.value)||0)))} style={{ width:'100%', fontSize:13, padding:'8px 10px', marginTop:4 }}/></div>
                <div style={{ flex:1, minWidth:120 }}><label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' as const }}>Конец (сек)</label><input type="number" className="aurora-input" min={clipStart} max={duration} step={0.1} value={clipEnd.toFixed(1)} onChange={(e)=>setClipEnd(Math.max(clipStart,Math.min(duration,parseFloat(e.target.value)||0)))} style={{ width:'100%', fontSize:13, padding:'8px 10px', marginTop:4 }}/></div>
              </div>
            </div>
            <button onClick={handleTest} disabled={testing||!audioFilename} style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:12, fontSize:14, fontWeight:700, cursor:testing?'wait':'pointer', border:'none', background:'linear-gradient(135deg,#8B5CF6,#6366F1)', color:'#fff', fontFamily:'Inter,sans-serif', opacity:testing||!audioFilename?0.6:1, transition:'opacity 0.2s', width:'100%', justifyContent:'center' }}>{testing?<Loader2 size={18} className="animate-spin"/>:<Volume2 size={18}/>}{testing?' Анализ аудио...':' Отправить на анализ ИИ'}</button>
          </div>
          {(aiTranscript||testStatus==='error')&&(
            <div style={{ marginBottom:16 }}>
              {testStatus==='error'&&<div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12, background:'rgba(248,113,113,0.08)', border:'1px solid rgba(248,113,113,0.2)', marginBottom:12 }}><AlertCircle size={16} style={{ color:'#F87171', flexShrink:0 }}/><p style={{ fontSize:12, color:'#F87171', margin:0 }}>{errorMessage}</p></div>}
              {aiTranscript&&(
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="pg-grid">
                  <div style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}><Volume2 size={14} style={{ color:'#60A5FA' }}/><span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'#60A5FA' }}>Что распознал ИИ</span></div>
                    <div style={{ marginBottom:10 }}><label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' as const }}>Транскрипт</label><div style={{ padding:'8px 12px', borderRadius:8, marginTop:4, fontSize:13, background:'rgba(0,0,0,0.3)', color:'var(--text-primary)', fontFamily:'"JetBrains Mono",monospace', lineHeight:1.5, minHeight:40, wordBreak:'break-word' }}>{aiTranscript||'—'}</div></div>
                    <div><label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' as const }}>Перевод ИИ</label><div style={{ padding:'8px 12px', borderRadius:8, marginTop:4, fontSize:13, background:'rgba(0,0,0,0.3)', color:'var(--text-secondary)', fontFamily:'"JetBrains Mono",monospace', lineHeight:1.5, minHeight:40, wordBreak:'break-word' }}>{aiTranslation||'—'}</div></div>
                  </div>
                  <div style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border-subtle)', borderRadius:14, padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}><CheckCircle size={14} style={{ color:'var(--accent-green)' }}/><span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.06em', color:'var(--accent-green)' }}>Правильный вариант</span></div>
                    <div style={{ marginBottom:10 }}><label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' as const }}>Транскрипт</label><input className="aurora-input" value={expectedTranscript} onChange={(e)=>setExpectedTranscript(e.target.value)} placeholder="Что было сказано..." style={{ width:'100%', fontSize:13, padding:'8px 10px', marginTop:4 }}/></div>
                    <div style={{ marginBottom:12 }}><label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase' as const }}>Перевод</label><input className="aurora-input" value={expectedTranslation} onChange={(e)=>setExpectedTranslation(e.target.value)} placeholder="Правильный перевод..." style={{ width:'100%', fontSize:13, padding:'8px 10px', marginTop:4 }}/></div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <button onClick={handleSaveCorrection} disabled={savingCorrection} style={{ flex:1, minWidth:100, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:'1px solid var(--accent-green)', background:'rgba(52,211,153,0.1)', color:'var(--accent-green)', fontFamily:'Inter,sans-serif' }}>{savingCorrection?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>} Сохранить</button>
                      <button onClick={handleTest} disabled={testing} style={{ flex:1, minWidth:100, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 14px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer', border:'1px solid var(--accent-orange)', background:'rgba(245,158,11,0.1)', color:'var(--accent-orange)', fontFamily:'Inter,sans-serif' }}>{testing?<Loader2 size={14} className="animate-spin"/>:<RotateCcw size={14}/>} ✨ Перетестировать</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
