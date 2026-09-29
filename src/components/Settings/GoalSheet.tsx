import { useEffect, useState } from 'react';
import { updateSettings } from '../../app/actions';
import { useAppState } from '../../app/store';
import { formatDuration } from '../../lib/format';
import { ClayButton, IconButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { Sheet } from '../common/Sheet';

export const GOAL_PRESETS = [30, 60, 120, 180, 300] as const;
export const GOAL_MIN = 10;
export const GOAL_MAX = 720;
export const GOAL_STEP = 30;

export function clampGoal(minutes: number) {
  return Math.max(GOAL_MIN, Math.min(GOAL_MAX, Math.round(minutes)));
}

/** Daily goal picker: presets + hours/minutes, used from Home and Settings. */
export function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const goal = useAppState((s) => s.settings.dailyGoalMinutes);
  const [draft, setDraft] = useState(goal);
  useEffect(() => {
    if (open) setDraft(goal);
  }, [open, goal]);
  const h = Math.floor(draft / 60);
  const m = draft % 60;
  const set = (v: number) => setDraft(clampGoal(v));

  return (
    <Sheet open={open} onClose={onClose} label="하루 목표 설정">
      <div className="stack">
        <p className="h2">하루 목표</p>
        <p className="big-time center" style={{ fontSize: 44 }} aria-live="polite">{formatDuration(draft * 60)}</p>
        <ChipGroup<number>
          label="목표 프리셋"
          value={(GOAL_PRESETS as readonly number[]).includes(draft) ? draft : -1}
          onChange={set}
          options={GOAL_PRESETS.map((v) => ({ value: v, label: formatDuration(v * 60) }))}
        />
        <div className="goal-steppers">
          <div className="goal-stepper">
            <IconButton aria-label="1시간 줄이기" onClick={() => set(draft - 60)}>－</IconButton>
            <span className="strong tabular">{h}시간</span>
            <IconButton aria-label="1시간 늘리기" onClick={() => set(draft + 60)}>＋</IconButton>
          </div>
          <div className="goal-stepper">
            <IconButton aria-label="10분 줄이기" onClick={() => set(draft - 10)}>－</IconButton>
            <span className="strong tabular">{m}분</span>
            <IconButton aria-label="10분 늘리기" onClick={() => set(draft + 10)}>＋</IconButton>
          </div>
        </div>
        <ClayButton
          variant="primary"
          size="lg"
          block
          onClick={() => {
            updateSettings({ dailyGoalMinutes: draft });
            onClose();
          }}
        >
          {formatDuration(draft * 60)}로 저장
        </ClayButton>
      </div>
    </Sheet>
  );
}
