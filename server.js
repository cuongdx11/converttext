const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const xml2js = require('xml2js');
const js2xmlparser = require('js2xmlparser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
// Đọc các template HTML
const notFoundTemplate = fs.readFileSync(path.join(__dirname, 'public', '404.html'), 'utf8');
const viewContentTemplate = fs.readFileSync(path.join(__dirname, 'public', 'view.html'), 'utf8');
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.text({ type: 'text/*', limit: '1mb' }));
app.use(express.static('public'));

// Lưu trữ tạm thời
const storage = {};

// API: Lưu text và trả về link
app.post('/api/save', (req, res) => {
    const text = req.body.text;
    if (!text) return res.status(400).json({ error: 'Thiếu dữ liệu text' });
    const id = uuidv4();
    storage[id] = text;
    res.json({ link: `/view/${id}`, id });
});

// API: Lấy text theo id
app.get('/api/get/:id', (req, res) => {
    const id = req.params.id;
    if (!storage[id]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ text: storage[id] });
});

// API: Format JSON
app.post('/api/format/json', (req, res) => {
    try {
        const obj = JSON.parse(req.body.text);
        res.json({ formatted: JSON.stringify(obj, null, 2) });
    } catch (e) {
        res.status(400).json({ error: 'JSON không hợp lệ' });
    }
});

// API: Format XML
app.post('/api/format/xml', (req, res) => {
    const text = req.body.text;
    xml2js.parseString(text, { trim: true }, (err, result) => {
        if (err) return res.status(400).json({ error: 'XML không hợp lệ' });
        const builder = new xml2js.Builder({ pretty: true });
        res.json({ formatted: builder.buildObject(result) });
    });
});

// API: XML -> JSON
app.post('/api/xml2json', (req, res) => {
    const text = req.body.text;
    xml2js.parseString(text, { trim: true }, (err, result) => {
        if (err) return res.status(400).json({ error: 'XML không hợp lệ' });
        res.json({ json: JSON.stringify(result, null, 2) });
    });
});

// API: JSON -> XML
app.post('/api/json2xml', (req, res) => {
    try {
        const obj = JSON.parse(req.body.text);
        const xml = js2xmlparser.parse('root', obj);
        res.json({ xml });
    } catch (e) {
        res.status(400).json({ error: 'JSON không hợp lệ' });
    }
});

// API: XML -> Base64
app.post('/api/xml2base64', (req, res) => {
    const text = req.body.text;
    try {
        Buffer.from(text); // kiểm tra hợp lệ
        const base64 = Buffer.from(text).toString('base64');
        res.json({ base64 });
    } catch (e) {
        res.status(400).json({ error: 'XML không hợp lệ' });
    }
});

// API: Base64 -> XML
app.post('/api/base642xml', (req, res) => {
    const base64 = req.body.text;
    try {
        const xml = Buffer.from(base64, 'base64').toString('utf-8');
        res.json({ xml });
    } catch (e) {
        res.status(400).json({ error: 'Base64 không hợp lệ' });
    }
});

app.get('/view/:id', (req, res) => {
    const id = req.params.id;
    
    // Kiểm tra nếu không tìm thấy nội dung
    if (!storage[id]) {
        return res.status(404).send(notFoundTemplate);
    }

    const content = storage[id];
    
    // Detect content type
    let contentType = 'text';
    let displayContent = content;
    
    try {
        // Try to parse as JSON
        JSON.parse(content);
        contentType = 'json';
        displayContent = JSON.stringify(JSON.parse(content), null, 2);
    } catch (e1) {
        try {
            // Try to parse as XML
            require('xml2js').parseString(content, (err) => {
                if (!err) {
                    contentType = 'xml';
                }
            });
        } catch (e2) {
            // Check if it's Base64
            if (/^[A-Za-z0-9+/]*={0,2}$/.test(content) && content.length % 4 === 0) {
                contentType = 'base64';
            }
        }
    }

    // Escape HTML trong displayContent
    const escapedDisplayContent = displayContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Escape content cho JavaScript (trong clipboard function)
    const escapedOriginalContent = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    // Thay thế các placeholder trong template
    const htmlResponse = viewContentTemplate
        .replace(/\{\{CONTENT_TYPE\}\}/g, contentType.toUpperCase())
        .replace(/\{\{DISPLAY_CONTENT\}\}/g, escapedDisplayContent)
        .replace(/\{\{ORIGINAL_CONTENT\}\}/g, escapedOriginalContent);

    res.send(htmlResponse);
});

app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
}); 