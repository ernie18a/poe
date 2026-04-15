
/**
 * Atlas Node Navigator Core Logic
 */

class TreeViewer {
    constructor() {
        this.canvas = document.getElementById('tree-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.data = null;
        this.nodes = [];
        this.nodeMap = {}; // ID to Node mapping for line drawing
        
        // View state
        this.scale = 0.4;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Interaction state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.hoveredNode = null;
        
        // Search filters
        this.queryExact = "";
        this.queryOrTokens = [];

        this.init();
    }

    async init() {
        try {
            const response = await fetch('./data.json');
            this.data = await response.json();
            this.processNodes();
            this.setupEventListeners();
            this.resize();
            this.centerView();
            this.animate();
            document.getElementById('status-bar').innerText = `節點數量: ${this.nodes.length}`;
        } catch (e) {
            console.error("Failed to load data", e);
            document.getElementById('status-bar').innerText = "資料載入失敗";
        }
    }

    processNodes() {
        const { nodes, groups, constants } = this.data;
        this.nodes = [];
        this.nodeMap = {};
        const orbitRadii = constants.orbitRadii;
        const skillsPerOrbit = constants.skillsPerOrbit;

        for (const id in nodes) {
            const node = nodes[id];
            const group = groups[node.group];
            if (!group) continue;

            // Calculate Position
            const radius = orbitRadii[node.orbit];
            const n = skillsPerOrbit[node.orbit];
            const angle = (2 * Math.PI * node.orbitIndex) / n - (Math.PI / 2);
            
            const x = group.x + radius * Math.cos(angle);
            const y = group.y + radius * Math.sin(angle);

            // Determine size and type (Enlarged for better visibility)
            let size = 30; // Normal nodes
            let type = "small";
            if (node.isKeystone) { size = 110; type = "keystone"; }
            else if (node.isNotable) { size = 70; type = "notable"; }

            const processedNode = {
                ...node,
                id, // Store ID for matching connections
                x, y, size, type,
                name: node.name || "Unknown Node",
                searchText: ((node.name || "") + " " + (node.stats || []).join(" ")).toLowerCase()
            };

            this.nodes.push(processedNode);
            this.nodeMap[id] = processedNode;
        }
    }

    centerView() {
        this.offsetX = this.canvas.width / 2;
        this.offsetY = this.canvas.height / 2;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());

        // Dragging
        this.canvas.addEventListener('mousedown', e => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });
        window.addEventListener('mousemove', e => {
            if (this.isDragging) {
                this.offsetX += (e.clientX - this.lastX);
                this.offsetY += (e.clientY - this.lastY);
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }
            this.handleHover(e);
        });
        window.addEventListener('mouseup', () => this.isDragging = false);

        // Zooming
        this.canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const zoomSpeed = 0.001;
            const delta = -e.deltaY;
            const oldScale = this.scale;
            this.scale *= (1 + delta * zoomSpeed);
            this.scale = Math.max(0.02, Math.min(this.scale, 2));

            // Zoom towards mouse
            const mouseX = e.clientX;
            const mouseY = e.clientY;
            this.offsetX = mouseX - (mouseX - this.offsetX) * (this.scale / oldScale);
            this.offsetY = mouseY - (mouseY - this.offsetY) * (this.scale / oldScale);
        }, { passive: false });

        // Search inputs
        document.getElementById('search-exact').addEventListener('input', e => {
            this.queryExact = e.target.value.toLowerCase().trim();
        });
        document.getElementById('search-or').addEventListener('input', e => {
            const val = e.target.value.toLowerCase().trim();
            this.queryOrTokens = val ? val.split(/\s+/) : [];
        });
    }

    handleHover(e) {
        const mouseX = (e.clientX - this.offsetX) / this.scale;
        const mouseY = (e.clientY - this.offsetY) / this.scale;
        
        let found = null;
        for (const node of this.nodes) {
            const dx = node.x - mouseX;
            const dy = node.y - mouseY;
            if (Math.sqrt(dx*dx + dy*dy) < node.size) {
                found = node;
                break;
            }
        }

        if (found !== this.hoveredNode) {
            this.hoveredNode = found;
            this.updateTooltip(e, found);
        } else if (found) {
            this.updateTooltip(e, found);
        }
    }

    updateTooltip(e, node) {
        const tt = document.getElementById('tooltip');
        if (!node) {
            tt.style.opacity = 0;
            return;
        }
        document.getElementById('tt-name').innerText = node.name;
        document.getElementById('tt-stat').innerText = (node.stats || []).join('\n');
        
        tt.style.left = (e.clientX + 20) + 'px';
        tt.style.top = (e.clientY + 20) + 'px';
        tt.style.opacity = 1;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    drawNode(node) {
        const screenX = node.x * this.scale + this.offsetX;
        const screenY = node.y * this.scale + this.offsetY;
        
        // Ensure minimum visibility radius (at least 2.5px even when zoomed out)
        const radius = Math.max(node.size * this.scale * 0.8, 2.5);

        if (screenX < -200 || screenX > this.canvas.width + 200 || 
            screenY < -200 || screenY > this.canvas.height + 200) return;

        // Check Search State
        const isSearching = this.queryExact !== "" || this.queryOrTokens.length > 0;
        const isMatchExact = this.queryExact && node.searchText.includes(this.queryExact);
        const isMatchOr = this.queryOrTokens.length > 0 && this.queryOrTokens.some(t => node.searchText.includes(t));
        
        // --- Style Definition ---
        let fillColor = "#555";
        let strokeColor = "rgba(255,255,255,0.3)";
        let opacity = 0.9;
        let glow = null;
        let glowSize = 10;

        if (node.id === "root") {
            fillColor = "#00ffff"; // Cyan for root
            strokeColor = "#fff";
            glow = "#00ffff";
        } else if (node.type === "keystone") { 
            fillColor = "#fff"; 
            strokeColor = "rgba(255,255,255,0.8)";
            glow = "rgba(255,255,255,0.4)"; 
        }
        else if (node.type === "notable") { 
            fillColor = "#ffd700"; 
            strokeColor = "rgba(255,215,0,0.8)"; 
            glow = "rgba(255,215,0,0.3)";
        }
        else { 
            fillColor = "#888"; // Brighter small nodes
            strokeColor = "rgba(0,0,0,0.5)";
        }

        // --- Search Highlight Priority ---
        if (isSearching) {
            if (isMatchExact || isMatchOr) {
                opacity = 1.0;
                if (isMatchExact && isMatchOr) {
                    glow = "#ffffff";
                    fillColor = "#ffffff";
                    glowSize = 25;
                } else if (isMatchExact) {
                    glow = "#00ff88"; // Neon Green
                    fillColor = "#00ff88";
                    strokeColor = "#fff";
                    glowSize = 20;
                } else {
                    glow = "#ffaa00"; // Neon Orange
                    fillColor = "#ffaa00";
                    strokeColor = "#fff";
                    glowSize = 20;
                }
            } else {
                opacity = 0.15; // Dim others
            }
        }

        this.ctx.globalAlpha = opacity;
        
        // 1. Draw Outer Glow
        if (glow) {
            this.ctx.shadowBlur = glowSize * this.scale * 2;
            this.ctx.shadowColor = glow;
        }

        // 2. Draw Main Circle
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
        
        // 3. Draw Sharper Border (High Contrast)
        this.ctx.shadowBlur = 0; 
        this.ctx.strokeStyle = (isMatchExact || isMatchOr) ? "#fff" : strokeColor;
        this.ctx.lineWidth = Math.max(1, (node.type === "small" ? 1 : 3) * this.scale);
        this.ctx.stroke();

        this.ctx.globalAlpha = 1.0;
    }

    drawLines() {
        this.ctx.shadowBlur = 0; // Reset shadow for lines
        this.ctx.beginPath();
        // Increased opacity and width for better visibility
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        this.ctx.lineWidth = 2 * this.scale;

        for (const node of this.nodes) {
            if (!node.out || node.out.length === 0) continue;

            const x1 = node.x * this.scale + this.offsetX;
            const y1 = node.y * this.scale + this.offsetY;

            // Frustum culling for lines (simple check)
            if (x1 < -500 || x1 > this.canvas.width + 500 || y1 < -500 || y1 > this.canvas.height + 500) continue;

            for (const outId of node.out) {
                const target = this.nodeMap[outId];
                if (!target) continue;

                const x2 = target.x * this.scale + this.offsetX;
                const y2 = target.y * this.scale + this.offsetY;

                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
            }
        }
        this.ctx.stroke();
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw Lines behind nodes
        this.drawLines();
        
        // Draw Nodes
        for (const node of this.nodes) {
            this.drawNode(node);
        }

        requestAnimationFrame(() => this.animate());
    }
}

new TreeViewer();
