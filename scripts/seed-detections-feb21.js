/**
 * 🌱 Seed Detections – Feb 21, 2026 (Saturday)
 * Route: Pampanga → Tarlac → Pangasinan (destination: RCS Store, Urdaneta City)
 * All detections: vehicle type only
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
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").replace(/\\r\\n/g, "");
  });
}

const PROJECT_ID   = envVars["FIREBASE_PROJECT_ID"] || "blindspot-mode";
const CLIENT_EMAIL = envVars["FIREBASE_CLIENT_EMAIL"];
const PRIVATE_KEY  = envVars["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");
const COL          = "detections";

if (!CLIENT_EMAIL || !PRIVATE_KEY) {
  console.error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

// ── JWT / Auth ────────────────────────────────────────────────────────────────
function makeJWT() {
  const now     = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: CLIENT_EMAIL, sub: CLIENT_EMAIL,
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore",
  })).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  return `${header}.${payload}.${sign.sign(PRIVATE_KEY, "base64url")}`;
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

// PHT (UTC+8) → UTC for Feb 21
function makePHT(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const utcH = h - 8;
  if (utcH < 0) return new Date(Date.UTC(2026, 1, 20, 24 + utcH, m)); // spills to Feb 20 UTC
  return new Date(Date.UTC(2026, 1, 21, utcH, m));
}

const VID = "truck-001";

const ROWS = [
  // ═══ PAMPANGA (05:10–06:22) ══════════════════════════════════════════════════
  // San Fernando
  { t:"05:10", lat:15.0289, lon:120.6899, place:"San Fernando, Pampanga",  alert:"MEDIUM",   dir:"right", dist:4.2 },
  { t:"05:18", lat:15.0312, lon:120.6921, place:"San Fernando, Pampanga",  alert:"HIGH",     dir:"left",  dist:3.1 },
  { t:"05:25", lat:15.0301, lon:120.6910, place:"San Fernando, Pampanga",  alert:"DANGER",   dir:"rear",  dist:2.0 },
  { t:"05:32", lat:15.0325, lon:120.6930, place:"San Fernando, Pampanga",  alert:"WARNING",  dir:"right", dist:5.3 },
  // Angeles City
  { t:"05:42", lat:15.1472, lon:120.5888, place:"Angeles City, Pampanga",  alert:"HIGH",     dir:"rear",  dist:4.8 },
  { t:"05:50", lat:15.1490, lon:120.5902, place:"Angeles City, Pampanga",  alert:"MEDIUM",   dir:"left",  dist:6.0 },
  { t:"05:57", lat:15.1501, lon:120.5915, place:"Angeles City, Pampanga",  alert:"DANGER",   dir:"right", dist:1.9 },
  { t:"06:03", lat:15.1515, lon:120.5928, place:"Angeles City, Pampanga",  alert:"WARNING",  dir:"rear",  dist:3.5 },
  // Mabalacat
  { t:"06:12", lat:15.2176, lon:120.5726, place:"Mabalacat, Pampanga",     alert:"HIGH",     dir:"left",  dist:4.1 },
  { t:"06:19", lat:15.2195, lon:120.5740, place:"Mabalacat, Pampanga",     alert:"MEDIUM",   dir:"right", dist:5.7 },
  { t:"06:26", lat:15.2210, lon:120.5752, place:"Mabalacat, Pampanga",     alert:"DANGER",   dir:"rear",  dist:1.6 },
  { t:"06:33", lat:15.2230, lon:120.5760, place:"Mabalacat, Pampanga",     alert:"HIGH",     dir:"left",  dist:3.9 },
  // ═══ TARLAC (06:45–08:05) ═════════════════════════════════════════════════════
  // Capas
  { t:"06:45", lat:15.3305, lon:120.5875, place:"Capas, Tarlac",           alert:"HIGH",     dir:"right", dist:4.4 },
  { t:"06:53", lat:15.3321, lon:120.5890, place:"Capas, Tarlac",           alert:"MEDIUM",   dir:"rear",  dist:2.8 },
  { t:"07:00", lat:15.3338, lon:120.5901, place:"Capas, Tarlac",           alert:"DANGER",   dir:"left",  dist:3.2 },
  { t:"07:07", lat:15.3355, lon:120.5912, place:"Capas, Tarlac",           alert:"WARNING",  dir:"right", dist:5.1 },
  // Tarlac City
  { t:"07:18", lat:15.4755, lon:120.5963, place:"Tarlac City, Tarlac",     alert:"HIGH",     dir:"left",  dist:4.0 },
  { t:"07:26", lat:15.4772, lon:120.5975, place:"Tarlac City, Tarlac",     alert:"CRITICAL", dir:"rear",  dist:1.8 },
  { t:"07:33", lat:15.4790, lon:120.5988, place:"Tarlac City, Tarlac",     alert:"MEDIUM",   dir:"right", dist:5.5 },
  { t:"07:40", lat:15.4805, lon:120.6000, place:"Tarlac City, Tarlac",     alert:"HIGH",     dir:"left",  dist:3.0 },
  // Paniqui
  { t:"07:52", lat:15.6636, lon:120.5866, place:"Paniqui, Tarlac",         alert:"WARNING",  dir:"rear",  dist:4.7 },
  { t:"08:00", lat:15.6651, lon:120.5880, place:"Paniqui, Tarlac",         alert:"DANGER",   dir:"right", dist:2.1 },
  { t:"08:07", lat:15.6665, lon:120.5893, place:"Paniqui, Tarlac",         alert:"HIGH",     dir:"left",  dist:3.8 },
  // Moncada
  { t:"08:18", lat:15.7385, lon:120.5672, place:"Moncada, Tarlac",         alert:"MEDIUM",   dir:"rear",  dist:5.2 },
  { t:"08:25", lat:15.7401, lon:120.5685, place:"Moncada, Tarlac",         alert:"HIGH",     dir:"right", dist:2.6 },
  { t:"08:32", lat:15.7415, lon:120.5698, place:"Moncada, Tarlac",         alert:"DANGER",   dir:"left",  dist:1.5 },
  { t:"08:39", lat:15.7428, lon:120.5710, place:"Moncada, Tarlac",         alert:"WARNING",  dir:"rear",  dist:4.0 },
  // ═══ PANGASINAN (08:50–09:45) ══════════════════════════════════════════════════
  // Rosales
  { t:"08:52", lat:15.8948, lon:120.6335, place:"Rosales, Pangasinan",     alert:"HIGH",     dir:"right", dist:4.6 },
  { t:"09:00", lat:15.8962, lon:120.6348, place:"Rosales, Pangasinan",     alert:"MEDIUM",   dir:"left",  dist:3.1 },
  { t:"09:08", lat:15.8975, lon:120.6360, place:"Rosales, Pangasinan",     alert:"DANGER",   dir:"rear",  dist:2.3 },
  { t:"09:15", lat:15.8988, lon:120.6372, place:"Rosales, Pangasinan",     alert:"HIGH",     dir:"right", dist:5.0 },
  // Urdaneta City
  { t:"09:28", lat:15.9760, lon:120.5713, place:"Urdaneta City, Pangasinan", alert:"HIGH",     dir:"left",  dist:4.2 },
  { t:"09:35", lat:15.9775, lon:120.5728, place:"Urdaneta City, Pangasinan", alert:"MEDIUM",   dir:"rear",  dist:3.4 },
  { t:"09:42", lat:15.9788, lon:120.5740, place:"Urdaneta City, Pangasinan", alert:"DANGER",   dir:"right", dist:1.8 },
  { t:"09:50", lat:15.9800, lon:120.5752, place:"Urdaneta City, Pangasinan", alert:"WARNING",  dir:"left",  dist:5.6 },
  // RCS Store, Urdaneta – destination
  { t:"10:02", lat:15.9825, lon:120.5768, place:"RCS Store, Urdaneta City",  alert:"MEDIUM",   dir:"rear",  dist:3.9 },
  { t:"10:10", lat:15.9838, lon:120.5779, place:"RCS Store, Urdaneta City",  alert:"HIGH",     dir:"right", dist:2.7 },
  { t:"10:18", lat:15.9850, lon:120.5790, place:"RCS Store, Urdaneta City",  alert:"DANGER",   dir:"left",  dist:1.4 },
  { t:"10:25", lat:15.9862, lon:120.5800, place:"RCS Store, Urdaneta City",  alert:"WARNING",  dir:"rear",  dist:4.5 },
];

async function main() {
  console.log("🔑 Building JWT from .env.local credentials...");
  const token = await getToken(makeJWT());
  console.log("✅ Authenticated!\n");
  console.log(`🚛 Seeding ${ROWS.length} detections — Saturday, Feb 21, 2026`);
  console.log("   San Fernando → Angeles City → Mabalacat → Capas → Tarlac City → Paniqui → Moncada → Rosales → Urdaneta City → RCS Store\n");

  let ok = 0, fail = 0;
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    const fields = {
      vehicleId:     str(VID),
      truckId:       str(VID),
      detectionType: str("vehicle"),
      alertLevel:    str(r.alert),
      latitude:      num(r.lat),
      longitude:     num(r.lon),
      timestamp:     tss(makePHT(r.t)),
      description:   str(`vehicle detected ${r.dir} at ${r.place}`),
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
  console.log("📍 Destination: RCS Store, Urdaneta City, Pangasinan 🏪");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
