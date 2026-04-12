import { RTC_TOPIC, VUI_CMD } from '../../protocol/topics';
import type { DataChannelHandler } from '../../protocol/data-channel';
import { audioServerUrl, audioServerHeaders } from '../../platform';

interface AudioFile {
  filename: string;
  size_kb: number;
}

export class AudioPage {
  private container: HTMLElement;
  private onBack: () => void;
  private dataHandler: DataChannelHandler;
  private robotHost: string;

  // State
  private volume    = 7;
  private files: AudioFile[] = [];
  private playing: string | null = null;
  private uploading = false;

  // DOM refs
  private volSlider!:   HTMLInputElement;
  private volLabel!:    HTMLElement;
  private fileListEl!:  HTMLElement;
  private stopBtn!:     HTMLButtonElement;
  private uploadInput!: HTMLInputElement;
  private uploadBtn!:   HTMLButtonElement;
  private uploadStatus!:HTMLElement;

  constructor(
    parent: HTMLElement,
    onBack: () => void,
    dataHandler: DataChannelHandler,
    robotHost: string,
  ) {
    this.onBack      = onBack;
    this.dataHandler = dataHandler;
    this.robotHost   = robotHost;

    this.container = document.createElement('div');
    this.container.className = 'audio-page';

    this.buildHeader();
    this.buildContent();

    parent.appendChild(this.container);

    // Fetch current volume and file list on open
    this.dataHandler.publishRequest(RTC_TOPIC.VUI, VUI_CMD.VolumeGet);
    this.fetchFileList();
  }

  // ── Header ──────────────────────────────────────────────────────────────

  private buildHeader(): void {
    const header = document.createElement('div');
    header.className = 'page-header';

    const backBtn = document.createElement('button');
    backBtn.className = 'page-back-btn';
    backBtn.innerHTML = `<img src="/sprites/nav-bar-left-icon.png" alt="Back" />`;
    backBtn.addEventListener('click', () => this.onBack());
    header.appendChild(backBtn);

    const title = document.createElement('h2');
    title.textContent = 'Audio';
    header.appendChild(title);

    this.container.appendChild(header);
  }

  // ── Main content ─────────────────────────────────────────────────────────

  private buildContent(): void {
    const content = document.createElement('div');
    content.className = 'page-content audio-content';

    content.appendChild(this.buildVolumeSection());
    content.appendChild(this.buildDivider());
    content.appendChild(this.buildPlayerSection());
    content.appendChild(this.buildDivider());
    content.appendChild(this.buildUploadSection());

    this.container.appendChild(content);
  }

  // ── Volume ───────────────────────────────────────────────────────────────

  private buildVolumeSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'audio-section';
    wrap.appendChild(this.makeLabel('VOLUME'));

    const row = document.createElement('div');
    row.className = 'audio-volume-row';

    row.appendChild(this.makeVolIcon(false));

    this.volSlider = document.createElement('input');
    this.volSlider.type    = 'range';
    this.volSlider.min     = '0';
    this.volSlider.max     = '10';
    this.volSlider.step    = '1';
    this.volSlider.value   = String(this.volume);
    this.volSlider.className = 'audio-vol-slider';

    this.volLabel = document.createElement('span');
    this.volLabel.className = 'audio-vol-label';
    this.volLabel.textContent = String(this.volume);

    this.volSlider.addEventListener('input', () => {
      this.volume = parseInt(this.volSlider.value, 10);
      this.volLabel.textContent = String(this.volume);
    });
    this.volSlider.addEventListener('change', () => {
      this.dataHandler.publishRequest(
        RTC_TOPIC.VUI,
        VUI_CMD.VolumeSet,
        JSON.stringify({ volume: this.volume }),
      );
    });

    row.appendChild(this.volSlider);
    row.appendChild(this.makeVolIcon(true));
    row.appendChild(this.volLabel);

    wrap.appendChild(row);
    return wrap;
  }

  private makeVolIcon(high: boolean): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', '#666');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (high) {
      svg.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>`;
    } else {
      svg.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <line x1="23" y1="9" x2="17" y2="15"/>
        <line x1="17" y1="9" x2="23" y2="15"/>`;
    }
    return svg;
  }

  // ── MP3 Player ───────────────────────────────────────────────────────────

  private nowPlayingEl!: HTMLElement;

  private buildPlayerSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'audio-section';

    // Header row with label + refresh
    const headerRow = document.createElement('div');
    headerRow.className = 'audio-player-header-row';
    headerRow.appendChild(this.makeLabel('MP3 PLAYER'));

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'audio-icon-btn';
    refreshBtn.title = 'Refresh list';
    refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>`;
    refreshBtn.addEventListener('click', () => this.fetchFileList());
    headerRow.appendChild(refreshBtn);
    wrap.appendChild(headerRow);

    // Now Playing card (hidden initially)
    this.nowPlayingEl = document.createElement('div');
    this.nowPlayingEl.className = 'audio-now-playing';
    this.nowPlayingEl.style.display = 'none';
    wrap.appendChild(this.nowPlayingEl);

    // Stop button (hidden until something is playing)
    this.stopBtn = document.createElement('button');
    this.stopBtn.className = 'audio-stop-btn';
    this.stopBtn.style.display = 'none';
    this.stopBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
      </svg>
      Stop playback
    `;
    this.stopBtn.addEventListener('click', () => this.stopPlayback());
    wrap.appendChild(this.stopBtn);

    // File list
    this.fileListEl = document.createElement('div');
    this.fileListEl.className = 'audio-file-list';
    this.fileListEl.innerHTML = `<p class="audio-file-empty">Loading…</p>`;
    wrap.appendChild(this.fileListEl);

    return wrap;
  }

  private renderNowPlaying(): void {
    if (!this.playing) {
      this.nowPlayingEl.style.display = 'none';
      this.stopBtn.style.display = 'none';
      return;
    }
    this.nowPlayingEl.style.display = '';
    this.stopBtn.style.display = '';
    this.nowPlayingEl.innerHTML = `
      <div class="audio-np-bars">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="audio-np-info">
        <span class="audio-np-label">NOW PLAYING</span>
        <span class="audio-np-title">${this.playing}</span>
      </div>
    `;
  }

  private async fetchFileList(): Promise<void> {
    this.fileListEl.innerHTML = `<p class="audio-file-empty">Loading…</p>`;
    try {
      const res = await fetch(
        audioServerUrl(this.robotHost, '/list'),
        { headers: audioServerHeaders(this.robotHost) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { files: AudioFile[] };
      this.files = data.files || [];
      this.renderFileList();
    } catch (err) {
      this.fileListEl.innerHTML = `<p class="audio-file-empty audio-file-error">
        Cannot reach audio server<br><small>${(err as Error).message}</small>
      </p>`;
    }
  }

  private renderFileList(): void {
    this.fileListEl.innerHTML = '';
    if (this.files.length === 0) {
      this.fileListEl.innerHTML = `<p class="audio-file-empty">No MP3 files on robot.<br>Upload one below.</p>`;
      return;
    }

    for (const f of this.files) {
      const row = document.createElement('div');
      row.className = `audio-file-row ${this.playing === f.filename ? 'audio-file-row--playing' : ''}`;
      row.dataset['filename'] = f.filename;

      const info = document.createElement('div');
      info.className = 'audio-file-info';
      info.innerHTML = `<span class="audio-file-name">${f.filename}</span>
                        <span class="audio-file-size">${f.size_kb} KB</span>`;

      const btns = document.createElement('div');
      btns.className = 'audio-file-btns';

      const playBtn = document.createElement('button');
      playBtn.className = 'audio-file-play-btn';
      playBtn.title = 'Play';
      playBtn.innerHTML = this.playing === f.filename
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
             <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
           </svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
             <polygon points="5 3 19 12 5 21 5 3"/>
           </svg>`;
      playBtn.addEventListener('click', () => this.playFile(f.filename));

      const delBtn = document.createElement('button');
      delBtn.className = 'audio-file-del-btn';
      delBtn.title = 'Delete';
      delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14H6L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>`;
      delBtn.addEventListener('click', () => this.deleteFile(f.filename));

      btns.appendChild(playBtn);
      btns.appendChild(delBtn);
      row.appendChild(info);
      row.appendChild(btns);
      this.fileListEl.appendChild(row);
    }
  }

  private async playFile(filename: string): Promise<void> {
    try {
      const res = await fetch(
        audioServerUrl(this.robotHost, `/play/${encodeURIComponent(filename)}`),
        { method: 'POST', headers: audioServerHeaders(this.robotHost) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.playing = filename;
      this.renderNowPlaying();
      this.renderFileList();
    } catch (err) {
      console.error('Play error:', err);
    }
  }

  private async stopPlayback(): Promise<void> {
    try {
      await fetch(
        audioServerUrl(this.robotHost, '/stop'),
        { method: 'POST', headers: audioServerHeaders(this.robotHost) },
      );
      this.playing = null;
      this.renderNowPlaying();
      this.renderFileList();
    } catch (err) {
      console.error('Stop error:', err);
    }
  }

  private async deleteFile(filename: string): Promise<void> {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      const res = await fetch(
        audioServerUrl(this.robotHost, `/delete/${encodeURIComponent(filename)}`),
        { method: 'DELETE', headers: audioServerHeaders(this.robotHost) },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (this.playing === filename) {
        this.playing = null;
        this.renderNowPlaying();
      }
      await this.fetchFileList();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────

  private buildUploadSection(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'audio-section audio-upload-section';
    wrap.appendChild(this.makeLabel('UPLOAD MP3'));

    const sub = document.createElement('p');
    sub.className = 'audio-section-sub';
    sub.textContent = 'Send an MP3 file to the robot\'s storage';
    wrap.appendChild(sub);

    // Hidden file input
    this.uploadInput = document.createElement('input');
    this.uploadInput.type   = 'file';
    this.uploadInput.accept = '.mp3,audio/mpeg';
    this.uploadInput.style.display = 'none';
    this.uploadInput.addEventListener('change', () => this.handleFileSelected());
    wrap.appendChild(this.uploadInput);

    this.uploadBtn = document.createElement('button');
    this.uploadBtn.className = 'audio-upload-btn';
    this.uploadBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 16 12 12 8 16"/>
        <line x1="12" y1="12" x2="12" y2="21"/>
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
      </svg>
      Choose MP3 file
    `;
    this.uploadBtn.addEventListener('click', () => this.uploadInput.click());
    wrap.appendChild(this.uploadBtn);

    this.uploadStatus = document.createElement('p');
    this.uploadStatus.className = 'audio-upload-status';
    wrap.appendChild(this.uploadStatus);

    return wrap;
  }

  private async handleFileSelected(): Promise<void> {
    const file = this.uploadInput.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.mp3')) {
      this.uploadStatus.textContent = 'Only MP3 files are supported.';
      this.uploadStatus.className = 'audio-upload-status audio-upload-status--error';
      return;
    }

    this.uploading = true;
    this.uploadBtn.disabled = true;
    this.uploadStatus.className = 'audio-upload-status audio-upload-status--info';
    this.uploadStatus.textContent = `Uploading "${file.name}"…`;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(
        audioServerUrl(this.robotHost, '/upload'),
        {
          method: 'POST',
          headers: audioServerHeaders(this.robotHost), // no Content-Type — browser sets multipart boundary
          body: formData,
        },
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error: string }).error);
      }

      this.uploadStatus.className = 'audio-upload-status audio-upload-status--ok';
      this.uploadStatus.textContent = `"${file.name}" uploaded successfully.`;
      this.uploadInput.value = '';
      await this.fetchFileList();
    } catch (err) {
      this.uploadStatus.className = 'audio-upload-status audio-upload-status--error';
      this.uploadStatus.textContent = `Upload failed: ${(err as Error).message}`;
    } finally {
      this.uploading = false;
      this.uploadBtn.disabled = false;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private makeLabel(text: string): HTMLElement {
    const el = document.createElement('p');
    el.className = 'audio-section-label';
    el.textContent = text;
    return el;
  }

  private buildDivider(): HTMLElement {
    const d = document.createElement('hr');
    d.className = 'audio-divider';
    return d;
  }

  /** Called from app.ts when a VUI response with volume arrives. */
  setVolume(vol: number): void {
    this.volume = Math.round(Math.max(0, Math.min(10, vol)));
    if (this.volSlider) this.volSlider.value = String(this.volume);
    if (this.volLabel)  this.volLabel.textContent = String(this.volume);
  }
}
