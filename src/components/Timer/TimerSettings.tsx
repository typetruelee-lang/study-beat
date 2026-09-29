import { useState } from 'react';
import { updateSettings } from '../../app/actions';
import { useAppState } from '../../app/store';
import { BUILTIN_ROUTINES, TIMER_PRESETS_MIN } from '../../features/routines/builtins';
import { formatClock, formatDuration } from '../../lib/format';
import type { TimerKind } from '../../storage/settings';
import { ClayButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { ScreenHeader } from '../common/ScreenHeader';
import { RoutineList } from './RoutineList';
import './timer.css';

const KINDS: { value: TimerKind; label: string; hint: string }[] = [
  { value: 'countdown', label: '카운트다운', hint: '정한 시간이 끝나면 알려줘요' },
  { value: 'countup', label: '카운트업', hint: '00:00부터 집중한 시간을 재요' },
  { value: 'goal', label: '목표시간', hint: '목표까지 남은 시간을 함께 보여줘요' },
];

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" className="icon-btn" aria-label={`${label} 늘리기`} onClick={() => onChange(value >= max ? 0 : value + 1)}>＋</button>
      <label className="stepper__value">
        <input
          inputMode="numeric"
          aria-label={label}
          value={String(value).padStart(2, '0')}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, '').slice(-2));
            onChange(Math.min(max, Number.isFinite(n) ? n : 0));
          }}
        />
        <span className="small muted">{label}</span>
      </label>
      <button type="button" className="icon-btn" aria-label={`${label} 줄이기`} onClick={() => onChange(value <= 0 ? max : value - 1)}>－</button>
    </div>
  );
}

export function TimerSettings() {
  const timer = useAppState((s) => s.settings.focusTimer);
  const set = (patch: Partial<typeof timer>) => updateSettings((s) => ({ focusTimer: { ...s.focusTimer, ...patch } }));
  const [hms, setHms] = useState(() => ({
    h: Math.floor(timer.seconds / 3600),
    m: Math.floor((timer.seconds % 3600) / 60),
    s: timer.seconds % 60,
  }));
  const customSeconds = hms.h * 3600 + hms.m * 60 + hms.s;
  const presetMin = timer.seconds % 60 === 0 && (TIMER_PRESETS_MIN as readonly number[]).includes(timer.seconds / 60) ? timer.seconds / 60 : -1;

  const pickPreset = (min: number) => {
    set({ seconds: min * 60, routineId: null });
    setHms({ h: Math.floor(min / 60), m: min % 60, s: 0 });
  };

  return (
    <div className="screen screen--bare stack">
      <ScreenHeader title="타이머" />

      <section className="stack-s" aria-label="타이머 종류">
        <h2 className="h2">타이머 종류</h2>
        <ChipGroup label="타이머 종류" value={timer.kind} onChange={(kind) => set({ kind })} options={KINDS} />
        <p className="small muted">{KINDS.find((k) => k.value === timer.kind)?.hint}</p>
      </section>

      {timer.kind !== 'countup' && (
        <>
          <section className="stack-s" aria-label="시간">
            <div className="row-between">
              <h2 className="h2">{timer.kind === 'goal' ? '목표시간' : '집중 시간'}</h2>
              <span className="h2 tabular">{formatClock(timer.seconds)}</span>
            </div>
            <ChipGroup label="시간 프리셋" value={presetMin} onChange={pickPreset} options={TIMER_PRESETS_MIN.map((m) => ({ value: m, label: m >= 60 && m % 60 === 0 ? `${m / 60}시간` : `${m}분` }))} />
          </section>

          <section className="card stack-s" aria-label="직접 설정">
            <p className="strong">직접 설정</p>
            <div className="steppers">
              <Stepper label="시간" value={hms.h} max={9} onChange={(h) => setHms({ ...hms, h })} />
              <Stepper label="분" value={hms.m} max={59} onChange={(m) => setHms({ ...hms, m })} />
              <Stepper label="초" value={hms.s} max={59} onChange={(s) => setHms({ ...hms, s })} />
            </div>
            <ClayButton variant="primary" block disabled={customSeconds < 10} onClick={() => set({ seconds: customSeconds, routineId: null })}>
              {formatClock(customSeconds)}로 설정
            </ClayButton>
          </section>
        </>
      )}

      <section className="stack-s" aria-label="휴식 시간">
        <h2 className="h2">휴식 시간</h2>
        <ChipGroup label="휴식 시간" value={timer.breakSeconds} onChange={(breakSeconds) => set({ breakSeconds })} options={[5, 10, 15, 20].map((m) => ({ value: m * 60, label: `${m}분` }))} />
      </section>

      <section className="stack-s" aria-label="루틴">
        <h2 className="h2">루틴</h2>
        <div className="routine-grid">
          {BUILTIN_ROUTINES.map((r) => {
            const selected = !timer.routineId && timer.kind === 'countdown' && timer.seconds === r.focus && timer.breakSeconds === r.rest;
            return (
              <button key={r.key} type="button" className="routine-card" aria-pressed={selected} onClick={() => set({ kind: 'countdown', seconds: r.focus, breakSeconds: r.rest, routineId: null })}>
                <span className="strong">{r.name}</span>
                <span className="small muted">{formatDuration(r.focus)} 집중<br />{formatDuration(r.rest)} 휴식</span>
              </button>
            );
          })}
        </div>
        <RoutineList />
      </section>
    </div>
  );
}
