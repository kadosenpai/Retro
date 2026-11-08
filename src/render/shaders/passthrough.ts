// Shader "passthrough": vẽ nguyên texture, không lọc.
// Giai đoạn sau sẽ thêm crt.ts (màn hình lồi, scanline) cùng giao diện.
export const vertexSource = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const fragmentSource = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uBgr; // 1.0 với XRGB8888 (byte B,G,R,X)
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  gl_FragColor = vec4(uBgr > 0.5 ? c.bgr : c, 1.0);
}
`;
