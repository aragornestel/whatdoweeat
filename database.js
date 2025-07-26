const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./whatdoweeat.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS polls (
            id TEXT PRIMARY KEY,
            candidates TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error("Error creating 'polls' table", err);
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS votes (
            poll_id TEXT,
            user_name TEXT NOT NULL,
            voted_for TEXT NOT NULL,
            FOREIGN KEY (poll_id) REFERENCES polls (id),
            PRIMARY KEY (poll_id, user_name)
        )`, (err) => {
            if (err) {
                console.error("Error creating 'votes' table", err);
            }
        });
    }
});

module.exports = db; 