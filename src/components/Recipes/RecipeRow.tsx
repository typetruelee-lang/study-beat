import { useNavigate } from 'react-router-dom';
import { applyRecipe } from '../../app/actions';
import { useAppState } from '../../app/store';
import { recipesFor, type Recipe } from '../../sounds/recipes';
import type { UseCase } from '../../sounds/types';
import { RecipeCover } from './RecipeCover';
import './recipes.css';

function isActive(r: Recipe, tracks: { id: string }[], binauralOn: boolean, beat: number) {
  const ids = tracks.map((t) => t.id).sort().join(',');
  return ids === r.tracks.map((t) => t.id).sort().join(',') && (r.beat === null ? !binauralOn : binauralOn && beat === r.beat);
}

/**
 * One-tap soundscapes ("빗속 집중", "카페 몰입" …). `go` navigates to start right away
 * (home); on a mode screen the recipe just loads into the mix.
 */
export function RecipeRow({ mode, go = false, label }: { mode: UseCase; go?: boolean; label: string }) {
  const navigate = useNavigate();
  const player = useAppState((s) => s.player);
  return (
    <div className="recipe-row" role="group" aria-label={label}>
      {recipesFor(mode).map((r) => {
        const active = player.mode === mode && isActive(r, player.tracks, player.binauralOn, player.beat);
        return (
          <button
            key={r.id}
            type="button"
            className="recipe-card"
            aria-pressed={active}
            aria-label={`${r.name}: ${r.desc}`}
            onClick={() => {
              applyRecipe(r);
              if (go) navigate(mode === 'focus' ? '/focus/ready' : `/${mode}`);
            }}
          >
            <RecipeCover colors={r.colors} badge={r.beat ? `${r.beat}Hz` : '비트 없음'} active={active} />
            <span className="recipe-card__name">{r.name}</span>
            <span className="recipe-card__desc">{r.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
