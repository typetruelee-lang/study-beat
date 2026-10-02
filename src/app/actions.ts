/**
 * App actions: the only place that coordinates store ⇄ audio engine ⇄ repositories.
 * Screens call these; they never talk to the audio engine directly.
 */
import { getSound, QUICK_PICKS } from '../sounds/catalog';
import { holdPrewarm, prewarmSounds } from '../audio/prewarm';
import type { UseCase } from '../sounds/types';
import type { BeatKind, Bus } from '../audio/types';
import type { Recipe } from '../sounds/recipes';
import { createId } from '../lib/id';
import { clamp } from '../lib/format';
import {
  endSession,
  pause,
  remainingSeconds,
  resume,
  startSession as machineStart,
  tick,
  toRecord,
  type PauseReason,
  type PlanPhase,
  type SessionPlan,
  type SessionState,
} from '../features/session/sessionMachine';
import { beatForProgress } from '../features/session/autoFrequency';
import { readJson } from '../storage/KeyValueStore';
import type { Routine } from '../storage/routines';
import type { StudySession } from '../storage/sessions';
import type { FavoriteMix, Settings, TrackSetting } from '../storage/settings';
import { onVisibilityChange } from '../platform/visibility';
import { resetWakeLock, setKeepScreenOn } from '../platform/wakeLock';
import { haptic } from '../platform/haptics';
import { updateMediaSession } from '../platform/mediaSession';
import { getState, playerFor, setState, subscribe } from './store';
import { services } from './services';

const ACTIVE_SESSION_KEY = 'focusclay.activeSession.v1';
const MAX_TRACKS = 4;
const SLEEP_FADE_SECONDS = 20;
const MIN_RECORD_SECONDS = 60;

// ─── init ────────────────────────────────────────────────────────────────────

let visibilityOff: (() => void) | null = null;

export async function initApp() {
  const [settings, sessions, routines] = await Promise.all([
    services.settings.load(),
    services.sessions.list(),
    services.routines.list(),
  ]);
  setState({ ready: true, settings, sessions, routines, player: playerFor(settings, settings.lastMode) });
  await recoverInterruptedSession();
  services.audio.setBackgroundOutput(settings.backgroundPlayback);
  // Prepare the last-used mix while the user looks at the home screen.
  setTimeout(() => prewarmMode(settings.lastMode), 600);
  window.addEventListener('pagehide', flushSettings);
  visibilityOff?.();
  visibilityOff = onVisibilityChange(handleVisibility);
  mediaOff?.();
  mediaOff = subscribe(syncMediaSession);
}

// ─── lock-screen media info ──────────────────────────────────────────────────

let mediaOff: (() => void) | null = null;
let lastMediaKey = '';
const MODE_NAME = { focus: '집중', sleep: '수면', relax: '휴식' } as const;

function syncMediaSession() {
  const { player, session } = getState();
  const active = player.playing || !!session;
  const main = player.tracks.map((t) => getSound(t.id)).find((m) => m?.bus === 'ambient') ?? getSound(player.tracks[0]?.id ?? '');
  const title = main?.name ?? (player.binauralOn ? `집중 사운드 ${player.beat}Hz` : 'FOCUS CLAY');
  const key = `${active}|${title}|${player.mode}|${player.playing}`;
  if (key === lastMediaKey) return;
  lastMediaKey = key;
  updateMediaSession(active ? { title, mode: MODE_NAME[player.mode], playing: player.playing } : null, {
    play: () => void (getState().session ? resumeSession() : play()),
    pause: () => void (getState().session ? pauseSession('user') : stopPlayback()),
  });
}

// ─── screen: keep awake, dim, black screen ───────────────────────────────────

/** Keep the display on when the active mode wants it, or always while the black screen is up. */
export function applyAwake() {
  const { session, player, settings, curtain } = getState();
  const mode = session?.mode ?? player.mode;
  const active = session ? session.status === 'running' : player.playing;
  void setKeepScreenOn(curtain || (active && settings.keepScreenOnByMode[mode]));
}

export function setKeepAwakeFor(mode: UseCase, on: boolean) {
  updateSettings((s) => ({ keepScreenOnByMode: { ...s.keepScreenOnByMode, [mode]: on } }));
  applyAwake();
}

export function setDimFor(mode: UseCase, dim: number) {
  updateSettings((s) => ({ dimByMode: { ...s.dimByMode, [mode]: clamp(dim, 0, 0.85) } }));
}

export function openCurtain() {
  setState({ curtain: true });
  applyAwake();
}

export function closeCurtain() {
  setState({ curtain: false });
  applyAwake();
}

export function setBackgroundPlayback(on: boolean) {
  updateSettings({ backgroundPlayback: on });
  services.audio.setBackgroundOutput(on);
}

/** If the WebView was closed mid-session, keep what was recorded up to the last snapshot. */
async function recoverInterruptedSession() {
  const snap = await readJson<SessionState>(services.kv, ACTIVE_SESSION_KEY);
  if (!snap) return;
  await services.kv.remove(ACTIVE_SESSION_KEY);
  const ended: SessionState = { ...snap, status: 'ended', endedAt: snap.lastTickAt };
  await saveRecord(toRecord(ended));
}

/** Queue the saved mix and quick picks of a mode for background generation. */
export function prewarmMode(mode: UseCase) {
  const { settings } = getState();
  prewarmSounds([...settings.tracksByMode[mode].map((t) => t.id), ...QUICK_PICKS[mode]]);
}

// ─── settings ────────────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) {
  const current = getState().settings;
  const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
  setState({ settings: next });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSettings, 250);
}

/** Save now (also when the app is hidden or closed, so the last change is never lost). */
export function flushSettings() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  void services.settings.save(getState().settings);
}

export async function saveRoutines(routines: Routine[]) {
  setState({ routines });
  await services.routines.saveAll(routines);
}

export async function clearFocusRecords() {
  await services.sessions.clear();
  setState({ sessions: [], lastResult: null });
}

// ─── player / mixer ──────────────────────────────────────────────────────────

/** Load a mode's saved mix. Ignored while a session of another mode is running. */
export function selectMode(mode: UseCase) {
  const { player, settings, session } = getState();
  if (session && session.mode !== mode) return;
  if (player.mode !== mode) {
    setState({ player: playerFor(settings, mode, player.playing) });
    updateSettings({ lastMode: mode });
    syncAudio();
  }
}

/** Apply the desired player state to the engine (diff-based, all changes ramped). */
function syncAudio() {
  const { player, settings } = getState();
  const audio = services.audio;
  if (!player.playing) return;
  audio.setMasterVolume(settings.masterVolume);
  (Object.keys(settings.busVolumes) as Bus[]).forEach((b) => audio.setBusVolume(b, settings.busVolumes[b]));

  if (player.binauralOn) {
    const kind = settings.beatKind;
    if (audio.isBinauralOn() && audio.beatKind() === kind) audio.setBeatFrequency(player.beat);
    else audio.startBinauralBeat({ beat: player.beat, carrier: settings.carrierHz, kind });
  } else if (audio.isBinauralOn()) {
    audio.stopBinauralBeat();
  }

  const wanted = new Map(player.tracks.map((t) => [t.id, t.volume]));
  for (const id of audio.activeTrackIds()) if (!wanted.has(id)) audio.stopTrack(id);
  const active = new Set(audio.activeTrackIds());
  for (const [id, volume] of wanted) {
    const meta = getSound(id);
    if (!meta) continue;
    if (active.has(id)) audio.setTrackVolume(id, volume);
    else audio.playTrack(meta, volume);
  }
}

export async function play() {
  holdPrewarm(4000);
  await services.audio.unlock();
  const alreadyPlaying = getState().player.playing;
  setState((s) => ({ player: { ...s.player, playing: true } }));
  syncAudio();
  if (!alreadyPlaying) services.audio.fadeIn(2);
  applyAwake();
}

export async function stopPlayback() {
  setState((s) => ({ player: { ...s.player, playing: false } }));
  applyAwake();
  await services.audio.stopAll(1.2);
}

function updatePlayer(patch: Partial<ReturnType<typeof getState>['player']>) {
  setState((s) => ({ player: { ...s.player, ...patch } }));
  const { player } = getState();
  updateSettings((st) => ({
    tracksByMode: { ...st.tracksByMode, [player.mode]: player.tracks },
    binauralOnByMode: { ...st.binauralOnByMode, [player.mode]: player.binauralOn },
    beatByMode: { ...st.beatByMode, [player.mode]: player.beat },
  }));
  syncAudio();
}

/** Add or remove a sound from the current mix. Only one noise colour at a time. */
export function toggleTrack(id: string) {
  const meta = getSound(id);
  if (!meta) return;
  const { player } = getState();
  let tracks: TrackSetting[];
  if (player.tracks.some((t) => t.id === id)) {
    tracks = player.tracks.filter((t) => t.id !== id);
  } else {
    tracks = player.tracks.filter((t) => meta.bus !== 'noise' || getSound(t.id)?.bus !== 'noise');
    tracks = [...tracks, { id, volume: meta.volume }].slice(-MAX_TRACKS);
  }
  updatePlayer({ tracks });
}

/** Replace the main ambient sound (keeps noise) — used by the quick picks on mode screens. */
export function setMainSound(id: string) {
  const meta = getSound(id);
  if (!meta) return;
  const { player } = getState();
  if (meta.bus === 'noise') return toggleTrack(id);
  const noise = player.tracks.filter((t) => getSound(t.id)?.bus === 'noise');
  const current = player.tracks.find((t) => t.id === id);
  updatePlayer({ tracks: [{ id, volume: current?.volume ?? meta.volume }, ...noise] });
}

export function setTrackVolume(id: string, volume: number) {
  const tracks = getState().player.tracks.map((t) => (t.id === id ? { ...t, volume: clamp(volume, 0, 1) } : t));
  updatePlayer({ tracks });
}

export function setBusVolume(bus: Bus, volume: number) {
  updateSettings((s) => ({ busVolumes: { ...s.busVolumes, [bus]: clamp(volume, 0, 1) } }));
  syncAudio();
}

export function setMasterVolume(volume: number) {
  updateSettings({ masterVolume: clamp(volume, 0, 1) });
  services.audio.setMasterVolume(clamp(volume, 0, 1));
}

export function setCarrier(hz: number) {
  updateSettings({ carrierHz: hz });
  services.audio.setCarrierFrequency(hz);
}

/** Binaural (headphones) or isochronic (speaker-friendly). Applies live with a crossfade. */
export function setBeatKind(kind: BeatKind) {
  updateSettings({ beatKind: kind });
  syncAudio();
}

/** Load a curated soundscape into its mode's mix (saved like any manual choice). */
export function applyRecipe(recipe: Recipe) {
  const { session } = getState();
  if (session && session.mode !== recipe.mode) return;
  if (getState().player.mode !== recipe.mode) selectMode(recipe.mode);
  updateSettings((s) => ({ busVolumes: { ...s.busVolumes, binaural: recipe.intensity } }));
  updatePlayer({
    tracks: recipe.tracks.map((t) => ({ ...t })),
    binauralOn: recipe.beat !== null,
    beat: recipe.beat ?? getState().player.beat,
  });
  prewarmSounds(recipe.tracks.map((t) => t.id));
}

const MAX_FAVORITES = 12;

/** Save the current mix as "내 믹스". */
export function saveFavorite(name: string): FavoriteMix {
  const { player, settings } = getState();
  const fav: FavoriteMix = {
    id: createId('fav'),
    name: name.trim().slice(0, 20) || '내 믹스',
    mode: player.mode,
    beat: player.beat,
    binauralOn: player.binauralOn,
    tracks: player.tracks.map((t) => ({ ...t })),
    intensity: settings.busVolumes.binaural,
    createdAt: Date.now(),
  };
  updateSettings((s) => ({ favorites: [fav, ...s.favorites].slice(0, MAX_FAVORITES) }));
  flushSettings();
  return fav;
}

export function applyFavorite(fav: FavoriteMix) {
  applyRecipe({ id: fav.id, mode: fav.mode, name: fav.name, desc: '', beat: fav.binauralOn ? fav.beat : null, tracks: fav.tracks, intensity: fav.intensity, colors: ['#000', '#000'] });
  if (!fav.binauralOn) updatePlayer({ beat: fav.beat });
}

export function deleteFavorite(id: string) {
  updateSettings((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }));
}

export function setBinauralOn(on: boolean) {
  updatePlayer({ binauralOn: on });
}

export function setBeat(hz: number) {
  updatePlayer({ beat: hz });
}

// ─── sessions (timer + recording) ────────────────────────────────────────────

let ticker: ReturnType<typeof setInterval> | null = null;
let lastSnapshot = 0;

export function buildPlan(mode: UseCase, settings: Settings, routines: Routine[], overrideSeconds?: number): SessionPlan {
  const player = getState().player;
  const base = {
    mode,
    beatFrequency: player.binauralOn ? player.beat : undefined,
    ambientSound: player.tracks.find((t) => getSound(t.id)?.bus === 'ambient')?.id ?? player.tracks[0]?.id,
  };
  let phases: PlanPhase[];
  let timerKind = settings.focusTimer.kind;
  if (overrideSeconds !== undefined) {
    phases = [{ kind: 'focus', seconds: overrideSeconds }];
    timerKind = 'countdown';
  } else if (mode === 'focus') {
    const routine = routines.find((r) => r.id === settings.focusTimer.routineId);
    if (routine && timerKind === 'countdown') phases = routine.phases.map((p) => ({ ...p }));
    else if (timerKind === 'countup') phases = [{ kind: 'focus', seconds: null }];
    else phases = [{ kind: 'focus', seconds: settings.focusTimer.seconds }];
  } else if (mode === 'sleep') {
    timerKind = settings.sleepMinutes === null ? 'countup' : 'countdown';
    phases = [{ kind: 'focus', seconds: settings.sleepMinutes === null ? null : settings.sleepMinutes * 60 }];
  } else {
    timerKind = 'countdown';
    phases = [{ kind: 'focus', seconds: settings.relaxMinutes * 60 }];
  }
  return { ...base, timerKind, phases };
}

export async function startSession(mode: UseCase, opts: { seconds?: number } = {}) {
  if (getState().session) await endSessionEarly();
  // Always start from the saved mix (drops transient changes such as auto-frequency glides).
  setState((s) => ({ player: playerFor(s.settings, mode, s.player.playing) }));
  if (getState().settings.lastMode !== mode) updateSettings({ lastMode: mode });
  const { settings, routines } = getState();
  const plan = buildPlan(mode, settings, routines, opts.seconds);
  const session = machineStart(createId('s'), plan, Date.now());
  setState({ session, lastResult: null });
  // Timer first: audio start-up (context resume, media element) must never delay recording.
  startTicker();
  await play();
  applyAwake();
  scheduleSleepFade();
  haptic('tick');
}

function scheduleSleepFade() {
  const { session } = getState();
  services.audio.cancelScheduledFadeOut();
  if (!session || session.mode !== 'sleep' || session.status !== 'running') return;
  const left = remainingSeconds(session);
  if (left === null) return;
  services.audio.scheduleFadeOut(Math.max(0, left - SLEEP_FADE_SECONDS), Math.min(SLEEP_FADE_SECONDS, left));
}

function startTicker() {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(handleTick, 500);
}

function stopTicker() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

export function handleTick() {
  const { session, settings } = getState();
  if (!session) return;
  const { state: next, events } = tick(session, Date.now());
  // Commit only when something visible changes (the displayed second, status or phase).
  // Skipping is exact: the next tick measures from the last committed `lastTickAt`.
  const sec = (s: typeof session) => Math.floor(s.phaseElapsedMs / 1000);
  if (events.length === 0 && next.status === session.status && sec(next) === sec(session) && !settings.autoFrequency) return;
  setState({ session: next });

  if (settings.autoFrequency && next.mode === 'focus' && next.status === 'running' && getState().player.binauralOn) {
    const phase = next.phases[next.phaseIndex];
    if (phase.kind === 'focus' && phase.seconds) {
      const target = beatForProgress(next.phaseElapsedMs / 1000 / phase.seconds, settings.beatByMode.focus);
      if (target !== getState().player.beat) {
        setState((s) => ({ player: { ...s.player, beat: target } }));
        services.audio.setBeatFrequency(target, 20); // slow glide between stages
      }
    }
  }

  for (const e of events) {
    if (e.type === 'phaseChanged') {
      services.audio.playChime('bell');
      haptic('tick');
    }
    if (e.type === 'completed') void finishSession();
  }

  if (Date.now() - lastSnapshot > 15_000 && next.status !== 'completed') {
    lastSnapshot = Date.now();
    void services.kv.set(ACTIVE_SESSION_KEY, JSON.stringify(next));
  }
}

/**
 * Pause the timer/recording. A pause by the user also pauses the sound; an automatic pause
 * because the app went to the background ("away") keeps the sound playing — only the focus
 * record stops until the user comes back and confirms.
 */
export async function pauseSession(reason: PauseReason = 'user') {
  const { session } = getState();
  if (!session || session.status !== 'running') return;
  const keepSound = reason === 'away';
  setState((s) => ({ session: pause(session, Date.now(), reason), player: { ...s.player, playing: keepSound } }));
  void services.kv.set(ACTIVE_SESSION_KEY, JSON.stringify(getState().session));
  applyAwake();
  if (keepSound) return;
  services.audio.cancelScheduledFadeOut();
  await services.audio.suspend(0.8);
}

export async function resumeSession() {
  const { session } = getState();
  if (!session || session.status !== 'paused') return;
  setState((s) => ({ session: resume(session, Date.now()), player: { ...s.player, playing: true } }));
  if (session.pauseReason === 'away') {
    // Sound never stopped; just make sure the OS did not suspend it meanwhile.
    await services.audio.ensureRunning();
  } else {
    await services.audio.unlock();
    syncAudio();
    await services.audio.resume(1.5);
  }
  applyAwake();
  scheduleSleepFade();
}

export async function endSessionEarly() {
  const { session } = getState();
  if (!session) return;
  setState({ session: endSession(session, Date.now()) });
  await finishSession();
}

async function saveRecord(record: StudySession): Promise<boolean> {
  const seconds = record.mode === 'focus' ? record.focusedSeconds : record.activeSeconds;
  if (seconds < MIN_RECORD_SECONDS) return false;
  await services.sessions.add(record);
  setState((s) => ({ sessions: [...s.sessions, record] }));
  return true;
}

let finishing = false;

async function finishSession() {
  const { session, settings } = getState();
  if (!session || finishing) return;
  finishing = true;
  try {
    stopTicker();
    const completed = session.status === 'completed';
    const record = toRecord(session);
    await services.kv.remove(ACTIVE_SESSION_KEY);
    const saved = await saveRecord(record);
    services.audio.cancelScheduledFadeOut();
    setState({ session: null, curtain: false, lastResult: session.mode === 'focus' && saved ? record : null });
    applyAwake();

    if (session.mode === 'sleep') {
      // Natural end already faded out on the audio clock; an early stop fades now.
      await stopPlayback();
      return;
    }
    if (!completed) {
      await stopPlayback();
      return;
    }
    haptic('success');
    const end = settings.endSound;
    if (end === 'bell' || end === 'beep') services.audio.playChime(end);
    if (end === 'nature' && session.mode === 'focus') {
      // Keep the ambient bed, let the focus tone go.
      // (Transient: the next session reloads the saved mix from settings.)
      setState((s) => ({ player: { ...s.player, binauralOn: false } }));
      syncAudio();
      return;
    }
    await stopPlayback();
    if (end === 'autoBreak' && session.mode === 'focus') {
      await startSession('relax', { seconds: settings.focusTimer.breakSeconds });
    }
  } finally {
    finishing = false;
  }
}

function handleVisibility(visible: boolean) {
  const { session, settings } = getState();
  services.audio.setAppHidden(!visible);
  if (!visible) {
    flushSettings();
    if (session?.mode === 'focus' && session.status === 'running' && settings.awayDetection) {
      void pauseSession('away');
    }
    return;
  }
  resetWakeLock();
  if (getState().player.playing) void services.audio.ensureRunning();
  if (session) handleTick();
  applyAwake();
}

export function dismissResult() {
  setState({ lastResult: null });
}
