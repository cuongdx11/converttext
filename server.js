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
        res.status(400).json({ error: 'JSON không hợp lệ: ' + e.message });
    }
});

// API: Format XML
app.post('/api/format/xml', (req, res) => {
    const text = req.body.text;
    xml2js.parseString(text, { 
        trim: true,
        explicitRoot: true,
        explicitArray: false,
        mergeAttrs: false
    }, (err, result) => {
        if (err) return res.status(400).json({ error: 'XML không hợp lệ: ' + err.message });
        
        const builder = new xml2js.Builder({ 
            pretty: true, 
            indent: '  ',
            rootName: 'root',
            xmldec: { version: '1.0', encoding: 'UTF-8' }
        });
        
        try {
            const formatted = builder.buildObject(result);
            res.json({ formatted });
        } catch (buildErr) {
            res.status(400).json({ error: 'Lỗi format XML: ' + buildErr.message });
        }
    });
});

// API: XML -> JSON (SỬA LỖI)
app.post('/api/xml2json', (req, res) => {
    const text = req.body.text;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung XML' });
    }
    
    xml2js.parseString(text, { 
        trim: true,
        explicitRoot: true,
        explicitArray: false,
        mergeAttrs: false,
        ignoreAttrs: false,
        attrkey: '@',
        charkey: '#text'
    }, (err, result) => {
        if (err) {
            return res.status(400).json({ error: 'XML không hợp lệ: ' + err.message });
        }
        
        try {
            const jsonString = JSON.stringify(result, null, 2);
            res.json({ json: jsonString });
        } catch (jsonErr) {
            res.status(400).json({ error: 'Lỗi chuyển đổi sang JSON: ' + jsonErr.message });
        }
    });
});

// API: JSON -> XML (SỬA LỖI)
app.post('/api/json2xml', (req, res) => {
    const text = req.body.text;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung JSON' });
    }
    
    try {
        const obj = JSON.parse(text);
        
        // Xử lý object phức tạp
        let rootKey = 'root';
        let dataToConvert = obj;
        
        // Nếu JSON có một key duy nhất ở root level, sử dụng nó làm root
        const keys = Object.keys(obj);
        if (keys.length === 1 && typeof obj[keys[0]] === 'object') {
            rootKey = keys[0];
            dataToConvert = obj[keys[0]];
        }
        
        const xml = js2xmlparser.parse(rootKey, dataToConvert, {
            declaration: {
                include: true,
                encoding: 'UTF-8'
            },
            format: {
                pretty: true,
                indent: '  '
            }
        });
        
        res.json({ xml });
    } catch (parseErr) {
        res.status(400).json({ error: 'JSON không hợp lệ: ' + parseErr.message });
    }
});

// API: XML -> Base64
app.post('/api/xml2base64', (req, res) => {
    const text = req.body.text;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung XML' });
    }
    
    try {
        // Kiểm tra XML hợp lệ trước
        xml2js.parseString(text, (err) => {
            if (err) {
                return res.status(400).json({ error: 'XML không hợp lệ: ' + err.message });
            }
            
            const base64 = Buffer.from(text, 'utf8').toString('base64');
            res.json({ base64 });
        });
    } catch (e) {
        res.status(400).json({ error: 'Lỗi xử lý: ' + e.message });
    }
});

// API: Base64 -> XML
app.post('/api/base642xml', (req, res) => {
    const base64 = req.body.text;
    if (!base64 || !base64.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung Base64' });
    }
    
    try {
        // Kiểm tra Base64 hợp lệ
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
            throw new Error('Định dạng Base64 không hợp lệ');
        }
        
        const xml = Buffer.from(base64, 'base64').toString('utf-8');
        
        // Kiểm tra XML sau khi decode
        xml2js.parseString(xml, (err) => {
            if (err) {
                return res.status(400).json({ error: 'Nội dung decode không phải XML hợp lệ: ' + err.message });
            }
            
            res.json({ xml });
        });
    } catch (e) {
        res.status(400).json({ error: 'Base64 không hợp lệ: ' + e.message });
    }
});

// View route (giữ nguyên)
app.get('/view/:id', (req, res) => {
    const id = req.params.id;
    
    if (!storage[id]) {
        return res.status(404).send(notFoundTemplate);
    }

    const content = storage[id];
    let contentType = 'text';
    let displayContent = content;
    
    try {
        JSON.parse(content);
        contentType = 'json';
        displayContent = JSON.stringify(JSON.parse(content), null, 2);
    } catch (e1) {
        try {
            require('xml2js').parseString(content, (err) => {
                if (!err) {
                    contentType = 'xml';
                }
            });
        } catch (e2) {
            if (/^[A-Za-z0-9+/]*={0,2}$/.test(content) && content.length % 4 === 0) {
                contentType = 'base64';
            }
        }
    }

    const escapedDisplayContent = displayContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const escapedOriginalContent = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    const htmlResponse = viewContentTemplate
        .replace(/\{\{CONTENT_TYPE\}\}/g, contentType.toUpperCase())
        .replace(/\{\{DISPLAY_CONTENT\}\}/g, escapedDisplayContent)
        .replace(/\{\{ORIGINAL_CONTENT\}\}/g, escapedOriginalContent);

    res.send(htmlResponse);
});

app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});