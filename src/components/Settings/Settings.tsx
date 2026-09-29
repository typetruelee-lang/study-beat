import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearFocusRecords, updateSettings } from '../../app/actions';
import { useAppState } from '../../app/store';
import type { EndSound } from '../../storage/settings';
import { formatDuration } from '../../lib/format';
import { ClayButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { Sheet } from '../common/Sheet';
import { ToggleRow } from '../common/Toggle';

const GOALS = [30, 60, 120, 180, 300];
const END_SOUNDS: { value: EndSound; label: string }[] = [
  { value: 'bell', label: '부드러운 종소리' },
  { value: 'beep', label: '짧은 알림음' },
  { value: 'vibrate', label: '진동만' },
  { value: 'nature', label: '자연음으로 전환' },
  { value: 'autoBreak', label: '자동 휴식' },
];

export function Settings() {
  const navigate = useNavigate();
  const s = useAppState((st) => st.settings);
  const count = useAppState((st) => st.sessions.length);
  const [confirm, setConfirm] = useState(false);
  const [customGoal, setCustomGoal] = useState('');

  return (
    <div className="screen stack">
      <h1 className="h1" style={{ paddingTop: 8 }}>설정</h1>

      <section id="goal" className="card stack-s" aria-label="하루 목표">
        <div className="row-between">
          <h2 className="h2">하루 목표</h2>
          <span className="strong">{formatDuration(s.dailyGoalMinutes * 60)}</span>
        </div>
        <ChipGroup
          label="하루 목표"
          value={GOALS.includes(s.dailyGoalMinutes) ? s.dailyGoalMinutes : -1}
          onChange={(v) => updateSettings({ dailyGoalMinutes: v })}
          options={GOALS.map((m) => ({ value: m, label: formatDuration(m * 60) }))}
        />
        <div className="row">
          <input className="text-input" inputMode="numeric" placeholder="직접 입력 (분)" aria-label="하루 목표 직접 입력(분)" value={customGoal} onChange={(e) => setCustomGoal(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <ClayButton
            disabled={!customGoal || Number(customGoal) < 1}
            onClick={() => {
              updateSettings({ dailyGoalMinutes: Math.min(1440, Number(customGoal)) });
              setCustomGoal('');
            }}
          >
            적용
          </ClayButton>
        </div>
      </section>

      <section className="card stack-s" aria-label="타이머 종료">
        <h2 className="h2">집중이 끝나면</h2>
        <ChipGroup label="타이머 종료 방식" value={s.endSound} onChange={(v) => updateSettings({ endSound: v })} options={END_SOUNDS} />
        <p className="small muted">큰 소리 없이 부드럽게 알려줘요. 진동은 지원하는 기기에서만 동작해요.</p>
      </section>

      <section className="card" aria-label="집중 도움">
        <ToggleRow
          title="집중 이탈 감지"
          description="집중 중 FOCUS CLAY 화면을 벗어나면 기록을 잠시 멈추고, 돌아오면 이어서 할지 물어봐요. 끄면 화면을 벗어나도 시간이 계속 기록돼요."
          checked={s.awayDetection}
          onChange={(v) => updateSettings({ awayDetection: v })}
        />
        <ToggleRow
          title="집중 중 화면 켜짐 유지"
          description="지원하는 기기에서 집중하는 동안 화면이 꺼지지 않게 해요."
          checked={s.keepScreenOn}
          onChange={(v) => updateSettings({ keepScreenOn: v })}
        />
        <ToggleRow
          title="움직임 줄이기"
          description="클레이 장면의 애니메이션을 멈춰 배터리를 아껴요."
          checked={s.reduceMotion}
          onChange={(v) => updateSettings({ reduceMotion: v })}
        />
        <ToggleRow
          title="자동 주파수 변화"
          description="집중 세션 흐름에 맞춰 알파 대역(8–12Hz) 안에서 집중 사운드가 천천히 바뀌어요."
          checked={s.autoFrequency}
          onChange={(v) => updateSettings({ autoFrequency: v })}
        />
      </section>

      <section className="card list" style={{ padding: '4px 20px' }} aria-label="더 보기">
        <button type="button" className="list-item" onClick={() => navigate('/timer')}><span className="strong">타이머·루틴</span><span aria-hidden="true">›</span></button>
        <button type="button" className="list-item" onClick={() => navigate('/binaural')}><span className="strong">집중 사운드</span><span aria-hidden="true">›</span></button>
        <button type="button" className="list-item" onClick={() => navigate('/settings/licenses')}><span className="strong">사운드 출처·라이선스</span><span aria-hidden="true">›</span></button>
      </section>

      <section className="card stack-s" aria-label="데이터 관리">
        <h2 className="h2">데이터 관리</h2>
        <p className="small muted">집중 기록과 설정은 이 기기에만 저장돼요. (기록 {count}개)</p>
        <ClayButton block onClick={() => setConfirm(true)} disabled={count === 0}>집중 기록 삭제</ClayButton>
      </section>

      <div className="notice">
        <span aria-hidden="true">ℹ️</span>
        <span>FOCUS CLAY는 공부·휴식·수면을 위한 배경 사운드 앱이에요. 의료기기가 아니며, 건강 상태를 진단하거나 개선하는 기능은 없어요.</span>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} label="집중 기록 삭제 확인">
        <div className="stack center">
          <p className="h2">집중 기록을 모두 삭제할까요?</p>
          <p className="muted">삭제한 기록은 되돌릴 수 없어요. 설정은 그대로 남아요.</p>
          <ClayButton
            variant="primary"
            size="lg"
            block
            onClick={async () => {
              await clearFocusRecords();
              setConfirm(false);
            }}
          >
            삭제하기
          </ClayButton>
          <ClayButton block onClick={() => setConfirm(false)}>취소</ClayButton>
        </div>
      </Sheet>
    </div>
  );
}
