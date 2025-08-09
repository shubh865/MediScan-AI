import { useState } from "react";
import { analyzeImage } from "../services/api";
import { classifyImage } from "../services/api";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [stubResp, setStubResp] = useState(null);
  const [stubErr, setStubErr] = useState("");
  const [stubLoading, setStubLoading] = useState(false);

  const [hfResp, setHfResp] = useState(null);
  const [hfErr, setHfErr] = useState("");
  const [hfLoading, setHfLoading] = useState(false);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setStubResp(null); setHfResp(null);
    setStubErr(""); setHfErr("");
    if (f && f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview("");
    }
  };

  const onAnalyzeStub = async () => {
    if (!file) return setStubErr("Please choose an image first.");
    setStubLoading(true); setStubErr(""); setStubResp(null);
    try {
      const { data } = await analyzeImage(file);
      setStubResp(data);
    } catch (e) {
      setStubErr(e?.response?.data?.message || e.message);
    } finally {
      setStubLoading(false);
    }
  };

  const onClassifyHF = async () => {
    if (!file) return setHfErr("Please choose an image first.");
    if (!file.type.startsWith("image/")) {
      return setHfErr("HF classify supports PNG/JPEG/WEBP (not DICOM).");
    }
    setHfLoading(true); setHfErr(""); setHfResp(null);
    try {
      const { data } = await classifyImage(file);
      setHfResp(data);
    } catch (e) {
      setHfErr(e?.response?.data?.message || e.message);
    } finally {
      setHfLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Upload Page</h1>

      <div className="mt-4 flex items-center gap-4">
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,application/dicom"
          onChange={onPick}
          className="block w-full text-sm"
        />
        <button
          onClick={onAnalyzeStub}
          disabled={stubLoading || !file}
          className="px-4 py-2 rounded-md border hover:bg-gray-100 disabled:opacity-50"
        >
          {stubLoading ? "Analyzing..." : "Analyze (Stub)"}
        </button>
        <button
          onClick={onClassifyHF}
          disabled={hfLoading || !file}
          className="px-4 py-2 rounded-md border hover:bg-gray-100 disabled:opacity-50"
        >
          {hfLoading ? "Classifying..." : "Classify (HF)"}
        </button>
      </div>

      {preview && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Preview:</p>
          <img
            src={preview}
            alt="preview"
            className="h-48 w-auto rounded border bg-white"
            onLoad={() => URL.revokeObjectURL(preview)}
          />
        </div>
      )}

      {/* Stub response (works for images + DICOM) */}
      {stubResp && (
        <div className="mt-4">
          <p className="font-medium">Stub Result (/api/analyze-image):</p>
          <pre className="mt-2 text-sm bg-white border rounded p-3 overflow-auto">
{JSON.stringify(stubResp, null, 2)}
          </pre>
        </div>
      )}
      {stubErr && <p className="mt-2 text-red-600">Stub Error: {stubErr}</p>}

      {/* HF classification response (images only) */}
      {hfResp && (
        <div className="mt-6">
          <p className="font-medium">
            HF Classification ({hfResp.model}):
          </p>
          <ul className="mt-2 space-y-1">
            {(hfResp.predictions || []).slice(0, 5).map((p, i) => (
              <li key={i} className="text-sm">
                {p.label} — {(p.confidence * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
      {hfErr && <p className="mt-2 text-red-600">HF Error: {hfErr}</p>}
    </div>
  );
}
