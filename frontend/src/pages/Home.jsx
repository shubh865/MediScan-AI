import { useState } from "react";
import { getHealth } from "../services/api";

export default function Home() {
  const [resp, setResp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const checkHealth = async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await getHealth();
      setResp(data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Home Page</h1>
      <button
        onClick={checkHealth}
        className="mt-4 px-4 py-2 rounded-md border hover:bg-gray-100"
        disabled={loading}
      >
        {loading ? "Checking..." : "Ping Backend /health"}
      </button>

      {resp && (
        <pre className="mt-4 text-sm bg-white border rounded p-3 overflow-auto">
{JSON.stringify(resp, null, 2)}
        </pre>
      )}
      {err && <p className="mt-4 text-red-600">Error: {err}</p>}
    </div>
  );
}
