import { SPORT_CMD } from '../../protocol/topics';
import { getIconSize, getShowLabels, type IconSize } from '../components/settings-panel';

export interface RobotAction {
  apiId: number;
  name: string;
  icon: string;
  /** JSON parameter string sent with the request. Defaults to '{}'. */
  param?: string;
}

const DATA_TRUE = '{"data":true}';

/** All available actions (tricks/gestures) */
export const ALL_ACTIONS: RobotAction[] = [
  { apiId: SPORT_CMD.Wallow, name: 'Roll Over', icon: '/icons/rollOver.svg' },
  { apiId: SPORT_CMD.Stretch, name: 'Stretch', icon: '/icons/stretch.svg' },
  { apiId: SPORT_CMD.Hello, name: 'Shake Hand', icon: '/icons/shakeHands.svg' },
  { apiId: SPORT_CMD.FingerHeart, name: 'Heart', icon: '/icons/showHeart.svg' },
  { apiId: SPORT_CMD.FrontPounce, name: 'Pounce', icon: '/icons/pounceForward.svg' },
  { apiId: SPORT_CMD.FrontJump, name: 'Jump Fwd', icon: '/icons/jumpForward.svg' },
  { apiId: SPORT_CMD.Scrape, name: 'Greet', icon: '/icons/newYear.svg' },
  { apiId: SPORT_CMD.Dance1, name: 'Dance 1', icon: '/icons/dance1.svg' },
  { apiId: SPORT_CMD.Dance2, name: 'Dance 2', icon: '/icons/dance2.svg' },
  { apiId: SPORT_CMD.FrontFlip, name: 'Front Flip', icon: '/sprites/icon_flip_forward.png', param: DATA_TRUE },
  { apiId: SPORT_CMD.BackFlip, name: 'Back Flip', icon: '/icons/hand_stand.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.LeftFlip, name: 'Left Flip', icon: '/icons/mode_bound.svg', param: DATA_TRUE },
];

/** All available modes */
export const ALL_MODES: RobotAction[] = [
  { apiId: SPORT_CMD.Damp, name: 'Damping', icon: '/icons/mode_damping.svg' },
  { apiId: SPORT_CMD.FreeWalk, name: 'Free Walk', icon: '/icons/mode_freeWalk.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.Sit, name: 'Sit Down', icon: '/icons/sitDown.svg' },
  { apiId: SPORT_CMD.Pose, name: 'Pose', icon: '/icons/mode_pose.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.StandDown, name: 'Crouch', icon: '/icons/lieDown.svg' },
  { apiId: SPORT_CMD.SwitchGait, name: 'Run', icon: '/icons/mode_run.svg', param: '{"data":1}' },
  { apiId: SPORT_CMD.WalkStair, name: 'Walk Stair', icon: '/icons/mode_climbingStairs.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.StandUp, name: 'Lock On', icon: '/icons/mode_locking.svg' },
  { apiId: SPORT_CMD.StaticWalk, name: 'Static Walk', icon: '/icons/mode_walk.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.EconomicGait, name: 'Endurance', icon: '/icons/mode_batteryLife.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.LeadFollow, name: 'Leash', icon: '/icons/mode_traction.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.HandStand, name: 'Hand Stand', icon: '/icons/hand_stand.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.FreeAvoid, name: 'Free Avoid', icon: '/icons/mode_ai_avoid.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.FreeBound, name: 'Bound', icon: '/icons/mode_ai_bound.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.FreeJump, name: 'Jump', icon: '/icons/mode_bound.svg', param: DATA_TRUE },
  { apiId: SPORT_CMD.RecoveryStand, name: 'Stand', icon: '/icons/mode_stand.svg' },
  { apiId: SPORT_CMD.CrossStep, name: 'Cross Step', icon: '/icons/mode_crossStep.svg', param: DATA_TRUE },
];

export type ActionCallback = (action: RobotAction) => void;

interface ShortcutRef {
  type: 'action' | 'mode';
  index: number;
}

/** Default shortcut bar items */
const DEFAULT_SHORTCUTS: ShortcutRef[] = [
  { type: 'action', index: 0 },
  { type: 'action', index: 1 },
  { type: 'action', index: 2 },
  { type: 'action', index: 3 },
  { type: 'action', index: 4 },
];

const SHORTCUTS_KEY = 'go2_shortcuts';
const POS_KEY = 'go2_actionbar_pos';

export class ActionBar {
  private container: HTMLElement;
  private island: HTMLElement;
  private popup: HTMLElement | null = null;
  private onAction: ActionCallback;
  private editing = false;

  // Items that appear in the shortcut bar
  private shortcuts: ShortcutRef[];

  // Touch scroll state
  private scrollStartX = 0;
  private scrollLeft = 0;
  private isDragging = false;
  private hasDragged = false;

  // Drag state for moving the bar
  private barDragging = false;
  private barDragStartX = 0;
  private barDragStartY = 0;
  private barOffsetX = 0;
  private barOffsetY = 0;
  private barHasMoved = false;

  constructor(parent: HTMLElement, onAction: ActionCallback) {
    this.onAction = onAction;

    // Load saved shortcuts
    try {
      const saved = localStorage.getItem(SHORTCUTS_KEY);
      this.shortcuts = saved ? (JSON.parse(saved) as ShortcutRef[]) : [...DEFAULT_SHORTCUTS];
    } catch {
      this.shortcuts = [...DEFAULT_SHORTCUTS];
    }

    this.container = document.createElement('div');
    this.container.className = 'action-bar-container';

    // Oval transparent island
    this.island = document.createElement('div');
    this.island.className = 'action-island';

    // Drag grip handle — the only draggable area
    const gripHandle = document.createElement('div');
    gripHandle.className = 'action-bar-grip';
    gripHandle.innerHTML = `<svg width="10" height="16" viewBox="0 0 10 16" fill="none">
      <circle cx="3" cy="3" r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="7" cy="3" r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="3" cy="8" r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="7" cy="8" r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="3" cy="13" r="1.5" fill="rgba(255,255,255,0.4)"/>
      <circle cx="7" cy="13" r="1.5" fill="rgba(255,255,255,0.4)"/>
    </svg>`;
    this.island.appendChild(gripHandle);

    // Small divider after grip
    const gripDiv = document.createElement('div');
    gripDiv.className = 'action-island-divider';
    this.island.appendChild(gripDiv);

    // Grid icon button (4-square) on the left
    const gridBtn = document.createElement('button');
    gridBtn.className = 'action-grid-btn';
    gridBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="1" width="7" height="7" rx="1.5" fill="white"/>
      <rect x="12" y="1" width="7" height="7" rx="1.5" fill="white"/>
      <rect x="1" y="12" width="7" height="7" rx="1.5" fill="white"/>
      <rect x="12" y="12" width="7" height="7" rx="1.5" fill="white"/>
    </svg>`;
    gridBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.barHasMoved) this.togglePopup();
    });
    this.island.appendChild(gridBtn);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'action-island-divider';
    this.island.appendChild(divider);

    // Scrollable action area
    const scrollArea = document.createElement('div');
    scrollArea.className = 'action-island-scroll';
    scrollArea.id = 'action-island-scroll';
    this.island.appendChild(scrollArea);

    // Apply icon size + labels from saved settings
    this.island.dataset['iconSize'] = getIconSize();
    this.island.dataset['labels'] = String(getShowLabels());

    this.container.appendChild(this.island);
    this.buildShortcutItems();
    this.setupScrollHandlers();
    this.setupBarDrag();
    parent.appendChild(this.container);

    // Restore saved position, or default to bottom-center
    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) {
        const { x, y } = JSON.parse(saved) as { x: number; y: number };
        this.barOffsetX = x;
        this.barOffsetY = y;
        this.container.style.transform = `translate(${x}px, ${y}px)`;
      } else {
        // Use window dimensions — works even if layout isn't fully flushed yet
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const rect = this.container.getBoundingClientRect();
          const w = rect.width  || 300;
          const h = rect.height || 60;
          this.barOffsetX = Math.max(0, (window.innerWidth  - w) / 2);
          this.barOffsetY = Math.max(0, window.innerHeight - h - 90);
          this.container.style.transform = `translate(${this.barOffsetX}px, ${this.barOffsetY}px)`;
        }));
      }
    } catch { /* ignore */ }
  }

  /** Live-update icon size (S/M/L) */
  setIconSize(size: IconSize): void {
    this.island.dataset['iconSize'] = size;
  }

  /** Show or hide text labels under icons */
  setShowLabels(show: boolean): void {
    this.island.dataset['labels'] = String(show);
  }

  /** Reload shortcuts from localStorage (called after external edit) */
  refreshShortcuts(): void {
    try {
      const saved = localStorage.getItem(SHORTCUTS_KEY);
      this.shortcuts = saved ? (JSON.parse(saved) as ShortcutRef[]) : [...DEFAULT_SHORTCUTS];
    } catch {
      this.shortcuts = [...DEFAULT_SHORTCUTS];
    }
    this.buildShortcutItems();
  }

  // ── Bar drag ────────────────────────────────────────────────────────────

  private setupBarDrag(): void {
    const grip = this.island.querySelector('.action-bar-grip') as HTMLElement;
    if (!grip) return;

    grip.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.barDragging = true;
      this.barHasMoved = false;
      this.barDragStartX = e.clientX - this.barOffsetX;
      this.barDragStartY = e.clientY - this.barOffsetY;
      grip.setPointerCapture(e.pointerId);
      this.container.style.transition = 'none';
    });

    grip.addEventListener('pointermove', (e) => {
      if (!this.barDragging) return;
      const dx = e.clientX - this.barDragStartX;
      const dy = e.clientY - this.barDragStartY;
      if (Math.abs(dx - this.barOffsetX) > 3 || Math.abs(dy - this.barOffsetY) > 3) {
        this.barHasMoved = true;
        this.closePopup();
      }
      this.barOffsetX = dx;
      this.barOffsetY = dy;
      this.container.style.transform = `translate(${dx}px, ${dy}px)`;
    });

    grip.addEventListener('pointerup', () => {
      if (!this.barDragging) return;
      this.barDragging = false;
      this.container.style.transition = '';
      if (this.barHasMoved) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify({ x: this.barOffsetX, y: this.barOffsetY }));
        } catch { /* ignore */ }
      }
      setTimeout(() => { this.barHasMoved = false; }, 0);
    });
  }

  // ── Shortcut bar ─────────────────────────────────────────────────────────

  private buildShortcutItems(): void {
    const scrollArea = this.island.querySelector('#action-island-scroll')!;
    scrollArea.innerHTML = '';

    for (const ref of this.shortcuts) {
      const list = ref.type === 'action' ? ALL_ACTIONS : ALL_MODES;
      const action = list[ref.index];
      if (!action) continue;
      const btn = document.createElement('button');
      btn.className = 'action-island-item';
      btn.innerHTML = `
        <div class="action-icon-wrap">
          <img src="${action.icon}" alt="${action.name}" draggable="false" />
        </div>
        <span>${action.name}</span>
      `;
      btn.addEventListener('click', (e) => {
        if (this.hasDragged) { e.preventDefault(); return; }
        btn.classList.add('active-state');
        setTimeout(() => btn.classList.remove('active-state'), 300);
        this.onAction(action);
      });
      scrollArea.appendChild(btn);
    }

    // "+" add button at end
    const addBtn = document.createElement('button');
    addBtn.className = 'action-island-item action-add-btn';
    addBtn.innerHTML = `
      <div class="action-icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="11" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-dasharray="4 3"/>
          <line x1="12" y1="7" x2="12" y2="17" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
          <line x1="7" y1="12" x2="17" y2="12" stroke="rgba(255,255,255,0.6)" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <span>Add</span>
    `;
    addBtn.addEventListener('click', (e) => {
      if (this.hasDragged) { e.preventDefault(); return; }
      this.openPopupInEditMode();
    });
    scrollArea.appendChild(addBtn);
  }

  private saveShortcuts(): void {
    try {
      localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(this.shortcuts));
    } catch { /* ignore */ }
  }

  // ── Scroll handlers ──────────────────────────────────────────────────────

  private setupScrollHandlers(): void {
    const scrollArea = this.island.querySelector('#action-island-scroll') as HTMLElement;
    if (!scrollArea) return;

    scrollArea.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.hasDragged = false;
      this.scrollStartX = e.clientX;
      this.scrollLeft = scrollArea.scrollLeft;
      scrollArea.style.cursor = 'grabbing';
    });

    scrollArea.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.scrollStartX;
      if (Math.abs(dx) > 5) this.hasDragged = true;
      scrollArea.scrollLeft = this.scrollLeft - dx;
    });

    const endDrag = () => {
      this.isDragging = false;
      const sa = this.island.querySelector('#action-island-scroll') as HTMLElement;
      if (sa) sa.style.cursor = '';
    };
    scrollArea.addEventListener('pointerup', endDrag);
    scrollArea.addEventListener('pointercancel', endDrag);
  }

  // ── Popup ────────────────────────────────────────────────────────────────

  private togglePopup(): void {
    if (this.popup) { this.closePopup(); return; }
    this.openPopup();
  }

  private openPopup(): void {
    this.editing = false;
    this.popup = document.createElement('div');
    this.popup.className = 'action-popup';

    const header = document.createElement('div');
    header.className = 'action-popup-header';
    header.innerHTML = `<span class="action-popup-title">All</span>`;
    const editBtn = document.createElement('button');
    editBtn.className = 'action-popup-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      this.editing = !this.editing;
      editBtn.textContent = this.editing ? 'Done' : 'Edit';
      this.rebuildPopupGrid();
    });
    header.appendChild(editBtn);
    this.popup.appendChild(header);

    const actionSection = document.createElement('div');
    actionSection.className = 'action-popup-section';
    actionSection.innerHTML = '<div class="action-popup-section-title">Action</div>';
    const actionGrid = document.createElement('div');
    actionGrid.className = 'action-popup-grid';
    actionGrid.id = 'popup-action-grid';
    actionSection.appendChild(actionGrid);
    this.popup.appendChild(actionSection);

    const modeSection = document.createElement('div');
    modeSection.className = 'action-popup-section';
    modeSection.innerHTML = '<div class="action-popup-section-title">Mode</div>';
    const modeGrid = document.createElement('div');
    modeGrid.className = 'action-popup-grid';
    modeGrid.id = 'popup-mode-grid';
    modeSection.appendChild(modeGrid);
    this.popup.appendChild(modeSection);

    this.container.appendChild(this.popup);
    this.rebuildPopupGrid();

    const closeHandler = (e: PointerEvent) => {
      if (this.popup && !this.popup.contains(e.target as Node) &&
          !(e.target as HTMLElement).closest('.action-grid-btn')) {
        this.closePopup();
        document.removeEventListener('pointerdown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', closeHandler), 0);
  }

  private closePopup(): void {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
      this.editing = false;
    }
  }

  private rebuildPopupGrid(): void {
    const actionGrid = this.popup?.querySelector('#popup-action-grid');
    const modeGrid = this.popup?.querySelector('#popup-mode-grid');
    if (!actionGrid || !modeGrid) return;

    actionGrid.innerHTML = '';
    modeGrid.innerHTML = '';

    ALL_ACTIONS.forEach((action, idx) => {
      actionGrid.appendChild(this.createPopupItem(action, idx, 'action'));
    });
    ALL_MODES.forEach((mode, idx) => {
      modeGrid.appendChild(this.createPopupItem(mode, idx, 'mode'));
    });

    // In edit mode, show the reorder section at the top
    if (this.editing) {
      this.ensureReorderSection();
    } else {
      this.popup?.querySelector('.action-reorder-section')?.remove();
    }
  }

  // ── Reorder section ───────────────────────────────────────────────────────

  private ensureReorderSection(): void {
    if (!this.popup) return;
    let section = this.popup.querySelector('.action-reorder-section') as HTMLElement | null;
    if (!section) {
      section = document.createElement('div');
      section.className = 'action-reorder-section';
      // Insert before first action-popup-section
      const first = this.popup.querySelector('.action-popup-section');
      if (first) this.popup.insertBefore(section, first);
      else this.popup.appendChild(section);
    }
    this.buildReorderSection(section);
  }

  private buildReorderSection(section: HTMLElement): void {
    section.innerHTML = `<div class="action-popup-section-title">Bar order — drag to reorder</div>`;

    const list = document.createElement('div');
    list.className = 'action-reorder-list';
    section.appendChild(list);

    for (let i = 0; i < this.shortcuts.length; i++) {
      const ref = this.shortcuts[i];
      const srcList = ref.type === 'action' ? ALL_ACTIONS : ALL_MODES;
      const action = srcList[ref.index];
      if (!action) continue;

      const item = document.createElement('div');
      item.className = 'action-reorder-item';
      item.dataset['idx'] = String(i);
      item.innerHTML = `
        <span class="action-reorder-handle">≡</span>
        <img src="${action.icon}" width="22" height="22" draggable="false"/>
        <span class="action-reorder-name">${action.name}</span>
        <button class="action-reorder-remove" title="Remove">×</button>
      `;

      // Remove button
      item.querySelector('.action-reorder-remove')!.addEventListener('click', (e) => {
        e.stopPropagation();
        this.shortcuts.splice(i, 1);
        this.saveShortcuts();
        this.buildShortcutItems();
        this.buildReorderSection(section);
        this.rebuildPopupGrid();
      });

      // Drag to reorder
      this.attachReorderDrag(item, list, section);
      list.appendChild(item);
    }
  }

  private attachReorderDrag(item: HTMLElement, list: HTMLElement, section: HTMLElement): void {
    const handle = item.querySelector('.action-reorder-handle') as HTMLElement;
    let dragging = false;
    let startY = 0;
    let currentIdx = 0;   // current position in shortcuts[] during drag

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dy = e.clientY - startY;

      // Move item visually with transform — don't touch DOM structure
      item.style.transform = `translateY(${dy}px)`;

      // Check if we crossed the midpoint of a sibling → swap in shortcuts[]
      const siblings = Array.from(
        list.querySelectorAll('.action-reorder-item:not(.action-reorder-dragging)')
      ) as HTMLElement[];

      for (const sib of siblings) {
        const sibIdx = parseInt(sib.dataset['idx'] ?? '-1', 10);
        if (sibIdx < 0) continue;
        const rect = sib.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;

        if (sibIdx === currentIdx - 1 && e.clientY < mid) {
          // Swap up
          [this.shortcuts[currentIdx], this.shortcuts[sibIdx]] = [this.shortcuts[sibIdx], this.shortcuts[currentIdx]];
          currentIdx = sibIdx;
          startY = e.clientY;
          item.style.transform = '';
          this.buildReorderSection(section);
          // Re-attach drag on the new item node (same data-idx)
          const newItem = list.querySelector(`[data-idx="${currentIdx}"]`) as HTMLElement;
          if (newItem) { newItem.classList.add('action-reorder-dragging'); }
          return;
        }
        if (sibIdx === currentIdx + 1 && e.clientY > mid) {
          // Swap down
          [this.shortcuts[currentIdx], this.shortcuts[sibIdx]] = [this.shortcuts[sibIdx], this.shortcuts[currentIdx]];
          currentIdx = sibIdx;
          startY = e.clientY;
          item.style.transform = '';
          this.buildReorderSection(section);
          const newItem = list.querySelector(`[data-idx="${currentIdx}"]`) as HTMLElement;
          if (newItem) { newItem.classList.add('action-reorder-dragging'); }
          return;
        }
      }
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      item.style.transform = '';
      item.classList.remove('action-reorder-dragging');

      this.saveShortcuts();
      this.buildShortcutItems();
      this.buildReorderSection(section);
    };

    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      currentIdx = parseInt(item.dataset['idx'] ?? '0', 10);
      item.classList.add('action-reorder-dragging');

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  // ── Popup item ────────────────────────────────────────────────────────────

  private isInShortcuts(type: 'action' | 'mode', index: number): boolean {
    return this.shortcuts.some((s) => s.type === type && s.index === index);
  }

  private createPopupItem(action: RobotAction, itemIdx: number, type: 'action' | 'mode'): HTMLElement {
    const item = document.createElement('div');
    item.className = 'action-popup-item';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'action-popup-icon';
    iconWrap.innerHTML = `<img src="${action.icon}" alt="${action.name}" draggable="false" />`;
    item.appendChild(iconWrap);

    const label = document.createElement('span');
    label.className = 'action-popup-label';
    label.textContent = action.name;
    item.appendChild(label);

    if (this.editing) {
      const isInBar = this.isInShortcuts(type, itemIdx);
      const badge = document.createElement('div');
      badge.className = `action-popup-badge ${isInBar ? 'badge-remove' : 'badge-add'}`;
      badge.textContent = isInBar ? '−' : '+';
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isInBar) {
          this.shortcuts = this.shortcuts.filter((s) => !(s.type === type && s.index === itemIdx));
        } else {
          this.shortcuts.push({ type, index: itemIdx });
        }
        this.saveShortcuts();
        this.buildShortcutItems();
        this.rebuildPopupGrid();
      });
      item.appendChild(badge);
    } else {
      // Popup stays open — just trigger the action and show flash
      item.addEventListener('click', () => {
        item.classList.add('action-popup-item--flash');
        setTimeout(() => item.classList.remove('action-popup-item--flash'), 300);
        this.onAction(action);
      });
    }

    return item;
  }

  private openPopupInEditMode(): void {
    if (this.popup) this.closePopup();
    this.openPopup();
    this.editing = true;
    const editBtn = this.popup?.querySelector('.action-popup-edit-btn') as HTMLButtonElement;
    if (editBtn) editBtn.textContent = 'Done';
    this.rebuildPopupGrid();
  }

  toggleMode(): void {
    this.togglePopup();
  }
}
