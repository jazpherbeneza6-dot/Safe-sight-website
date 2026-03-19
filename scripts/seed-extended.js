/**
 * 🌱 Extended Seed – Feb 26, Feb 28, Mar 1, Mar 3 (x2), Mar 5
 * All vehicle type, minimum 10 detections per place.
 * Run: node scripts/seed-extended.js
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

const LAT_OFF = [0,.0005,-.0003,.0008,-.0005,.0002,-.0007,.0004,-.0001,.0006,.0003,-.0008];
const LON_OFF = [0,.0003,.0006,-.0002,-.0004,.0008,.0001,-.0007,.0005,-.0003,.0009,-.0001];
const ALERTS  = ["MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL"];
const DIRS    = ["left","right","rear","left","right","rear","left","right","rear","left","right","rear"];
const DISTS   = [4.2, 2.1, 1.5, 5.0, 2.8, 6.1, 3.3, 5.5, 1.8, 2.5, 4.0, 3.8];

function genPlace(date, startTime, name, lat, lon, count=10) {
  return Array.from({ length: count }, (_, i) => ({
    date, t: addMins(startTime, i * 2),
    lat: lat + LAT_OFF[i % LAT_OFF.length],
    lon: lon + LON_OFF[i % LON_OFF.length],
    place: name,
    alert: ALERTS[i % ALERTS.length],
    dir:   DIRS[i % DIRS.length],
    dist:  DISTS[i % DISTS.length],
  }));
}

const ROWS = [

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 26 – THURSDAY  |  Pampanga → Ilagan, Isabela (Puregold)
  //  via SCTEx → Tarlac → Nueva Ecija → Maharlika Hwy → Nueva Vizcaya → Isabela
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-02-26","04:00","URC Pampanga, San Fernando",        15.0350,120.6950),
  ...genPlace("2026-02-26","04:30","San Fernando, Pampanga",            15.0289,120.6899),
  ...genPlace("2026-02-26","04:55","Lubao, Pampanga",                   14.9281,120.5997),
  ...genPlace("2026-02-26","05:20","Guagua, Pampanga",                  14.9657,120.6339),
  ...genPlace("2026-02-26","05:45","Mabalacat, Pampanga",               15.2176,120.5726),
  ...genPlace("2026-02-26","06:08","Angeles City, Pampanga",            15.1472,120.5888),
  ...genPlace("2026-02-26","06:35","SCTEx, Tarlac",                     15.3780,120.5850),
  ...genPlace("2026-02-26","07:00","Tarlac, Tarlac",                    15.4755,120.5963),
  ...genPlace("2026-02-26","07:30","Tarlac City, Tarlac",               15.4820,120.6010),
  ...genPlace("2026-02-26","08:10","Gapan, Nueva Ecija",                15.3087,120.9456),
  ...genPlace("2026-02-26","09:00","Maharlika Highway (AH26), Nueva Ecija", 15.6500,121.0500),
  ...genPlace("2026-02-26","10:30","Nueva Vizcaya",                     16.3200,121.0000),
  ...genPlace("2026-02-26","12:30","Ilagan City (Puregold), Isabela",   17.1456,121.8905),

  // ══════════════════════════════════════════════════════════════════════════
  //  FEB 28 – SATURDAY  |  Meycauayan, Bulacan (Puregold)
  //  San Fernando URC → Mabalacat → NLEX → Meycauayan → Puregold
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-02-28","05:00","San Fernando (URC), Pampanga",      15.0350,120.6950),
  ...genPlace("2026-02-28","05:25","Mabalacat, Pampanga",               15.2176,120.5726),
  ...genPlace("2026-02-28","05:48","NLEX Entrance",                     15.1300,120.5800),
  ...genPlace("2026-02-28","06:15","NLEX Service Road",                 14.9800,120.8500),
  ...genPlace("2026-02-28","06:50","Exit to Meycauayan, Bulacan",       14.7450,120.9650),
  ...genPlace("2026-02-28","07:10","Meycauayan, Bulacan",               14.7340,120.9580),
  ...genPlace("2026-02-28","07:35","Quinale Rd / Pambansang Daan",      14.7360,120.9600),
  ...genPlace("2026-02-28","08:00","Puregold Meycauayan Proper",        14.7380,120.9620),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 1 – SUNDAY  |  Aparri, Cagayan (Savemore) — long haul
  //  URC Pampanga → Mabalacat → San Fernando → Bacolor → San Simon →
  //  Apalit → Baliwag → Plaridel → Cabanatuan → Talavera → Ilagan →
  //  Santiago → Tuguegarao → Cagayan Valley → Aparri, Cagayan
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-03-01","03:00","URC Pampanga, San Fernando",        15.0350,120.6950),
  ...genPlace("2026-03-01","03:25","Mabalacat, Pampanga",               15.2176,120.5726),
  ...genPlace("2026-03-01","03:50","San Fernando, Pampanga",            15.0289,120.6899),
  ...genPlace("2026-03-01","04:15","Bacolor, Pampanga",                 15.0169,120.6527),
  ...genPlace("2026-03-01","04:38","San Simon, Pampanga",               15.0432,120.7776),
  ...genPlace("2026-03-01","05:02","Apalit, Pampanga",                  14.9538,120.7597),
  ...genPlace("2026-03-01","05:30","Baliwag, Bulacan",                  14.9535,120.9091),
  ...genPlace("2026-03-01","06:00","Plaridel, Bulacan",                 14.8699,120.8569),
  ...genPlace("2026-03-01","06:45","Cabanatuan City, Nueva Ecija",      15.4855,120.9662),
  ...genPlace("2026-03-01","07:30","Talavera, Nueva Ecija",             15.6008,120.9313),
  ...genPlace("2026-03-01","09:00","Ilagan City, Isabela",              17.1456,121.8905),
  ...genPlace("2026-03-01","10:00","Santiago City, Isabela",            16.6898,121.5497),
  ...genPlace("2026-03-01","11:30","Tuguegarao City, Cagayan",          17.6132,121.7270),
  ...genPlace("2026-03-01","12:30","Cagayan Valley",                    17.9000,121.8000),
  ...genPlace("2026-03-01","13:30","Aparri, Cagayan (Savemore)",        18.3556,121.6377),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 3 – TUESDAY (Route A)  |  Meycauayan, Bulacan (Puregold)
  //  Same as Feb 28 route
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-03-03","05:00","San Fernando (URC), Pampanga",      15.0350,120.6950),
  ...genPlace("2026-03-03","05:25","Mabalacat, Pampanga",               15.2176,120.5726),
  ...genPlace("2026-03-03","05:48","NLEX Entrance",                     15.1300,120.5800),
  ...genPlace("2026-03-03","06:15","NLEX Service Road",                 14.9800,120.8500),
  ...genPlace("2026-03-03","06:50","Exit to Meycauayan, Bulacan",       14.7450,120.9650),
  ...genPlace("2026-03-03","07:10","Meycauayan, Bulacan",               14.7340,120.9580),
  ...genPlace("2026-03-03","07:35","Quinale Rd / Pambansang Daan",      14.7360,120.9600),
  ...genPlace("2026-03-03","08:00","Puregold Meycauayan Proper",        14.7380,120.9620),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 3 – TUESDAY (Route B)  |  Subic, Zambales (SaveMore)
  //  Mabalacat → San Fernando → Bacolor → Lubao → San Simon →
  //  Masantol → Guagua → Dinalupihan → Hermosa → Subic (SaveMore)
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-03-03","10:00","Mabalacat, Pampanga",               15.2176,120.5726),
  ...genPlace("2026-03-03","10:25","San Fernando, Pampanga",            15.0289,120.6899),
  ...genPlace("2026-03-03","10:50","Bacolor, Pampanga",                 15.0169,120.6527),
  ...genPlace("2026-03-03","11:12","Lubao, Pampanga",                   14.9281,120.5997),
  ...genPlace("2026-03-03","11:35","San Simon, Pampanga",               15.0432,120.7776),
  ...genPlace("2026-03-03","11:58","Masantol, Pampanga",                14.8992,120.7176),
  ...genPlace("2026-03-03","12:20","Guagua, Pampanga",                  14.9657,120.6339),
  ...genPlace("2026-03-03","12:50","Dinalupihan, Bataan",               14.8786,120.4686),
  ...genPlace("2026-03-03","13:20","Hermosa, Bataan",                   14.8335,120.5046),
  ...genPlace("2026-03-03","14:00","Subic, Zambales (SaveMore)",        14.7284,120.2397),

  // ══════════════════════════════════════════════════════════════════════════
  //  MARCH 5 – THURSDAY  |  Santiago, Isabela (Super Value)
  //  Mabalacat → San Fernando → Bacolor → Lubao → San Simon →
  //  Masantol → Guagua → San Ildefonso → Baliwag → Plaridel →
  //  Cabanatuan → Talavera → Aliaga → Cuyapo → Ilagan → Santiago (Super Value)
  // ══════════════════════════════════════════════════════════════════════════
  ...genPlace("2026-03-05","04:00","Mabalacat, Pampanga",               15.2176,120.5726),
  ...genPlace("2026-03-05","04:25","San Fernando, Pampanga",            15.0289,120.6899),
  ...genPlace("2026-03-05","04:48","Bacolor, Pampanga",                 15.0169,120.6527),
  ...genPlace("2026-03-05","05:10","Lubao, Pampanga",                   14.9281,120.5997),
  ...genPlace("2026-03-05","05:32","San Simon, Pampanga",               15.0432,120.7776),
  ...genPlace("2026-03-05","05:55","Masantol, Pampanga",                14.8992,120.7176),
  ...genPlace("2026-03-05","06:18","Guagua, Pampanga",                  14.9657,120.6339),
  ...genPlace("2026-03-05","06:50","San Ildefonso, Bulacan",            14.9744,121.0103),
  ...genPlace("2026-03-05","07:20","Baliwag, Bulacan",                  14.9535,120.9091),
  ...genPlace("2026-03-05","07:48","Plaridel, Bulacan",                 14.8699,120.8569),
  ...genPlace("2026-03-05","08:30","Cabanatuan City, Nueva Ecija",      15.4855,120.9662),
  ...genPlace("2026-03-05","09:15","Talavera, Nueva Ecija",             15.6008,120.9313),
  ...genPlace("2026-03-05","09:45","Aliaga, Nueva Ecija",               15.5042,120.8578),
  ...genPlace("2026-03-05","10:15","Cuyapo, Nueva Ecija",               15.7872,120.8728),
  ...genPlace("2026-03-05","12:00","Ilagan City, Isabela",              17.1456,121.8905),
  ...genPlace("2026-03-05","13:00","Santiago City (Super Value), Isabela", 16.6898,121.5497),
];

async function main() {
  console.log("🔑 Authenticating...");
  const token = await getToken(makeJWT());
  console.log(`✅ Authenticated!\n`);
  console.log(`🚛 Uploading ${ROWS.length} detections — Feb 26, Feb 28, Mar 1, Mar 3 (x2), Mar 5`);
  console.log(`   Minimum 10 per place — all vehicle type\n`);

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
        process.stdout.write(`\r📡 ${ok}/${ROWS.length} — ${r.date} [${r.t}] ${r.place.slice(0,38).padEnd(38)}`);
    } catch(e) {
      fail++;
      console.error(`\n❌ [${i+1}] ${r.place}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`\n\n🎉 Done! ${ok} uploaded, ${fail} failed.\n`);
  console.log("📅 Feb 26 (Thu): Pampanga → Ilagan (Puregold), Isabela        — 130 detections");
  console.log("📅 Feb 28 (Sat): San Fernando → Meycauayan (Puregold), Bulacan —  80 detections");
  console.log("📅 Mar 01 (Sun): URC Pampanga → Aparri (Savemore), Cagayan     — 150 detections");
  console.log("📅 Mar 03 (Tue): Route A — Meycauayan Bulacan (Puregold)        —  80 detections");
  console.log("📅 Mar 03 (Tue): Route B — Subic (SaveMore), Zambales           — 100 detections");
  console.log("📅 Mar 05 (Thu): Pampanga → Santiago (Super Value), Isabela     — 160 detections");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
