/** Built-in focus routines (spec 10). Selecting one sets focus + break length. */
export const BUILTIN_ROUTINES = [
  { key: 'basic', name: '기본', focus: 25 * 60, rest: 5 * 60 },
  { key: 'long', name: '긴 집중', focus: 50 * 60, rest: 10 * 60 },
  { key: 'deep', name: '딥워크', focus: 90 * 60, rest: 15 * 60 },
] as const;

export const TIMER_PRESETS_MIN = [5, 10, 15, 25, 30, 45, 50, 60, 90, 120] as const;
