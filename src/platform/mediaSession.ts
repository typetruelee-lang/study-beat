/**
 * Lock-screen / notification media controls (Media Session API), where the WebView supports it.
 */
export interface MediaInfo {
  title: string;
  mode: string;
  playing: boolean;
}

export function updateMediaSession(info: MediaInfo | null, handlers: { play: () => void; pause: () => void }) {
  const ms = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  if (!ms || typeof MediaMetadata === 'undefined') return;
  try {
    if (!info) {
      ms.metadata = null;
      ms.playbackState = 'none';
      return;
    }
    ms.metadata = new MediaMetadata({ title: info.title, artist: 'FOCUS CLAY', album: info.mode });
    ms.playbackState = info.playing ? 'playing' : 'paused';
    ms.setActionHandler('play', handlers.play);
    ms.setActionHandler('pause', handlers.pause);
  } catch {
    /* partial support */
  }
}
