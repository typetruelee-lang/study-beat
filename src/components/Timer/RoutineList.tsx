import { useState } from 'react';
import { saveRoutines, updateSettings } from '../../app/actions';
import { useAppState } from '../../app/store';
import { createId } from '../../lib/id';
import { formatDuration } from '../../lib/format';
import type { Routine, RoutinePhase } from '../../storage/routines';
import { ClayButton, IconButton } from '../common/ClayButton';
import { Sheet } from '../common/Sheet';
import './timer.css';

const NAME_IDEAS = ['시험공부', '영어공부', '독서', '코딩', '자격증 공부'];

function summary(r: Routine) {
  const focus = r.phases.filter((p) => p.kind === 'focus').reduce((a, p) => a + p.seconds, 0);
  return `${r.phases.map((p) => `${Math.round(p.seconds / 60)}${p.kind === 'focus' ? '집중' : '휴식'}`).join(' → ')} · 집중 ${formatDuration(focus)}`;
}

/** User routines: "50분 공부 → 10분 휴식 → 50분 공부 …" saved under a name. */
export function RoutineList() {
  const routines = useAppState((s) => s.routines);
  const selectedId = useAppState((s) => s.settings.focusTimer.routineId);
  const [editing, setEditing] = useState<Routine | null>(null);

  const select = (id: string | null) => updateSettings((s) => ({ focusTimer: { ...s.focusTimer, kind: 'countdown', routineId: id } }));

  return (
    <div className="stack-s">
      {routines.length > 0 && (
        <div className="card list" style={{ padding: '4px 16px' }}>
          {routines.map((r) => (
            <div key={r.id} className="list-item">
              <button type="button" className="cbtn cbtn--ghost" style={{ flex: 1, justifyContent: 'flex-start', padding: 0, textAlign: 'left' }} aria-pressed={selectedId === r.id} onClick={() => select(selectedId === r.id ? null : r.id)}>
                <span className="stack-s" style={{ gap: 0 }}>
                  <span className="strong" style={{ color: 'var(--ink)' }}>{selectedId === r.id ? '● ' : ''}{r.name}</span>
                  <span className="tiny muted">{summary(r)}</span>
                </span>
              </button>
              <IconButton flat aria-label={`${r.name} 편집`} onClick={() => setEditing(r)}>✎</IconButton>
            </div>
          ))}
        </div>
      )}
      <ClayButton block onClick={() => setEditing({ id: createId('r'), name: '', phases: [{ kind: 'focus', seconds: 3000 }, { kind: 'break', seconds: 600 }, { kind: 'focus', seconds: 3000 }] })}>
        ＋ 나의 루틴 만들기
      </ClayButton>
      {editing && <RoutineEditor routine={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function RoutineEditor({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const routines = useAppState((s) => s.routines);
  const selectedId = useAppState((s) => s.settings.focusTimer.routineId);
  const [name, setName] = useState(routine.name);
  const [phases, setPhases] = useState<RoutinePhase[]>(routine.phases);
  const exists = routines.some((r) => r.id === routine.id);

  const setMinutes = (i: number, min: number) => setPhases(phases.map((p, j) => (j === i ? { ...p, seconds: Math.max(1, Math.min(240, min)) * 60 } : p)));
  const save = async () => {
    const next = { id: routine.id, name: name.trim() || '나의 루틴', phases };
    await saveRoutines(exists ? routines.map((r) => (r.id === next.id ? next : r)) : [...routines, next]);
    updateSettings((s) => ({ focusTimer: { ...s.focusTimer, kind: 'countdown', routineId: next.id } }));
    onClose();
  };
  const remove = async () => {
    await saveRoutines(routines.filter((r) => r.id !== routine.id));
    if (selectedId === routine.id) updateSettings((s) => ({ focusTimer: { ...s.focusTimer, routineId: null } }));
    onClose();
  };

  return (
    <Sheet open onClose={onClose} label="루틴 편집">
      <div className="stack">
        <p className="h2">{exists ? '루틴 편집' : '나의 루틴 만들기'}</p>
        <input
          className="text-input"
          placeholder="루틴 이름 (예: 시험공부)"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          aria-label="루틴 이름"
        />
        <div className="chips">
          {NAME_IDEAS.map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={name === n} onClick={() => setName(n)}>{n}</button>
          ))}
        </div>
        <div className="stack-s">
          {phases.map((p, i) => (
            <div key={i} className="phase-row">
              <span className="strong">{i + 1}. {p.kind === 'focus' ? '📚 집중' : '☕ 휴식'}</span>
              <label className="row" style={{ gap: 6 }}>
                <input
                  className="text-input text-input--num"
                  inputMode="numeric"
                  aria-label={`${i + 1}단계 분`}
                  value={Math.round(p.seconds / 60)}
                  onChange={(e) => setMinutes(i, Number(e.target.value.replace(/\D/g, '')) || 1)}
                />
                <span className="muted">분</span>
              </label>
              <IconButton flat aria-label={`${i + 1}단계 삭제`} disabled={phases.length <= 1} onClick={() => setPhases(phases.filter((_, j) => j !== i))}>✕</IconButton>
            </div>
          ))}
        </div>
        <div className="link-row" style={{ display: 'flex', gap: 10 }}>
          <ClayButton style={{ flex: 1 }} onClick={() => setPhases([...phases, { kind: 'focus', seconds: 3000 }])}>＋ 집중</ClayButton>
          <ClayButton style={{ flex: 1 }} onClick={() => setPhases([...phases, { kind: 'break', seconds: 600 }])}>＋ 휴식</ClayButton>
        </div>
        <ClayButton variant="primary" size="lg" block onClick={save} disabled={!phases.some((p) => p.kind === 'focus')}>저장하고 선택</ClayButton>
        {exists && <ClayButton variant="ghost" onClick={remove}>루틴 삭제</ClayButton>}
      </div>
    </Sheet>
  );
}
