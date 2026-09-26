const axios = require("axios");

const AI_ENGINE_URL =
  process.env.AI_ENGINE_URL ||
  "http://localhost:8000";

async function analyzeImages(payload) {
  const response = await axios.post(
    `${AI_ENGINE_URL}/ai/analyze`,
    payload,
    {
      timeout: 120000,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  return response.data;
}

async function checkAIHealth() {
  const response = await axios.get(
    `${AI_ENGINE_URL}/health`,
    {
      timeout: 5000
    }
  );

  return response.data;
}

module.exports = {
  analyzeImages,
  checkAIHealth
};
