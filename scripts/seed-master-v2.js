/**
 * 🌱 MASTER SEED v2 — Feb 20 through Mar 5, 2026
 * - Every route has GOING + RETURN trip back to Pampanga
 * - Varied detection count per place (10–15, never below 10)
 * - Only MEDIUM and CRITICAL alert levels
 * - All vehicle type
 *
 * Run AFTER deleting:
 *   firebase firestore:delete detections --recursive -f
 *   node scripts/seed-master-v2.js
 */

const https  = require("https");
const crypto = require("crypto");
const fs     = require("fs");
const path   = require("path");

const envVars = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").replace(/\\r\\n/g, "");
});
const PROJECT_ID   = envVars["FIREBASE_PROJECT_ID"] || "blindspot-mode";
const CLIENT_EMAIL = envVars["FIREBASE_CLIENT_EMAIL"];
const PRIVATE_KEY  = envVars["FIREBASE_PRIVATE_KEY"];

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

// ── Cycling pools ─────────────────────────────────────────────────────────────
const LAT_OFF = [0,.0005,-.0003,.0008,-.0005,.0002,-.0007,.0004,-.0001,.0006,.0003,-.0008,.0010,-.0006,.0007,-.0004];
const LON_OFF = [0,.0003,.0006,-.0002,-.0004,.0008,.0001,-.0007,.0005,-.0003,.0009,-.0001,.0004,-.0008,.0006,-.0005];
const ALERTS  = ["MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL"];
const DIRS    = ["left","right","rear","left","right","rear","left","right","rear","left","right","rear","left","right","rear","left"];
const DISTS   = [4.2,2.1,1.5,5.0,2.8,6.1,3.3,5.5,1.8,2.5,4.0,3.8,6.5,1.2,3.6,4.9];

// ── Varied count pool (10–15, never < 10) ─────────────────────────────────────
const COUNT_POOL = [10,12,11,13,10,14,11,12,10,13,11,15,10,12,14,11,10,13,12,11,14,10,12,11,13,10,15,11,12,10,11,13,10,14,12,11,10,13,15,10];
let ci = 0;
const C = () => COUNT_POOL[ci++ % COUNT_POOL.length];

function genPlace(date, startTime, name, lat, lon, count) {
  return Array.from({ length: count }, (_, i) => ({
    date, t: addMins(startTime, i * 2),
    lat: lat + LAT_OFF[i % LAT_OFF.length],
    lon: lon + LON_OFF[i % LON_OFF.length],
    place: name, alert: ALERTS[i % ALERTS.length],
    dir: DIRS[i % DIRS.length], dist: DISTS[i % DISTS.length],
  }));
}

// ── Shorthand ─────────────────────────────────────────────────────────────────
const g = (date, t, name, lat, lon) => genPlace(date, t, name, lat, lon, C());

// ─────────────────────────────────────────────────────────────────────────────
const ROWS = [

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 20 (Friday) — Pampanga → Baguio City → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-02-20","05:00","San Fernando, Pampanga",           15.0289,120.6899),
  ...g("2026-02-20","05:30","Angeles City, Pampanga",           15.1472,120.5888),
  ...g("2026-02-20","05:58","Mabalacat, Pampanga",              15.2176,120.5726),
  ...g("2026-02-20","06:30","Capas, Tarlac",                    15.3305,120.5875),
  ...g("2026-02-20","07:00","Tarlac City, Tarlac",              15.4755,120.5963),
  ...g("2026-02-20","07:30","Paniqui, Tarlac",                  15.6636,120.5866),
  ...g("2026-02-20","08:00","Moncada, Tarlac",                  15.7385,120.5672),
  ...g("2026-02-20","08:35","Rosales, Pangasinan",              15.8948,120.6335),
  ...g("2026-02-20","09:00","Urdaneta, Pangasinan",             15.9760,120.5713),
  ...g("2026-02-20","09:25","Villasis, Pangasinan",             15.9020,120.5879),
  ...g("2026-02-20","10:00","Sison, Pangasinan",                16.1671,120.4631),
  ...g("2026-02-20","10:30","Rosario, La Union",                16.2082,120.4882),
  ...g("2026-02-20","11:00","Marcos Highway, Benguet",          16.3250,120.4700),
  ...g("2026-02-20","11:30","Tuba, Benguet",                    16.3840,120.4626),
  ...g("2026-02-20","12:00","La Trinidad, Benguet",             16.4604,120.5878),
  ...g("2026-02-20","12:30","Baguio City Proper, Super Value",  16.4023,120.5960),
  // Return
  ...g("2026-02-20","14:30","La Trinidad, Benguet",             16.4622,120.5890),
  ...g("2026-02-20","15:00","Tuba, Benguet",                    16.3855,120.4640),
  ...g("2026-02-20","15:30","Marcos Highway, Benguet",          16.3380,120.4660),
  ...g("2026-02-20","16:00","Rosario, La Union",                16.2095,120.4895),
  ...g("2026-02-20","16:35","Sison, Pangasinan",                16.1690,120.4648),
  ...g("2026-02-20","17:00","Villasis, Pangasinan",             15.9030,120.5886),
  ...g("2026-02-20","17:25","Urdaneta, Pangasinan",             15.9775,120.5725),
  ...g("2026-02-20","17:55","Rosales, Pangasinan",              15.8962,120.6348),
  ...g("2026-02-20","18:30","Moncada, Tarlac",                  15.7401,120.5685),
  ...g("2026-02-20","19:00","Paniqui, Tarlac",                  15.6651,120.5880),
  ...g("2026-02-20","19:30","Tarlac City, Tarlac",              15.4772,120.5975),
  ...g("2026-02-20","20:00","Capas, Tarlac",                    15.3321,120.5890),
  ...g("2026-02-20","20:35","Mabalacat, Pampanga",              15.2195,120.5740),
  ...g("2026-02-20","21:00","Angeles City, Pampanga",           15.1490,120.5902),
  ...g("2026-02-20","21:30","San Fernando, Pampanga",           15.0308,120.6915),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 21 (Saturday) — Pampanga → RCS Store Urdaneta → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-02-21","05:00","San Fernando, Pampanga",           15.0289,120.6899),
  ...g("2026-02-21","05:30","Angeles City, Pampanga",           15.1472,120.5888),
  ...g("2026-02-21","06:00","Mabalacat, Pampanga",              15.2176,120.5726),
  ...g("2026-02-21","06:40","Capas, Tarlac",                    15.3305,120.5875),
  ...g("2026-02-21","07:15","Tarlac City, Tarlac",              15.4755,120.5963),
  ...g("2026-02-21","07:50","Paniqui, Tarlac",                  15.6636,120.5866),
  ...g("2026-02-21","08:25","Moncada, Tarlac",                  15.7385,120.5672),
  ...g("2026-02-21","09:00","Rosales, Pangasinan",              15.8948,120.6335),
  ...g("2026-02-21","09:35","Urdaneta City, Pangasinan",        15.9760,120.5713),
  ...g("2026-02-21","10:05","RCS Store, Urdaneta City",         15.9830,120.5780),
  // Return
  ...g("2026-02-21","11:30","Urdaneta City, Pangasinan",        15.9770,120.5720),
  ...g("2026-02-21","12:05","Rosales, Pangasinan",              15.8955,120.6340),
  ...g("2026-02-21","12:40","Moncada, Tarlac",                  15.7395,120.5680),
  ...g("2026-02-21","13:15","Paniqui, Tarlac",                  15.6642,120.5872),
  ...g("2026-02-21","13:50","Tarlac City, Tarlac",              15.4762,120.5970),
  ...g("2026-02-21","14:25","Capas, Tarlac",                    15.3312,120.5882),
  ...g("2026-02-21","15:00","Mabalacat, Pampanga",              15.2188,120.5733),
  ...g("2026-02-21","15:35","Angeles City, Pampanga",           15.1480,120.5895),
  ...g("2026-02-21","16:05","San Fernando, Pampanga",           15.0295,120.6905),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 22 (Sunday) — Pampanga → Santiago Savemore, Isabela → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-02-22","04:30","San Fernando, Pampanga",           15.0289,120.6899),
  ...g("2026-02-22","05:00","Angeles City, Pampanga",           15.1472,120.5888),
  ...g("2026-02-22","05:30","Mabalacat, Pampanga",              15.2176,120.5726),
  ...g("2026-02-22","06:00","Capas, Tarlac",                    15.3305,120.5875),
  ...g("2026-02-22","06:30","Tarlac City, Tarlac",              15.4755,120.5963),
  ...g("2026-02-22","07:00","Paniqui, Tarlac",                  15.6636,120.5866),
  ...g("2026-02-22","07:30","Moncada, Tarlac",                  15.7385,120.5672),
  ...g("2026-02-22","08:00","Rosales, Pangasinan",              15.8948,120.6335),
  ...g("2026-02-22","08:35","Urdaneta City, Pangasinan",        15.9760,120.5713),
  ...g("2026-02-22","09:00","RCS Store, Urdaneta City",         15.9830,120.5780),
  ...g("2026-02-22","09:45","Cabanatuan City, Nueva Ecija",     15.4855,120.9662),
  ...g("2026-02-22","10:30","San Leonardo, Nueva Ecija",        15.3596,120.9624),
  ...g("2026-02-22","12:30","Alicia, Isabela",                  16.9889,122.1417),
  ...g("2026-02-22","13:15","Angadanan, Isabela",               16.7831,121.8597),
  ...g("2026-02-22","14:00","Santiago City (Savemore), Isabela",16.6898,121.5497),
  // Return
  ...g("2026-02-22","15:30","Angadanan, Isabela",               16.7840,121.8605),
  ...g("2026-02-22","16:15","Alicia, Isabela",                  16.9900,122.1425),
  ...g("2026-02-22","17:10","San Leonardo, Nueva Ecija",        15.3605,120.9630),
  ...g("2026-02-22","18:00","Cabanatuan City, Nueva Ecija",     15.4862,120.9670),
  ...g("2026-02-22","19:30","Tarlac City, Tarlac",              15.4768,120.5970),
  ...g("2026-02-22","20:30","Mabalacat, Pampanga",              15.2188,120.5733),
  ...g("2026-02-22","21:10","Angeles City, Pampanga",           15.1480,120.5895),
  ...g("2026-02-22","21:45","San Fernando, Pampanga",           15.0293,120.6908),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 23 (Monday) — Pampanga → Aritao (Acheta RCS), Nueva Vizcaya → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-02-23","05:00","San Fernando, Pampanga",           15.0289,120.6899),
  ...g("2026-02-23","05:30","Angeles City, Pampanga",           15.1472,120.5888),
  ...g("2026-02-23","06:00","Mabalacat, Pampanga",              15.2176,120.5726),
  ...g("2026-02-23","06:30","Capas, Tarlac",                    15.3305,120.5875),
  ...g("2026-02-23","07:00","Tarlac City, Tarlac",              15.4755,120.5963),
  ...g("2026-02-23","07:30","Paniqui, Tarlac",                  15.6636,120.5866),
  ...g("2026-02-23","08:00","Moncada, Tarlac",                  15.7385,120.5672),
  ...g("2026-02-23","08:45","Cabanatuan City, Nueva Ecija",     15.4855,120.9662),
  ...g("2026-02-23","09:30","San Leonardo, Nueva Ecija",        15.3596,120.9624),
  ...g("2026-02-23","10:00","Aliaga, Nueva Ecija",              15.5042,120.8578),
  ...g("2026-02-23","10:30","Gapan, Nueva Ecija",               15.3087,120.9456),
  ...g("2026-02-23","12:30","Aritao (Acheta RCS), Nueva Vizcaya",16.3017,121.0242),
  // Return
  ...g("2026-02-23","14:00","Gapan, Nueva Ecija",               15.3095,120.9462),
  ...g("2026-02-23","14:45","Aliaga, Nueva Ecija",              15.5050,120.8585),
  ...g("2026-02-23","15:20","San Leonardo, Nueva Ecija",        15.3602,120.9630),
  ...g("2026-02-23","16:00","Cabanatuan City, Nueva Ecija",     15.4862,120.9670),
  ...g("2026-02-23","17:00","Moncada, Tarlac",                  15.7395,120.5680),
  ...g("2026-02-23","17:35","Paniqui, Tarlac",                  15.6642,120.5872),
  ...g("2026-02-23","18:10","Tarlac City, Tarlac",              15.4762,120.5970),
  ...g("2026-02-23","18:45","Capas, Tarlac",                    15.3312,120.5882),
  ...g("2026-02-23","19:20","Mabalacat, Pampanga",              15.2188,120.5733),
  ...g("2026-02-23","19:55","Angeles City, Pampanga",           15.1480,120.5895),
  ...g("2026-02-23","20:30","San Fernando, Pampanga",           15.0295,120.6905),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 26 (Thursday) — Pampanga → Ilagan (Puregold), Isabela → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-02-26","04:00","URC Pampanga, San Fernando",        15.0350,120.6950),
  ...g("2026-02-26","04:30","San Fernando, Pampanga",            15.0289,120.6899),
  ...g("2026-02-26","04:55","Lubao, Pampanga",                   14.9281,120.5997),
  ...g("2026-02-26","05:20","Guagua, Pampanga",                  14.9657,120.6339),
  ...g("2026-02-26","05:45","Mabalacat, Pampanga",               15.2176,120.5726),
  ...g("2026-02-26","06:08","Angeles City, Pampanga",            15.1472,120.5888),
  ...g("2026-02-26","06:35","SCTEx, Tarlac",                     15.3780,120.5850),
  ...g("2026-02-26","07:00","Tarlac, Tarlac",                    15.4755,120.5963),
  ...g("2026-02-26","07:30","Tarlac City, Tarlac",               15.4820,120.6010),
  ...g("2026-02-26","08:10","Gapan, Nueva Ecija",                15.3087,120.9456),
  ...g("2026-02-26","09:00","Maharlika Highway (AH26)",          15.6500,121.0500),
  ...g("2026-02-26","10:30","Nueva Vizcaya",                     16.3200,121.0000),
  ...g("2026-02-26","12:30","Ilagan City (Puregold), Isabela",   17.1456,121.8905),
  // Return
  ...g("2026-02-26","14:00","Nueva Vizcaya",                     16.3210,121.0010),
  ...g("2026-02-26","15:30","Maharlika Highway (AH26)",          15.6510,121.0510),
  ...g("2026-02-26","16:30","Gapan, Nueva Ecija",                15.3095,120.9462),
  ...g("2026-02-26","17:30","Tarlac City, Tarlac",               15.4762,120.5970),
  ...g("2026-02-26","18:10","SCTEx, Tarlac",                     15.3788,120.5858),
  ...g("2026-02-26","18:45","Angeles City, Pampanga",            15.1480,120.5895),
  ...g("2026-02-26","19:20","Mabalacat, Pampanga",               15.2188,120.5733),
  ...g("2026-02-26","19:55","Guagua, Pampanga",                  14.9665,120.6345),
  ...g("2026-02-26","20:30","Lubao, Pampanga",                   14.9289,120.6003),
  ...g("2026-02-26","21:00","San Fernando, Pampanga",            15.0295,120.6905),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 28 (Saturday) — San Fernando → Meycauayan (Puregold) → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-02-28","05:00","San Fernando (URC), Pampanga",      15.0350,120.6950),
  ...g("2026-02-28","05:25","Mabalacat, Pampanga",               15.2176,120.5726),
  ...g("2026-02-28","05:48","NLEX Entrance",                     15.1300,120.5800),
  ...g("2026-02-28","06:15","NLEX Service Road",                 14.9800,120.8500),
  ...g("2026-02-28","06:50","Exit to Meycauayan, Bulacan",       14.7450,120.9650),
  ...g("2026-02-28","07:10","Meycauayan, Bulacan",               14.7340,120.9580),
  ...g("2026-02-28","07:35","Quinale Rd / Pambansang Daan",      14.7360,120.9600),
  ...g("2026-02-28","08:00","Puregold Meycauayan Proper",        14.7380,120.9620),
  // Return
  ...g("2026-02-28","09:30","Quinale Rd / Pambansang Daan",      14.7368,120.9608),
  ...g("2026-02-28","09:55","Meycauayan, Bulacan",               14.7348,120.9588),
  ...g("2026-02-28","10:20","Exit to Meycauayan, Bulacan",       14.7458,120.9658),
  ...g("2026-02-28","10:45","NLEX Service Road",                 14.9808,120.8508),
  ...g("2026-02-28","11:15","NLEX Entrance",                     15.1308,120.5808),
  ...g("2026-02-28","11:45","Mabalacat, Pampanga",               15.2188,120.5733),
  ...g("2026-02-28","12:15","San Fernando, Pampanga",            15.0295,120.6905),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 1 (Sunday) — URC Pampanga → Aparri (Savemore), Cagayan → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-03-01","03:00","URC Pampanga, San Fernando",        15.0350,120.6950),
  ...g("2026-03-01","03:25","Mabalacat, Pampanga",               15.2176,120.5726),
  ...g("2026-03-01","03:50","San Fernando, Pampanga",            15.0289,120.6899),
  ...g("2026-03-01","04:15","Bacolor, Pampanga",                 15.0169,120.6527),
  ...g("2026-03-01","04:38","San Simon, Pampanga",               15.0432,120.7776),
  ...g("2026-03-01","05:02","Apalit, Pampanga",                  14.9538,120.7597),
  ...g("2026-03-01","05:30","Baliwag, Bulacan",                  14.9535,120.9091),
  ...g("2026-03-01","06:00","Plaridel, Bulacan",                 14.8699,120.8569),
  ...g("2026-03-01","06:45","Cabanatuan City, Nueva Ecija",      15.4855,120.9662),
  ...g("2026-03-01","07:30","Talavera, Nueva Ecija",             15.6008,120.9313),
  ...g("2026-03-01","09:00","Ilagan City, Isabela",              17.1456,121.8905),
  ...g("2026-03-01","10:00","Santiago City, Isabela",            16.6898,121.5497),
  ...g("2026-03-01","11:30","Tuguegarao City, Cagayan",          17.6132,121.7270),
  ...g("2026-03-01","12:30","Cagayan Valley",                    17.9000,121.8000),
  ...g("2026-03-01","13:30","Aparri, Cagayan (Savemore)",        18.3556,121.6377),
  // Return
  ...g("2026-03-01","15:00","Cagayan Valley",                    17.9010,121.8010),
  ...g("2026-03-01","16:00","Tuguegarao City, Cagayan",          17.6140,121.7278),
  ...g("2026-03-01","17:00","Santiago City, Isabela",            16.6905,121.5505),
  ...g("2026-03-01","18:30","Ilagan City, Isabela",              17.1464,121.8913),
  ...g("2026-03-01","19:30","Talavera, Nueva Ecija",             15.6015,120.9320),
  ...g("2026-03-01","21:00","Cabanatuan City, Nueva Ecija",      15.4862,120.9670),
  ...g("2026-03-01","22:00","Plaridel, Bulacan",                 14.8707,120.8577),
  ...g("2026-03-01","22:35","Baliwag, Bulacan",                  14.9542,120.9098),
  ...g("2026-03-01","23:10","Apalit, Pampanga",                  14.9545,120.7604),
  ...g("2026-03-01","23:40","San Simon, Pampanga",               15.0440,120.7783),
  ...g("2026-03-02","00:10","Bacolor, Pampanga",                 15.0176,120.6534),
  ...g("2026-03-02","00:40","San Fernando, Pampanga",            15.0293,120.6908),
  ...g("2026-03-02","01:05","Mabalacat, Pampanga",               15.2183,120.5730),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 3 — Route A: San Fernando → Meycauayan (Puregold) → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-03-03","05:00","San Fernando (URC), Pampanga",      15.0350,120.6950),
  ...g("2026-03-03","05:25","Mabalacat, Pampanga",               15.2176,120.5726),
  ...g("2026-03-03","05:48","NLEX Entrance",                     15.1300,120.5800),
  ...g("2026-03-03","06:15","NLEX Service Road",                 14.9800,120.8500),
  ...g("2026-03-03","06:50","Exit to Meycauayan, Bulacan",       14.7450,120.9650),
  ...g("2026-03-03","07:10","Meycauayan, Bulacan",               14.7340,120.9580),
  ...g("2026-03-03","07:35","Quinale Rd / Pambansang Daan",      14.7360,120.9600),
  ...g("2026-03-03","08:00","Puregold Meycauayan Proper",        14.7380,120.9620),
  // Return A
  ...g("2026-03-03","09:30","Quinale Rd / Pambansang Daan",      14.7368,120.9608),
  ...g("2026-03-03","09:55","Meycauayan, Bulacan",               14.7348,120.9588),
  ...g("2026-03-03","10:20","NLEX Service Road",                 14.9808,120.8508),
  ...g("2026-03-03","10:50","NLEX Entrance",                     15.1308,120.5808),
  ...g("2026-03-03","11:20","Mabalacat, Pampanga",               15.2188,120.5733),
  ...g("2026-03-03","11:50","San Fernando, Pampanga",            15.0295,120.6905),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 3 — Route B: Mabalacat → Subic (SaveMore), Zambales → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-03-03","13:00","Mabalacat, Pampanga",               15.2176,120.5726),
  ...g("2026-03-03","13:25","San Fernando, Pampanga",            15.0289,120.6899),
  ...g("2026-03-03","13:50","Bacolor, Pampanga",                 15.0169,120.6527),
  ...g("2026-03-03","14:12","Lubao, Pampanga",                   14.9281,120.5997),
  ...g("2026-03-03","14:35","San Simon, Pampanga",               15.0432,120.7776),
  ...g("2026-03-03","14:58","Masantol, Pampanga",                14.8992,120.7176),
  ...g("2026-03-03","15:20","Guagua, Pampanga",                  14.9657,120.6339),
  ...g("2026-03-03","15:50","Dinalupihan, Bataan",               14.8786,120.4686),
  ...g("2026-03-03","16:20","Hermosa, Bataan",                   14.8335,120.5046),
  ...g("2026-03-03","17:00","Subic, Zambales (SaveMore)",        14.7284,120.2397),
  // Return B
  ...g("2026-03-03","18:30","Hermosa, Bataan",                   14.8342,120.5053),
  ...g("2026-03-03","19:00","Dinalupihan, Bataan",               14.8793,120.4693),
  ...g("2026-03-03","19:30","Guagua, Pampanga",                  14.9665,120.6345),
  ...g("2026-03-03","20:00","Masantol, Pampanga",                14.9000,120.7183),
  ...g("2026-03-03","20:30","San Simon, Pampanga",               15.0440,120.7783),
  ...g("2026-03-03","21:00","Lubao, Pampanga",                   14.9289,120.6003),
  ...g("2026-03-03","21:30","Bacolor, Pampanga",                 15.0176,120.6534),
  ...g("2026-03-03","22:00","San Fernando, Pampanga",            15.0293,120.6908),
  ...g("2026-03-03","22:30","Mabalacat, Pampanga",               15.2183,120.5730),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 5 (Thursday) — Pampanga → Santiago (Super Value), Isabela → RETURN
  // ══════════════════════════════════════════════════════════════════════════
  ...g("2026-03-05","04:00","Mabalacat, Pampanga",               15.2176,120.5726),
  ...g("2026-03-05","04:25","San Fernando, Pampanga",            15.0289,120.6899),
  ...g("2026-03-05","04:48","Bacolor, Pampanga",                 15.0169,120.6527),
  ...g("2026-03-05","05:10","Lubao, Pampanga",                   14.9281,120.5997),
  ...g("2026-03-05","05:32","San Simon, Pampanga",               15.0432,120.7776),
  ...g("2026-03-05","05:55","Masantol, Pampanga",                14.8992,120.7176),
  ...g("2026-03-05","06:18","Guagua, Pampanga",                  14.9657,120.6339),
  ...g("2026-03-05","06:50","San Ildefonso, Bulacan",            14.9744,121.0103),
  ...g("2026-03-05","07:20","Baliwag, Bulacan",                  14.9535,120.9091),
  ...g("2026-03-05","07:48","Plaridel, Bulacan",                 14.8699,120.8569),
  ...g("2026-03-05","08:30","Cabanatuan City, Nueva Ecija",      15.4855,120.9662),
  ...g("2026-03-05","09:15","Talavera, Nueva Ecija",             15.6008,120.9313),
  ...g("2026-03-05","09:45","Aliaga, Nueva Ecija",               15.5042,120.8578),
  ...g("2026-03-05","10:15","Cuyapo, Nueva Ecija",               15.7872,120.8728),
  ...g("2026-03-05","12:00","Ilagan City, Isabela",              17.1456,121.8905),
  ...g("2026-03-05","13:00","Santiago City (Super Value), Isabela",16.6898,121.5497),
  // Return
  ...g("2026-03-05","14:30","Ilagan City, Isabela",              17.1464,121.8913),
  ...g("2026-03-05","15:30","Cuyapo, Nueva Ecija",               15.7880,120.8736),
  ...g("2026-03-05","16:10","Aliaga, Nueva Ecija",               15.5050,120.8585),
  ...g("2026-03-05","16:45","Talavera, Nueva Ecija",             15.6015,120.9320),
  ...g("2026-03-05","17:20","Cabanatuan City, Nueva Ecija",      15.4862,120.9670),
  ...g("2026-03-05","18:20","Plaridel, Bulacan",                 14.8707,120.8577),
  ...g("2026-03-05","18:55","Baliwag, Bulacan",                  14.9542,120.9098),
  ...g("2026-03-05","19:30","San Ildefonso, Bulacan",            14.9752,121.0110),
  ...g("2026-03-05","20:10","Guagua, Pampanga",                  14.9665,120.6345),
  ...g("2026-03-05","20:45","Masantol, Pampanga",                14.9000,120.7183),
  ...g("2026-03-05","21:15","San Simon, Pampanga",               15.0440,120.7783),
  ...g("2026-03-05","21:45","Lubao, Pampanga",                   14.9289,120.6003),
  ...g("2026-03-05","22:15","Bacolor, Pampanga",                 15.0176,120.6534),
  ...g("2026-03-05","22:45","San Fernando, Pampanga",            15.0293,120.6908),
  ...g("2026-03-05","23:15","Mabalacat, Pampanga",               15.2183,120.5730),
];

// ── Upload ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔑 Authenticating...");
  const token = await getToken(makeJWT());
  console.log(`✅ Authenticated!\n`);
  console.log(`🚛 Uploading ${ROWS.length} detections — Feb 20 to Mar 5 (all with return trips)`);
  console.log(`   Varied counts (10–15 per place) — MEDIUM/CRITICAL only — all vehicle\n`);

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
      if (ok % 20 === 0 || ok === ROWS.length)
        process.stdout.write(`\r📡 ${ok}/${ROWS.length} — ${r.date} [${r.t}] ${r.place.slice(0,36).padEnd(36)}`);
    } catch(e) {
      fail++;
      console.error(`\n❌ [${i+1}] ${r.place}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 55));
  }
  console.log(`\n\n🎉 Done! ${ok} uploaded, ${fail} failed.`);
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
