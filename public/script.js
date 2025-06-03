
// Script tương thích với server API của bạn
function showResult(html, type) {
    const resultDiv = document.getElementById('result');
    if (type === 'json') {
        resultDiv.innerHTML = `<b>JSON:</b><pre>${html}</pre>`;
    } else if (type === 'xml') {
        resultDiv.innerHTML = `<b>XML:</b><pre>${html}</pre>`;
    } else if (type === 'base64') {
        resultDiv.innerHTML = `<b>Base64:</b><pre>${html}</pre>`;
    } else if (type === 'link') {
        resultDiv.innerHTML = html;
    } else {
        resultDiv.innerHTML = html;
    }
}

async function saveText() {
    const text = document.getElementById('text').value;
    if (!text) return showResult('Vui lòng nhập nội dung!');
    
    try {
        const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.link) {
            showResult(`<b>Link chia sẻ:</b><br><a href="${data.link}" target="_blank">${window.location.origin}${data.link}</a>`, 'link');
        } else {
            showResult(data.error || 'Lỗi!');
        }
    } catch (error) {
        showResult('Lỗi kết nối: ' + error.message);
    }
}

async function formatText() {
    const text = document.getElementById('text').value;
    const format = document.getElementById('format').value;
    if (!text) return showResult('Vui lòng nhập nội dung!');
    
    try {
        const res = await fetch(`/api/format/${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.formatted) {
            showResult(data.formatted, format);
        } else {
            showResult(data.error || 'Lỗi!');
        }
    } catch (error) {
        showResult('Lỗi kết nối: ' + error.message);
    }
}

async function xml2json() {
    const text = document.getElementById('text').value;
    if (!text) return showResult('Vui lòng nhập XML!');
    
    try {
        const res = await fetch('/api/xml2json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.json) {
            showResult(data.json, 'json');
        } else {
            showResult(data.error || 'Lỗi!');
        }
    } catch (error) {
        showResult('Lỗi kết nối: ' + error.message);
    }
}

async function json2xml() {
    const text = document.getElementById('text').value;
    if (!text) return showResult('Vui lòng nhập JSON!');
    
    try {
        const res = await fetch('/api/json2xml', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.xml) {
            showResult(data.xml, 'xml');
        } else {
            showResult(data.error || 'Lỗi!');
        }
    } catch (error) {
        showResult('Lỗi kết nối: ' + error.message);
    }
}

async function xml2base64() {
    const text = document.getElementById('text').value;
    if (!text) return showResult('Vui lòng nhập XML!');
    
    try {
        const res = await fetch('/api/xml2base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.base64) {
            showResult(data.base64, 'base64');
        } else {
            showResult(data.error || 'Lỗi!');
        }
    } catch (error) {
        showResult('Lỗi kết nối: ' + error.message);
    }
}

async function base642xml() {
    const text = document.getElementById('text').value;
    if (!text) return showResult('Vui lòng nhập Base64!');
    
    try {
        const res = await fetch('/api/base642xml', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        const data = await res.json();
        if (data.xml) {
            showResult(data.xml, 'xml');
        } else {
            showResult(data.error || 'Lỗi!');
        }
    } catch (error) {
        showResult('Lỗi kết nối: ' + error.message);
    }
}
