import { useNavigate } from 'react-router-dom';
import { applyFavorite, deleteFavorite } from '../../app/actions';
import { useAppState } from '../../app/store';
import { getSound } from '../../sounds/catalog';
import { IconButton } from '../common/ClayButton';
import './recipes.css';

const MODE_LABEL = { focus: '집중', sleep: '수면', relax: '휴식' } as const;
const MODE_ROUTE = { focus: '/focus/ready', sleep: '/sleep', relax: '/relax' } as const;

/** 내 믹스: saved mixes, one tap to load and go to that mode. */
export function FavoriteList() {
  const navigate = useNavigate();
  const favorites = useAppState((s) => s.settings.favorites);
  if (favorites.length === 0) return <p className="small muted">마음에 드는 조합을 소리 섞기에서 ⭐ 저장하면 여기에 모여요.</p>;
  return (
    <div className="card list fav-list" style={{ padding: '4px 16px' }}>
      {favorites.map((f) => (
        <div key={f.id} className="list-item">
          <button
            type="button"
            className="cbtn cbtn--ghost"
            style={{ flex: 1, justifyContent: 'flex-start', padding: 0, textAlign: 'left', color: 'var(--ink)' }}
            onClick={() => {
              applyFavorite(f);
              navigate(MODE_ROUTE[f.mode]);
            }}
          >
            <span className="stack-s" style={{ gap: 0 }}>
              <span className="strong">⭐ {f.name}</span>
              <span className="tiny muted">
                {MODE_LABEL[f.mode]} · {f.tracks.map((t) => getSound(t.id)?.name).filter(Boolean).join(' + ') || '배경음 없음'}
                {f.binauralOn ? ` · ${f.beat}Hz` : ''}
              </span>
            </span>
          </button>
          <IconButton flat aria-label={`${f.name} 삭제`} onClick={() => deleteFavorite(f.id)}>✕</IconButton>
        </div>
      ))}
    </div>
  );
}
