const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dicomParser = require('dicom-parser');

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

app.get('/', (_req, res) => res.send('Backend is running...'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
