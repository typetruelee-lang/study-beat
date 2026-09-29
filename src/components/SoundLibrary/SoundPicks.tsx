import { setMainSound, toggleTrack } from '../../app/actions';
import { useAppState } from '../../app/store';
import { getSound, QUICK_PICKS } from '../../sounds/catalog';
import type { UseCase } from '../../sounds/types';
import '../common/common.css';

/** One-tap sound choices on a mode screen. Ambient picks replace the main sound; noise toggles. */
export function SoundPicks({ mode }: { mode: UseCase }) {
  const tracks = useAppState((s) => s.player.tracks);
  const active = new Set(tracks.map((t) => t.id));
  return (
    <div className="chips chips--scroll" role="group" aria-label="배경음 선택">
      {QUICK_PICKS[mode].map((id) => {
        const s = getSound(id);
        if (!s) return null;
        return (
          <button
            key={id}
            type="button"
            className="chip"
            aria-pressed={active.has(id)}
            onClick={() => (s.bus === 'noise' ? toggleTrack(id) : setMainSound(id))}
          >
            <span aria-hidden="true">{s.emoji}</span>
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
