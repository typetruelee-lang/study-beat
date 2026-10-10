import { useState } from 'react';
import { openCurtain, setAutoDark, setDimFor, setKeepAwakeFor } from '../../app/actions';
import { useAppState } from '../../app/store';
import type { UseCase } from '../../sounds/types';
import { ClayButton, IconButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { Sheet } from '../common/Sheet';
import { Slider } from '../common/Slider';
import { ToggleRow } from '../common/Toggle';
import './screen.css';

const MODE_LABEL = { focus: '집중', sleep: '수면', relax: '휴식' } as const;

/** ☀ button + sheet: app brightness, the dark screen and when it comes on. */
export function ScreenControlsButton({ mode }: { mode: UseCase }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton flat aria-label="화면 설정" onClick={() => setOpen(true)}>
        <SunIcon />
      </IconButton>
      <ScreenControlsSheet mode={mode} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** "🌙 어둡게 두기" on the playback screens: the way to "turn the screen off" without stopping the sound. */
export function DarkButton({ mode }: { mode: UseCase }) {
  return (
    <ClayButton variant="ghost" onClick={openCurtain}>
      🌙 어둡게 두기 <span className="muted small">· 소리{mode === 'focus' ? '·기록' : ''} 계속</span>
    </ClayButton>
  );
}

export function ScreenControlsSheet({ mode, open, onClose }: { mode: UseCase; open: boolean; onClose: () => void }) {
  const dim = useAppState((s) => s.settings.dimByMode[mode]);
  const awake = useAppState((s) => s.settings.keepScreenOnByMode[mode]);
  const auto = useAppState((s) => s.settings.autoDarkMinutes);

  return (
    <Sheet open={open} onClose={onClose} label="화면 설정">
      <div className="stack">
        <p className="h2">화면 설정 · {MODE_LABEL[mode]}</p>

        <div className="screen-sheet__row">
          <ClayButton
            variant="primary"
            size="lg"
            block
            onClick={() => {
              onClose();
              openCurtain();
            }}
          >
            🌙 지금 어둡게 두기
          </ClayButton>
          <p className="small muted">
            화면을 끄는 대신 까맣게 두고 소리{mode === 'focus' ? '와 집중 기록' : ''}은 계속돼요. 화면을 만져도 그대로이고, 밀어야 돌아와요.
            전원 버튼으로 화면을 끄면 소리가 멈출 수 있어요.
          </p>
        </div>

        <div className="screen-sheet__row">
          <p className="strong">자동으로 어둡게</p>
          <ChipGroup<number | null>
            label="자동으로 어둡게"
            value={auto}
            onChange={setAutoDark}
            options={[
              { value: 1, label: '1분' },
              { value: 5, label: '5분' },
              { value: 10, label: '10분' },
              { value: null, label: '끔' },
            ]}
          />
          <p className="small muted">재생 중에 이 시간 동안 화면을 만지지 않으면 어둡게 바뀌어요. 그때까지 화면은 켜져 있어요.</p>
        </div>

        <div className="screen-sheet__row">
          <Slider
            label="화면 밝기"
            min={0.05}
            max={1}
            value={1 - dim}
            onChange={(v) => setDimFor(mode, 1 - v)}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="small muted">기기 밝기는 앱에서 바꿀 수 없어서, 앱 화면을 어둡게 해요.</p>
        </div>

        {auto == null && (
          <ToggleRow
            title="화면 켜짐 유지"
            description={awake ? '재생하는 동안 화면이 꺼지지 않아요.' : '기기 설정 시간이 지나면 화면이 꺼져요. 화면이 꺼지면 소리가 멈출 수 있어요.'}
            checked={awake}
            onChange={(v) => setKeepAwakeFor(mode, v)}
          />
        )}
      </div>
    </Sheet>
  );
}

function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}
