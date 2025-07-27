const functions = require("firebase-functions");
const { defineString } = require('firebase-functions/params');
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const axios = require("axios");

// Firestore 초기화
admin.initializeApp();
const db = admin.firestore();

// V2 방식 환경 변수 선언 (지도용 / 검색용 분리)
const NAVER_MAP_CLIENT_ID = defineString("NAVER_MAP_CLIENT_ID");
const NAVER_SEARCH_CLIENT_ID = defineString("NAVER_SEARCH_CLIENT_ID");
const NAVER_SEARCH_CLIENT_SECRET = defineString("NAVER_SEARCH_CLIENT_SECRET");

// 메인 Express 앱
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// API 라우터 생성
const apiRouter = express.Router();

// --- API 엔드포인트 정의 ---

// Naver Map Client ID 전달
apiRouter.get("/config", (req, res) => {
    try {
        const mapClientId = NAVER_MAP_CLIENT_ID.value();
        if (!mapClientId) {
            return res.status(500).json({ error: "Naver Map Client ID is not configured." });
        }
        res.status(200).json({ naverMapClientId: mapClientId });
    } catch (e) {
        console.error("Error fetching config:", e);
        res.status(500).json({ error: "Failed to fetch server configuration." });
    }
});

// Naver 지역 검색 API 프록시
apiRouter.get("/search", async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: "Query parameter is required." });
    }

    try {
        const response = await axios.get("https://openapi.naver.com/v1/search/local.json", {
            params: {
                query: query,
                display: 5, // 최대 5개 결과
            },
            headers: {
                "X-Naver-Client-Id": NAVER_SEARCH_CLIENT_ID.value(),
                "X-Naver-Client-Secret": NAVER_SEARCH_CLIENT_SECRET.value(),
            },
        });
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error searching Naver API:", error);
        res.status(500).json({ error: "Failed to search places." });
    }
});


// 새 투표 생성 (기존 로직과 동일)
apiRouter.post("/polls", async (req, res) => {
    const { candidates } = req.body;
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: 'Candidates are required.' });
    }
    try {
        // 네이버 API 결과에는 id가 없으므로, title과 address를 조합해 고유 ID 생성
        const candidatesWithId = candidates.map(c => ({
            ...c,
            id: crypto.createHash('sha256').update(c.title + c.address).digest('hex')
        }));
        
        const candidatesString = JSON.stringify(candidatesWithId.map(c => c.id).sort());
        const pollId = crypto.createHash('sha256').update(candidatesString).digest('hex').slice(0, 10);
        const pollRef = db.collection('polls').doc(pollId);
        const doc = await pollRef.get();

        if (doc.exists) {
            return res.status(200).json({ pollId, created: false });
        } else {
            // Firestore에는 id가 포함된 후보자 목록 저장
            await pollRef.set({ candidates: candidatesWithId });
            return res.status(201).json({ pollId, created: true });
        }
    } catch (error) {
        console.error("Error creating poll:", error);
        return res.status(500).json({ error: "Failed to create poll." });
    }
});

// 특정 투표 정보 조회 (기존 로직과 동일)
apiRouter.get("/polls/:pollId", async (req, res) => {
    const { pollId } = req.params;
    try {
        const pollRef = db.collection('polls').doc(pollId);
        const doc = await pollRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Poll not found.' });
        }
        const pollData = doc.data();
        const votesSnapshot = await db.collection('polls').doc(pollId).collection('votes').get();
        const votes = {};
        votesSnapshot.forEach(voteDoc => {
            votes[voteDoc.id] = voteDoc.data().selections;
        });
        res.status(200).json({
            candidates: pollData.candidates,
            votes: votes
        });
    } catch (error) {
        console.error("Error fetching poll data:", error);
        return res.status(500).json({ error: "Failed to fetch poll data." });
    }
});

// 투표하기 (기존 로직과 동일)
apiRouter.post("/votes", async (req, res) => {
    const { pollId, userName, selections } = req.body;
    if (!pollId || !userName || !selections) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    try {
        const voteRef = db.collection('polls').doc(pollId).collection('votes').doc(userName);
        await voteRef.set({ selections });
        res.status(201).json({ message: "Vote submitted." });
    } catch (error) {
        console.error("Error submitting vote:", error);
        return res.status(500).json({ error: "Failed to submit vote." });
    }
});


// '/api' 경로에 라우터 연결
app.use('/api', apiRouter);

// Cloud Function으로 앱 내보내기
exports.api = functions.https.onRequest(app);
