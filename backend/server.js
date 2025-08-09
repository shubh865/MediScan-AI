const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dicomParser = require('dicom-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_MODEL = process.env.HF_IMAGE_MODEL || 'microsoft/resnet-50';
const DEFAULT_DET_MODEL = process.env.HF_DET_MODEL || 'facebook/detr-resnet-50';

app.use(cors());
app.use(express.json());

// Multer: in-memory storage, 10MB limit, allow common images + DICOM
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'application/dicom',
        'application/octet-stream',
      ].includes(file.mimetype) ||
      (file.originalname || '').toLowerCase().endsWith('.dcm');

    if (!allowed) return cb(new Error('Unsupported file type'), false);
    cb(null, true);
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', version: '0.1.0' });
});

// ---------- DICOM / stub analyze ----------
app.post('/api/analyze-image', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const isDicom =
    req.file.mimetype === 'application/dicom' ||
    req.file.mimetype === 'application/octet-stream' ||
    (req.file.originalname || '').toLowerCase().endsWith('.dcm');

  let dicom = null;
  if (isDicom) {
    try {
      const byteArray = new Uint8Array(req.file.buffer);
      const dataSet = dicomParser.parseDicom(byteArray);
      const str = (tag) => (dataSet.string(tag) || '').trim();

      dicom = {
        patientName: str('x00100010'),
        patientID:   str('x00100020'),
        studyDate:   str('x00080020'),
        modality:    str('x00080060'),
        rows:        dataSet.uint16('x00280010'),
        cols:        dataSet.uint16('x00280011'),
      };
    } catch (e) {
      dicom = { error: 'Failed to parse DICOM', detail: e.message };
    }
  }

  res.json({
    received: true,
    filename: req.file.originalname,
    mime: req.file.mimetype,
    size_bytes: req.file.size,
    is_dicom: isDicom,
    dicom,
    predictions: [{ label: 'normal', confidence: 0.95 }], // stub
  });
});

// ---------- HF helpers ----------
async function callHF(buffer, mime, model) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error('HF_TOKEN not set');
  const url = `https://api-inference.huggingface.co/models/${model}`;

  let attempts = 0;
  while (attempts < 2) {
    try {
      const resp = await axios.post(url, buffer, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mime || 'application/octet-stream',
          Accept: 'application/json',
        },
        timeout: 20000,
      });
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 503 && data?.estimated_time && attempts === 0) {
        const waitMs = Math.min(4000, data.estimated_time * 1000);
        await new Promise((r) => setTimeout(r, waitMs));
        attempts++;
        continue;
      }
      throw err;
    }
  }
}

// ---------- Classification ----------
app.post('/api/classify-image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const mime = req.file.mimetype;
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) {
    return res.status(400).json({ message: 'Only PNG/JPEG/WEBP supported for classification right now' });
  }

  const model = String(req.query.model || req.headers['x-hf-model'] || DEFAULT_MODEL);

  try {
    const data = await callHF(req.file.buffer, mime, model);
    const predictions = Array.isArray(data)
      ? data.map(({ label, score }) => ({ label, confidence: score }))
      : data;

    res.json({ model, predictions });
  } catch (e) {
    const detail = e.response?.data?.error || e.message;
    res.status(502).json({ message: 'HF call failed', detail });
  }
});

// ---------- Object Detection (NEW) ----------
app.post('/api/detect-objects', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const mime = req.file.mimetype;
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) {
    return res.status(400).json({ message: 'Only PNG/JPEG/WEBP supported for detection' });
  }

  const model = String(req.query.model || req.headers['x-hf-model'] || DEFAULT_DET_MODEL);

  try {
    const data = await callHF(req.file.buffer, mime, model);
    // Normalize to {label, confidence, box:{xmin,ymin,xmax,ymax}}
    const detections = (Array.isArray(data) ? data : []).map((d) => {
      const label = d.label ?? d.class ?? 'object';
      const confidence = d.score ?? d.confidence ?? 0;
      const b = d.box || {};
      let xmin, ymin, xmax, ymax;
      if (typeof b.xmin === 'number') {
        ({ xmin, ymin, xmax, ymax } = b);
      } else if (typeof b.x === 'number') {
        xmin = b.x;
        ymin = b.y;
        xmax = b.x + (b.w || 0);
        ymax = b.y + (b.h || 0);
      }
      return { label, confidence, box: { xmin, ymin, xmax, ymax } };
    });

    res.json({ model, detections });
  } catch (e) {
    const detail = e.response?.data?.error || e.message;
    res.status(502).json({ message: 'HF call failed', detail });
  }
});

app.get('/', (_req, res) => res.send('Backend is running...'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
