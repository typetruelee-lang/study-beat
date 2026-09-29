import { useNavigate } from 'react-router-dom';
import { endSessionEarly, resumeSession } from '../../app/actions';
import { useAppState } from '../../app/store';
import { ClayButton } from '../common/ClayButton';
import { Sheet } from '../common/Sheet';

/** Shown after returning to the app while a focus session was auto-paused (집중 이탈 감지). */
export function AwaySheet() {
  const navigate = useNavigate();
  // Select only the boolean so the sheet does not re-render on every timer tick.
  const open = useAppState((s) => s.session?.status === 'paused' && s.session.pauseReason === 'away');
  return (
    <Sheet open={open} label="집중 세션 일시정지">
      <div className="stack center">
        <span style={{ fontSize: 40 }} aria-hidden="true">⏸</span>
        <p className="h2">집중 세션이 잠시 멈췄어요</p>
        <p className="muted">
          FOCUS CLAY 화면을 벗어난 동안의 시간은 집중시간에 기록하지 않았어요.
          <br />
          이어서 집중할까요?
        </p>
        <ClayButton variant="primary" size="lg" block onClick={() => void resumeSession()}>
          집중 계속하기
        </ClayButton>
        <ClayButton
          block
          onClick={async () => {
            await endSessionEarly();
            navigate('/focus/result', { replace: true });
          }}
        >
          세션 종료
        </ClayButton>
      </div>
    </Sheet>
  );
}
