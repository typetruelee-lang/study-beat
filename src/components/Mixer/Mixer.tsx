import { useNavigate } from 'react-router-dom';
import { play, setBeatKind, setBinauralOn, setBusVolume, setMasterVolume, setTrackVolume, stopPlayback, toggleTrack } from '../../app/actions';
import { FavoriteSave } from '../Recipes/FavoriteSave';
import { bandLabel, beatLabel } from '../../app/beats';
import { useAppState } from '../../app/store';
import { getSound } from '../../sounds/catalog';
import { ClayButton, IconButton } from '../common/ClayButton';
import { ScreenHeader } from '../common/ScreenHeader';
import { Slider } from '../common/Slider';
import { ToggleRow } from '../common/Toggle';
import { SoundThumb } from '../scenes/SoundThumb';
import '../SoundLibrary/library.css';

const NOISES = [
  { id: 'noise_white', label: 'White' },
  { id: 'noise_pink', label: 'Pink' },
  { id: 'noise_brown', label: 'Brown' },
];

/** Independent levels for 집중 사운드 (binaural), 배경음 (ambient) and Noise. */
export function Mixer() {
  const navigate = useNavigate();
  const player = useAppState((s) => s.player);
  const session = useAppState((s) => s.session);
  const bus = useAppState((s) => s.settings.busVolumes);
  const master = useAppState((s) => s.settings.masterVolume);
  const kind = useAppState((s) => s.settings.beatKind);
  const ambient = player.tracks.filter((t) => getSound(t.id)?.bus === 'ambient');
  const noise = player.tracks.find((t) => getSound(t.id)?.bus === 'noise');

  return (
    <div className="screen screen--bare stack">
      <ScreenHeader title="소리 섞기" />
      {!session && (
        <ClayButton variant="primary" size="lg" block onClick={() => void (player.playing ? stopPlayback() : play())}>
          {player.playing ? '■ 미리 듣기 멈추기' : '▶ 미리 듣기'}
        </ClayButton>
      )}

      <section className="card stack-s" aria-label="집중 사운드">
        <ToggleRow
          title="집중 사운드 (Binaural Beat)"
          description={`${player.beat}Hz · ${bandLabel(player.beat)} · ${beatLabel(player.beat)}`}
          checked={player.binauralOn}
          onChange={setBinauralOn}
        />
        <Slider label="강도" value={bus.binaural} onChange={(v) => setBusVolume('binaural', v)} />
        <div className="chips" role="radiogroup" aria-label="듣는 방식">
          <button type="button" role="radio" className="chip" aria-checked={kind === 'binaural'} onClick={() => setBeatKind('binaural')}>🎧 이어폰용</button>
          <button type="button" role="radio" className="chip" aria-checked={kind === 'isochronic'} onClick={() => setBeatKind('isochronic')}>🔈 스피커용</button>
        </div>
        <ClayButton variant="ghost" onClick={() => navigate('/binaural')}>사운드 프리셋 바꾸기 ›</ClayButton>
      </section>

      <section className="card stack-s" aria-label="배경음">
        <div className="row-between">
          <h2 className="h2">배경음</h2>
          <ClayButton variant="ghost" onClick={() => navigate('/library')}>+ 추가</ClayButton>
        </div>
        {ambient.length === 0 && <p className="muted small">선택된 배경음이 없어요.</p>}
        {ambient.map((t) => {
          const s = getSound(t.id)!;
          return (
            <div key={t.id} className="mix-row">
              <SoundThumb thumb={s.thumb} id={`mx-${s.id}`} size={40} />
              <Slider label={s.name} value={t.volume} onChange={(v) => setTrackVolume(t.id, v)} />
              <IconButton flat aria-label={`${s.name} 빼기`} onClick={() => toggleTrack(t.id)}>✕</IconButton>
            </div>
          );
        })}
        <Slider label="배경음 전체" value={bus.ambient} onChange={(v) => setBusVolume('ambient', v)} />
      </section>

      <section className="card stack-s" aria-label="노이즈">
        <h2 className="h2">Noise</h2>
        <div className="chips" role="radiogroup" aria-label="노이즈 종류">
          <button type="button" role="radio" className="chip" aria-checked={!noise} onClick={() => noise && toggleTrack(noise.id)}>없음</button>
          {NOISES.map((n) => (
            <button key={n.id} type="button" role="radio" className="chip" aria-checked={noise?.id === n.id} onClick={() => noise?.id !== n.id && toggleTrack(n.id)}>
              {n.label}
            </button>
          ))}
        </div>
        {noise && <Slider label="노이즈" value={noise.volume} onChange={(v) => setTrackVolume(noise.id, v)} />}
        <Slider label="Noise 전체" value={bus.noise} onChange={(v) => setBusVolume('noise', v)} />
      </section>

      <FavoriteSave />

      <section className="card stack-s" aria-label="전체 볼륨">
        <Slider label="전체 볼륨" value={master} onChange={setMasterVolume} />
        <p className="small muted">
          오래 들을 때는 기기 볼륨을 최대의 60% 이하로 권장해요(WHO 안전 청취 기준). 집중 사운드를 켜면 배경음의 같은 음 높이 부분을
          살짝 줄여서 집중 사운드가 묻히지 않게 해요.
        </p>
      </section>
    </div>
  );
}
