import { audioServerUrl, audioServerHeaders } from '../../platform';

interface AudioFile {
  filename: string;
  size_kb: number;
}

export class FloatingPlayer {
  private container: HTMLElement;
  private robotHost: string;

  private files: AudioFile[] = [];
  private playing: string | null = null;

  // DOM refs
  private trackLabel!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private listPopup: HTMLElement | null = null;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private offsetX = 0;
  private offsetY = 0;
  private hasMoved = false;
  private static POS_KEY = 'go2_float_player_pos';

  constructor(parent: HTMLElement, robotHost: string) {
    this.robotHost = robotHost;

    this.container = document.createElement('div');
    this.container.className = 'float-player';

    this.buildUI();
    this.setupDrag();

    parent.appendChild(this.container);

    // Restore saved position
    try {
      const saved = localStorage.getItem(FloatingPlayer.POS_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number };
        this.offsetX = x;
        this.offsetY = y;
        this.container.style.transform = `translate(${x}px, ${y}px)`;
      }
    } catch { /* ignore */ }

    this.fetchFiles();
  }

  private static stripExt(name: string): string {
    return name.replace(/\.mp3$/i, '');
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  private buildUI(): void {
    // Music icon
    const icon = document.createElement('div');
    icon.className = 'float-player-icon';
    icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>`;
    this.container.appendChild(icon);

    // Track name — tap to open list
    this.trackLabel = document.createElement('button');
    this.trackLabel.className = 'float-player-track';
    this.trackLabel.textContent = 'No track';
    this.trackLabel.addEventListener('click', (e) => {
      if (this.hasMoved) return;
      e.stopPropagation();
      this.toggleList();
    });
    this.container.appendChild(this.trackLabel);

    // Divider
    const div = document.createElement('div');
    div.className = 'float-player-divider';
    this.container.appendChild(div);

    // Prev
    const prevBtn = this.makeBtn(`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`, 'Prev');
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.playPrev(); });
    this.container.appendChild(prevBtn);

    // Play/Pause
    this.playBtn = this.makeBtn(`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>`, 'Play');
    this.playBtn.className = 'float-player-btn float-player-btn--play';
    this.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.playing) {
        this.stopPlayback();
      } else if (this.files.length > 0) {
        this.playFile(this.files[0].filename);
      }
    });
    this.container.appendChild(this.playBtn);

    // Next
    const nextBtn = this.makeBtn(`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`, 'Next');
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.playNext(); });
    this.container.appendChild(nextBtn);
  }

  private makeBtn(svg: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'float-player-btn';
    btn.title = title;
    btn.innerHTML = svg;
    return btn;
  }

  // ── Drag ─────────────────────────────────────────────────────────────────

  private setupDrag(): void {
    this.container.addEventListener('pointerdown', (e) => {
      // Don't drag if target is a button
      if ((e.target as HTMLElement).closest('button')) return;
      this.dragging = true;
      this.hasMoved = false;
      this.dragStartX = e.clientX - this.offsetX;
      this.dragStartY = e.clientY - this.offsetY;
      this.container.setPointerCapture(e.pointerId);
      this.container.style.transition = 'none';
    });

    this.container.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx - this.offsetX) > 4 || Math.abs(dy - this.offsetY) > 4) {
        this.hasMoved = true;
      }
      this.offsetX = dx;
      this.offsetY = dy;
      this.container.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    this.container.addEventListener('pointerup', () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.container.style.transition = '';
      if (this.hasMoved) {
        try {
          localStorage.setItem(FloatingPlayer.POS_KEY, JSON.stringify({ x: this.offsetX, y: this.offsetY }));
        } catch { /* ignore */ }
      }
    });
  }

  // ── File list popup ───────────────────────────────────────────────────────

  private toggleList(): void {
    if (this.listPopup) {
      this.closeList();
      return;
    }
    this.openList();
  }

  private openList(): void {
    this.listPopup = document.createElement('div');
    this.listPopup.className = 'float-player-popup';

    if (this.files.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'float-player-popup-empty';
      empty.textContent = 'No MP3 files on robot';
      this.listPopup.appendChild(empty);
    } else {
      for (const f of this.files) {
        const row = document.createElement('button');
        row.className = `float-player-popup-row ${this.playing === f.filename ? 'float-player-popup-row--active' : ''}`;
        row.dataset['filename'] = f.filename;
        row.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" class="float-popup-play-icon">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>${FloatingPlayer.stripExt(f.filename)}</span>
        `;
        row.addEventListener('click', () => {
          this.playFile(f.filename);
          // Update active state without closing
          this.listPopup?.querySelectorAll('.float-player-popup-row').forEach((r) => {
            r.classList.toggle('float-player-popup-row--active', (r as HTMLElement).dataset['filename'] === f.filename);
          });
        });
        this.listPopup.appendChild(row);
      }
    }

    // Refresh row
    const refreshRow = document.createElement('button');
    refreshRow.className = 'float-player-popup-refresh';
    refreshRow.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg> Refresh`;
    refreshRow.addEventListener('click', () => {
      this.closeList();
      this.fetchFiles().then(() => this.openList());
    });
    this.listPopup.appendChild(refreshRow);

    this.container.appendChild(this.listPopup);

    // Close on outside click
    const close = (e: PointerEvent) => {
      if (this.listPopup && !this.container.contains(e.target as Node)) {
        this.closeList();
        document.removeEventListener('pointerdown', close);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', close), 0);
  }

  private closeList(): void {
    this.listPopup?.remove();
    this.listPopup = null;
  }

  // ── Playback ──────────────────────────────────────────────────────────────

  private async fetchFiles(): Promise<void> {
    try {
      const res = await fetch(
        audioServerUrl(this.robotHost, '/list'),
        { headers: audioServerHeaders(this.robotHost) },
      );
      if (!res.ok) return;
      const data = await res.json() as { files: AudioFile[] };
      this.files = data.files || [];
    } catch { /* silent — audio server may not be running */ }
  }

  private async playFile(filename: string): Promise<void> {
    try {
      const res = await fetch(
        audioServerUrl(this.robotHost, `/play/${encodeURIComponent(filename)}`),
        { method: 'POST', headers: audioServerHeaders(this.robotHost) },
      );
      if (!res.ok) return;
      this.playing = filename;
      this.updateUI();
    } catch (err) {
      console.error('FloatingPlayer play error:', err);
    }
  }

  private async stopPlayback(): Promise<void> {
    try {
      await fetch(
        audioServerUrl(this.robotHost, '/stop'),
        { method: 'POST', headers: audioServerHeaders(this.robotHost) },
      );
      this.playing = null;
      this.updateUI();
    } catch (err) {
      console.error('FloatingPlayer stop error:', err);
    }
  }

  private playPrev(): void {
    if (this.files.length === 0) return;
    const idx = this.files.findIndex((f) => f.filename === this.playing);
    const prev = idx <= 0 ? this.files[this.files.length - 1] : this.files[idx - 1];
    this.playFile(prev.filename);
  }

  private playNext(): void {
    if (this.files.length === 0) return;
    const idx = this.files.findIndex((f) => f.filename === this.playing);
    const next = idx < 0 || idx >= this.files.length - 1 ? this.files[0] : this.files[idx + 1];
    this.playFile(next.filename);
  }

  private updateUI(): void {
    // Track label
    this.trackLabel.textContent = this.playing ? FloatingPlayer.stripExt(this.playing) : 'No track';
    this.trackLabel.classList.toggle('float-player-track--playing', !!this.playing);

    // Play button icon
    this.playBtn.innerHTML = this.playing
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
           <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
         </svg>`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
           <polygon points="5 3 19 12 5 21 5 3"/>
         </svg>`;

    this.container.classList.toggle('float-player--playing', !!this.playing);
  }

  destroy(): void {
    this.closeList();
    this.container.remove();
  }
}
