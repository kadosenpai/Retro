import type { SystemProfile } from './types';

const base = import.meta.env.BASE_URL;

export const gba: SystemProfile = {
  id: 'gba',
  name: 'Game Boy Advance',
  shortName: 'GBA',

  core: {
    id: 'mgba',
    jsUrl: `${base}cores/mgba/mgba_libretro.js`,
    wasmUrl: `${base}cores/mgba/mgba_libretro.wasm`,
  },

  video: { width: 240, height: 160, fps: 59.7275, aspectRatio: 240 / 160 },
  audio: { sampleRate: 65536 },

  buttons: [
    { id: 'UP', label: '↑' },
    { id: 'DOWN', label: '↓' },
    { id: 'LEFT', label: '←' },
    { id: 'RIGHT', label: '→' },
    { id: 'A', label: 'A' },
    { id: 'B', label: 'B' },
    { id: 'L', label: 'L' },
    { id: 'R', label: 'R' },
    { id: 'START', label: 'Start' },
    { id: 'SELECT', label: 'Select' },
  ],

  extensions: ['gba', 'agb'],
  bios: {
    required: false,
    files: [{ name: 'gba_bios.bin', optional: true }],
  },
  saves: { sram: true, states: true },

  input: {
    keyboard: {
      UP: ['ArrowUp'],
      DOWN: ['ArrowDown'],
      LEFT: ['ArrowLeft'],
      RIGHT: ['ArrowRight'],
      A: ['KeyX'],
      B: ['KeyZ'],
      L: ['KeyA'],
      R: ['KeyS'],
      START: ['Enter'],
      SELECT: ['Backspace'],
    },
    gamepad: {
      UP: [12],
      DOWN: [13],
      LEFT: [14],
      RIGHT: [15],
      A: [1],
      B: [0],
      L: [4],
      R: [5],
      START: [9],
      SELECT: [8],
    },
    touch: {
      portrait: [
        { id: 'dpad', kind: 'dpad', buttons: ['UP', 'DOWN', 'LEFT', 'RIGHT'], cx: 25, cy: 50, w: 44, h: 44 },
        { id: 'A', kind: 'button', buttons: ['A'], label: 'A', cx: 87, cy: 38, w: 20, h: 20 },
        { id: 'B', kind: 'button', buttons: ['B'], label: 'B', cx: 70, cy: 58, w: 20, h: 20 },
        { id: 'L', kind: 'pill', buttons: ['L'], label: 'L', cx: 18, cy: 11, w: 28, h: 13 },
        { id: 'R', kind: 'pill', buttons: ['R'], label: 'R', cx: 82, cy: 11, w: 28, h: 13 },
        { id: 'SELECT', kind: 'pill', buttons: ['SELECT'], label: 'Select', cx: 31, cy: 85, w: 24, h: 11 },
        { id: 'menu', kind: 'menu', buttons: [], label: '▲', cx: 50, cy: 85, w: 11, h: 11 },
        { id: 'START', kind: 'pill', buttons: ['START'], label: 'Start', cx: 69, cy: 85, w: 24, h: 11 },
      ],
      landscape: [
        { id: 'dpad', kind: 'dpad', buttons: ['UP', 'DOWN', 'LEFT', 'RIGHT'], cx: 14, cy: 55, w: 40, h: 40 },
        { id: 'A', kind: 'button', buttons: ['A'], label: 'A', cx: 91, cy: 42, w: 18, h: 18 },
        { id: 'B', kind: 'button', buttons: ['B'], label: 'B', cx: 82, cy: 64, w: 18, h: 18 },
        { id: 'L', kind: 'pill', buttons: ['L'], label: 'L', cx: 11, cy: 13, w: 24, h: 11 },
        { id: 'R', kind: 'pill', buttons: ['R'], label: 'R', cx: 89, cy: 13, w: 24, h: 11 },
        { id: 'SELECT', kind: 'pill', buttons: ['SELECT'], label: 'Select', cx: 37, cy: 89, w: 22, h: 10 },
        { id: 'menu', kind: 'menu', buttons: [], label: '▲', cx: 50, cy: 89, w: 9, h: 9 },
        { id: 'START', kind: 'pill', buttons: ['START'], label: 'Start', cx: 63, cy: 89, w: 22, h: 10 },
      ],
    },
  },
};
