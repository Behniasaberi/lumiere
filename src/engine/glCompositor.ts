// GPU compositor for the try-on: recolours hair and lips in one fragment-shader pass.
// Why: canvas-2D filters run on the CPU in many browsers (and don't exist in Safari), so the old
// path was slow on phones and blew out highlights. Here every pixel keeps its own light/shadow
// (texture), but its luminance is remapped so the *average* colour lands on the chosen shade.

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

export interface HairParams {
  mask: Uint8Array; // low-res hair probability (0-255), face skin already removed
  mw: number;
  mh: number;
  rgb: [number, number, number]; // 0..1
  mean: number; // average luminance of the person's hair (0..1)
  amount: number; // 0..1 final opacity
}
export interface LipParams {
  mask: HTMLCanvasElement; // white lip shape inside the lip box
  box: [number, number, number, number]; // x, y, w, h in source pixels
  feather: number; // edge softness in source pixels
  rgb: [number, number, number];
  mean: number; // average luminance of the bare lips
  amount: number;
  gloss: number; // 0 matte .. 1 gloss highlight strength
  matte: number; // 0..1 how much to flatten natural shine
}

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() {
  uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform sampler2D uSrc, uHair, uLip;
uniform bool uHairOn, uLipOn;
uniform vec2 uHairTexel;
uniform vec3 uHairRGB;
uniform float uHairL, uHairMean, uHairAmt;
uniform vec4 uLipBox;      // in uv
uniform vec2 uLipStep;     // feather step in lip-box uv
uniform vec3 uLipRGB;
uniform float uLipL, uLipMean, uLipAmt, uGloss, uMatte;

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// soft shoulder: values above .72 roll off towards 1 instead of clipping to white
float roll(float x) { return x < 0.72 ? x : 0.72 + 0.28 * (1.0 - exp(-(x - 0.72) / 0.28)); }
// shade with a given luminance; if that overflows a channel, blend towards white keeping luminance
vec3 tint(vec3 shade, float shadeL, float l) {
  vec3 c = shade * (l / max(shadeL, 0.03));
  float mx = max(c.r, max(c.g, c.b));
  if (mx > 1.0) {
    c /= mx;
    float cl = luma(c);
    c = mix(c, vec3(1.0), clamp((l - cl) / max(1.0 - cl, 1e-3), 0.0, 1.0));
  }
  return c;
}

void main() {
  vec3 base = texture(uSrc, uv).rgb;
  vec3 col = base;
  float l = luma(base);

  if (uHairOn) {
    float m0 = texture(uHair, uv).r;
    float m = m0;
    // near an edge: joint-bilateral upsampling — the 256px mask is refined by the photo's own edges,
    // so the colour follows real strands and stops at the forehead / background
    if (m0 > 0.02 && m0 < 0.98) {
      float acc = 0.0, ws = 0.0;
      for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
          vec2 off = vec2(float(i), float(j)) * uHairTexel * 0.8;
          vec3 g = texture(uSrc, uv + off).rgb;
          vec3 d = g - base;
          float w = exp(-dot(d, d) * 30.0 - float(i * i + j * j) * 0.2);
          acc += texture(uHair, uv + off).r * w;
          ws += w;
        }
      }
      m = acc / ws;
    }
    m = smoothstep(0.28, 0.72, m);
    if (m > 0.001) {
      float t = l / uHairMean;
      float x = roll(uHairL * pow(t, 0.85));
      vec3 rc = tint(uHairRGB, uHairL, x);
      col = mix(col, rc, m * uHairAmt);
    }
  }

  if (uLipOn) {
    vec2 q = (uv - uLipBox.xy) / uLipBox.zw;
    if (q.x >= 0.0 && q.y >= 0.0 && q.x <= 1.0 && q.y <= 1.0) {
      // 5x5 gaussian feather of the crisp lip shape
      float acc = 0.0, ws = 0.0;
      for (int j = -2; j <= 2; j++) {
        for (int i = -2; i <= 2; i++) {
          float w = exp(-float(i * i + j * j) * 0.35);
          acc += texture(uLip, q + vec2(float(i), float(j)) * uLipStep).r * w;
          ws += w;
        }
      }
      // soft edge centred on the lip line
      float m = smoothstep(0.12, 0.88, acc / ws);
      float t = l / uLipMean;
      // teeth guard: much brighter than the lips and barely red → it's teeth, not lip
      float red = (base.r - 0.5 * (base.g + base.b)) / max(l, 0.05);
      float zone = texture(uLip, q).g;  // near the inner lip line only
      float teeth = zone * (1.0 - smoothstep(0.1, 0.2, red)) * smoothstep(1.06, 1.22, t) * smoothstep(0.5, 0.65, l);
      m *= 1.0 - teeth;
      if (m > 0.001) {
        float tf = mix(t, min(t, 1.1), uMatte * 0.6);       // matte: tame natural shine, keep texture
        float x = roll(uLipL * pow(tf, mix(1.0, 0.9, uMatte)));
        vec3 rc = tint(uLipRGB, uLipL, x);
        // satin / gloss: real highlights of the lips become the shine (no painted blob)
        float spec = smoothstep(1.12, 1.75, t) * uGloss;
        rc += (1.0 - rc) * spec;
        col = mix(col, rc, m * uLipAmt);
      }
    }
  }
  o = vec4(col, 1.0);
}`;

export class GLCompositor {
  readonly canvas = document.createElement("canvas");
  private gl: WebGL2RenderingContext;
  private tex: { src: WebGLTexture; hair: WebGLTexture; lip: WebGLTexture };
  private u: Record<string, WebGLUniformLocation | null> = {};
  private hairSize = [0, 0];

  static create(): GLCompositor | null {
    try {
      return new GLCompositor();
    } catch (e) {
      console.warn("WebGL2 compositor unavailable, using canvas fallback", e);
      return null;
    }
  }

  private constructor() {
    const gl = this.canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error("no webgl2");
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");

    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const mk = (unit: number) => {
      const t = gl.createTexture()!;
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tex = { src: mk(0), hair: mk(1), lip: mk(2) };
    for (const n of ["uSrc", "uHair", "uLip", "uHairOn", "uLipOn", "uHairTexel", "uHairRGB", "uHairL", "uHairMean", "uHairAmt",
      "uLipBox", "uLipStep", "uLipRGB", "uLipL", "uLipMean", "uLipAmt", "uGloss", "uMatte"]) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }
    gl.uniform1i(this.u.uSrc, 0);
    gl.uniform1i(this.u.uHair, 1);
    gl.uniform1i(this.u.uLip, 2);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  /** Renders source + look into this.canvas (same pixel size as the source). */
  render(src: Source, w: number, h: number, hair: HairParams | null, lip: LipParams | null): HTMLCanvasElement {
    const gl = this.gl, u = this.u;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex.src);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

    gl.uniform1i(u.uHairOn, hair ? 1 : 0);
    if (hair) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex.hair);
      if (this.hairSize[0] !== hair.mw || this.hairSize[1] !== hair.mh) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, hair.mw, hair.mh, 0, gl.RED, gl.UNSIGNED_BYTE, hair.mask);
        this.hairSize = [hair.mw, hair.mh];
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, hair.mw, hair.mh, gl.RED, gl.UNSIGNED_BYTE, hair.mask);
      }
      gl.uniform2f(u.uHairTexel, 1 / hair.mw, 1 / hair.mh);
      gl.uniform3fv(u.uHairRGB, hair.rgb);
      gl.uniform1f(u.uHairL, lumaOf(hair.rgb));
      gl.uniform1f(u.uHairMean, Math.max(0.03, hair.mean));
      gl.uniform1f(u.uHairAmt, hair.amount);
    }

    gl.uniform1i(u.uLipOn, lip ? 1 : 0);
    if (lip) {
      const [x, y, bw, bh] = lip.box;
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.tex.lip);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lip.mask);
      gl.uniform4f(u.uLipBox, x / w, y / h, bw / w, bh / h);
      gl.uniform2f(u.uLipStep, lip.feather / 2 / bw, lip.feather / 2 / bh);
      gl.uniform3fv(u.uLipRGB, lip.rgb);
      gl.uniform1f(u.uLipL, lumaOf(lip.rgb));
      gl.uniform1f(u.uLipMean, Math.max(0.05, lip.mean));
      gl.uniform1f(u.uLipAmt, lip.amount);
      gl.uniform1f(u.uGloss, lip.gloss);
      gl.uniform1f(u.uMatte, lip.matte);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return this.canvas;
  }
}

const lumaOf = (c: [number, number, number]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
