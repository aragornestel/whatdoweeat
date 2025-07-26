const express = require('express');
const crypto = require('crypto');
const app = express();
const port = process.env.PORT || 3000;
const { db, initializeDb } = require('./database.js');

// 데이터베이스가 완전히 초기화된 후에 서버를 시작
initializeDb(() => {
    app.use(express.json()); 
    app.use(express.static('.')); 

    app.get('/', (req, res) => {
        res.sendFile(__dirname + '/index.html');
    });

    // 새로운 투표(poll) 생성 API
    app.post('/api/polls', (req, res) => {
        const { candidates } = req.body;

        if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
            return res.status(400).json({ error: 'Candidates are required and must be a non-empty array.' });
        }

        const candidatesString = JSON.stringify(candidates);
        const pollId = crypto.createHash('sha256').update(candidatesString).digest('hex').slice(0, 10);

        const sql = 'INSERT INTO polls (id, candidates) VALUES (?, ?)';
        db.run(sql, [pollId, candidatesString], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(200).json({ pollId: pollId, created: false });
                }
                console.error('Error inserting poll:', err.message);
                return res.status(500).json({ error: 'Failed to create poll' });
            }
            res.status(201).json({ pollId: pollId, created: true });
        });
    });

    // 특정 투표 정보 조회 API
    app.get('/api/polls/:pollId', (req, res) => {
        const { pollId } = req.params;

        const pollSql = 'SELECT * FROM polls WHERE id = ?';
        db.get(pollSql, [pollId], (err, poll) => {
            if (err) {
                console.error('Error fetching poll:', err.message);
                return res.status(500).json({ error: 'Database error while fetching poll.' });
            }
            if (!poll) {
                return res.status(404).json({ error: 'Poll not found.' });
            }

            const votesSql = 'SELECT user_name, selections FROM votes WHERE poll_id = ?';
            db.all(votesSql, [pollId], (err, votes) => {
                if (err) {
                    console.error('Error fetching votes:', err.message);
                    return res.status(500).json({ error: 'Database error while fetching votes.' });
                }

                try {
                    const voteResults = {};
                    votes.forEach(vote => {
                        if (vote.selections) {
                            voteResults[vote.user_name] = JSON.parse(vote.selections);
                        }
                    });

                    res.status(200).json({
                        candidates: JSON.parse(poll.candidates),
                        votes: voteResults
                    });
                } catch (parseError) {
                    console.error('Error parsing data:', parseError.message);
                    return res.status(500).json({ error: 'Failed to process poll data.' });
                }
            });
        });
    });

    // 새로운 투표 제출 API
    app.post('/api/votes', (req, res) => {
        const { pollId, userName, selections } = req.body;

        if (!pollId || !userName || !selections || !Array.isArray(selections)) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        const selectionsString = JSON.stringify(selections);

        // INSERT OR REPLACE: 동일한 poll_id와 user_name을 가진 데이터가 있으면 덮어쓰고, 없으면 새로 삽입
        const sql = 'INSERT OR REPLACE INTO votes (poll_id, user_name, selections) VALUES (?, ?, ?)';
        
        db.run(sql, [pollId, userName, selectionsString], function(err) {
            if (err) {
                console.error('Error saving vote:', err.message);
                return res.status(500).json({ error: 'Failed to save vote.' });
            }
            res.status(200).json({ success: true, message: 'Vote saved successfully.' });
        });
    });


    app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });
}); 