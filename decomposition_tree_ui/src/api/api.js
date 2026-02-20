import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});


// --- GLOBAL ERROR INTERCEPTOR ---
api.interceptors.response.use(
  (response) => response,
  (error) => {

    // Backend responded with error
    if (error.response) {
      const msg =
        error.response.data?.detail ||
        error.response.data?.message ||
        "Server error";

      console.error("API Error:", msg);

      return Promise.reject(
        new Error(msg)
      );
    }

    // No response (network issue)
    if (error.request) {
      console.error("Network error");
      return Promise.reject(
        new Error("Network error. Check backend.")
      );
    }

    return Promise.reject(error);
  }
);


// --- GET TOTAL ---
export const getTotalSales = async (
  table,
  kpi_metric
) => {
  try {
    const res = await api.get(
      "/total-sales",
      { params: { table, kpi_metric } }
    );
    return res.data;

  } catch (err) {
    throw err; // pass to UI
  }
};


// --- SPLIT DATA ---
export const getSplitData = async ({
  table,
  kpi_metric,
  split_col,
  filters = {},
}) => {
  try {
    const res = await api.post(
      "/split-data",
      {
        table,
        kpi_metric,
        split_col,
        filters,
      }
    );

    return res.data;

  } catch (err) {
    throw err;
  }
};

export const askGenie = async ({
  question,
  table,
  kpi_metric,
  path,
  conversation_id
}) => {
  try {
    const res = await api.post(
      "/genie",
      {
        question,
        table,
        kpi_metric,
        path,
        conversation_id
      }
    );

    return res.data;

  } catch (err) {
    throw err;
  }
};

export const getAvailableDims = async () => {
  const res = await api.get("/available-dims");
  return res.data;
};

export default api;
