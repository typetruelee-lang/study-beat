import { useState } from 'react';
import { openCurtain, setDimFor, setKeepAwakeFor, updateSettings } from '../../app/actions';
import { useAppState } from '../../app/store';
import type { UseCase } from '../../sounds/types';
import { ClayButton, IconButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { Sheet } from '../common/Sheet';
import { Slider } from '../common/Slider';
import { ToggleRow } from '../common/Toggle';
import './screen.css';

const MODE_LABEL = { focus: '집중', sleep: '수면', relax: '휴식' } as const;

/** ☀ button + sheet: app brightness, keep-awake / let the screen turn off, black screen. */
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

export function ScreenControlsSheet({ mode, open, onClose }: { mode: UseCase; open: boolean; onClose: () => void }) {
  const dim = useAppState((s) => s.settings.dimByMode[mode]);
  const awake = useAppState((s) => s.settings.keepScreenOnByMode[mode]);
  const auto = useAppState((s) => s.settings.autoCurtainMinutes);

  return (
    <Sheet open={open} onClose={onClose} label="화면 설정">
      <div className="stack">
        <p className="h2">화면 설정 · {MODE_LABEL[mode]}</p>

        <div className="screen-sheet__row">
          <Slider
            label="화면 밝기"
            min={0.15}
            max={1}
            value={1 - dim}
            onChange={(v) => setDimFor(mode, 1 - v)}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <p className="small muted">기기 밝기는 앱에서 바꿀 수 없어서, 앱 화면을 어둡게 해요.</p>
        </div>

        <ToggleRow
          title="화면 켜짐 유지"
          description={
            awake
              ? '재생하는 동안 화면이 꺼지지 않아요.'
              : mode === 'focus'
                ? '기기의 화면 자동 꺼짐 시간에 맞춰 꺼져요. 꺼지면 소리는 계속되고 집중 기록은 잠시 멈춰요.'
                : '기기의 화면 자동 꺼짐 시간에 맞춰 꺼져요.'
          }
          checked={awake}
          onChange={(v) => setKeepAwakeFor(mode, v)}
        />

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
            검은 화면으로 두기
          </ClayButton>
          <p className="small muted">
            화면이 꺼진 것처럼 까맣게 두고 소리{mode === 'focus' ? '와 집중 기록' : ''}은 계속돼요. 두 번 탭하거나 길게 누르면 돌아와요.
          </p>
        </div>

        <div className="screen-sheet__row">
          <p className="strong">자동 검은 화면</p>
          <ChipGroup<number | null>
            label="자동 검은 화면"
            value={auto}
            onChange={(v) => updateSettings({ autoCurtainMinutes: v })}
            options={[
              { value: null, label: '끔' },
              { value: 1, label: '1분' },
              { value: 5, label: '5분' },
              { value: 10, label: '10분' },
            ]}
          />
          <p className="small muted">재생 중에 이 시간 동안 화면을 만지지 않으면 검은 화면으로 바뀌어요.</p>
        </div>
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
