const API_URL = 'http://127.0.0.1:8000';
let items = [];
let currentItem = null;
let activeLabel = null;
let annotations = [];
let isDrawing = false;
let startX, startY;

const canvas = document.getElementById('image-canvas');
const ctx = canvas.getContext('2d');
const img = document.getElementById('source-image');

async function fetchItems() {
    const response = await fetch(`${API_URL}/items`);
    items = await response.json();
    renderSidebar();
}

function renderSidebar() {
    const list = document.getElementById('item-list');
    list.innerHTML = items.map(item => `
        <div onclick="selectItem(${item.id})" class="p-3 rounded-xl cursor-pointer transition-all border border-transparent hover:bg-slate-50 ${currentItem?.id === item.id ? 'sidebar-active shadow-sm' : ''}">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                    <i data-lucide="${getIcon(item.task_type)}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="text-sm font-semibold truncate text-slate-700">${item.content.substring(0, 20)}...</p>
                    <p class="text-[10px] text-slate-400 uppercase font-bold">${item.task_type.replace('_', ' ')}</p>
                </div>
                ${item.annotation ? '<i data-lucide="check" class="w-4 h-4 text-emerald-500"></i>' : ''}
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

function getIcon(type) {
    if (type === 'text_classification') return 'type';
    if (type === 'ner') return 'highlighter';
    return 'frame';
}

async function selectItem(id) {
    const response = await fetch(`${API_URL}/items/${id}`);
    currentItem = await response.json();
    annotations = currentItem.annotation ? 
        (Array.isArray(currentItem.annotation) ? currentItem.annotation : [currentItem.annotation]) 
        : [];
    
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('item-title').innerText = `Item #${id}`;
    document.getElementById('task-badge').innerText = currentItem.task_type.replace('_', ' ');
    
    renderSidebar();
    renderLabels();
    setupEditor();
    renderAnnotations();
}

function renderLabels() {
    const container = document.getElementById('label-container');
    container.innerHTML = currentItem.label_config.map((label, idx) => `
        <button onclick="setActiveLabel('${label}')" id="btn-label-${label}" class="px-4 py-2 rounded-lg border-2 border-slate-200 text-sm font-bold transition-all hover:border-indigo-400 ${activeLabel === label ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white text-slate-600'}">
            ${label}
        </button>
    `).join('');
}

function setActiveLabel(label) {
    activeLabel = label;
    renderLabels();
    if (currentItem.task_type === 'text_classification') {
        annotations = { label: label };
        renderAnnotations();
    }
}

function setupEditor() {
    const textEditor = document.getElementById('text-editor');
    const imageEditor = document.getElementById('image-editor');
    
    textEditor.classList.add('hidden');
    imageEditor.classList.add('hidden');

    if (currentItem.task_type === 'bbox') {
        imageEditor.classList.remove('hidden');
        img.src = currentItem.content;
        img.onload = () => {
            canvas.width = img.clientWidth;
            canvas.height = img.clientHeight;
            drawBoxes();
        };
    } else {
        textEditor.classList.remove('hidden');
        const contentDiv = document.getElementById('text-content');
        contentDiv.innerText = currentItem.content;
        if (currentItem.task_type === 'ner') {
            contentDiv.onmouseup = handleTextSelection;
        }
    }
}

function handleTextSelection() {
    if (currentItem.task_type !== 'ner' || !activeLabel) return;
    
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && selection.toString().length > 0) {
        const range = selection.getRangeAt(0);
        const start = range.startOffset;
        const end = range.endOffset;
        
        annotations.push({ start, end, label: activeLabel, text: selection.toString() });
        renderAnnotations();
        selection.removeAllRanges();
    }
}

canvas.onmousedown = (e) => {
    if (currentItem.task_type !== 'bbox' || !activeLabel) return;
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
};

canvas.onmousemove = (e) => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    drawBoxes();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
};

canvas.onmouseup = (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    annotations.push({
        label: activeLabel,
        bbox: {
            x: Math.min(startX, endX) / canvas.width,
            y: Math.min(startY, endY) / canvas.height,
            w: Math.abs(endX - startX) / canvas.width,
            h: Math.abs(endY - startY) / canvas.height
        }
    });
    drawBoxes();
    renderAnnotations();
};

function drawBoxes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotations.forEach(ann => {
        if (!ann.bbox) return;
        const x = ann.bbox.x * canvas.width;
        const y = ann.bbox.y * canvas.height;
        const w = ann.bbox.w * canvas.width;
        const h = ann.bbox.h * canvas.height;
        
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.fillRect(x, y, w, h);
    });
}

function renderAnnotations() {
    const preview = document.getElementById('annotation-preview');
    if (Object.keys(annotations).length === 0 || (Array.isArray(annotations) && annotations.length === 0)) {
        preview.innerHTML = '<p class="text-sm text-slate-400 italic">No labels applied yet.</p>';
        return;
    }

    if (currentItem.task_type === 'text_classification') {
        preview.innerHTML = `
            <div class="p-3 bg-indigo-50 rounded-lg border border-indigo-100 flex justify-between items-center">
                <span class="text-sm font-bold text-indigo-700">${annotations.label}</span>
                <button onclick="annotations={}; renderAnnotations();" class="text-indigo-300 hover:text-red-500">
                    <i data-lucide="x-circle" class="w-4 h-4"></i>
                </button>
            </div>
        `;
    } else {
        preview.innerHTML = annotations.map((ann, idx) => `
            <div class="p-2 bg-white border border-slate-200 rounded-lg flex justify-between items-center text-xs group">
                <span class="font-bold text-slate-500">${ann.label}</span>
                <span class="text-slate-400">${ann.text ? ann.text.substring(0, 10) + '...' : 'Box'}</span>
                <button onclick="removeAnnotation(${idx})" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `).join('');
    }
    lucide.createIcons();
}

function removeAnnotation(index) {
    annotations.splice(index, 1);
    renderAnnotations();
    if (currentItem.task_type === 'bbox') drawBoxes();
}

async function saveAnnotation() {
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    
    try {
        await fetch(`${API_URL}/items/${currentItem.id}/annotation`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ annotation: annotations })
        });
        
        const itemIndex = items.findIndex(i => i.id === currentItem.id);
        items[itemIndex].annotation = annotations;
        renderSidebar();
        
        btn.classList.replace('bg-indigo-600', 'bg-emerald-500');
        setTimeout(() => {
            btn.classList.replace('bg-emerald-500', 'bg-indigo-600');
            btn.disabled = false;
        }, 1000);
    } catch (e) {
        alert("Save failed");
        btn.disabled = false;
    }
}

function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "minilabel_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

fetchItems();