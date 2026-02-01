let API_URL = '';
let items = [];
let currentItem = null;
let activeLabel = null;
let annotations = [];
let isDrawing = false;
let startX, startY;

let canvas, ctx, img;

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('image-canvas');
    if (canvas) ctx = canvas.getContext('2d');
    img = document.getElementById('source-image');
    
    setupCanvasListeners();
    fetchItems();
});

async function fetchItems() {
    try {
        const response = await fetch(`${API_URL}/items`);
        if (!response.ok) throw new Error('Network response was not ok');
        items = await response.json();
        renderSidebar();
    } catch (e) {
        console.error("Failed to fetch items:", e);
    }
}

function renderSidebar() {
    const list = document.getElementById('item-list');
    list.innerHTML = items.map(item => `
        <div onclick="selectItem(${item.id})" class="p-3 rounded-xl cursor-pointer transition-all border border-transparent hover:bg-slate-100 ${currentItem?.id === item.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : ''}">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-slate-500">
                    <i data-lucide="${getIcon(item.task_type)}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 overflow-hidden">
                    <p class="text-sm font-semibold truncate text-slate-700">${item.task_type === 'bbox' ? 'Image Task' : item.content.substring(0, 20)}</p>
                    <p class="text-[10px] text-slate-400 uppercase font-bold tracking-tight">${item.task_type.replace('_', ' ')}</p>
                </div>
                ${item.annotation ? '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i>' : ''}
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
    try {
        const response = await fetch(`${API_URL}/items/${id}`);
        currentItem = await response.json();
        
        const rawAnn = currentItem.annotation;
        if (rawAnn) {
            annotations = typeof rawAnn === 'string' ? JSON.parse(rawAnn) : rawAnn;
        } else {
            annotations = [];
        }
        
        activeLabel = null;
        document.getElementById('welcome-screen').classList.add('hidden');
        document.getElementById('item-title').innerText = `Item #${id}`;
        document.getElementById('task-badge').innerText = currentItem.task_type.replace('_', ' ');
        
        renderSidebar();
        renderLabels();
        setupEditor();
        renderAnnotations();
    } catch (e) {
        console.error("Error selecting item:", e);
    }
}

function renderLabels() {
    const container = document.getElementById('label-container');
    const labels = typeof currentItem.label_config === 'string' ? JSON.parse(currentItem.label_config) : currentItem.label_config;
    
    container.innerHTML = labels.map(label => `
        <button onclick="setActiveLabel('${label}')" class="px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${activeLabel === label ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400'}">
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
        contentDiv.onmouseup = currentItem.task_type === 'ner' ? handleTextSelection : null;
    }
}

function handleTextSelection() {
    if (currentItem.task_type !== 'ner' || !activeLabel) return;
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && sel.toString().trim().length > 0) {
        annotations.push({
            label: activeLabel,
            text: sel.toString(),
            start: sel.anchorOffset,
            end: sel.focusOffset
        });
        renderAnnotations();
        sel.removeAllRanges();
    }
}

function setupCanvasListeners() {
    if (!canvas) return;
    canvas.onmousedown = (e) => {
        if (currentItem?.task_type !== 'bbox' || !activeLabel) return;
        isDrawing = true;
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
    };

    canvas.onmousemove = (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        drawBoxes();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, (e.clientX - rect.left) - startX, (e.clientY - rect.top) - startY);
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
}

function drawBoxes() {
    if (!ctx) return;
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
    const hasData = Array.isArray(annotations) ? annotations.length > 0 : annotations.label;

    if (!hasData) {
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
            </div>`;
    } else {
        preview.innerHTML = annotations.map((ann, idx) => `
            <div class="p-2 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center text-xs group mb-2">
                <span class="font-bold text-indigo-600">${ann.label}</span>
                <span class="text-slate-500 truncate ml-2 mr-2">${ann.text || 'Box'}</span>
                <button onclick="removeAnnotation(${idx})" class="text-slate-300 hover:text-red-500 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>`).join('');
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
            body: JSON.stringify({ annotation: JSON.stringify(annotations) })
        });
        const itemIndex = items.findIndex(i => i.id === currentItem.id);
        items[itemIndex].annotation = annotations;
        renderSidebar();
        btn.innerHTML = 'Saved!';
        btn.classList.replace('bg-indigo-600', 'bg-emerald-500');
        setTimeout(() => {
            btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Save Annotation';
            btn.classList.replace('bg-emerald-500', 'bg-indigo-600');
            btn.disabled = false;
            lucide.createIcons();
        }, 1500);
    } catch (e) {
        alert("Save failed");
        btn.disabled = false;
    }
}

function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(items, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "minilabel_export.json");
    dlAnchor.click();
}