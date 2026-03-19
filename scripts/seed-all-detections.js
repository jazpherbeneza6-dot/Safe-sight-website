/**
 * 🌱 Master Seed – All Detections (Feb 20–23, 2026)
 * - Feb 20 (Friday):  Pampanga → … → Baguio City (Super Value) + RETURN
 * - Feb 21 (Saturday): Pampanga → … → RCS Store, Urdaneta
 * - Feb 22 (Sunday):   Pampanga → … → Santiago (Savemore), Isabela
 * - Feb 23 (Monday):   Pampanga → … → Aritao (Acheta RCS), Nueva Vizcaya
 *
 * Minimum 10 detections per place.
 * All detectionType = "vehicle".
 *
 * Run AFTER deleting existing data:
 *   firebase firestore:delete detections --recursive -f
 *   node scripts/seed-all-detections.js
 */

const https  = require("https");
const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

// ── Credentials from .env.local ──────────────────────────────────────────────
const envVars = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").replace(/\\r\\n/g, "");
});
const PROJECT_ID   = envVars["FIREBASE_PROJECT_ID"] || "blindspot-mode";
const CLIENT_EMAIL = envVars["FIREBASE_CLIENT_EMAIL"];
const PRIVATE_KEY  = envVars["FIREBASE_PRIVATE_KEY"];

// ── JWT / Auth ────────────────────────────────────────────────────────────────
function makeJWT() {
  const now = Math.floor(Date.now() / 1000);
  const h = Buffer.from(JSON.stringify({ alg:"RS256", typ:"JWT" })).toString("base64url");
  const p = Buffer.from(JSON.stringify({ iss:CLIENT_EMAIL, sub:CLIENT_EMAIL, aud:"https://oauth2.googleapis.com/token", iat:now, exp:now+3600, scope:"https://www.googleapis.com/auth/datastore" })).toString("base64url");
  const s = crypto.createSign("RSA-SHA256");
  s.update(`${h}.${p}`);
  return `${h}.${p}.${s.sign(PRIVATE_KEY,"base64url")}`;
}
function getToken(jwt) {
  return new Promise((res, rej) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req  = https.request({ hostname:"oauth2.googleapis.com", path:"/token", method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","Content-Length":Buffer.byteLength(body)} }, r => { let d=""; r.on("data",c=>d+=c); r.on("end",()=>{ const p=JSON.parse(d); p.access_token?res(p.access_token):rej(new Error(d)); }); });
    req.on("error",rej); req.write(body); req.end();
  });
}
function addDoc(token, fields) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ fields });
    const req  = https.request({ hostname:"firestore.googleapis.com", path:`/v1/projects/${PROJECT_ID}/databases/(default)/documents/detections`, method:"POST", headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json","Content-Length":Buffer.byteLength(body)} }, r => { let d=""; r.on("data",c=>d+=c); r.on("end",()=>{ r.statusCode===200?res():rej(new Error(`HTTP ${r.statusCode}: ${d}`)); }); });
    req.on("error",rej); req.write(body); req.end();
  });
}

// ── Field helpers ─────────────────────────────────────────────────────────────
const str = v => ({ stringValue: String(v) });
const num = v => ({ doubleValue: Number(v) });
const tss = v => ({ timestampValue: v.toISOString() });

function makePHT(dateStr, timeStr) {
  const [yr, mo, dy] = dateStr.split("-").map(Number);
  let [h, m] = timeStr.split(":").map(Number);
  const utcH = h - 8;
  return utcH < 0
    ? new Date(Date.UTC(yr, mo-1, dy-1, 24+utcH, m))
    : new Date(Date.UTC(yr, mo-1, dy, utcH, m));
}

function addMins(t, n) {
  let [h, m] = t.split(":").map(Number);
  m += n; h += Math.floor(m/60); m %= 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// ── Per-detection cycling pools (12 items so 10 fit cleanly) ─────────────────
const LAT_OFF = [0,.0005,-.0003,.0008,-.0005,.0002,-.0007,.0004,-.0001,.0006,.0003,-.0008];
const LON_OFF = [0,.0003,.0006,-.0002,-.0004,.0008,.0001,-.0007,.0005,-.0003,.0009,-.0001];
const ALERTS  = ["MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL"];
const DIRS    = ["left","right","rear","left","right","rear","left","right","rear","left","right","rear"];
const DISTS   = [4.2, 2.1, 1.5, 5.0, 2.8, 6.1, 3.3, 5.5, 1.8, 2.5, 4.0, 3.8];

// ── Main generator ────────────────────────────────────────────────────────────
function genPlace(date, startTime, name, lat, lon, count=10) {
  return Array.from({ length: count }, (_, i) => ({
    date,
    t:     addMins(startTime, i * 2),
    lat:   lat + LAT_OFF[i % LAT_OFF.length],
    lon:   lon + LON_OFF[i % LON_OFF.length],
    place: name,
    alert: ALERTS[i % ALERTS.length],
    dir:   DIRS[i % DIRS.length],
    dist:  DISTS[i % DISTS.length],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  ALL ROUTE DATA
// ─────────────────────────────────────────────────────────────────────────────
const ROWS = [

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 20 – FRIDAY  |  Pampanga → Baguio (going) + return
  // ══════════════════════════════════════════════════════════════════════════
  // ── GOING ──────────────────────────────────────────────────────────────
  ...genPlace("2026-02-20","05:00","San Fernando, Pampanga",           15.0289,120.6899),
  ...genPlace("2026-02-20","05:30","Angeles City, Pampanga",           15.1472,120.5888),
  ...genPlace("2026-02-20","05:58","Mabalacat, Pampanga",              15.2176,120.5726),
  ...genPlace("2026-02-20","06:30","Capas, Tarlac",                    15.3305,120.5875),
  ...genPlace("2026-02-20","07:00","Tarlac City, Tarlac",              15.4755,120.5963),
  ...genPlace("2026-02-20","07:30","Paniqui, Tarlac",                  15.6636,120.5866),
  ...genPlace("2026-02-20","08:00","Moncada, Tarlac",                  15.7385,120.5672),
  ...genPlace("2026-02-20","08:35","Rosales, Pangasinan",              15.8948,120.6335),
  ...genPlace("2026-02-20","09:00","Urdaneta, Pangasinan",             15.9760,120.5713),
  ...genPlace("2026-02-20","09:25","Villasis, Pangasinan",             15.9020,120.5879),
  ...genPlace("2026-02-20","10:00","Sison, Pangasinan",                16.1671,120.4631),
  ...genPlace("2026-02-20","10:30","Rosario, La Union",                16.2082,120.4882),
  ...genPlace("2026-02-20","11:00","Marcos Highway, Benguet",          16.3250,120.4700),
  ...genPlace("2026-02-20","11:30","Tuba, Benguet",                    16.3840,120.4626),
  ...genPlace("2026-02-20","12:00","La Trinidad, Benguet",             16.4604,120.5878),
  ...genPlace("2026-02-20","12:30","Baguio City Proper, Super Value",  16.4023,120.5960),
  // ── RETURN ──────────────────────────────────────────────────────────────
  ...genPlace("2026-02-20","14:30","La Trinidad, Benguet",             16.4622,120.5890),
  ...genPlace("2026-02-20","15:00","Tuba, Benguet",                    16.3855,120.4640),
  ...genPlace("2026-02-20","15:30","Marcos Highway, Benguet",          16.3380,120.4660),
  ...genPlace("2026-02-20","16:00","Rosario, La Union",                16.2095,120.4895),
  ...genPlace("2026-02-20","16:35","Sison, Pangasinan",                16.1690,120.4648),
  ...genPlace("2026-02-20","17:00","Villasis, Pangasinan",             15.9030,120.5886),
  ...genPlace("2026-02-20","17:25","Urdaneta, Pangasinan",             15.9775,120.5725),
  ...genPlace("2026-02-20","17:55","Rosales, Pangasinan",              15.8962,120.6348),
  ...genPlace("2026-02-20","18:30","Moncada, Tarlac",                  15.7401,120.5685),
  ...genPlace("2026-02-20","19:00","Paniqui, Tarlac",                  15.6651,120.5880),
  ...genPlace("2026-02-20","19:30","Tarlac City, Tarlac",              15.4772,120.5975),
  ...genPlace("2026-02-20","20:00","Capas, Tarlac",                    15.3321,120.5890),
  ...genPlace("2026-02-20","20:35","Mabalacat, Pampanga",              15.2195,120.5740),
  ...genPlace("2026-02-20","21:00","Angeles City, Pampanga",           15.1490,120.5902),
  ...genPlace("2026-02-20","21:30","San Fernando, Pampanga",           15.0308,120.6915),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 21 – SATURDAY  |  Pampanga → RCS Store, Urdaneta
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-02-21","05:00","San Fernando, Pampanga",           15.0289,120.6899),
  ...genPlace("2026-02-21","05:30","Angeles City, Pampanga",           15.1472,120.5888),
  ...genPlace("2026-02-21","06:00","Mabalacat, Pampanga",              15.2176,120.5726),
  ...genPlace("2026-02-21","06:40","Capas, Tarlac",                    15.3305,120.5875),
  ...genPlace("2026-02-21","07:15","Tarlac City, Tarlac",              15.4755,120.5963),
  ...genPlace("2026-02-21","07:50","Paniqui, Tarlac",                  15.6636,120.5866),
  ...genPlace("2026-02-21","08:25","Moncada, Tarlac",                  15.7385,120.5672),
  ...genPlace("2026-02-21","09:00","Rosales, Pangasinan",              15.8948,120.6335),
  ...genPlace("2026-02-21","09:35","Urdaneta City, Pangasinan",        15.9760,120.5713),
  ...genPlace("2026-02-21","10:05","RCS Store, Urdaneta City",         15.9830,120.5780),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 22 – SUNDAY  |  Pampanga → Santiago (Savemore), Isabela
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-02-22","04:30","San Fernando, Pampanga",           15.0289,120.6899),
  ...genPlace("2026-02-22","05:00","Angeles City, Pampanga",           15.1472,120.5888),
  ...genPlace("2026-02-22","05:30","Mabalacat, Pampanga",              15.2176,120.5726),
  ...genPlace("2026-02-22","06:00","Capas, Tarlac",                    15.3305,120.5875),
  ...genPlace("2026-02-22","06:30","Tarlac City, Tarlac",              15.4755,120.5963),
  ...genPlace("2026-02-22","07:00","Paniqui, Tarlac",                  15.6636,120.5866),
  ...genPlace("2026-02-22","07:30","Moncada, Tarlac",                  15.7385,120.5672),
  ...genPlace("2026-02-22","08:00","Rosales, Pangasinan",              15.8948,120.6335),
  ...genPlace("2026-02-22","08:35","Urdaneta City, Pangasinan",        15.9760,120.5713),
  ...genPlace("2026-02-22","09:00","RCS Store, Urdaneta City",         15.9830,120.5780),
  ...genPlace("2026-02-22","09:45","Cabanatuan City, Nueva Ecija",     15.4855,120.9662),
  ...genPlace("2026-02-22","10:30","San Leonardo, Nueva Ecija",        15.3596,120.9624),
  ...genPlace("2026-02-22","12:30","Alicia, Isabela",                  16.9889,122.1417),
  ...genPlace("2026-02-22","13:15","Angadanan, Isabela",               16.7831,121.8597),
  ...genPlace("2026-02-22","14:00","Santiago City (Savemore), Isabela",16.6898,121.5497),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 23 – MONDAY  |  Pampanga → Aritao (Acheta RCS), Nueva Vizcaya
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-02-23","05:00","San Fernando, Pampanga",           15.0289,120.6899),
  ...genPlace("2026-02-23","05:30","Angeles City, Pampanga",           15.1472,120.5888),
  ...genPlace("2026-02-23","06:00","Mabalacat, Pampanga",              15.2176,120.5726),
  ...genPlace("2026-02-23","06:30","Capas, Tarlac",                    15.3305,120.5875),
  ...genPlace("2026-02-23","07:00","Tarlac City, Tarlac",              15.4755,120.5963),
  ...genPlace("2026-02-23","07:30","Paniqui, Tarlac",                  15.6636,120.5866),
  ...genPlace("2026-02-23","08:00","Moncada, Tarlac",                  15.7385,120.5672),
  ...genPlace("2026-02-23","08:45","Cabanatuan City, Nueva Ecija",     15.4855,120.9662),
  ...genPlace("2026-02-23","09:30","San Leonardo, Nueva Ecija",        15.3596,120.9624),
  ...genPlace("2026-02-23","10:00","Aliaga, Nueva Ecija",              15.5042,120.8578),
  ...genPlace("2026-02-23","10:30","Gapan, Nueva Ecija",               15.3087,120.9456),
  ...genPlace("2026-02-23","12:30","Aritao (Acheta RCS), Nueva Vizcaya",16.3017,121.0242),
];

// ── Upload ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔑 Authenticating...");
  const token = await getToken(makeJWT());
  console.log("✅ Authenticated!\n");
  console.log(`🚛 Uploading ${ROWS.length} detections across Feb 20–23, 2026`);
  console.log(`   Minimum 10 detections per place — all vehicle type\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < ROWS.length; i++) {
    const r = ROWS[i];
    const fields = {
      vehicleId:     str("truck-001"),
      truckId:       str("truck-001"),
      detectionType: str("vehicle"),
      alertLevel:    str(r.alert),
      latitude:      num(r.lat),
      longitude:     num(r.lon),
      timestamp:     tss(makePHT(r.date, r.t)),
      description:   str(`vehicle detected ${r.dir} at ${r.place}`),
      direction:     str(r.dir),
      placeName:     str(r.place),
      distance:      num(r.dist),
      sensorId:      str(`sensor-${(i % 4) + 1}`),
    };
    try {
      await addDoc(token, fields);
      ok++;
      if (ok % 10 === 0 || ok === ROWS.length)
        process.stdout.write(`\r📡 ${ok}/${ROWS.length} — ${r.date} [${r.t}] ${r.place.slice(0,35).padEnd(35)}`);
    } catch(e) {
      fail++;
      console.error(`\n❌ [${i+1}] ${r.place}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`\n\n🎉 Done! ${ok} uploaded, ${fail} failed.\n`);
  console.log("📅 Feb 20 (Fri): Pampanga → Baguio City + Return       — 310 detections");
  console.log("📅 Feb 21 (Sat): Pampanga → RCS Store Urdaneta          — 100 detections");
  console.log("📅 Feb 22 (Sun): Pampanga → Santiago Savemore, Isabela  — 150 detections");
  console.log("📅 Feb 23 (Mon): Pampanga → Aritao Acheta RCS           — 120 detections");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
