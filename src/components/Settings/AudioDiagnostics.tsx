import { useEffect, useState } from 'react';
import { services } from '../../app/services';
import { isInToss } from '../../platform/toss';
import { ScreenHeader } from '../common/ScreenHeader';

const ROUTE = { direct: '직접 출력 (앱 화면이 보일 때)', background: '배경 음원 (화면 꺼짐·다른 앱)' } as const;
const time = (ms: number) => (ms ? new Date(ms).toLocaleTimeString('ko-KR', { hour12: false }) : '—');

/**
 * 소리 진단: what the sound engine is doing right now and what happened recently.
 * Meant for device tests — a screenshot of this screen shows why a sound stopped.
 */
export function AudioDiagnostics() {
  const [d, setD] = useState(() => services.audio.diagnostics());
  useEffect(() => {
    const id = setInterval(() => setD(services.audio.diagnostics()), 1000);
    return () => clearInterval(id);
  }, []);
  const rows: [string, string][] = [
    ['실행 환경', isInToss() ? '토스 앱' : '브라우저'],
    ['출력 경로', ROUTE[d.route]],
    ['오디오 상태', `${d.contextState}${d.sampleRate ? ` · ${d.sampleRate} Hz` : ''}`],
    ['화면 꺼져도 재생', d.backgroundOutput ? '켜짐' : '꺼짐'],
    ['배경 음원', d.loopReady ? `${d.loopKind === 'stream' ? `이음매 없는 스트림 · ${d.streamAhead}초 준비` : 'WAV 반복(반복마다 짧은 끊김)'} · ${d.loopUpToDate ? '최신' : '이전 믹스'} · ${d.loopPlaying ? '대기 중(재생)' : '멈춤'} · ${time(d.lastRenderAt)} (${d.lastRenderMs}ms)` : '아직 없음'],
    ['비트', d.beat ? `${d.beat.hz} Hz · ${d.beat.carrier} Hz 기준 · ${d.beat.kind === 'binaural' ? '이어폰용' : '스피커용'}` : '꺼짐'],
    ['배경음', d.tracks.join(', ') || '없음'],
    ['자동 복구', `${d.recoveries}회`],
  ];
  return (
    <div className="screen screen--bare stack">
      <ScreenHeader title="소리 진단" />
      <p className="small muted">기기에서 소리가 끊기거나 멈췄다면 이 화면을 캡처해서 보내 주세요.</p>
      <div className="card list" style={{ padding: '4px 20px' }}>
        {rows.map(([k, v]) => (
          <div key={k} className="list-item" style={{ cursor: 'default' }}>
            <span className="strong">{k}</span>
            <span className="small muted" style={{ textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <h2 className="h2">최근 기록</h2>
      <div className="card list" style={{ padding: '4px 20px' }} aria-label="최근 소리 기록">
        {d.events.length === 0 && <p className="small muted" style={{ padding: '12px 0' }}>아직 기록이 없어요.</p>}
        {[...d.events].reverse().map((e, i) => (
          <div key={`${e.at}-${i}`} className="list-item" style={{ cursor: 'default', minHeight: 40 }}>
            <span className="tiny muted tabular">{time(e.at)}</span>
            <span className="small" style={{ textAlign: 'right' }}>{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
