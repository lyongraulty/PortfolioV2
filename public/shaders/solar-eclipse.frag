#version 300 es
// =============================================================================
//  TOTAL SOLAR ECLIPSE — raymarched volumetric corona
// -----------------------------------------------------------------------------
//  Self-contained GLSL ES 3.00 fragment shader (WebGL2). No textures.
//
//  Uniforms expected from the host:
//    iResolution : vec3  (width, height, 1)
//    iTime       : float (seconds)
//    iMouse      : vec4  (xy = current drag position in pixels, z > 0 while
//                         the button is held) — optional, drives orbit.
//
//  SHADERTOY: delete everything between the "HOST HEADER" markers and the
//  "HOST FOOTER" markers. The rest is plain mainImage() code.
//
//  Scene (world units, right-handed, camera looks down -Z):
//
//      camera  ●───────────────►  ( moon )  ─────────────►  [ SUN + CORONA ]
//      z≈5                         z=0, r=1                 behind the moon
//
//  The moon is an opaque sphere. The sun is a solid emissive sphere surrounded
//  by a volumetric emissive corona that we raymarch. By default the sun is
//  "eclipse-locked": it is re-placed every frame on the camera→moon line, so
//  the eclipse stays total and centred however you animate the camera.
//
//  KNOBS THAT MATTER MOST (in order):
//    EXPOSURE            whole-image brightness after HDR; first thing to touch
//    RING_INTENSITY      how hard the razor limb burns
//    SUN_APPARENT_RATIO  0.97–0.995: how much of the bright limb peeks past the moon
//    OUTER_FALLOFF       streamer length (lower = longer)
//    STREAMER_STRENGTH   streamer brightness vs. the inner glow
//    TURBULENCE          straight rays (low) ↔ curling, organic plasma (high)
//    BELT_SHARPNESS      streamers bunched at the equator (high) ↔ all around (low)
//    CAM_FOV_DEG / CAM_DISTANCE   how big the moon sits in frame
// =============================================================================

// ---- HOST HEADER (remove for Shadertoy) -------------------------------------
precision highp float;
uniform vec3  iResolution;
uniform float iTime;
uniform vec4  iMouse;
out vec4 fragColor_out;
// ---- END HOST HEADER --------------------------------------------------------


// =============================================================================
//  PARAMETERS
// =============================================================================

// ---- Time / animation --------------------------------------------------------
#define TIME_SCALE          1.0     // global clock multiplier
#define CORONA_SPEED        0.015   // noise drift speed. Keep tiny: monumental, not boiling
#define CORONA_ROTATION     0.004   // slow rotation of the corona around the solar axis (rad/s)

// ---- Camera ------------------------------------------------------------------
#define CAM_TARGET          vec3(0.0, 0.0, 0.0)  // look-at point (moon centre keeps it framed)
#define CAM_DISTANCE        5.5     // camera distance from target (4–6 recommended)
#define CAM_FOV_DEG         60.0    // vertical field of view in degrees
#define CAM_ROLL            0.0     // camera roll (radians)
#define CAM_ORBIT_AMOUNT    0.05    // auto-orbit swing (radians). 0 = locked off
#define CAM_ORBIT_SPEED     0.06    // auto-orbit speed
#define CAM_PUSH_AMOUNT     0.35    // slow dolly-in distance (world units). 0 = none
#define CAM_PUSH_SPEED      0.04    // dolly ping-pong speed
#define MOUSE_ORBIT         1       // 1 = drag to orbit (uses iMouse)

// ---- Moon --------------------------------------------------------------------
#define MOON_CENTER         vec3(0.0, 0.0, 0.0)
#define MOON_RADIUS         1.0
#define MOON_COLOR          vec3(0.0016, 0.0019, 0.0026)  // faint earthshine — nearly black

// ---- Sun ---------------------------------------------------------------------
#define ECLIPSE_LOCK        1       // 1 = sun follows camera→moon line (always total, always centred)
                                    // 0 = sun is fixed at SUN_CENTER_FIXED / SUN_RADIUS_FIXED
#define SUN_BEHIND_MOON     7.0     // (lock) distance of the sun centre behind the moon
#define SUN_APPARENT_RATIO  0.985   // (lock) sun apparent size / moon apparent size. <1 = total
#define SUN_CENTER_FIXED    vec3(0.0, 0.0, -7.0)  // (no lock)
#define SUN_RADIUS_FIXED    2.32    // (no lock)
#define ECLIPSE_OFFSET      vec2(0.0, 0.0) // misalignment, in moon radii (screen x/y). Try (0.06,0.02)
#define SUN_AXIS            normalize(vec3(0.32, 1.0, 0.18))  // solar rotation axis (tilt = asymmetry)
#define SUN_DISK_INTENSITY  60.0    // photosphere brightness if it peeks out

// ---- Corona volume ------------------------------------------------------------
#define CORONA_RADIUS       4.6     // outer bound of the volume, in solar radii
#define VOLUME_STEPS        96      // max raymarch steps inside the volume (64–128)
#define SOLAR_BRIGHTNESS    1.0     // master emission multiplier
#define DENSITY_MULT        1.0     // overall corona density
#define INNER_FALLOFF       11.0    // falloff of the bright inner (K) corona. Higher = tighter
#define OUTER_FALLOFF       0.85    // falloff of the long streamers. Lower = longer
#define STREAMER_STRENGTH   1.4     // brightness of the long streamers
#define STREAMER_TAPER      0.9     // how fast streamers narrow with height
#define NOISE_SCALE         1.0     // global scale of the angular noise
#define RAY_FREQ            9.0     // frequency of fine radial filaments
#define TURBULENCE          0.55    // domain-warp amount (organic irregularity)
#define BELT_SHARPNESS      3.0     // concentration of streamers around the solar equator
#define NOISE_OCTAVES       3       // FBM octaves for filaments (3–5)
#define BLUE_DRIFT          0.55    // outer plasma drift toward pale blue (0 = none)

// ---- Limb ring -----------------------------------------------------------------
#define RING_INTENSITY      22.0    // brightness of the razor ring at the solar limb
#define RING_SHARPNESS      55.0    // radial tightness of the ring
#define RING_UNEVENNESS     0.55    // 0 = perfect ring, 1 = very patchy
#define BLOOM_STRENGTH      0.4     // lens bloom hugging the limb (bleeds slightly over the moon)
#define BLOOM_FALLOFF       16.0    // bloom radius (higher = tighter)

// ---- Diamond ring --------------------------------------------------------------
#define DIAMOND_STRENGTH    0.0     // 0 = OFF (pure totality). Try 1.0
#define DIAMOND_ANGLE       2.35    // position on the limb (radians, 0 = right, CCW)
#define DIAMOND_SIZE        0.022   // bead size (fraction of moon apparent radius)

// ---- Background ----------------------------------------------------------------
#define STAR_DENSITY        0.012   // fraction of cells that hold a star
#define STAR_BRIGHTNESS     0.035   // keep low — the eclipse must dominate
#define HAZE_STRENGTH       0.0035  // deep-space haze (0 = pure black)

// ---- Output ---------------------------------------------------------------------
#define EXPOSURE            1.0
#define GAMMA               2.2     // set 1.0 if your pipeline already does sRGB
#define VIGNETTE            0.18


// =============================================================================
//  UTILITIES — hash, value noise, FBM (all procedural)
// =============================================================================

const float PI = 3.14159265359;

float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
}

// Smooth 3D value noise in [0,1].
float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i);
    float n100 = hash13(i + vec3(1, 0, 0));
    float n010 = hash13(i + vec3(0, 1, 0));
    float n110 = hash13(i + vec3(1, 1, 0));
    float n001 = hash13(i + vec3(0, 0, 1));
    float n101 = hash13(i + vec3(1, 0, 1));
    float n011 = hash13(i + vec3(0, 1, 1));
    float n111 = hash13(i + vec3(1, 1, 1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
               mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

// Fractal Brownian motion. Rotating each octave hides the value-noise grid.
const mat3 OCT_ROT = mat3( 0.00,  0.80,  0.60,
                          -0.80,  0.36, -0.48,
                          -0.60, -0.48,  0.64);

float fbm(vec3 p, int octaves) {
    float sum = 0.0, amp = 0.5, norm = 0.0;
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        sum  += amp * noise3(p);
        norm += amp;
        p = OCT_ROT * p * 2.03;
        amp *= 0.5;
    }
    return sum / norm;
}

// Rotate vector v around unit axis k by angle a (Rodrigues).
vec3 rotateAxis(vec3 v, vec3 k, float a) {
    float c = cos(a), s = sin(a);
    return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}


// =============================================================================
//  CAMERA
// -----------------------------------------------------------------------------
//  Classic look-at basis:
//    forward = normalize(target - origin)
//    right   = normalize(cross(forward, worldUp))
//    up      = cross(right, forward)
//  A pixel's ray is   normalize(uv.x * right + uv.y * up + focal * forward)
//  where uv is centred on screen (0,0) and spans [-0.5, 0.5] vertically.
//  Because the target is the moon centre, the eclipse is always in the middle
//  of frame no matter how the origin is animated.
// =============================================================================

mat3 lookAt(vec3 ro, vec3 ta, float roll) {
    vec3 f  = normalize(ta - ro);
    vec3 wu = vec3(sin(roll), cos(roll), 0.0);
    vec3 r  = normalize(cross(f, wu));
    vec3 u  = cross(r, f);
    return mat3(r, u, f);           // columns: right, up, forward
}

// Vertical FOV → focal length for uv in [-0.5, 0.5].
float focalFromFov(float fovDeg) {
    return 0.5 / tan(radians(fovDeg) * 0.5);
}

// Camera origin: spherical orbit around the target + optional slow push-in.
vec3 cameraOrigin(float t) {
    float yaw   = CAM_ORBIT_AMOUNT * sin(t * CAM_ORBIT_SPEED);
    float pitch = CAM_ORBIT_AMOUNT * 0.45 * sin(t * CAM_ORBIT_SPEED * 0.71 + 1.3);
#if MOUSE_ORBIT
    if (iMouse.z > 0.0) {
        vec2 m = iMouse.xy / iResolution.xy - 0.5;
        yaw   += m.x * 1.2;
        pitch += m.y * 0.6;
    }
#endif
    float dist = CAM_DISTANCE - CAM_PUSH_AMOUNT * (0.5 - 0.5 * cos(t * CAM_PUSH_SPEED));
    vec3 dir = vec3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch));
    return CAM_TARGET + dir * dist;
}


// =============================================================================
//  RAY / SPHERE INTERSECTION
// -----------------------------------------------------------------------------
//  Solve |ro + t·rd - c|² = r²  (rd normalised)  →  t² + 2bt + c' = 0.
//  Returns (tNear, tFar); tNear > tFar means no hit. The ray may start inside
//  the sphere (tNear < 0) — callers clamp to 0.
// =============================================================================

vec2 sphereIntersect(vec3 ro, vec3 rd, vec3 c, float r) {
    vec3  oc = ro - c;
    float b  = dot(oc, rd);
    float h  = b * b - (dot(oc, oc) - r * r);
    if (h < 0.0) return vec2(1e9, -1e9);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
}


// =============================================================================
//  CORONA DENSITY FIELD
// -----------------------------------------------------------------------------
//  Evaluated in sun-local space where the sun has radius 1:
//      r = |p|       h = r - 1  (height above the photosphere, in solar radii)
//      n = p / r     (direction from the sun centre)
//
//  Key idea for long rays: noise is sampled mainly on the DIRECTION n, with
//  only a small dependence on height h. Features therefore stay coherent as
//  you move outward, which stretches them into radial streamers.
//
//    inner  = exp(-h·INNER_FALLOFF)      bright, tight K-corona hugging the limb
//    outer  = exp(-h·OUTER_FALLOFF)      long faint streamers
//    belt   = equatorial concentration   (helmet streamers sit near the equator)
//    lobes  = low-frequency FBM          picks a few strong streamers, kills symmetry
//    rays   = high-freq angular FBM      fine filaments / polar plumes
//    taper  = mask^(1 + h·TAPER)         streamers narrow as they extend
// =============================================================================

float gT;   // animated time, set once in mainImage

float coronaDensity(vec3 p) {
    float r = length(p);
    float h = r - 1.0;
    if (h < 0.0) return 0.0;

    // Solar rotation — the whole field turns very slowly.
    p = rotateAxis(p, SUN_AXIS, gT * CORONA_ROTATION);
    vec3 n = p / r;
    float drift = gT * CORONA_SPEED;

    // Domain warp: bend directions with cheap low-frequency noise so the
    // streamers curve and fork instead of being dead straight.
    vec3 wp = n * (2.2 * NOISE_SCALE) + vec3(0.0, drift, h * 0.06);
    vec3 warp = vec3(noise3(wp), noise3(wp + 17.3), noise3(wp + 41.7)) - 0.5;
    vec3 nw = normalize(n + warp * TURBULENCE * (0.3 + 0.08 * h));

    // Large-scale structure: equatorial belt × a few random lobes.
    float lat   = dot(nw, SUN_AXIS);
    float belt  = exp(-lat * lat * BELT_SHARPNESS * 2.0);
    float lobes = fbm(nw * (1.6 * NOISE_SCALE) + vec3(3.1, 7.7, drift * 0.5), 3);
    lobes = smoothstep(0.38, 0.72, lobes);
    float mask  = mix(0.03, 1.0, belt * lobes);
    mask += 0.35 * lobes * (1.0 - belt) * smoothstep(0.6, 0.95, abs(lat)); // faint polar plumes
    mask  = pow(clamp(mask, 0.0, 1.0), 1.0 + h * STREAMER_TAPER);         // taper with height

    // Fine radial filaments: high angular frequency, very slow change in h.
    vec3 rp = nw * (RAY_FREQ * NOISE_SCALE) + SUN_AXIS * (h * 0.12) + vec3(drift * 2.0);
    float rays = fbm(rp, NOISE_OCTAVES);
    rays = 0.08 + 3.2 * rays * rays * rays;

    float inner = exp(-h * INNER_FALLOFF) * (0.45 + 0.55 * rays) * (0.45 + 0.9 * lobes) * 0.95;
    float outer = exp(-h * OUTER_FALLOFF) * mask * rays * STREAMER_STRENGTH;

    // Soft fade at the volume bound so the march never shows a hard edge.
    float fade = 1.0 - smoothstep(CORONA_RADIUS * 0.55, CORONA_RADIUS, r);
    return (inner + 0.55 * outer) * fade * DENSITY_MULT;
}

// Cheap upper bound of the density at height h (no noise) — used for early exit.
float coronaEnvelope(float h) {
    return (exp(-h * INNER_FALLOFF) * 1.6 + exp(-h * OUTER_FALLOFF) * STREAMER_STRENGTH * 1.2)
           * DENSITY_MULT;
}

// Emission colour by height: white core → warm white → faint pale blue.
vec3 coronaColor(float h) {
    vec3 c = mix(vec3(1.0, 0.99, 0.97), vec3(1.0, 0.91, 0.78), smoothstep(0.03, 0.9, h));
    return mix(c, vec3(0.74, 0.84, 1.0), smoothstep(1.2, 3.5, h) * BLUE_DRIFT);
}


// =============================================================================
//  VOLUME INTEGRATION
// -----------------------------------------------------------------------------
//  The corona is optically thin, so we only ADD emission (no absorption):
//        L = ∫ color(h) · density(p) · SOLAR_BRIGHTNESS  dt
//  - March only between the entry/exit points of the corona bounding sphere.
//  - Stop at the sun's surface if the ray hits it.
//  - Adaptive step: small near the sun where density changes fast, larger
//    far out where it is smooth. A per-pixel jitter hides step banding.
//  - Points in front of the moon's plane are masked out: the corona exists
//    behind the occluder, never between camera and moon.
//  - Early exit once the ray is heading away from the sun and the remaining
//    possible contribution is negligible.
// =============================================================================

vec3 marchCorona(vec3 ro, vec3 rd, vec3 sunC, float sunR, float tStop, float jitter) {
    // Work in sun-local units (sun radius = 1).
    vec3 lo = (ro - sunC) / sunR;
    vec2 tb = sphereIntersect(lo, rd, vec3(0.0), CORONA_RADIUS);
    if (tb.x > tb.y || tb.y < 0.0) return vec3(0.0);

    float t0 = max(tb.x, 0.0);
    float t1 = min(tb.y, tStop / sunR);

    // Moon plane mask (in sun-local units).
    vec3  mN = normalize(ro - MOON_CENTER);
    vec3  mC = (MOON_CENTER - sunC) / sunR;

    vec3  acc = vec3(0.0);
    float t   = t0;

    for (int i = 0; i < VOLUME_STEPS; i++) {
        if (t > t1) break;

        // Adaptive step size (solar radii), from the height at the step start.
        float hs = length(lo + rd * t) - 1.0;
        float dt = clamp(0.04 + 0.2 * hs, 0.04, 0.32);
        dt = min(dt, t1 - t + 1e-4);

        // Sample at a jittered point inside this step (hides step banding).
        vec3  p = lo + rd * (t + dt * jitter);
        float r = length(p);
        float h = r - 1.0;

        float front = dot(p - mC, mN);                       // > 0 → in front of the moon
        float vis   = 1.0 - smoothstep(-0.15, 0.25, front);

        if (vis > 0.0) {
            float d = coronaDensity(p);
            acc += coronaColor(h) * d * vis * dt;
        }

        // Early termination: moving outward and nothing meaningful left.
        if (dot(p, rd) > 0.0 && coronaEnvelope(h) * (t1 - t) < 2e-3) break;

        t += dt;
    }
    return acc * SOLAR_BRIGHTNESS;
}


// =============================================================================
//  LIMB RING (analytic)
// -----------------------------------------------------------------------------
//  The chromosphere / innermost corona is far thinner than any sane march step,
//  so we integrate it analytically. For a shell with density exp(-k·h), the
//  line integral along a ray with impact parameter b (closest approach, in
//  solar radii) is approximately
//        exp(-k·(b-1)) · sqrt(2π·b / k)
//  — a true 3D volumetric result, giving the photographic limb brightening
//  with a razor inner edge and an exponential outer fade.
// =============================================================================

float limbRing(vec3 ro, vec3 rd, vec3 sunC, float sunR, out vec3 closestDir) {
    vec3  oc = sunC - ro;
    float tc = dot(oc, rd);
    vec3  q  = ro + rd * tc - sunC;           // closest-approach offset
    float b  = length(q) / sunR;
    closestDir = q / max(length(q), 1e-5);
    if (tc < 0.0 || b < 1.0) return 0.0;
    float hb = b - 1.0;
    float ring = exp(-hb * RING_SHARPNESS) * sqrt(2.0 * PI * b / RING_SHARPNESS);

    // Uneven intensity around the limb: low-frequency angular noise.
    vec3 cd = rotateAxis(closestDir, SUN_AXIS, gT * CORONA_ROTATION);
    float patchN = fbm(cd * 3.2 + vec3(1.7, 0.0, gT * CORONA_SPEED), 3);
    float fine  = noise3(cd * 18.0 + 4.0);
    ring *= mix(1.0, 0.25 + 1.6 * patchN * (0.7 + 0.6 * fine), RING_UNEVENNESS);
    return ring * RING_INTENSITY;
}


// =============================================================================
//  BACKGROUND — sparse stars + faint haze
// =============================================================================

vec3 starLayer(vec3 rd, float scale, float pixAngle) {
    vec3 p  = rd * scale;
    vec3 id = floor(p);
    vec3 f  = p - id;
    float h = hash13(id + 11.0);
    if (h > STAR_DENSITY) return vec3(0.0);
    vec3  c   = 0.25 + 0.5 * hash33(id);                // star position inside its cell
    float d   = length(f - c);
    float sig = max(0.05, pixAngle * scale * 0.7);      // never smaller than ~1 pixel
    float mag = pow(hash13(id + 3.7), 6.0);             // most stars faint, a few bright
    float temp = hash13(id + 9.1);
    vec3  col = mix(vec3(1.0, 0.86, 0.72), vec3(0.78, 0.86, 1.0), temp);
    return col * mag * exp(-d * d / (2.0 * sig * sig));
}

vec3 background(vec3 rd, float pixAngle) {
    vec3 col = vec3(0.0);
    col += starLayer(rd, 160.0, pixAngle);
    col += starLayer(rd, 310.0, pixAngle) * 0.6;
    col *= STAR_BRIGHTNESS * 8.0;
    float haze = fbm(rd * 2.3 + 5.0, 3);
    col += vec3(0.45, 0.55, 0.8) * haze * haze * HAZE_STRENGTH;
    return col;
}


// =============================================================================
//  TONEMAP — ACES filmic fit (Narkowicz 2015)
// =============================================================================

vec3 acesFilm(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}


// =============================================================================
//  MAIN
// =============================================================================

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    gT = iTime * TIME_SCALE;

    // ---- Camera ray --------------------------------------------------------
    vec2  uv    = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;  // (0,0) = centre
    float focal = focalFromFov(CAM_FOV_DEG);
    vec3  ro    = cameraOrigin(gT);
    mat3  cam   = lookAt(ro, CAM_TARGET, CAM_ROLL);
    vec3  rd    = normalize(cam * vec3(uv, focal));
    float pixAngle = 1.0 / (iResolution.y * focal);   // approx. angular size of a pixel

    // ---- Moon (apparent size, as seen from the camera) ---------------------
    vec3  toMoon   = MOON_CENTER - ro;
    float moonDist = length(toMoon);
    vec3  moonDir  = toMoon / moonDist;
    float moonAng  = asin(clamp(MOON_RADIUS / moonDist, 0.0, 1.0));

    // ---- Sun placement -----------------------------------------------------
#if ECLIPSE_LOCK
    // Put the sun on the camera→moon line, shifted by ECLIPSE_OFFSET (in moon
    // radii, measured in screen space), sized to a fixed apparent ratio.
    vec3  sunDir  = normalize(moonDir + (cam[0] * ECLIPSE_OFFSET.x + cam[1] * ECLIPSE_OFFSET.y) * tan(moonAng));
    float sunDist = moonDist + SUN_BEHIND_MOON;
    vec3  sunC    = ro + sunDir * sunDist;
    float sunR    = sin(moonAng * SUN_APPARENT_RATIO) * sunDist;
#else
    vec3  sunC    = SUN_CENTER_FIXED;
    float sunR    = SUN_RADIUS_FIXED;
    float sunDist = length(sunC - ro);
    vec3  sunDir  = (sunC - ro) / sunDist;
#endif
    float sunAng = asin(clamp(sunR / sunDist, 0.0, 1.0));

    // ---- Moon occlusion with an anti-aliased limb ---------------------------
    // Distance from the moon centre to the ray, compared to the radius, with a
    // one-pixel soft edge. coverage = 1 inside the silhouette.
    float tcm      = dot(toMoon, rd);
    float dm       = length(toMoon - rd * tcm);
    float fw       = pixAngle * max(tcm, 0.0) * 0.9;
    float coverage = tcm > 0.0 ? 1.0 - smoothstep(MOON_RADIUS - fw, MOON_RADIUS + fw, dm) : 0.0;

    // ---- Everything behind the moon ----------------------------------------
    vec3 behind = vec3(0.0);
    vec3 closestDir = vec3(0.0, 1.0, 0.0);
    float ring = 0.0;
    if (coverage < 0.999) {     // fully covered pixels skip the expensive march
        vec2  sh    = sphereIntersect(ro, rd, sunC, sunR);
        bool  hitSun = sh.x < sh.y && sh.x > 0.0;
        float tStop = hitSun ? sh.x : 1e9;

        float jitter = hash13(vec3(fragCoord, fract(gT) * 61.0));
        behind += marchCorona(ro, rd, sunC, sunR, tStop, jitter);

        ring = limbRing(ro, rd, sunC, sunR, closestDir);
        behind += vec3(1.0, 0.985, 0.96) * ring * SOLAR_BRIGHTNESS;

        if (hitSun) {
            // Photosphere with limb darkening (only visible when misaligned).
            vec3  nS = normalize(ro + rd * sh.x - sunC);
            float mu = max(dot(nS, -rd), 0.0);
            behind += vec3(1.0, 0.96, 0.9) * SUN_DISK_INTENSITY * (0.4 + 0.6 * pow(mu, 0.6)) * SOLAR_BRIGHTNESS;
        } else {
            behind += background(rd, pixAngle);
        }
    }

    // Moon surface: near black, a hint of earthshine toward its centre.
    float moonShade = 1.0 - 0.5 * smoothstep(0.4, 1.0, dm / MOON_RADIUS);
    vec3  col = mix(behind, MOON_COLOR * moonShade, coverage);

    // ---- Lens effects (sit on top of everything, including the moon) -------
    // Bloom: a glow around the *visible* bright edge — the solar limb where it
    // is not covered by the moon. It decays outward over the sky and dies off
    // within a few pixels over the moon, so the silhouette stays crisp.
    float angS   = acos(clamp(dot(rd, sunDir),  -1.0, 1.0));
    float angM   = acos(clamp(dot(rd, moonDir), -1.0, 1.0));
    float bS     = (angS - sunAng)  / sunAng;     // > 0 outside the sun's disk
    float bM     = angM - moonAng;                // < 0 inside the moon's disk
    float inside = min(angM - moonAng, 0.0) / (0.9 * pixAngle);   // pixels inside the moon (<0)
    float bloom  = exp(-max(bS, 0.0) * BLOOM_FALLOFF) * exp(inside);
    bloom       += 0.15 * exp(-max(bS, 0.0) * BLOOM_FALLOFF * 0.2) * step(0.0, bM);  // wide veil
    float ringVar = mix(1.0, 0.45 + 1.1 * fbm(closestDir * 3.2 + vec3(1.7, 0.0, gT * CORONA_SPEED), 2), RING_UNEVENNESS);
    col += vec3(1.0, 0.97, 0.92) * bloom * ringVar * BLOOM_STRENGTH * SOLAR_BRIGHTNESS;

    // Diamond ring: one blinding bead on the moon's limb + wide glare.
    if (DIAMOND_STRENGTH > 0.0) {
        vec3  beadAxis = cam[0] * cos(DIAMOND_ANGLE) + cam[1] * sin(DIAMOND_ANGLE);
        vec3  beadDir  = normalize(moonDir + beadAxis * tan(moonAng * 1.004));
        float dB       = acos(clamp(dot(rd, beadDir), -1.0, 1.0)) / moonAng; // in moon radii
        float s        = DIAMOND_SIZE;
        float core     = exp(-dB * dB / (s * s));          // blinding bead
        float halo     = exp(-dB / (s * 5.0));             // tight lens halo
        float glow     = exp(-dB / 0.35);                  // soft wide glow, dies before the moon centre
        col += vec3(1.0, 0.97, 0.93) * DIAMOND_STRENGTH * (core * 300.0 + halo * 30.0 + glow * 1.4);
    }

    // ---- Exposure, tonemap, gamma, vignette, dither -------------------------
    col *= EXPOSURE;
    col  = acesFilm(col);
    col  = pow(col, vec3(1.0 / GAMMA));
    col *= 1.0 - VIGNETTE * dot(uv, uv);
    col += (hash13(vec3(fragCoord, 7.0)) - 0.5) / 255.0;   // break up 8-bit banding

    fragColor = vec4(col, 1.0);
}

// ---- HOST FOOTER (remove for Shadertoy) -------------------------------------
void main() {
    mainImage(fragColor_out, gl_FragCoord.xy);
}
// ---- END HOST FOOTER --------------------------------------------------------
