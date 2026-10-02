import { useState } from 'react';
import { saveFavorite } from '../../app/actions';
import { ClayButton } from '../common/ClayButton';
import { Sheet } from '../common/Sheet';

/** "⭐ 이 믹스 저장" → name it → appears under 내 믹스 in the sound library. */
export function FavoriteSave() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <>
      <ClayButton block onClick={() => { setName(''); setOpen(true); }}>⭐ 이 믹스 저장</ClayButton>
      {saved && <p className="small muted center" role="status">“{saved}”을(를) 내 믹스에 저장했어요</p>}
      <Sheet open={open} onClose={() => setOpen(false)} label="믹스 저장">
        <div className="stack">
          <p className="h2">내 믹스로 저장</p>
          <input className="text-input" placeholder="이름 (예: 시험기간 빗소리)" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} aria-label="믹스 이름" />
          <ClayButton
            variant="primary"
            size="lg"
            block
            onClick={() => {
              const fav = saveFavorite(name);
              setSaved(fav.name);
              setOpen(false);
            }}
          >
            저장
          </ClayButton>
        </div>
      </Sheet>
    </>
  );
}
