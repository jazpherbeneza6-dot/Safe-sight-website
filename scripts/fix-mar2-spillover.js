/**
 * Fix script: deletes any detections with timestamp on 2026-03-02
 * and re-uploads them compressed into Mar 1 (before midnight PHT).
 *
 * node scripts/fix-mar2-spillover.js
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
  const s = crypto.createSign("RSA-SHA256"); s.update(`${h}.${p}`);
  return `${h}.${p}.${s.sign(PRIVATE_KEY,"base64url")}`;
}
function getToken(jwt) {
  return new Promise((res, rej) => {
    const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req  = https.request({ hostname:"oauth2.googleapis.com", path:"/token", method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded","Content-Length":Buffer.byteLength(body)} }, r => { let d=""; r.on("data",c=>d+=c); r.on("end",()=>{ const p=JSON.parse(d); p.access_token?res(p.access_token):rej(new Error(d)); }); });
    req.on("error",rej); req.write(body); req.end();
  });
}

function request(token, method, path_, body) {
  return new Promise((res, rej) => {
    const raw = body ? JSON.stringify(body) : null;
    const headers = { "Authorization":`Bearer ${token}`, "Content-Type":"application/json" };
    if (raw) headers["Content-Length"] = Buffer.byteLength(raw);
    const req = https.request({ hostname:"firestore.googleapis.com", path:path_, method, headers }, r => {
      let d = ""; r.on("data",c=>d+=c);
      r.on("end",()=>{ try { res({ status:r.statusCode, body: d ? JSON.parse(d) : {} }); } catch(e) { res({ status:r.statusCode, body:d }); }});
    });
    req.on("error",rej); if (raw) req.write(raw); req.end();
  });
}

const BASE = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// List all docs on 2026-03-02 UTC (= Mar 2 00:00 PHT to Mar 2 23:59 PHT)
// In UTC: Mar 1 16:00 UTC to Mar 2 15:59 UTC
async function listSpilloverDocs(token) {
  const body = {
    structuredQuery: {
      from: [{ collectionId: "detections" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "timestamp" },
                op: "GREATER_THAN_OR_EQUAL",
                value: { timestampValue: "2026-03-01T16:00:00Z" }  // Mar 2 00:00 PHT
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: "timestamp" },
                op: "LESS_THAN",
                value: { timestampValue: "2026-03-02T16:00:00Z" }  // Mar 3 00:00 PHT (exclusive)
              }
            }
          ]
        }
      }
    }
  };
  const r = await request(token, "POST", `${BASE}:runQuery`, body);
  return (r.body || []).filter(x => x.document).map(x => x.document);
}

async function deleteDoc(token, name) {
  const p = name.replace("projects", "/v1/projects"); // ensure /v1/ prefix
  const path_ = name.startsWith("/v1") ? name.replace("https://firestore.googleapis.com","") : `/${name.split("com/")[1]}`;
  const cleanPath = name.includes("googleapis.com") ? `/v1/${name.split("v1/")[1]}` : `/v1${name.startsWith("/v1")?name.slice(3):name}`;
  const r = await request(token, "DELETE", cleanPath.startsWith("/v1") ? cleanPath : `/v1/projects/${PROJECT_ID}/databases/(default)/documents/detections/${name.split("/").pop()}`);
  return r.status;
}

async function addDoc(token, fields) {
  const body = JSON.stringify({ fields });
  const r = await request(token, "POST", `${BASE}/detections`, JSON.parse(body));
  return r.status;
}

const str = v => ({ stringValue: String(v) });
const num = v => ({ doubleValue: Number(v) });
const tss = v => ({ timestampValue: v instanceof Date ? v.toISOString() : v });

function addMins(t, n) {
  let [h, m] = t.split(":").map(Number);
  m += n; h += Math.floor(m/60); m %= 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// Mar 1 late return stops compressed to stay within Mar 1 PHT (before 23:59)
// Tighten the schedule: Plaridel at 22:00, Baliwag 22:30, Apalit 23:00, San Simon 23:15, Bacolor 23:30, San Fernando 23:45, Mabalacat 23:55
const LAT_OFF = [0,.0005,-.0003,.0008,-.0005,.0002,-.0007,.0004,-.0001,.0006,.0003,-.0008,.0010,-.0006,.0007,-.0004];
const LON_OFF = [0,.0003,.0006,-.0002,-.0004,.0008,.0001,-.0007,.0005,-.0003,.0009,-.0001,.0004,-.0008,.0006,-.0005];
const ALERTS  = ["MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL","MEDIUM","CRITICAL"];
const DIRS    = ["left","right","rear","left","right","rear","left","right","rear","left","right","rear","left","right","rear","left"];
const DISTS   = [4.2,2.1,1.5,5.0,2.8,6.1,3.3,5.5,1.8,2.5,4.0,3.8,6.5,1.2,3.6,4.9];

function makePHT(dateStr, timeStr) {
  const [yr, mo, dy] = dateStr.split("-").map(Number);
  let [h, m] = timeStr.split(":").map(Number);
  const utcH = h - 8;
  return utcH < 0
    ? new Date(Date.UTC(yr, mo-1, dy-1, 24+utcH, m))
    : new Date(Date.UTC(yr, mo-1, dy, utcH, m));
}

function genPlace(date, startTime, name, lat, lon, count=12) {
  return Array.from({ length: count }, (_, i) => ({
    vehicleId:     str("truck-001"),
    truckId:       str("truck-001"),
    detectionType: str("vehicle"),
    alertLevel:    str(ALERTS[i % ALERTS.length]),
    latitude:      num(lat + LAT_OFF[i % LAT_OFF.length]),
    longitude:     num(lon + LON_OFF[i % LON_OFF.length]),
    timestamp:     tss(makePHT(date, addMins(startTime, i * 2))),
    description:   str(`vehicle detected ${DIRS[i % DIRS.length]} at ${name}`),
    direction:     str(DIRS[i % DIRS.length]),
    placeName:     str(name),
    distance:      num(DISTS[i % DISTS.length]),
    sensorId:      str(`sensor-${(i % 4) + 1}`),
  }));
}

// Replacement data for the Mar 1 late return, compressed to fit Mar 1 PHT
const REPLACEMENTS = [
  genPlace("2026-03-01","22:00","Plaridel, Bulacan",         14.8699,120.8569),
  genPlace("2026-03-01","22:28","Baliwag, Bulacan",          14.9535,120.9091),
  genPlace("2026-03-01","22:52","Apalit, Pampanga",          14.9538,120.7597),
  genPlace("2026-03-01","23:10","San Simon, Pampanga",       15.0432,120.7776),
  genPlace("2026-03-01","23:26","Bacolor, Pampanga",         15.0169,120.6527),
  genPlace("2026-03-01","23:40","San Fernando, Pampanga",    15.0293,120.6908),
  genPlace("2026-03-01","23:52","Mabalacat, Pampanga",       15.2183,120.5730),
];
const ALL_REPLACEMENTS = REPLACEMENTS.flat();

async function main() {
  console.log("🔑 Authenticating...");
  const token = await getToken(makeJWT());
  console.log("✅ Authenticated!\n");

  // 1. List spill-over docs on Mar 2
  console.log("🔍 Finding Mar 2 spill-over docs...");
  const docs = await listSpilloverDocs(token);
  console.log(`   Found ${docs.length} docs on 2026-03-02 PHT\n`);

  if (docs.length === 0) {
    console.log("✅ No spill-over docs found — nothing to fix!");
    return;
  }

  // 2. Delete them
  console.log("🗑️  Deleting spill-over docs...");
  let deleted = 0;
  for (const doc of docs) {
    const docId = doc.name.split("/").pop();
    const r = await request(token, "DELETE", `/v1/projects/${PROJECT_ID}/databases/(default)/documents/detections/${docId}`);
    if (r.status === 200 || r.status === 204) deleted++;
    await new Promise(r => setTimeout(r, 50));
  }
  console.log(`   Deleted ${deleted} docs\n`);

  // 3. Re-insert with corrected Mar 1 timestamps
  console.log(`📥 Re-inserting ${ALL_REPLACEMENTS.length} docs with Mar 1 timestamps (before midnight PHT)...`);
  let ok = 0;
  for (const fields of ALL_REPLACEMENTS) {
    const r = await request(token, "POST", `${BASE}/detections`, { fields });
    if (r.status === 200) ok++;
    else console.error("❌ Insert failed:", r.status, r.body);
    await new Promise(r => setTimeout(r, 55));
  }
  console.log(`\n✅ Done! Inserted ${ok}/${ALL_REPLACEMENTS.length} replacement docs.`);
  console.log("📅 All Mar 1 return data now stays within 2026-03-01 PHT (ends at 23:58).");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
