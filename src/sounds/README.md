# sounds/

Sound metadata lives here, one folder per category. Each `index.json` is an array of `SoundMeta`
(see `../sounds/types.ts`). Audio files, when added, go in `public/sounds/<category>/` and are
referenced with `"source": "file"` and `"file": "sounds/<category>/<name>.mp3"`.

Every entry **must** carry a `license` block. Before adding a recorded file, confirm:

- `commercialUse: true` — the licence allows use in a commercial service (Apps in Toss is commercial).
- `attributionRequired` — if true, fill `attribution` (and `url`); it is shown in 설정 › 사운드 출처·라이선스.

Procedurally generated sounds use `{"name": "Original (procedural)", "commercialUse": true, "attributionRequired": false}`.
Keep `synth` on a file entry as a fallback so the app still plays if the file fails to load.
