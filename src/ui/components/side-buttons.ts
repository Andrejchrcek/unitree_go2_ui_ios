// Joystick icon SVGs
const JOYSTICK_ON_SVG = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#6879e4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="14" width="8" height="7" rx="2"/>
  <rect x="14" y="14" width="8" height="7" rx="2"/>
  <line x1="6" y1="14" x2="6" y2="11"/>
  <circle cx="6" cy="9" r="2" fill="rgba(104,121,228,0.35)" stroke="#6879e4"/>
  <line x1="18" y1="14" x2="18" y2="11"/>
  <circle cx="18" cy="9" r="2" fill="rgba(104,121,228,0.35)" stroke="#6879e4"/>
</svg>`;

const JOYSTICK_OFF_SVG = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="14" width="8" height="7" rx="2"/>
  <rect x="14" y="14" width="8" height="7" rx="2"/>
  <line x1="6" y1="14" x2="6" y2="11"/>
  <circle cx="6" cy="9" r="2"/>
  <line x1="18" y1="14" x2="18" y2="11"/>
  <circle cx="18" cy="9" r="2"/>
  <line x1="3" y1="3" x2="21" y2="21" stroke="#ef4a4a" stroke-width="1.8"/>
</svg>`;

// LiDAR icon SVGs (simple 3D scan/point cloud icon)
const LIDAR_SVG_ON = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#6879e4" stroke-width="2" stroke-linecap="round">
  <circle cx="12" cy="12" r="2"/>
  <path d="M12 2a10 10 0 0 1 0 20"/>
  <path d="M12 2a10 10 0 0 0 0 20"/>
  <path d="M12 6a6 6 0 0 1 0 12"/>
  <path d="M12 6a6 6 0 0 0 0 12"/>
</svg>`;

const LIDAR_SVG_OFF = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
  <circle cx="12" cy="12" r="2"/>
  <path d="M12 2a10 10 0 0 1 0 20"/>
  <path d="M12 2a10 10 0 0 0 0 20"/>
  <path d="M12 6a6 6 0 0 1 0 12"/>
  <path d="M12 6a6 6 0 0 0 0 12"/>
</svg>`;

// PIP toggle SVGs — small window in corner = PIP ON, window with X = PIP OFF
const PIP_ON_SVG = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#6879e4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <rect x="13" y="11" width="7" height="5" rx="1" fill="rgba(104,121,228,0.3)" stroke="#6879e4"/>
</svg>`;

const PIP_OFF_SVG = `<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="4" width="20" height="16" rx="2"/>
  <line x1="14" y1="12" x2="20" y2="16" stroke="#ef4a4a" stroke-width="1.5"/>
  <line x1="20" y1="12" x2="14" y2="16" stroke="#ef4a4a" stroke-width="1.5"/>
</svg>`;

export interface SettingCallbacks {
  onRadarToggle: (enabled: boolean) => void;
  onLampSet: (level: number) => void;
  onVolumeSet: (level: number) => void;
  onLidarToggle: (enabled: boolean) => void;
  /** Show or hide the PIP window entirely. */
  onPipToggle: (visible: boolean) => void;
  /** Enable or disable both joysticks. */
  onJoystickToggle: (enabled: boolean) => void;
  /** Open full settings panel. */
  onSettingsOpen: () => void;
}

const SETTINGS_KEY = 'go2_ui_settings';
const SETTINGS_POS_KEY = 'go2_settingbar_pos';

interface SavedSettings {
  pipVisible: boolean;
  joysticksOn: boolean;
}

function loadSettings(): SavedSettings {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) return JSON.parse(s) as SavedSettings;
  } catch { /* ignore */ }
  return { pipVisible: true, joysticksOn: true };
}

function saveSettings(s: SavedSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export class SettingBar {
  private container: HTMLElement;
  private radarOn = false;
  private lidarOn = true;
  private pipVisible: boolean;
  private joysticksOn: boolean;
  private radarBtn!: HTMLButtonElement;
  private volumeBtn!: HTMLButtonElement;
  private lampBtn!: HTMLButtonElement;
  private pipBtn!: HTMLButtonElement;
  private joystickBtn!: HTMLButtonElement;
  private volumeLevel = 0;
  private lampLevel = 0;
  private callbacks: SettingCallbacks;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private offsetX = 0;
  private offsetY = 0;

  constructor(parent: HTMLElement, callbacks: SettingCallbacks) {
    this.callbacks = callbacks;

    // Restore saved settings
    const saved = loadSettings();
    this.pipVisible = saved.pipVisible;
    this.joysticksOn = saved.joysticksOn;

    this.container = document.createElement('div');
    this.container.className = 'setting-bar';

    // Radar button
    this.radarBtn = this.createBtn('/sprites/icon_radar.png', 'Radar');
    this.radarBtn.addEventListener('click', () => {
      this.radarOn = !this.radarOn;
      const img = this.radarBtn.querySelector('img')!;
      img.src = this.radarOn ? '/sprites/icon_radar_on.png' : '/sprites/icon_radar.png';
      callbacks.onRadarToggle(this.radarOn);
    });

    // LiDAR button
    const lidarBtn = this.createSvgBtn(LIDAR_SVG_ON, 'LiDAR');
    lidarBtn.addEventListener('click', () => {
      this.lidarOn = !this.lidarOn;
      lidarBtn.innerHTML = this.lidarOn ? LIDAR_SVG_ON : LIDAR_SVG_OFF;
      callbacks.onLidarToggle(this.lidarOn);
    });

    // Volume button
    this.volumeBtn = this.createBtn('/sprites/icon_volume.png', 'Volume');
    this.volumeBtn.addEventListener('click', () => {
      this.toggleSlider(this.volumeBtn, 'Vol', this.volumeLevel, (val) => {
        this.volumeLevel = val;
        const img = this.volumeBtn.querySelector('img')!;
        img.src = val > 0 ? '/sprites/icon_volume_on.png' : '/sprites/icon_volume.png';
        callbacks.onVolumeSet(val);
      });
    });

    // Lamp button
    this.lampBtn = this.createBtn('/sprites/icon_lamp.png', 'Light');
    this.lampBtn.addEventListener('click', () => {
      this.toggleSlider(this.lampBtn, 'Light', this.lampLevel, (val) => {
        this.lampLevel = val;
        const img = this.lampBtn.querySelector('img')!;
        img.src = val > 0 ? '/sprites/icon_lamp_on.png' : '/sprites/icon_lamp.png';
        callbacks.onLampSet(val);
      });
    });

    // PIP toggle button
    this.pipBtn = this.createSvgBtn(this.pipVisible ? PIP_ON_SVG : PIP_OFF_SVG, 'PIP');
    this.pipBtn.title = 'Show / hide the picture-in-picture panel';
    this.pipBtn.addEventListener('click', () => {
      this.pipVisible = !this.pipVisible;
      this.pipBtn.innerHTML = this.pipVisible ? PIP_ON_SVG : PIP_OFF_SVG;
      saveSettings({ pipVisible: this.pipVisible, joysticksOn: this.joysticksOn });
      callbacks.onPipToggle(this.pipVisible);
    });

    // Joystick toggle button
    this.joystickBtn = this.createSvgBtn(this.joysticksOn ? JOYSTICK_ON_SVG : JOYSTICK_OFF_SVG, 'Joystick');
    this.joystickBtn.title = 'Enable / disable joysticks';
    this.joystickBtn.addEventListener('click', () => {
      this.joysticksOn = !this.joysticksOn;
      this.joystickBtn.innerHTML = this.joysticksOn ? JOYSTICK_ON_SVG : JOYSTICK_OFF_SVG;
      saveSettings({ pipVisible: this.pipVisible, joysticksOn: this.joysticksOn });
      callbacks.onJoystickToggle(this.joysticksOn);
    });

    // Drag grip handle at the top of the bar
    const grip = document.createElement('div');
    grip.className = 'setting-bar-grip';
    grip.innerHTML = `<svg width="16" height="10" viewBox="0 0 16 10" fill="none">
      <circle cx="3"  cy="2" r="1.5" fill="rgba(255,255,255,0.35)"/>
      <circle cx="8"  cy="2" r="1.5" fill="rgba(255,255,255,0.35)"/>
      <circle cx="13" cy="2" r="1.5" fill="rgba(255,255,255,0.35)"/>
      <circle cx="3"  cy="8" r="1.5" fill="rgba(255,255,255,0.35)"/>
      <circle cx="8"  cy="8" r="1.5" fill="rgba(255,255,255,0.35)"/>
      <circle cx="13" cy="8" r="1.5" fill="rgba(255,255,255,0.35)"/>
    </svg>`;
    // Settings button (gear icon)
    const settingsBtn = this.createSvgBtn(`<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="#6879e4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`, 'Settings');
    settingsBtn.title = 'Open settings';
    settingsBtn.addEventListener('click', () => callbacks.onSettingsOpen());

    this.container.appendChild(grip);

    this.container.appendChild(settingsBtn);
    this.container.appendChild(this.radarBtn);
    this.container.appendChild(lidarBtn);
    this.container.appendChild(this.pipBtn);
    this.container.appendChild(this.joystickBtn);
    this.container.appendChild(this.volumeBtn);
    this.container.appendChild(this.lampBtn);

    parent.appendChild(this.container);

    // Setup drag on grip
    this.setupDrag(grip);

    // Restore saved position
    try {
      const saved = localStorage.getItem(SETTINGS_POS_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number };
        this.offsetX = x;
        this.offsetY = y;
        this.container.style.transform = `translate(${x}px, ${y}px)`;
      }
    } catch { /* ignore */ }
  }

  private setupDrag(grip: HTMLElement): void {
    grip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.dragging = true;
      this.dragStartX = e.clientX - this.offsetX;
      this.dragStartY = e.clientY - this.offsetY;
      grip.setPointerCapture(e.pointerId);
      this.container.style.transition = 'none';
    });

    grip.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.offsetX = e.clientX - this.dragStartX;
      this.offsetY = e.clientY - this.dragStartY;
      this.container.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px)`;
    });

    grip.addEventListener('pointerup', () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.container.style.transition = '';
      try {
        localStorage.setItem(SETTINGS_POS_KEY, JSON.stringify({ x: this.offsetX, y: this.offsetY }));
      } catch { /* ignore */ }
    });
  }

  /** Returns the initial (restored) state so app.ts can apply it on startup. */
  getInitialSettings(): SavedSettings {
    return { pipVisible: this.pipVisible, joysticksOn: this.joysticksOn };
  }

  setRadar(enabled: boolean): void {
    this.radarOn = enabled;
    const img = this.radarBtn.querySelector('img')!;
    img.src = enabled ? '/sprites/icon_radar_on.png' : '/sprites/icon_radar.png';
  }

  setVolume(level: number): void {
    this.volumeLevel = level;
    const img = this.volumeBtn.querySelector('img')!;
    img.src = level > 0 ? '/sprites/icon_volume_on.png' : '/sprites/icon_volume.png';
  }

  setBrightness(level: number): void {
    this.lampLevel = level;
    const img = this.lampBtn.querySelector('img')!;
    img.src = level > 0 ? '/sprites/icon_lamp_on.png' : '/sprites/icon_lamp.png';
  }

  private createBtn(iconSrc: string, alt: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'setting-btn';
    const img = document.createElement('img');
    img.src = iconSrc;
    img.alt = alt;
    img.draggable = false;
    btn.appendChild(img);
    return btn;
  }

  private createSvgBtn(svgHtml: string, _alt: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'setting-btn';
    btn.innerHTML = svgHtml;
    return btn;
  }

  private toggleSlider(
    anchor: HTMLElement,
    label: string,
    initialValue: number,
    onChange: (val: number) => void,
  ): void {
    const existing = anchor.querySelector('.slider-popup');
    if (existing) {
      existing.remove();
      return;
    }

    const popup = document.createElement('div');
    popup.className = 'slider-popup';

    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '10';
    range.value = String(initialValue);

    const valueLabel = document.createElement('span');
    valueLabel.className = 'slider-value';
    valueLabel.textContent = `${label}: ${initialValue}`;

    range.addEventListener('input', () => {
      const val = parseInt(range.value, 10);
      valueLabel.textContent = `${label}: ${val}`;
      onChange(val);
    });

    popup.appendChild(range);
    popup.appendChild(valueLabel);
    anchor.style.position = 'relative';
    anchor.appendChild(popup);

    const close = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
        popup.remove();
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

/** APK-matching emergency stop: swipe the whole button left to activate. */
export class EmergencyStop {
  private container: HTMLElement;
  private arrowEl: HTMLElement;
  private activated = false;
  private startX = 0;
  private animating = false;

  constructor(parent: HTMLElement, private onStop: (active: boolean) => void) {
    this.container = document.createElement('div');
    this.container.className = 'emergency-stop';

    // Left-pointing double arrow
    this.arrowEl = document.createElement('span');
    this.arrowEl.className = 'estop-arrow';
    this.arrowEl.innerHTML = '&#x00AB;'; // « double left arrow

    const label = document.createElement('span');
    label.className = 'estop-label';
    label.textContent = 'STOP';

    this.container.appendChild(this.arrowEl);
    this.container.appendChild(label);

    // Invisible drag overlay (APK: operation_bar 120% width, 180% height)
    const dragArea = document.createElement('div');
    dragArea.className = 'estop-drag-area';
    this.container.appendChild(dragArea);

    dragArea.addEventListener('pointerdown', (e) => this.onPointerDown(e, dragArea));
    dragArea.addEventListener('pointermove', (e) => this.onPointerMove(e, dragArea));
    dragArea.addEventListener('pointerup', (e) => this.onPointerUp(e, dragArea));
    dragArea.addEventListener('pointercancel', (e) => this.onPointerUp(e, dragArea));

    parent.appendChild(this.container);
  }

  private onPointerDown(e: PointerEvent, area: HTMLElement): void {
    if (this.animating) return;
    this.startX = e.clientX;
    area.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent, area: HTMLElement): void {
    if (this.animating || !area.hasPointerCapture(e.pointerId)) return;
    // No visual movement — APK doesn't move the button visually during drag
  }

  private onPointerUp(e: PointerEvent, area: HTMLElement): void {
    if (this.animating) return;
    area.releasePointerCapture(e.pointerId);
    const dragDist = this.startX - e.clientX; // positive = dragged left

    if (!this.activated && dragDist > 30) {
      // Swipe left → activate
      this.activated = true;
      this.container.classList.add('animation');
      this.arrowEl.classList.add('active');
      this.onStop(true);
    } else if (this.activated && dragDist < -30) {
      // Swipe right → deactivate
      this.activated = false;
      this.container.classList.remove('animation');
      this.arrowEl.classList.remove('active');
      this.onStop(false);
    }
  }
}
