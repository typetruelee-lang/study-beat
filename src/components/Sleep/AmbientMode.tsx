import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { endSessionEarly, pauseSession, resumeSession, selectMode, startSession } from '../../app/actions';
import { describeSession, useMixSummary } from '../../app/hooks';
import { useAppState } from '../../app/store';
import type { UseCase } from '../../sounds/types';
import { ClayButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { ScreenHeader } from '../common/ScreenHeader';
import { SoundPicks } from '../SoundLibrary/SoundPicks';
import '../Focus/focus.css';

/** Shared layout for the Sleep and Relax screens: scene, timer choice, sounds, one big play button. */
export function AmbientMode({
  mode,
  title,
  scene,
  timerOptions,
  timerValue,
  onTimerChange,
  footnote,
}: {
  mode: Exclude<UseCase, 'focus'>;
  title: string;
  scene: (active: boolean) => ReactNode;
  timerOptions: { value: number | null; label: string }[];
  timerValue: number | null;
  onTimerChange: (v: number | null) => void;
  footnote?: string;
}) {
  const navigate = useNavigate();
  const session = useAppState((s) => s.session);
  const binauralOn = useAppState((s) => s.player.binauralOn);
  const beat = useAppState((s) => s.player.beat);
  const summary = useMixSummary();
  const mine = session?.mode === mode ? session : null;
  const other = session && session.mode !== mode ? session : null;
  useEffect(() => selectMode(mode), [mode]);

  const view = mine ? describeSession(mine) : null;
  const running = mine?.status === 'running';

  return (
    <div className="screen stack">
      <ScreenHeader title={title} />
      <div className="mode-hero">{scene(!mine || running)}</div>

      {view ? (
        <div className="stack-s">
          <p className="big-time big-time--xl">{view.bigTime}</p>
          <p className="session-status">{view.status}</p>
          {view.sub && <p className="center muted">{view.sub}</p>}
        </div>
      ) : (
        <p className="sound-line">{summary}</p>
      )}

      {!mine && (
        <section className="stack-s" aria-label="타이머">
          <h2 className="h2">타이머</h2>
          <ChipGroup label="타이머" scroll value={timerValue} onChange={onTimerChange} options={timerOptions} />
          {footnote && <p className="small muted">{footnote}</p>}
        </section>
      )}

      <section className="stack-s" aria-label="사운드">
        <h2 className="h2">사운드</h2>
        <SoundPicks mode={mode} />
        <div className="link-row">
          <ClayButton onClick={() => navigate('/binaural')}>
            🎧 {binauralOn ? `${beat}Hz 켜짐` : 'Hz 사운드'}
          </ClayButton>
          <ClayButton onClick={() => navigate('/mixer')}>🎚 소리 섞기</ClayButton>
        </div>
      </section>

      <div className="sticky-cta">
        {other ? (
          <p className="center muted small">다른 모드의 세션이 진행 중이에요. 먼저 종료해 주세요.</p>
        ) : mine ? (
          <div className="session-controls">
            <ClayButton size="lg" onClick={() => (running ? pauseSession('user') : resumeSession())}>
              {running ? '❚❚ 일시정지' : '▶ 계속'}
            </ClayButton>
            <ClayButton size="lg" variant="primary" onClick={() => void endSessionEarly()}>■ 끄기</ClayButton>
          </div>
        ) : (
          <ClayButton variant="primary" size="lg" block onClick={() => void startSession(mode)}>▶ 재생</ClayButton>
        )}
      </div>
    </div>
  );
}
