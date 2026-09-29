import { NavLink } from 'react-router-dom';
import './player.css';

const TABS = [
  { to: '/', icon: '🏠', label: '홈' },
  { to: '/library', icon: '🎧', label: '사운드' },
  { to: '/stats', icon: '🌱', label: '기록' },
  { to: '/settings', icon: '⚙️', label: '설정' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
