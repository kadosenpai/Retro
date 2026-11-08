/** Cách Worker nhận bộ đệm âm thanh từ luồng chính. */
export type AudioAttach =
  | { transport: 'sab'; buffer: SharedArrayBuffer; capacityFrames: number }
  | { transport: 'port'; port: MessagePort; capacityFrames: number };
