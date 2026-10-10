import { dismissScreenOffTip, openCurtain } from '../../app/actions';
import { useAppState } from '../../app/store';
import { ClayButton } from '../common/ClayButton';
import { Sheet } from '../common/Sheet';

/**
 * Back in the app after the system stopped the sound while the screen was off (the Toss WebView
 * can pause it): suggest the dark screen. A focus session paused by 집중 이탈 감지 says the same
 * thing in its own sheet, so this one waits.
 */
export function ScreenOffTip() {
  const open = useAppState(
    (s) => s.screenOffTip && !s.curtain && !(s.session?.status === 'paused' && s.session.pauseReason === 'away'),
  );
  return (
    <Sheet open={open} onClose={dismissScreenOffTip} label="화면이 꺼진 동안 소리가 멈췄어요">
      <div className="stack center">
        <span style={{ fontSize: 40 }} aria-hidden="true">🌙</span>
        <p className="h2">화면이 꺼진 동안 소리가 멈췄어요</p>
        <p className="muted">
          이 휴대폰에서는 화면을 끄면 소리가 멈춰요.
          <br />
          화면을 끄는 대신 <b>어둡게 두기</b>를 쓰면 화면은 까맣게, 소리는 계속돼요.
        </p>
        <ClayButton variant="primary" size="lg" block onClick={openCurtain}>
          🌙 지금 어둡게 두기
        </ClayButton>
        <ClayButton block onClick={dismissScreenOffTip}>
          닫기
        </ClayButton>
      </div>
    </Sheet>
  );
}
