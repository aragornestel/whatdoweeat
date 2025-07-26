const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./whatdoweeat.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    }
});

function initializeDb(callback) {
    db.serialize(() => {
        console.log('Connected to the SQLite database and initializing tables...');
        
        db.run(`CREATE TABLE IF NOT EXISTS polls (
            id TEXT PRIMARY KEY,
            candidates TEXT NOT NULL
        )`, (err) => {
            if (err) console.error("Error creating 'polls' table", err);
        });

        db.run(`CREATE TABLE IF NOT EXISTS votes (
            poll_id TEXT,
            user_name TEXT,
            selections TEXT,
            FOREIGN KEY (poll_id) REFERENCES polls (id),
            PRIMARY KEY (poll_id, user_name)
        )`, (err) => {
            if (err) {
                console.error("Error creating 'votes' table", err);
            } else {
                console.log('Database initialized successfully.');
                if (callback) callback(); // 모든 테이블 생성이 완료된 후 콜백 실행
            }
        });
    });
}

module.exports = { db, initializeDb }; 