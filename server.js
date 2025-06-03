const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const xml2js = require('xml2js');
const js2xmlparser = require('js2xmlparser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const redis = require('redis');

const app = express();
const PORT = 3000;

// Redis setup
const redisClient = redis.createClient({
    host: 'localhost',
    port: 6379,
    // password: 'your-password', // nếu có auth
});

redisClient.connect().catch(console.error);

// Redis error handling
redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

// Đọc các template HTML
const notFoundTemplate = fs.readFileSync(path.join(__dirname, 'public', '404.html'), 'utf8');
const viewContentTemplate = fs.readFileSync(path.join(__dirname, 'public', 'view.html'), 'utf8');

app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.text({ type: 'text/*', limit: '1mb' }));
app.use(express.static('public'));

// Redis Storage Class
class RedisStorage {
    constructor(client) {
        this.client = client;
        this.defaultTTL = 600; // 10 phút = 600 giây
    }
    
    async save(id, content) {
        const data = {
            content: content,
            contentType: this.detectContentType(content),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + this.defaultTTL * 1000).toISOString(),
            viewCount: 0
        };
        
        // Lưu với expiration tự động sau 10 phút
        await this.client.setEx(`paste:${id}`, this.defaultTTL, JSON.stringify(data));
        return id;
    }
    
    async get(id) {
        try {
            const data = await this.client.get(`paste:${id}`);
            if (!data) return null;
            
            const parsed = JSON.parse(data);
            
            // Tăng view count và cập nhật lại với TTL hiện tại
            parsed.viewCount++;
            const remainingTTL = await this.client.ttl(`paste:${id}`);
            
            if (remainingTTL > 0) {
                await this.client.setEx(`paste:${id}`, remainingTTL, JSON.stringify(parsed));
            }
            
            return parsed;
        } catch (error) {
            console.error('Error getting paste:', error);
            return null;
        }
    }
    
    async getTimeRemaining(id) {
        const ttl = await this.client.ttl(`paste:${id}`);
        return ttl > 0 ? ttl : 0;
    }
    
    async exists(id) {
        const exists = await this.client.exists(`paste:${id}`);
        return exists === 1;
    }
    
    detectContentType(content) {
        try {
            JSON.parse(content);
            return 'json';
        } catch {
            // Kiểm tra XML
            try {
                xml2js.parseString(content, (err) => {
                    if (!err) return 'xml';
                });
                if (content.trim().startsWith('<') && content.trim().endsWith('>')) {
                    return 'xml';
                }
            } catch {}
            
            // Kiểm tra Base64
            if (/^[A-Za-z0-9+/]*={0,2}$/.test(content) && content.length % 4 === 0 && content.length > 10) {
                return 'base64';
            }
            
            // Kiểm tra HTML
            if (/<[^>]+>/.test(content)) {
                return 'html';
            }
            
            return 'text';
        }
    }
}

// Initialize Redis storage
const storage = new RedisStorage(redisClient);

// API: Lưu text và trả về link (CẬP NHẬT)
app.post('/api/save', async (req, res) => {
    try {
        const text = req.body.text;
        if (!text) return res.status(400).json({ error: 'Thiếu dữ liệu text' });
        
        const id = uuidv4();
        await storage.save(id, text);
        
        res.json({ 
            link: `/view/${id}`, 
            id,
            expiresIn: 600, // 10 phút
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            message: 'Paste sẽ tự động xóa sau 10 phút'
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Lỗi server khi lưu dữ liệu' });
    }
});

// API: Lấy text theo id (CẬP NHẬT)
app.get('/api/get/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = await storage.get(id);
        
        if (!data) {
            return res.status(404).json({ error: 'Không tìm thấy hoặc đã hết hạn' });
        }
        
        const timeRemaining = await storage.getTimeRemaining(id);
        
        res.json({ 
            text: data.content,
            contentType: data.contentType,
            createdAt: data.createdAt,
            viewCount: data.viewCount,
            timeRemaining: timeRemaining,
            remainingMinutes: Math.ceil(timeRemaining / 60)
        });
    } catch (error) {
        console.error('Get error:', error);
        res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu' });
    }
});

// API: Kiểm tra thời gian còn lại
app.get('/api/ttl/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const timeRemaining = await storage.getTimeRemaining(id);
        const exists = await storage.exists(id);
        
        res.json({
            id,
            exists,
            timeRemaining,
            remainingMinutes: Math.ceil(timeRemaining / 60),
            expired: timeRemaining <= 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Format JSON (giữ nguyên)
app.post('/api/format/json', (req, res) => {
    try {
        const obj = JSON.parse(req.body.text);
        res.json({ formatted: JSON.stringify(obj, null, 2) });
    } catch (e) {
        res.status(400).json({ error: 'JSON không hợp lệ: ' + e.message });
    }
});

// API: Format XML (giữ nguyên)
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

// API: XML -> JSON (giữ nguyên)
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

// API: JSON -> XML (giữ nguyên)
app.post('/api/json2xml', (req, res) => {
    const text = req.body.text;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung JSON' });
    }
    
    try {
        const obj = JSON.parse(text);
        
        let rootKey = 'root';
        let dataToConvert = obj;
        
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

// API: XML -> Base64 (giữ nguyên)
app.post('/api/xml2base64', (req, res) => {
    const text = req.body.text;
    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung XML' });
    }
    
    try {
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

// API: Base64 -> XML (giữ nguyên)
app.post('/api/base642xml', (req, res) => {
    const base64 = req.body.text;
    if (!base64 || !base64.trim()) {
        return res.status(400).json({ error: 'Vui lòng nhập nội dung Base64' });
    }
    
    try {
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
            throw new Error('Định dạng Base64 không hợp lệ');
        }
        
        const xml = Buffer.from(base64, 'base64').toString('utf-8');
        
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

// View route (CẬP NHẬT HOÀN TOÀN)
app.get('/view/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const data = await storage.get(id);
        
        if (!data) {
            return res.status(404).send(notFoundTemplate);
        }

        const timeRemaining = await storage.getTimeRemaining(id);
        const remainingMinutes = Math.ceil(timeRemaining / 60);
        
        const content = data.content;
        const contentType = data.contentType;
        let displayContent = content;
        
        // Format content theo type
        if (contentType === 'json') {
            try {
                displayContent = JSON.stringify(JSON.parse(content), null, 2);
            } catch {}
        }

        const escapedDisplayContent = displayContent.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escapedOriginalContent = content.replace(/`/g, '\\`').replace(/\$/g, '\\$');

        // Tạo HTML với thông tin expiration
        let htmlResponse = viewContentTemplate
            .replace(/\{\{CONTENT_TYPE\}\}/g, contentType.toUpperCase())
            .replace(/\{\{DISPLAY_CONTENT\}\}/g, escapedDisplayContent)
            .replace(/\{\{ORIGINAL_CONTENT\}\}/g, escapedOriginalContent);

        // Thêm thông tin expiration vào HTML (nếu template hỗ trợ)
        const expirationInfo = `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px;">
            <strong>⏰ Thông tin hết hạn:</strong><br>
            Thời gian còn lại: <span id="time-remaining">${remainingMinutes} phút (${timeRemaining}s)</span><br>
            Lượt xem: ${data.viewCount}<br>
            Tạo lúc: ${new Date(data.createdAt).toLocaleString('vi-VN')}
        </div>
        <script>
            let timeLeft = ${timeRemaining};
            const updateTimer = () => {
                timeLeft--;
                if (timeLeft <= 0) {
                    document.getElementById('time-remaining').innerHTML = '<span style="color: red;">ĐÃ HẾT HẠN</span>';
                    setTimeout(() => location.reload(), 2000);
                } else {
                    const minutes = Math.ceil(timeLeft / 60);
                    document.getElementById('time-remaining').textContent = minutes + ' phút (' + timeLeft + 's)';
                }
            };
            setInterval(updateTimer, 1000);
        </script>`;
        
        // Chèn thông tin expiration vào HTML (sau tag body hoặc tìm vị trí phù hợp)
        if (htmlResponse.includes('<body>')) {
            htmlResponse = htmlResponse.replace('<body>', '<body>' + expirationInfo);
        } else {
            htmlResponse = expirationInfo + htmlResponse;
        }

        res.send(htmlResponse);
    } catch (error) {
        console.error('View error:', error);
        res.status(500).send('Lỗi server khi hiển thị nội dung');
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Đang đóng kết nối Redis...');
    await redisClient.quit();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
    console.log('Dữ liệu sẽ tự động xóa sau 10 phút');
    console.log('Cần cài đặt Redis: npm install redis');
});