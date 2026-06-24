const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsing
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Path for local JSON database
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

/**
 * Helper to read database state (from Vercel KV or local file).
 */
async function readDB(code) {
  const sanitizedCode = (code || '').replace(/[^a-zA-Z0-9-_]/g, '');
  const kvKey = sanitizedCode ? `classmatch_data_${sanitizedCode}` : 'classmatch_data';
  const localFile = sanitizedCode ? path.join(DB_DIR, `db_${sanitizedCode}.json`) : DB_FILE;

  // 1. Check if Vercel KV environment variables are present
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const url = `${process.env.KV_REST_API_URL}/get/${kvKey}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
        }
      });
      if (!res.ok) throw new Error("KV GET failed");
      
      const json = await res.json();
      // Vercel KV REST API returns results inside a 'result' field
      if (json && json.result) {
        return JSON.parse(json.result);
      }
    } catch (err) {
      console.error(`Vercel KV 읽기 에러 (${kvKey}). 로컬 파일 시스템을 시도합니다.`, err);
    }
  }

  // 2. Local file system fallback
  if (fs.existsSync(localFile)) {
    try {
      const fileData = fs.readFileSync(localFile, 'utf8');
      return JSON.parse(fileData);
    } catch (err) {
      console.error(`로컬 파일 ${localFile} 파싱 실패. 초기 빈 데이터로 부팅합니다.`, err);
    }
  }

  return { config: null, teams: [], matches: [] };
}

/**
 * Helper to write database state (to Vercel KV or local file).
 */
async function writeDB(state, code) {
  const sanitizedCode = (code || '').replace(/[^a-zA-Z0-9-_]/g, '');
  const kvKey = sanitizedCode ? `classmatch_data_${sanitizedCode}` : 'classmatch_data';
  const localFile = sanitizedCode ? path.join(DB_DIR, `db_${sanitizedCode}.json`) : DB_FILE;
  const stringified = JSON.stringify(state, null, 2);

  // 1. Check if Vercel KV environment variables are present
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const url = `${process.env.KV_REST_API_URL}/set/${kvKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stringified) // KV REST API accepts JSON strings
      });
      if (res.ok) {
        console.log(`Vercel KV 데이터베이스 동기화 완료 (${kvKey}).`);
        // Also cache locally
        fs.writeFileSync(localFile, stringified, 'utf8');
        return true;
      } else {
        throw new Error("KV SET failed");
      }
    } catch (err) {
      console.error(`Vercel KV 쓰기 에러 (${kvKey}). 로컬 파일 시스템에 저장합니다.`, err);
    }
  }

  // 2. Write to local file system
  try {
    fs.writeFileSync(localFile, stringified, 'utf8');
    return true;
  } catch (err) {
    console.error(`로컬 파일 ${localFile} 쓰기 에러.`, err);
    return false;
  }
}

// REST API ROUTES

// GET: Fetch dashboard state
app.get('/api/data', async (req, res) => {
  try {
    const code = req.query.code || '';
    const state = await readDB(code);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: "데이터를 불러오는 중 오류가 발생했습니다." });
  }
});

// POST: Save dashboard state
app.post('/api/data', async (req, res) => {
  try {
    const newState = req.body;
    if (!newState || typeof newState !== 'object') {
      return res.status(400).json({ error: "잘못된 데이터 형식입니다." });
    }
    
    const code = req.query.code || '';
    const success = await writeDB(newState, code);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "데이터 저장에 실패했습니다." });
    }
  } catch (err) {
    res.status(500).json({ error: "데이터를 저장하는 중 오류가 발생했습니다." });
  }
});

// Wildcard route to serve index.html for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` 🏆 클래스매치(ClassMatch) 대시보드가 정상 구동되었습니다.`);
  console.log(` ▶ 로컬 서버 주소: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
