const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Multer: keep file in memory (no disk writes yet)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const ok = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'application/dicom'
    ].includes(file.mimetype);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', version: '0.1.0' });
});

// Stub: accept an image and echo metadata
app.post('/api/analyze-image', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({
    received: true,
    filename: req.file.originalname,
    mime: req.file.mimetype,
    size_bytes: req.file.size,
    predictions: [{ label: 'normal', confidence: 0.95 }]
  });
});

app.get('/', (_req, res) => res.send('Backend is running...'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
