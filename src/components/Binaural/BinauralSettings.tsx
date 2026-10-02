import { setBeat, setBinauralOn, setBusVolume, setCarrier, updateSettings } from '../../app/actions';
import { BANDS, BEAT_PRESETS, bandLabel, bandOf, CARRIER_OPTIONS, type Band } from '../../app/beats';
import { useAppState } from '../../app/store';
import { ChipGroup } from '../common/Chip';
import { ScreenHeader } from '../common/ScreenHeader';
import { Slider } from '../common/Slider';
import { ToggleRow } from '../common/Toggle';
import '../common/common.css';

const MODE_LABEL = { focus: '집중', sleep: '수면', relax: '휴식' } as const;
const BAND_ORDER: Band[] = ['delta', 'theta', 'alpha', 'beta', 'gamma'];

/** Binaural beat presets, grouped by frequency band. Named by use, never by effect. */
export function BinauralSettings() {
  const player = useAppState((s) => s.player);
  const carrier = useAppState((s) => s.settings.carrierHz);
  const volume = useAppState((s) => s.settings.busVolumes.binaural);
  const auto = useAppState((s) => s.settings.autoFrequency);

  return (
    <div className="screen screen--bare stack">
      <ScreenHeader title="집중 사운드" />
      <p className="muted">
        왼쪽과 오른쪽 귀에 아주 조금 다른 높이의 소리를 들려주는 배경 사운드예요(Binaural Beat). 두 소리의 차이가 비트 주파수(Hz)예요.
        이어폰이나 헤드폰으로 들어야 좌우 차이가 전달돼요.
      </p>

      <section className="card stack-s">
        <ToggleRow title={`${MODE_LABEL[player.mode]} 모드에서 사용`} checked={player.binauralOn} onChange={setBinauralOn} />
        <Slider label="볼륨" value={volume} onChange={(v) => setBusVolume('binaural', v)} />
      </section>

      <section className="stack-s" aria-label="사운드 프리셋">
        <h2 className="h2">사운드 프리셋</h2>
        <div className="card list" style={{ padding: '4px 20px' }} role="radiogroup" aria-label="사운드 프리셋">
          {BAND_ORDER.map((band) => {
            const presets = BEAT_PRESETS.filter((p) => bandOf(p.hz) === band);
            return (
              <div key={band} role="presentation">
                <p className="tiny faint" style={{ padding: '12px 0 2px', fontWeight: 700 }}>
                  {BANDS[band].symbol} {BANDS[band].name} · {BANDS[band].range}
                </p>
                {presets.map((p) => (
                  <button key={p.hz} type="button" role="radio" aria-checked={player.beat === p.hz} className="list-item" onClick={() => setBeat(p.hz)}>
                    <span className="stack-s" style={{ gap: 0 }}>
                      <span className="strong">{p.hz}Hz · {p.label}</span>
                      <span className="small muted">{p.hint}</span>
                      {p.note && <span className="tiny faint">{p.note}</span>}
                    </span>
                    <span aria-hidden="true" style={{ fontSize: 20, color: 'var(--primary)' }}>{player.beat === p.hz ? '●' : '○'}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <p className="small faint center tabular">
          {bandLabel(player.beat)} · 왼쪽 {carrier}Hz · 오른쪽 {carrier + player.beat}Hz
        </p>
      </section>

      <section className="card stack-s">
        <p className="strong">기본 음 높이 (왼쪽 귀)</p>
        <ChipGroup
          label="기본 음 높이"
          value={carrier}
          onChange={setCarrier}
          options={CARRIER_OPTIONS.map((hz) => ({ value: hz, label: hz === 400 ? '400Hz (기본)' : `${hz}Hz` }))}
        />
        <p className="small muted">바이노럴 비트는 400–500Hz 음에서 가장 잘 들려요. 오른쪽 귀 음 높이는 자동으로 맞춰져요.</p>
      </section>

      {player.mode === 'focus' && (
        <section className="card">
          <ToggleRow
            title="자동 주파수 변화"
            description="집중 세션 동안 알파 대역 안에서 8Hz → 기본값 → +2Hz → 기본값으로 천천히 바뀌어요."
            checked={auto}
            onChange={(v) => updateSettings({ autoFrequency: v })}
          />
        </section>
      )}

      <div className="notice">
        <span aria-hidden="true">ℹ️</span>
        <span>
          주파수 대역 이름은 국제 기준(IFCN 2020)의 구분을 따른 것으로, 소리의 비트 주파수를 나타내요. 이런 사운드에 대한 연구 결과는 엇갈리고
          느낌은 사람마다 달라요. 몰입각의 사운드는 공부·휴식·수면 환경을 위한 배경 소리이며 의료 목적의 기능이 아니에요.
        </span>
      </div>
    </div>
  );
}
