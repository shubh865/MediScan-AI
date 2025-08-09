const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dicomParser = require('dicom-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

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
        'application/octet-stream', // some tools send DICOM as octet-stream
      ].includes(file.mimetype) ||
      (file.originalname || '').toLowerCase().endsWith('.dcm');

    if (!allowed) return cb(new Error('Unsupported file type'), false);
    cb(null, true);
  },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', version: '0.1.0' });
});

// POST /api/analyze-image — accepts image/DICOM and returns basic info (+ DICOM tags if applicable)
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

// Helper: call HF image-classification model with short retry if model is cold
async function hfImageClassify(buffer, mime) {
  const model = process.env.HF_IMAGE_MODEL || 'microsoft/resnet-50';
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
      // Model cold-start: 503 with estimated_time
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

// POST /api/classify-image — calls Hugging Face image-classification model
app.post('/api/classify-image', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const mime = req.file.mimetype;
  // Keep classification to raster images for now (DICOM stays on /api/analyze-image)
  if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) {
    return res
      .status(400)
      .json({ message: 'Only PNG/JPEG/WEBP supported for classification right now' });
  }

  try {
    const out = await hfImageClassify(req.file.buffer, mime);
    // Expected output: [{label, score}, ...]
    const predictions = Array.isArray(out)
      ? out.map(({ label, score }) => ({ label, confidence: score }))
      : out;

    res.json({
      model: process.env.HF_IMAGE_MODEL || 'microsoft/resnet-50',
      predictions,
    });
  } catch (e) {
    const detail = e.response?.data?.error || e.message;
    res.status(502).json({ message: 'HF call failed', detail });
  }
});

app.get('/', (_req, res) => res.send('Backend is running...'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
