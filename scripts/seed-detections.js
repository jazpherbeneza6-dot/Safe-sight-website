/**
 * 🌱 Seed Detections – Feb 20, 2026 (Friday)
 * Route: Pampanga → Tarlac → Pangasinan → La Union → Baguio → (return evening)
 *
 * Uses JWT auth built from .env.local credentials directly.
 * No extra npm packages — only built-in Node.js crypto + https.
 */

const https  = require("https");
const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
const envVars = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").replace(/\\r\\n/g, "");
    }
  });
}

const PROJECT_ID   = envVars["FIREBASE_PROJECT_ID"]   || "blindspot-mode";
const CLIENT_EMAIL = envVars["FIREBASE_CLIENT_EMAIL"];
const PRIVATE_KEY  = envVars["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");
const COL          = "detections";

if (!CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

// ── JWT helpers ───────────────────────────────────────────────────────────────
function makeJWT() {
  const now    = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: CLIENT_EMAIL, sub: CLIENT_EMAIL,
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore",
  })).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(PRIVATE_KEY, "base64url");
  return `${header}.${payload}.${sig}`;
}

function getToken(jwt) {
  return new Promise((resolve, reject) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const opts = {
      hostname: "oauth2.googleapis.com", path: "/token", method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(opts, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        const p = JSON.parse(d);
        if (p.access_token) resolve(p.access_token);
        else reject(new Error(`Token error: ${d}`));
      });
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

function addDoc(token, fields) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ fields });
    const opts = {
      hostname: "firestore.googleapis.com",
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COL}`,
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    const req = https.request(opts, res => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { if (res.statusCode === 200) resolve(); else reject(new Error(`HTTP ${res.statusCode}: ${d}`)); });
    });
    req.on("error", reject); req.write(body); req.end();
  });
}

const str = v => ({ stringValue: String(v) });
const num = v => ({ doubleValue: Number(v) });
const tss = v => ({ timestampValue: v.toISOString() });

// PHT (UTC+8) → UTC
function makePHT(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const utcH = h - 8;
  if (utcH < 0) return new Date(Date.UTC(2026, 1, 19, 24 + utcH, m));
  return new Date(Date.UTC(2026, 1, 20, utcH, m));
}

const VID = "truck-001";

const ROWS = [
  // ═══ PAMPANGA – Paakyat (05:10–06:22) ══════════════════════════════════════
  { t:"05:10", lat:15.0289, lon:120.6899, place:"San Fernando, Pampanga",           type:"vehicle", alert:"MEDIUM",   dir:"right", dist:4.2 },
  { t:"05:18", lat:15.0312, lon:120.6921, place:"San Fernando, Pampanga",           type:"vehicle", alert:"HIGH",     dir:"left",  dist:2.1 },
  { t:"05:25", lat:15.0301, lon:120.6910, place:"San Fernando, Pampanga",           type:"vehicle", alert:"DANGER",   dir:"right", dist:1.5 },
  { t:"05:35", lat:15.1472, lon:120.5888, place:"Angeles City, Pampanga",           type:"vehicle", alert:"HIGH",     dir:"rear",  dist:5.0 },
  { t:"05:42", lat:15.1490, lon:120.5902, place:"Angeles City, Pampanga",           type:"vehicle", alert:"WARNING",  dir:"left",  dist:2.8 },
  { t:"05:50", lat:15.1501, lon:120.5915, place:"Angeles City, Pampanga",           type:"vehicle", alert:"MEDIUM",   dir:"right", dist:6.1 },
  { t:"06:00", lat:15.2176, lon:120.5726, place:"Mabalacat, Pampanga",              type:"vehicle", alert:"HIGH",     dir:"right", dist:3.3 },
  { t:"06:10", lat:15.2195, lon:120.5740, place:"Mabalacat, Pampanga",              type:"vehicle", alert:"MEDIUM",   dir:"left",  dist:5.5 },
  { t:"06:16", lat:15.2210, lon:120.5752, place:"Mabalacat, Pampanga",              type:"vehicle", alert:"DANGER",   dir:"right", dist:1.8 },
  { t:"06:22", lat:15.2230, lon:120.5760, place:"Mabalacat, Pampanga",              type:"vehicle", alert:"WARNING",  dir:"rear",  dist:2.5 },
  // ═══ TARLAC – Paakyat (06:35–08:08) ════════════════════════════════════════
  { t:"06:35", lat:15.3305, lon:120.5875, place:"Capas, Tarlac",                    type:"vehicle", alert:"HIGH",     dir:"left",  dist:4.0 },
  { t:"06:45", lat:15.3321, lon:120.5890, place:"Capas, Tarlac",                    type:"vehicle", alert:"MEDIUM",   dir:"right", dist:2.2 },
  { t:"06:52", lat:15.3338, lon:120.5901, place:"Capas, Tarlac",                    type:"vehicle", alert:"DANGER",   dir:"rear",  dist:3.8 },
  { t:"07:00", lat:15.4755, lon:120.5963, place:"Tarlac City, Tarlac",              type:"vehicle", alert:"HIGH",     dir:"left",  dist:1.9 },
  { t:"07:10", lat:15.4772, lon:120.5975, place:"Tarlac City, Tarlac",              type:"vehicle", alert:"WARNING",  dir:"right", dist:5.3 },
  { t:"07:20", lat:15.4790, lon:120.5988, place:"Tarlac City, Tarlac",              type:"vehicle", alert:"MEDIUM",   dir:"left",  dist:2.7 },
  { t:"07:30", lat:15.6636, lon:120.5866, place:"Paniqui, Tarlac",                  type:"vehicle", alert:"HIGH",     dir:"rear",  dist:4.6 },
  { t:"07:38", lat:15.6651, lon:120.5880, place:"Paniqui, Tarlac",                  type:"vehicle", alert:"DANGER",   dir:"right", dist:1.2 },
  { t:"07:50", lat:15.7385, lon:120.5672, place:"Moncada, Tarlac",                  type:"vehicle", alert:"HIGH",     dir:"left",  dist:3.0 },
  { t:"08:00", lat:15.7401, lon:120.5685, place:"Moncada, Tarlac",                  type:"vehicle", alert:"MEDIUM",   dir:"right", dist:5.8 },
  { t:"08:08", lat:15.7415, lon:120.5698, place:"Moncada, Tarlac",                  type:"vehicle", alert:"WARNING",  dir:"rear",  dist:2.0 },
  // ═══ PANGASINAN – Paakyat (08:20–09:50) ════════════════════════════════════
  { t:"08:20", lat:15.8948, lon:120.6335, place:"Rosales, Pangasinan",              type:"vehicle", alert:"HIGH",     dir:"left",  dist:4.4 },
  { t:"08:28", lat:15.8962, lon:120.6348, place:"Rosales, Pangasinan",              type:"vehicle", alert:"MEDIUM",   dir:"right", dist:2.9 },
  { t:"08:36", lat:15.8975, lon:120.6360, place:"Rosales, Pangasinan",              type:"vehicle", alert:"DANGER",   dir:"rear",  dist:3.5 },
  { t:"08:48", lat:15.9760, lon:120.5713, place:"Urdaneta, Pangasinan",             type:"vehicle", alert:"HIGH",     dir:"right", dist:1.7 },
  { t:"08:55", lat:15.9775, lon:120.5728, place:"Urdaneta, Pangasinan",             type:"vehicle", alert:"WARNING",  dir:"left",  dist:5.1 },
  { t:"09:02", lat:15.9788, lon:120.5740, place:"Urdaneta, Pangasinan",             type:"vehicle", alert:"MEDIUM",   dir:"rear",  dist:2.4 },
  { t:"09:12", lat:15.9020, lon:120.5879, place:"Villasis, Pangasinan",             type:"vehicle", alert:"HIGH",     dir:"right", dist:4.8 },
  { t:"09:20", lat:15.9035, lon:120.5892, place:"Villasis, Pangasinan",             type:"vehicle", alert:"DANGER",   dir:"left",  dist:1.4 },
  { t:"09:35", lat:16.1671, lon:120.4631, place:"Sison, Pangasinan",                type:"vehicle", alert:"MEDIUM",   dir:"rear",  dist:5.9 },
  { t:"09:42", lat:16.1685, lon:120.4645, place:"Sison, Pangasinan",                type:"vehicle", alert:"HIGH",     dir:"right", dist:2.6 },
  { t:"09:50", lat:16.1700, lon:120.4658, place:"Sison, Pangasinan",                type:"vehicle", alert:"WARNING",  dir:"left",  dist:4.2 },
  // ═══ LA UNION (10:00–10:15) ═════════════════════════════════════════════════
  { t:"10:00", lat:16.2082, lon:120.4882, place:"Rosario, La Union",                type:"vehicle", alert:"HIGH",     dir:"rear",  dist:1.8 },
  { t:"10:08", lat:16.2098, lon:120.4896, place:"Rosario, La Union",                type:"vehicle", alert:"DANGER",   dir:"right", dist:3.2 },
  { t:"10:15", lat:16.2111, lon:120.4910, place:"Rosario, La Union",                type:"vehicle", alert:"MEDIUM",   dir:"left",  dist:2.3 },
  // ═══ MARCOS HIGHWAY – Paakyat Baguio (10:25–10:52) ═════════════════════════
  { t:"10:25", lat:16.3120, lon:120.4750, place:"Marcos Highway, Benguet",          type:"vehicle", alert:"HIGH",     dir:"right", dist:4.0 },
  { t:"10:35", lat:16.3250, lon:120.4700, place:"Marcos Highway, Benguet",          type:"vehicle", alert:"DANGER",   dir:"left",  dist:1.1 },
  { t:"10:45", lat:16.3380, lon:120.4660, place:"Marcos Highway, Benguet",          type:"vehicle", alert:"CRITICAL", dir:"rear",  dist:2.0 },
  { t:"10:52", lat:16.3500, lon:120.4620, place:"Marcos Highway, Benguet",          type:"vehicle", alert:"HIGH",     dir:"right", dist:2.8 },
  // ═══ TUBA (11:02–11:17) ═════════════════════════════════════════════════════
  { t:"11:02", lat:16.3840, lon:120.4626, place:"Tuba, Benguet",                    type:"vehicle", alert:"MEDIUM",   dir:"left",  dist:5.5 },
  { t:"11:10", lat:16.3860, lon:120.4640, place:"Tuba, Benguet",                    type:"vehicle", alert:"DANGER",   dir:"right", dist:1.6 },
  { t:"11:17", lat:16.3878, lon:120.4655, place:"Tuba, Benguet",                    type:"vehicle", alert:"HIGH",     dir:"rear",  dist:2.2 },
  // ═══ LA TRINIDAD (11:28–11:42) ══════════════════════════════════════════════
  { t:"11:28", lat:16.4604, lon:120.5878, place:"La Trinidad, Benguet",             type:"vehicle", alert:"HIGH",     dir:"left",  dist:3.9 },
  { t:"11:35", lat:16.4620, lon:120.5893, place:"La Trinidad, Benguet",             type:"vehicle", alert:"MEDIUM",   dir:"right", dist:2.1 },
  { t:"11:42", lat:16.4638, lon:120.5908, place:"La Trinidad, Benguet",             type:"vehicle", alert:"WARNING",  dir:"rear",  dist:4.7 },
  // ═══ BAGUIO CITY – Super Value (11:55–12:28) ════════════════════════════════
  { t:"11:55", lat:16.4023, lon:120.5960, place:"Baguio City Proper, Super Value",  type:"vehicle", alert:"HIGH",     dir:"right", dist:3.6 },
  { t:"12:05", lat:16.4035, lon:120.5975, place:"Baguio City Proper, Super Value",  type:"vehicle", alert:"MEDIUM",   dir:"left",  dist:2.5 },
  { t:"12:15", lat:16.4048, lon:120.5988, place:"Baguio City Proper, Super Value",  type:"vehicle", alert:"DANGER",   dir:"rear",  dist:1.3 },
  { t:"12:28", lat:16.4060, lon:120.6001, place:"Baguio City Proper, Super Value",  type:"vehicle", alert:"HIGH",     dir:"right", dist:4.1 },
  // ═══ RETURN – La Trinidad (14:10–14:20) ═════════════════════════════════════
  { t:"14:10", lat:16.4618, lon:120.5882, place:"La Trinidad, Benguet",             type:"vehicle", alert:"MEDIUM",   dir:"right", dist:5.2 },
  { t:"14:20", lat:16.4601, lon:120.5868, place:"La Trinidad, Benguet",             type:"vehicle", alert:"HIGH",     dir:"left",  dist:2.7 },
  // RETURN – Tuba
  { t:"14:35", lat:16.3862, lon:120.4638, place:"Tuba, Benguet",                    type:"vehicle", alert:"DANGER",   dir:"rear",  dist:1.5 },
  { t:"14:42", lat:16.3845, lon:120.4623, place:"Tuba, Benguet",                    type:"vehicle", alert:"HIGH",     dir:"right", dist:3.8 },
  // RETURN – Marcos Hwy
  { t:"14:55", lat:16.3495, lon:120.4615, place:"Marcos Highway, Benguet",          type:"vehicle", alert:"CRITICAL", dir:"left",  dist:2.0 },
  { t:"15:05", lat:16.3370, lon:120.4655, place:"Marcos Highway, Benguet",          type:"vehicle", alert:"HIGH",     dir:"rear",  dist:2.4 },
  { t:"15:18", lat:16.3242, lon:120.4695, place:"Marcos Highway, Benguet",          type:"vehicle", alert:"WARNING",  dir:"right", dist:1.9 },
  // RETURN – Rosario La Union
  { t:"15:32", lat:16.2095, lon:120.4892, place:"Rosario, La Union",                type:"vehicle", alert:"MEDIUM",   dir:"left",  dist:4.9 },
  { t:"15:40", lat:16.2080, lon:120.4878, place:"Rosario, La Union",                type:"vehicle", alert:"HIGH",     dir:"rear",  dist:3.6 },
  // RETURN – Sison
  { t:"15:55", lat:16.1698, lon:120.4652, place:"Sison, Pangasinan",                type:"vehicle", alert:"MEDIUM",   dir:"right", dist:2.3 },
  { t:"16:03", lat:16.1682, lon:120.4638, place:"Sison, Pangasinan",                type:"vehicle", alert:"HIGH",     dir:"left",  dist:4.3 },
  // RETURN – Villasis
  { t:"16:12", lat:15.9032, lon:120.5886, place:"Villasis, Pangasinan",             type:"vehicle", alert:"MEDIUM",   dir:"rear",  dist:5.1 },
  { t:"16:19", lat:15.9018, lon:120.5873, place:"Villasis, Pangasinan",             type:"vehicle", alert:"HIGH",     dir:"right", dist:1.6 },
  // RETURN – Urdaneta
  { t:"16:30", lat:15.9780, lon:120.5735, place:"Urdaneta, Pangasinan",             type:"vehicle", alert:"DANGER",   dir:"left",  dist:3.0 },
  { t:"16:38", lat:15.9765, lon:120.5720, place:"Urdaneta, Pangasinan",             type:"vehicle", alert:"MEDIUM",   dir:"rear",  dist:2.2 },
  // RETURN – Rosales
  { t:"16:50", lat:15.8960, lon:120.6342, place:"Rosales, Pangasinan",              type:"vehicle", alert:"HIGH",     dir:"right", dist:4.1 },
  { t:"17:00", lat:15.8945, lon:120.6330, place:"Rosales, Pangasinan",              type:"vehicle", alert:"WARNING",  dir:"left",  dist:2.8 },
  // RETURN – Moncada
  { t:"17:15", lat:15.7402, lon:120.5678, place:"Moncada, Tarlac",                  type:"vehicle", alert:"MEDIUM",   dir:"right", dist:2.1 },
  { t:"17:24", lat:15.7388, lon:120.5665, place:"Moncada, Tarlac",                  type:"vehicle", alert:"HIGH",     dir:"rear",  dist:3.7 },
  // RETURN – Paniqui
  { t:"17:38", lat:15.6648, lon:120.5875, place:"Paniqui, Tarlac",                  type:"vehicle", alert:"DANGER",   dir:"left",  dist:2.9 },
  { t:"17:48", lat:15.6633, lon:120.5862, place:"Paniqui, Tarlac",                  type:"vehicle", alert:"HIGH",     dir:"rear",  dist:1.8 },
  // RETURN – Tarlac City
  { t:"18:02", lat:15.4782, lon:120.5980, place:"Tarlac City, Tarlac",              type:"vehicle", alert:"MEDIUM",   dir:"right", dist:5.4 },
  { t:"18:12", lat:15.4768, lon:120.5967, place:"Tarlac City, Tarlac",              type:"vehicle", alert:"WARNING",  dir:"left",  dist:2.6 },
  // RETURN – Capas
  { t:"18:28", lat:15.3322, lon:120.5882, place:"Capas, Tarlac",                    type:"vehicle", alert:"HIGH",     dir:"rear",  dist:1.6 },
  { t:"18:36", lat:15.3308, lon:120.5869, place:"Capas, Tarlac",                    type:"vehicle", alert:"MEDIUM",   dir:"right", dist:4.5 },
  // RETURN – Mabalacat
  { t:"18:52", lat:15.2212, lon:120.5742, place:"Mabalacat, Pampanga",              type:"vehicle", alert:"HIGH",     dir:"left",  dist:3.9 },
  { t:"19:00", lat:15.2198, lon:120.5728, place:"Mabalacat, Pampanga",              type:"vehicle", alert:"DANGER",   dir:"rear",  dist:1.4 },
  // RETURN – Angeles City
  { t:"19:12", lat:15.1495, lon:120.5905, place:"Angeles City, Pampanga",           type:"vehicle", alert:"MEDIUM",   dir:"right", dist:2.2 },
  { t:"19:20", lat:15.1480, lon:120.5891, place:"Angeles City, Pampanga",           type:"vehicle", alert:"HIGH",     dir:"left",  dist:4.6 },
  // RETURN – San Fernando (nakabalik na! 🏠)
  { t:"19:32", lat:15.0308, lon:120.6915, place:"San Fernando, Pampanga",           type:"vehicle", alert:"MEDIUM",   dir:"rear",  dist:5.7 },
  { t:"19:42", lat:15.0296, lon:120.6903, place:"San Fernando, Pampanga",           type:"vehicle", alert:"WARNING",  dir:"left",  dist:2.0 },
  { t:"19:50", lat:15.0282, lon:120.6891, place:"San Fernando, Pampanga",           type:"vehicle", alert:"HIGH",     dir:"right", dist:3.4 },
];

async function main() {
  console.log("🔑 Building JWT from .env.local credentials...");
  const jwt   = makeJWT();
  const token = await getToken(jwt);
  console.log("✅ Authenticated!\n");
  console.log(`🚛 Seeding ${ROWS.length} detections — Friday, Feb 20, 2026`);
  console.log("   Pampanga → Tarlac → Pangasinan → La Union → Marcos Hwy → Tuba → La Trinidad → Baguio (Super Value) → return\n");

  let ok = 0, fail = 0;
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    const fields = {
      vehicleId:     str(VID),
      truckId:       str(VID),
      detectionType: str(r.type),
      alertLevel:    str(r.alert),
      latitude:      num(r.lat),
      longitude:     num(r.lon),
      timestamp:     tss(makePHT(r.t)),
      description:   str(`${r.type} detected ${r.dir} at ${r.place}`),
      direction:     str(r.dir),
      placeName:     str(r.place),
      distance:      num(r.dist),
      sensorId:      str(`sensor-${(i % 4) + 1}`),
    };
    try {
      await addDoc(token, fields);
      ok++;
      process.stdout.write(`\r📡 ${ok}/${ROWS.length} — [${r.t}] ${r.place.padEnd(40)}`);
    } catch (e) {
      fail++;
      console.error(`\n❌ [${i+1}] ${r.place} @ ${r.t}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n\n✅ Done! ${ok} docs uploaded, ${fail} failed.`);
  console.log("🗺️  Full route from San Fernando, Pampanga → Baguio City → back to San Fernando ✨");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
