// Shader hình ảnh. Một fragment shader duy nhất, chọn kiểu qua uMode:
//   0 sharp  : lấy mẫu gần nhất (pixel thô)
//   1 smooth : lấy mẫu tuyến tính (làm mượt toàn bộ)
//   2 crisp  : "sharp bilinear" - pixel sắc, chỉ làm mượt ở mép nên không bị răng cưa khi phóng không tròn
//   3 lcd    : crisp + lưới ô điểm ảnh như màn LCD
//   4 crt    : crisp + đường quét, mặt nạ RGB, cong nhẹ, tối góc
export const vertexSource = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uBgr;     // 1.0 với XRGB8888 (byte B,G,R,X)
uniform vec2 uTexSize;  // kích thước hình gốc (pixel)
uniform float uScale;   // số pixel màn hình cho mỗi pixel gốc
uniform float uMode;

vec3 fetch(vec2 uv) {
  vec3 c = texture2D(uTex, uv).rgb;
  return uBgr > 0.5 ? c.bgr : c;
}

void main() {
  vec2 uv = vUv;
  float crt = step(3.5, uMode);
  if (crt > 0.5) {
    vec2 cc = uv * 2.0 - 1.0;
    cc *= 1.0 + 0.04 * dot(cc, cc);
    uv = cc * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }
  }

  vec2 px = uv * uTexSize;
  vec2 fl = floor(px);
  vec2 fr = px - fl;

  vec3 col;
  if (uMode < 1.5) {
    col = fetch(uv);
  } else {
    vec2 f = clamp((fr - 0.5) * uScale + 0.5, 0.0, 1.0);
    col = fetch((fl + f) / uTexSize);
  }

  // Hiệu ứng chỉ có ý nghĩa khi mỗi pixel gốc được phóng đủ lớn.
  float k = clamp((uScale - 1.5) / 2.5, 0.0, 1.0);

  if (uMode > 2.5 && uMode < 3.5) {
    vec2 e = abs(fr - 0.5) * 2.0;
    float g = smoothstep(0.7, 1.0, max(e.x, e.y));
    col *= 1.0 - 0.3 * g * k;
    col *= 1.0 + 0.06 * k;
  }

  if (crt > 0.5) {
    float s = abs(fr.y - 0.5) * 2.0;
    col *= 1.0 - 0.42 * s * s * k;
    float m = mod(floor(gl_FragCoord.x), 3.0);
    vec3 mask = vec3(m < 1.0 ? 1.0 : 0.82, (m >= 1.0 && m < 2.0) ? 1.0 : 0.82, m >= 2.0 ? 1.0 : 0.82);
    col *= mix(vec3(1.0), mask, 0.55 * k);
    vec2 cc = vUv * 2.0 - 1.0;
    col *= 1.0 - 0.28 * dot(cc, cc);
    col *= 1.12;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;
