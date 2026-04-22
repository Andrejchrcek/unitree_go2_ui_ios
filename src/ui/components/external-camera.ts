const POS_KEY     = 'go2_extcam_pos';
const VISIBLE_KEY = 'go2_extcam_visible';
export const EXTCAM_URL_KEY     = 'go2_extcam_url';
export const EXTCAM_DEFAULT_URL = 'ws://go2cam.local:81';

export class ExternalCamera {
  private container: HTMLElement;
  private img: HTMLImageElement;
  private statusEl: HTMLElement;
  private ws: WebSocket | null = null;
  private currentBlobUrl: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  // Drag
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private offsetX = 0;
  private offsetY = 0;

  constructor(private parent: HTMLElement, private wsUrl: string) {
    this.container = document.createElement('div');
    this.container.className = 'ext-camera';

    // ── Header: grip + label + status + close ──────────────────────────────
    const header = document.createElement('div');
    header.className = 'ext-camera-header';

    const grip = document.createElement('div');
    grip.className = 'ext-camera-grip';
    grip.innerHTML = `<svg width="10" height="16" viewBox="0 0 10 16" fill="none">
      <circle cx="3" cy="3"  r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="7" cy="3"  r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="3" cy="8"  r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="7" cy="8"  r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="3" cy="13" r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="7" cy="13" r="1.5" fill="rgba(255,255,255,0.4)"/>
    </svg>`;

    const label = document.createElement('span');
    label.className = 'ext-camera-label';
    label.textContent = 'Ext Cam';

    this.statusEl = document.createElement('span');
    this.statusEl.className = 'ext-camera-status status-connecting';
    this.statusEl.textContent = '● …';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ext-camera-close';
    closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <line x1="2" y1="2" x2="10" y2="10" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="10" y1="2" x2="2" y2="10" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
    closeBtn.addEventListener('click', () => this.hide());

    header.appendChild(grip);
    header.appendChild(label);
    header.appendChild(this.statusEl);
    header.appendChild(closeBtn);

    // ── Video area ─────────────────────────────────────────────────────────
    this.img = document.createElement('img');
    this.img.className = 'ext-camera-img';
    this.img.draggable = false;
    this.img.alt = '';

    this.container.appendChild(header);
    this.container.appendChild(this.img);
    parent.appendChild(this.container);

    this.setupDrag(grip);
    this.restorePosition();

    // Restore visibility
    const vis = localStorage.getItem(VISIBLE_KEY);
    if (vis === 'false') {
      this.container.style.display = 'none';
    } else {
      this.connect();
    }
  }

  // ── WebSocket ───────────────────────────────────────────────────────────────
  private connect(): void {
    if (this.destroyed || this.container.style.display === 'none') return;
    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => this.setStatus('live');

      this.ws.onmessage = (e: MessageEvent) => {
        const blob = new Blob([e.data as ArrayBuffer], { type: 'image/jpeg' });
        const url  = URL.createObjectURL(blob);
        const old  = this.currentBlobUrl;
        this.img.src = url;
        this.currentBlobUrl = url;
        if (old) URL.revokeObjectURL(old);
      };

      this.ws.onclose = () => {
        if (this.destroyed) return;
        this.setStatus('offline');
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = () => this.setStatus('offline');
    } catch {
      this.setStatus('offline');
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    }
  }

  private setStatus(s: 'connecting' | 'live' | 'offline'): void {
    const map = {
      connecting: { text: '● …',      cls: 'status-connecting' },
      live:       { text: '● LIVE',   cls: 'status-live'       },
      offline:    { text: '● Offline', cls: 'status-offline'   },
    };
    const m = map[s];
    this.statusEl.textContent = s === 'live' ? '● LIVE' : m.text;
    this.statusEl.className = `ext-camera-status ${m.cls}`;
  }

  // ── Public API ──────────────────────────────────────────────────────────────
  show(): void {
    this.container.style.display = '';
    try { localStorage.setItem(VISIBLE_KEY, 'true'); } catch { /* ignore */ }
    this.connect();
  }

  hide(): void {
    this.container.style.display = 'none';
    try { localStorage.setItem(VISIBLE_KEY, 'false'); } catch { /* ignore */ }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.ws?.close();
    this.ws = null;
    this.setStatus('offline');
  }

  isVisible(): boolean {
    return this.container.style.display !== 'none';
  }

  setUrl(url: string): void {
    this.wsUrl = url;
    this.ws?.close();
    this.ws = null;
    if (this.isVisible()) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), 200);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
    this.container.remove();
  }

  // ── Position ────────────────────────────────────────────────────────────────
  private restorePosition(): void {
    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number };
        this.offsetX = x;
        this.offsetY = y;
        this.container.style.transform = `translate(${x}px, ${y}px)`;
      } else {
        // Default: top-right, below nav bar
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const rect = this.container.getBoundingClientRect();
          this.offsetX = window.innerWidth - (rect.width || 280) - 16;
          this.offsetY = 60;
          this.container.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px)`;
        }));
      }
    } catch { /* ignore */ }
  }

  // ── Drag ────────────────────────────────────────────────────────────────────
  private setupDrag(grip: HTMLElement): void {
    let hasMoved = false;

    grip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.dragging = true;
      hasMoved = false;
      this.dragStartX = e.clientX - this.offsetX;
      this.dragStartY = e.clientY - this.offsetY;
      grip.setPointerCapture(e.pointerId);
      this.container.style.transition = 'none';
    });

    grip.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx - this.offsetX) > 3 || Math.abs(dy - this.offsetY) > 3) hasMoved = true;
      this.offsetX = dx;
      this.offsetY = dy;
      this.container.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    grip.addEventListener('pointerup', () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.container.style.transition = '';
      if (hasMoved) {
        try { localStorage.setItem(POS_KEY, JSON.stringify({ x: this.offsetX, y: this.offsetY })); }
        catch { /* ignore */ }
      }
    });
  }
}
