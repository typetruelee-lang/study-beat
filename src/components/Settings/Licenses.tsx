import { SOUNDS } from '../../sounds/catalog';
import { ScreenHeader } from '../common/ScreenHeader';

/** Every sound's source and licence, straight from its metadata. */
export function Licenses() {
  return (
    <div className="screen screen--bare stack">
      <ScreenHeader title="사운드 출처·라이선스" />
      <p className="small muted">
        현재 모든 소리는 FOCUS CLAY가 기기 안에서 실시간으로 만들어내는 자체 제작(절차적 생성) 사운드예요.
        녹음 음원이 추가되면 출처와 이용 조건이 여기에 표시돼요.
      </p>
      <div className="card list" style={{ padding: '4px 20px' }}>
        {SOUNDS.map((s) => (
          <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
            <span className="stack-s" style={{ gap: 0 }}>
              <span className="strong">{s.emoji} {s.name}</span>
              <span className="tiny muted">
                {s.license.name} · {s.source === 'synth' ? '실시간 생성' : '음원 파일'}
                {s.license.attributionRequired && s.license.attribution ? ` · ${s.license.attribution}` : ''}
              </span>
            </span>
            <span className="tiny muted">{s.license.commercialUse ? '상업적 이용 가능' : '확인 필요'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
