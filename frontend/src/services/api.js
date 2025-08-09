import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
});

export const getHealth = () => api.get("/health");

// NEW: image upload (multipart)
export const analyzeImage = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/api/analyze-image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const classifyImage = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api.post("/api/classify-image", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};
