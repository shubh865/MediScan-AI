import { useState } from "react";
import { analyzeImage } from "../services/api";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    setResp(null);
    setErr("");
    setFile(f || null);
    if (f && f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview("");
    }
  };

  const onUpload = async () => {
    if (!file) return setErr("Please choose an image first.");
    setLoading(true);
    setErr("");
    setResp(null);
    try {
      const { data } = await analyzeImage(file);
      setResp(data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
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
          onClick={onUpload}
          disabled={loading || !file}
          className="px-4 py-2 rounded-md border hover:bg-gray-100 disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Analyze"}
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

      {resp && (
        <pre className="mt-4 text-sm bg-white border rounded p-3 overflow-auto">
{JSON.stringify(resp, null, 2)}
        </pre>
      )}

      {err && <p className="mt-4 text-red-600">Error: {err}</p>}
    </div>
  );
}
