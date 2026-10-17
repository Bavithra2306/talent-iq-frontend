
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("VITE_API_BASE_URL is missing from the .env file.");
}

export const env = {
  apiBaseUrl,
};
