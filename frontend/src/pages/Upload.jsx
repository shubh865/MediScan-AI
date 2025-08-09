import { useRef, useState } from "react";
import { analyzeImage, classifyImage, detectObjects } from "../services/api";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // stub analyze
  const [stubResp, setStubResp] = useState(null);
  const [stubErr, setStubErr] = useState("");
  const [stubLoading, setStubLoading] = useState(false);

  // classify
  const [modelId, setModelId] = useState("microsoft/resnet-50");
  const [hfResp, setHfResp] = useState(null);
  const [hfErr, setHfErr] = useState("");
  const [hfLoading, setHfLoading] = useState(false);

  // detect
  const [detModel, setDetModel] = useState("facebook/detr-resnet-50");
  const [detResp, setDetResp] = useState(null);
  const [detErr, setDetErr] = useState("");
  const [detLoading, setDetLoading] = useState(false);

  const onPick = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setStubResp(null); setHfResp(null); setDetResp(null);
    setStubErr(""); setHfErr(""); setDetErr("");
    if (f && f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview("");
    }
    // clear canvas
    const c = canvasRef.current;
    if (c) { const ctx = c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); }
  };

  const onImgLoad = () => {
    // match canvas to displayed image size
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !c) return;
    c.width = img.clientWidth;
    c.height = img.clientHeight;
    const ctx = c.getContext("2d");
    ctx.clearRect(0,0,c.width,c.height);
  };

  const drawBoxes = (detections=[]) => {
    const img = imgRef.current;
    const c = canvasRef.current;
    if (!img || !c) return;
    const ctx = c.getContext("2d");
    ctx.clearRect(0,0,c.width,c.height);

    // scale from natural px -> displayed px
    const sx = img.clientWidth / (img.naturalWidth || img.clientWidth);
    const sy = img.clientHeight / (img.naturalHeight || img.clientHeight);

    ctx.lineWidth = 2;
    ctx.font = "12px system-ui";
    detections.forEach((d) => {
      const b = d.box || {};
      if ([b.xmin,b.ymin,b.xmax,b.ymax].some(v => typeof v !== "number")) return;
      const x = (b.xmin || 0) * sx;
      const y = (b.ymin || 0) * sy;
      const w = ((b.xmax || 0) - (b.xmin || 0)) * sx;
      const h = ((b.ymax || 0) - (b.ymin || 0)) * sy;

      ctx.strokeStyle = "rgb(31,41,55)"; // gray-800
      ctx.fillStyle = "rgba(31,41,55,0.1)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);

      const label = `${d.label ?? "object"} ${(d.confidence*100||0).toFixed(1)}%`;
      const pad = 4;
      const textW = ctx.measureText(label).width + pad*2;
      const textH = 16 + pad*2;
      ctx.fillStyle = "rgba(31,41,55,0.9)";
      ctx.fillRect(x, Math.max(0,y - textH), textW, textH);
      ctx.fillStyle = "white";
      ctx.fillText(label, x + pad, Math.max(12, y - textH + 12));
    });
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
    if (!file.type.startsWith("image/")) return setHfErr("HF classify supports PNG/JPEG/WEBP.");
    setHfLoading(true); setHfErr(""); setHfResp(null);
    try {
      const { data } = await classifyImage(file, modelId.trim());
      setHfResp(data);
    } catch (e) {
      setHfErr(e?.response?.data?.message || e.message);
    } finally {
      setHfLoading(false);
    }
  };

  const onDetectHF = async () => {
    if (!file) return setDetErr("Please choose an image first.");
    if (!file.type.startsWith("image/")) return setDetErr("Detection supports PNG/JPEG/WEBP.");
    setDetLoading(true); setDetErr(""); setDetResp(null);
    try {
      const { data } = await detectObjects(file, detModel.trim());
      setDetResp(data);
      drawBoxes(data.detections || []);
    } catch (e) {
      setDetErr(e?.response?.data?.message || e.message);
    } finally {
      setDetLoading(false);
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
        <button onClick={onAnalyzeStub} disabled={stubLoading || !file}
          className="px-4 py-2 rounded-md border hover:bg-gray-100 disabled:opacity-50">
          {stubLoading ? "Analyzing..." : "Analyze (Stub)"}
        </button>
        <button onClick={onClassifyHF} disabled={hfLoading || !file}
          className="px-4 py-2 rounded-md border hover:bg-gray-100 disabled:opacity-50">
          {hfLoading ? "Classifying..." : "Classify (HF)"}
        </button>
        <button onClick={onDetectHF} disabled={detLoading || !file}
          className="px-4 py-2 rounded-md border hover:bg-gray-100 disabled:opacity-50">
          {detLoading ? "Detecting..." : "Detect (HF)"}
        </button>
      </div>

      {/* model inputs */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">HF classify model:</label>
          <input value={modelId} onChange={(e)=>setModelId(e.target.value)}
            className="text-sm border rounded px-2 py-1 w-full md:w-80"
            placeholder="e.g. microsoft/resnet-50" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">HF detect model:</label>
          <input value={detModel} onChange={(e)=>setDetModel(e.target.value)}
            className="text-sm border rounded px-2 py-1 w-full md:w-80"
            placeholder="e.g. facebook/detr-resnet-50" />
        </div>
      </div>

      {preview && (
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Preview:</p>
          <div className="relative inline-block">
            <img
              ref={imgRef}
              src={preview}
              alt="preview"
              className="h-48 w-auto rounded border bg-white"
              onLoad={onImgLoad}
            />
            <canvas ref={canvasRef} className="absolute left-0 top-0 pointer-events-none rounded" />
          </div>
        </div>
      )}

      {/* Stub response */}
      {stubResp && (
        <div className="mt-4">
          <p className="font-medium">Stub Result (/api/analyze-image):</p>
          <pre className="mt-2 text-sm bg-white border rounded p-3 overflow-auto">
{JSON.stringify(stubResp, null, 2)}
          </pre>
        </div>
      )}
      {stubErr && <p className="mt-2 text-red-600">Stub Error: {stubErr}</p>}

      {/* HF classification */}
      {hfResp && (
        <div className="mt-6">
          <p className="font-medium">HF Classification ({hfResp.model}):</p>
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

      {/* HF detection */}
      {detResp && (
        <div className="mt-6">
          <p className="font-medium">HF Detection ({detResp.model}):</p>
          <ul className="mt-2 space-y-1">
            {(detResp.detections || []).slice(0, 5).map((d, i) => (
              <li key={i} className="text-sm">
                {d.label} — {(d.confidence * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </div>
      )}
      {detErr && <p className="mt-2 text-red-600">HF Detect Error: {detErr}</p>}
    </div>
  );
}
