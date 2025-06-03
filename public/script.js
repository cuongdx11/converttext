function showResult(html, type) {
    const resultDiv = document.getElementById('result');
    
    // Escape HTML để tránh XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    if (type === 'json') {
        resultDiv.innerHTML = `<b>JSON được chuyển đổi:</b><pre>${escapeHtml(html)}</pre>`;
    } else if (type === 'xml') {
        resultDiv.innerHTML = `<b>XML được chuyển đổi:</b><pre>${escapeHtml(html)}</pre>`;
    } else if (type === 'base64') {
        resultDiv.innerHTML = `<b>Base64 được chuyển đổi:</b><pre style="word-break: break-all;">${escapeHtml(html)}</pre>`;
    } else if (type === 'link') {
        resultDiv.innerHTML = html;
    } else if (type === 'error') {
        resultDiv.innerHTML = `<b style="color: #e53e3e;">❌ Lỗi:</b><pre style="color: #e53e3e;">${escapeHtml(html)}</pre>`;
    } else {
        resultDiv.innerHTML = `<pre>${escapeHtml(html)}</pre>`;
    }
}

function showLoading() {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<b>🔄 Đang xử lý...</b>';
}

async function saveText() {
    const text = document.getElementById('text').value;
    if (!text || !text.trim()) {
        return showResult('Vui lòng nhập nội dung!', 'error');
    }
    
    showLoading();
    
    try {
        const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        
        if (res.ok && data.link) {
            showResult(`<b>✅ Link chia sẻ đã tạo:</b><br><a href="${data.link}" target="_blank" style="word-break: break-all;">${window.location.origin}${data.link}</a>`, 'link');
        } else {
            showResult(data.error || 'Lỗi không xác định!', 'error');
        }
    } catch (error) {
        showResult('Lỗi kết nối server: ' + error.message, 'error');
    }
}

async function formatText() {
    const text = document.getElementById('text').value;
    const format = document.getElementById('format').value;
    
    if (!text || !text.trim()) {
        return showResult('Vui lòng nhập nội dung cần format!', 'error');
    }
    
    showLoading();
    
    try {
        const res = await fetch(`/api/format/${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        
        if (res.ok && data.formatted) {
            showResult(data.formatted, format);
        } else {
            showResult(data.error || 'Lỗi format!', 'error');
        }
    } catch (error) {
        showResult('Lỗi kết nối server: ' + error.message, 'error');
    }
}

async function xml2json() {
    const text = document.getElementById('text').value;
    if (!text || !text.trim()) {
        return showResult('Vui lòng nhập nội dung XML!', 'error');
    }
    
    showLoading();
    
    try {
        const res = await fetch('/api/xml2json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        
        if (res.ok && data.json) {
            showResult(data.json, 'json');
        } else {
            showResult(data.error || 'Lỗi chuyển đổi XML sang JSON!', 'error');
        }
    } catch (error) {
        showResult('Lỗi kết nối server: ' + error.message, 'error');
    }
}

async function json2xml() {
    const text = document.getElementById('text').value;
    if (!text || !text.trim()) {
        return showResult('Vui lòng nhập nội dung JSON!', 'error');
    }
    
    showLoading();
    
    try {
        const res = await fetch('/api/json2xml', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        
        if (res.ok && data.xml) {
            showResult(data.xml, 'xml');
        } else {
            showResult(data.error || 'Lỗi chuyển đổi JSON sang XML!', 'error');
        }
    } catch (error) {
        showResult('Lỗi kết nối server: ' + error.message, 'error');
    }
}

async function xml2base64() {
    const text = document.getElementById('text').value;
    if (!text || !text.trim()) {
        return showResult('Vui lòng nhập nội dung XML!', 'error');
    }
    
    showLoading();
    
    try {
        const res = await fetch('/api/xml2base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        
        if (res.ok && data.base64) {
            showResult(data.base64, 'base64');
        } else {
            showResult(data.error || 'Lỗi chuyển đổi XML sang Base64!', 'error');
        }
    } catch (error) {
        showResult('Lỗi kết nối server: ' + error.message, 'error');
    }
}

async function base642xml() {
    const text = document.getElementById('text').value;
    if (!text || !text.trim()) {
        return showResult('Vui lòng nhập nội dung Base64!', 'error');
    }
    
    showLoading();
    
    try {
        const res = await fetch('/api/base642xml', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        
        const data = await res.json();
        
        if (res.ok && data.xml) {
            showResult(data.xml, 'xml');
        } else {
            showResult(data.error || 'Lỗi chuyển đổi Base64 sang XML!', 'error');
        }
    } catch (error) {
        showResult('Lỗi kết nối server: ' + error.message, 'error');
    }
}

function copyResult() {
    const resultBox = document.getElementById('result');
    const copyBtn = document.querySelector('.btn-copy');
    const notification = document.getElementById('copyNotification');

    // Get text content from result box
    const textToCopy = resultBox?.textContent || resultBox?.innerText || '';

    // Check if clipboard API is supported
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(textToCopy).then(() => {
            showCopySuccess(copyBtn, notification);
        }).catch(err => {
            console.error('Clipboard copy failed: ', err);
            fallbackCopy(textToCopy, copyBtn, notification);
        });
    } else {
        // Use fallback
        fallbackCopy(textToCopy, copyBtn, notification);
    }
}

function fallbackCopy(textToCopy, copyBtn, notification) {
    try {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
            showCopySuccess(copyBtn, notification);
        } else {
            console.error('Fallback copy was not successful.');
        }
    } catch (err) {
        console.error('Fallback copy failed: ', err);
    }
}

function showCopySuccess(copyBtn, notification) {
    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    copyBtn.classList.add('copied');
    notification.classList.add('show');
    setTimeout(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
        copyBtn.classList.remove('copied');
        notification.classList.remove('show');
    }, 2000);
}
