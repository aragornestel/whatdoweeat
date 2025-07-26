const express = require('express');
const app = express();
const port = 3000;
const db = require('./database.js');

app.use(express.json()); // JSON 요청 본문을 파싱하기 위함
app.use(express.static('.')); // 현재 디렉토리의 정적 파일(html, css, js)을 제공

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
}); 