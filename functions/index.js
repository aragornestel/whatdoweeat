const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const axios = require("axios");

admin.initializeApp();

const app = express();

app.use(cors({ origin: true }));

app.get("/search", async (req, res) => {
  const { query, rect } = req.query;
  if (!query) {
    return res.status(400).send("A search query is required.");
  }

  // Kakao API 자격 증명
  const KAKAO_REST_API_KEY = '2724235ee825d22f56c5ef4aa4b635e6';

  try {
    const params = {
      query: query,
      size: 15,
    };
    // rect 파라미터가 있으면 요청에 추가합니다.
    if (rect) {
      params.rect = rect;
    }

    const apiResponse = await axios.get("https://dapi.kakao.com/v2/local/search/keyword.json", {
      params: params,
      headers: {
        "Authorization": `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    });

    // 카카오 API의 응답 형식에 맞춰 documents 배열을 반환합니다.
    if (apiResponse.data && Array.isArray(apiResponse.data.documents)) {
      res.status(200).json(apiResponse.data.documents);
    } else {
      console.warn("Kakao API response format was unexpected:", apiResponse.data);
      res.status(200).json([]);
    }
  } catch (error) {
    console.error("Error calling Kakao API:", error.response ? error.response.data : error.message);
    res.status(500).json([]);
  }
});

// 2세대(v2) 방식으로 Express 앱을 Firebase Function으로 내보냅니다.
exports.api = onRequest(app); 