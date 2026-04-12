import './ui/styles.css';
import { App } from './ui/app';
import { isCapacitor } from './platform';

// On iOS: hide the status bar for true full-screen experience
if (isCapacitor) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.hide();
    StatusBar.setStyle({ style: Style.Dark });
  }).catch(() => { /* not critical if plugin unavailable */ });
}

const root = document.getElementById('app');
if (root) {
  new App(root);
}
