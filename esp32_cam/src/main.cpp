/**
 * Go2Cam — External camera streamer for Unitree Go2
 * Hardware: Seeed XIAO ESP32S3 Sense (OV2640)
 *
 * Features:
 *   - WebSocket binary JPEG stream on port 81
 *   - Web settings UI on port 80 (WiFi, camera, hostname)
 *   - mDNS: http://go2cam.local  /  ws://go2cam.local:81
 *   - Auto AP fallback if WiFi not reachable (SSID: Go2Cam-XXXX, pass: go2cam123)
 *   - All settings saved to NVS (survive reboot)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>
#include "esp_camera.h"

// ── Camera pins — XIAO ESP32S3 Sense ─────────────────────────────────────────
#define PWDN_GPIO_NUM    -1
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM    10
#define SIOD_GPIO_NUM    40
#define SIOC_GPIO_NUM    39
#define Y9_GPIO_NUM      48
#define Y8_GPIO_NUM      11
#define Y7_GPIO_NUM      12
#define Y6_GPIO_NUM      14
#define Y5_GPIO_NUM      16
#define Y4_GPIO_NUM      18
#define Y3_GPIO_NUM      17
#define Y2_GPIO_NUM      15
#define VSYNC_GPIO_NUM   38
#define HREF_GPIO_NUM    47
#define PCLK_GPIO_NUM    13

// ── Defaults ──────────────────────────────────────────────────────────────────
#define DEFAULT_HOSTNAME  "go2cam"
#define AP_PASS           "go2cam123"
#define WIFI_TIMEOUT_MS   30000   // 30 s before AP fallback
#define WS_PORT           81
#define HTTP_PORT         80

// ── Globals ───────────────────────────────────────────────────────────────────
WebServer        httpServer(HTTP_PORT);
WebSocketsServer wsServer(WS_PORT);
Preferences      prefs;

String cfgSSID       = "";
String cfgPass       = "";
String cfgHostname   = DEFAULT_HOSTNAME;
int    cfgResolution = (int)FRAMESIZE_VGA;  // 640×480
int    cfgQuality    = 12;                  // JPEG 0-63 (lower = better)
int    cfgFPS        = 20;

bool   apMode      = false;
uint8_t wsClients  = 0;
bool   cameraReady = false;

// ─────────────────────────────────────────────────────────────────────────────
// Web UI  (dark theme, matches the Go2 app style)
// ─────────────────────────────────────────────────────────────────────────────
const char HTML_UI[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Go2Cam Settings</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1114;color:#e0e0e0;padding:20px;max-width:480px;margin:0 auto}
h1{font-size:22px;color:#fff;margin-bottom:4px}
.sub{font-size:13px;color:#555;margin-bottom:24px}
.card{background:#1a1d28;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px;margin-bottom:14px}
.ct{font-size:11px;font-weight:700;color:#6879e4;text-transform:uppercase;letter-spacing:.8px;margin-bottom:14px}
label{display:block;font-size:12px;color:#888;margin:10px 0 4px}
input[type=text],input[type=password],select{width:100%;padding:8px 12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;font-size:14px}
input[type=range]{width:100%;accent-color:#6879e4;margin-top:4px}
.rr{display:flex;align-items:center;gap:10px}
.rv{min-width:30px;text-align:right;font-size:13px;color:#6879e4;font-weight:600}
button{width:100%;margin-top:12px;padding:10px;background:#6879e4;border:none;border-radius:8px;color:#fff;font-size:15px;font-weight:600;cursor:pointer}
button.danger{background:rgba(239,74,74,.15);border:1px solid rgba(239,74,74,.35);color:#f07070}
button:active{opacity:.75}
.sr{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px}
.sr:last-child{border-bottom:none}
.sk{color:#888}
.sv{color:#fff;font-weight:500}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600}
.ok{background:rgba(74,239,122,.15);color:#4aef7a}
.warn{background:rgba(255,165,0,.15);color:orange}
#preview{width:100%;border-radius:8px;background:#000;aspect-ratio:4/3;object-fit:contain;margin-top:8px}
.msg{padding:8px 12px;border-radius:8px;margin-top:8px;font-size:13px;display:none}
.mok{background:rgba(74,239,122,.1);color:#4aef7a;border:1px solid rgba(74,239,122,.3)}
.mer{background:rgba(239,74,74,.1);color:#f07070;border:1px solid rgba(239,74,74,.3)}
</style>
</head>
<body>
<h1>📷 Go2Cam</h1>
<p class="sub">External camera for Unitree Go2</p>

<div class="card">
  <div class="ct">Status</div>
  <div id="st">Loading…</div>
</div>

<div class="card">
  <div class="ct">Live Preview</div>
  <img id="preview" alt="connecting…">
</div>

<div class="card">
  <div class="ct">WiFi Settings</div>
  <label>Network SSID</label>
  <input type="text" id="ssid" placeholder="your WiFi name">
  <label>Password</label>
  <input type="password" id="wpass" placeholder="WiFi password">
  <label>Hostname (mDNS)</label>
  <input type="text" id="host" placeholder="go2cam" maxlength="32">
  <button onclick="saveWifi()">Save &amp; Restart</button>
  <div id="mw" class="msg"></div>
</div>

<div class="card">
  <div class="ct">Camera Settings</div>
  <label>Resolution</label>
  <select id="res">
    <option value="5">QVGA 320×240</option>
    <option value="8">VGA 640×480</option>
    <option value="9">SVGA 800×600</option>
    <option value="10">XGA 1024×768</option>
    <option value="13">HD 1280×720</option>
  </select>
  <label>JPEG Quality (lower = better image)</label>
  <div class="rr">
    <input type="range" id="qual" min="4" max="40" oninput="qv.textContent=this.value">
    <span class="rv" id="qv">12</span>
  </div>
  <label>Frame Rate</label>
  <div class="rr">
    <input type="range" id="fps" min="5" max="30" oninput="fv.textContent=this.value+' fps'">
    <span class="rv" id="fv">20 fps</span>
  </div>
  <button onclick="saveCam()">Apply</button>
  <div id="mc" class="msg"></div>
</div>

<div class="card">
  <div class="ct">System</div>
  <button class="danger" onclick="doRestart()">Restart Device</button>
</div>

<script>
var ws=null;
function loadStatus(){
  fetch('/status').then(r=>r.json()).then(d=>{
    document.getElementById('st').innerHTML=
      '<div class="sr"><span class="sk">Mode</span><span class="badge '+(d.ap?'warn':'ok')+'">'+(d.ap?'Access Point':'WiFi')+' connected</span></div>'+
      '<div class="sr"><span class="sk">IP</span><span class="sv">'+d.ip+'</span></div>'+
      '<div class="sr"><span class="sk">Hostname</span><span class="sv">'+d.hostname+'.local</span></div>'+
      '<div class="sr"><span class="sk">Stream URL</span><span class="sv">ws://'+d.ip+':81</span></div>'+
      '<div class="sr"><span class="sk">Camera</span><span class="badge '+(d.camera?'ok':'warn')+'">'+(d.camera?'OK':'Error')+'</span></div>'+
      '<div class="sr"><span class="sk">WS clients</span><span class="sv">'+d.clients+'</span></div>'+
      '<div class="sr"><span class="sk">Free heap</span><span class="sv">'+d.heap+' KB</span></div>';
    document.getElementById('ssid').value=d.ssid||'';
    document.getElementById('host').value=d.hostname||'go2cam';
    document.getElementById('res').value=d.resolution;
    document.getElementById('qual').value=d.quality; qv.textContent=d.quality;
    document.getElementById('fps').value=d.fps; fv.textContent=d.fps+' fps';
  }).catch(()=>{document.getElementById('st').innerHTML='<span style="color:#f07070">Failed to load</span>';});
}
function connectWS(){
  ws=new WebSocket('ws://'+location.hostname+':81');
  ws.binaryType='arraybuffer';
  ws.onmessage=function(e){
    var blob=new Blob([e.data],{type:'image/jpeg'});
    var url=URL.createObjectURL(blob);
    var img=document.getElementById('preview');
    var old=img.src;
    img.src=url;
    if(old.startsWith('blob:'))URL.revokeObjectURL(old);
  };
  ws.onclose=function(){setTimeout(connectWS,2000);};
}
function saveWifi(){
  var b=JSON.stringify({ssid:document.getElementById('ssid').value,pass:document.getElementById('wpass').value,hostname:document.getElementById('host').value});
  fetch('/save-wifi',{method:'POST',headers:{'Content-Type':'application/json'},body:b})
    .then(r=>r.json()).then(d=>msg('mw',d.ok?'Saved! Restarting…':'Error: '+d.error,d.ok))
    .catch(()=>msg('mw','Request failed',false));
}
function saveCam(){
  var b=JSON.stringify({resolution:parseInt(document.getElementById('res').value),quality:parseInt(document.getElementById('qual').value),fps:parseInt(document.getElementById('fps').value)});
  fetch('/save-camera',{method:'POST',headers:{'Content-Type':'application/json'},body:b})
    .then(r=>r.json()).then(d=>msg('mc',d.ok?'Applied!':'Error: '+d.error,d.ok))
    .catch(()=>msg('mc','Request failed',false));
}
function doRestart(){if(confirm('Restart?'))fetch('/restart',{method:'POST'});}
function msg(id,txt,ok){var e=document.getElementById(id);e.textContent=txt;e.className='msg '+(ok?'mok':'mer');e.style.display='block';setTimeout(()=>e.style.display='none',3000);}
loadStatus();
setInterval(loadStatus,5000);
connectWS();
</script>
</body>
</html>
)rawliteral";

// ─────────────────────────────────────────────────────────────────────────────
// Camera
// ─────────────────────────────────────────────────────────────────────────────
bool initCamera() {
  camera_config_t cfg;
  cfg.ledc_channel  = LEDC_CHANNEL_0;
  cfg.ledc_timer    = LEDC_TIMER_0;
  cfg.pin_d0        = Y2_GPIO_NUM;
  cfg.pin_d1        = Y3_GPIO_NUM;
  cfg.pin_d2        = Y4_GPIO_NUM;
  cfg.pin_d3        = Y5_GPIO_NUM;
  cfg.pin_d4        = Y6_GPIO_NUM;
  cfg.pin_d5        = Y7_GPIO_NUM;
  cfg.pin_d6        = Y8_GPIO_NUM;
  cfg.pin_d7        = Y9_GPIO_NUM;
  cfg.pin_xclk      = XCLK_GPIO_NUM;
  cfg.pin_pclk      = PCLK_GPIO_NUM;
  cfg.pin_vsync     = VSYNC_GPIO_NUM;
  cfg.pin_href      = HREF_GPIO_NUM;
  cfg.pin_sccb_sda  = SIOD_GPIO_NUM;
  cfg.pin_sccb_scl  = SIOC_GPIO_NUM;
  cfg.pin_pwdn      = PWDN_GPIO_NUM;
  cfg.pin_reset     = RESET_GPIO_NUM;
  cfg.xclk_freq_hz  = 20000000;
  cfg.pixel_format  = PIXFORMAT_JPEG;
  cfg.frame_size    = (framesize_t)cfgResolution;
  cfg.jpeg_quality  = cfgQuality;
  cfg.fb_count      = psramFound() ? 2 : 1;
  cfg.fb_location   = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  cfg.grab_mode     = CAMERA_GRAB_WHEN_EMPTY;

  esp_err_t err = esp_camera_init(&cfg);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Init failed: 0x%x\n", err);
    return false;
  }
  Serial.println("[CAM] Ready");
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// WiFi
// ─────────────────────────────────────────────────────────────────────────────
void startAP() {
  apMode = true;
  // Unique SSID using last 4 hex chars of MAC
  String apSSID = "Go2Cam-" + String((uint32_t)ESP.getEfuseMac(), HEX).substring(0, 4);
  apSSID.toUpperCase();
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSSID.c_str(), AP_PASS);
  Serial.printf("[WiFi] AP: SSID=%s  IP=%s\n", apSSID.c_str(), WiFi.softAPIP().toString().c_str());
  Serial.printf("[WiFi] Connect to %s and open http://192.168.4.1\n", apSSID.c_str());
}

bool connectSTA() {
  if (cfgSSID.isEmpty()) return false;
  WiFi.mode(WIFI_STA);
  WiFi.begin(cfgSSID.c_str(), cfgPass.c_str());
  Serial.printf("[WiFi] Connecting to '%s'", cfgSSID.c_str());
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(250);
    Serial.print('.');
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
    return true;
  }
  Serial.println("[WiFi] Failed to connect");
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket
// ─────────────────────────────────────────────────────────────────────────────
void onWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length) {
  (void)payload; (void)length;
  if (type == WStype_CONNECTED) {
    wsClients++;
    IPAddress ip = wsServer.remoteIP(num);
    Serial.printf("[WS] Client %d connected from %s  (total: %d)\n", num, ip.toString().c_str(), wsClients);
  } else if (type == WStype_DISCONNECTED) {
    if (wsClients > 0) wsClients--;
    Serial.printf("[WS] Client %d disconnected  (total: %d)\n", num, wsClients);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP routes
// ─────────────────────────────────────────────────────────────────────────────
void setupHTTP() {
  httpServer.enableCORS(true);

  // Settings page
  httpServer.on("/", HTTP_GET, []() {
    httpServer.send_P(200, "text/html", HTML_UI);
  });

  // Status JSON
  httpServer.on("/status", HTTP_GET, []() {
    JsonDocument doc;
    doc["ap"]         = apMode;
    doc["ip"]         = apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
    doc["hostname"]   = cfgHostname;
    doc["ssid"]       = cfgSSID;
    doc["camera"]     = cameraReady;
    doc["clients"]    = wsClients;
    doc["heap"]       = (int)(ESP.getFreeHeap() / 1024);
    doc["resolution"] = cfgResolution;
    doc["quality"]    = cfgQuality;
    doc["fps"]        = cfgFPS;
    String out;
    serializeJson(doc, out);
    httpServer.send(200, "application/json", out);
  });

  // Save WiFi + hostname → restart
  httpServer.on("/save-wifi", HTTP_POST, []() {
    if (!httpServer.hasArg("plain")) {
      httpServer.send(400, "application/json", "{\"ok\":false,\"error\":\"No body\"}");
      return;
    }
    JsonDocument doc;
    if (deserializeJson(doc, httpServer.arg("plain"))) {
      httpServer.send(400, "application/json", "{\"ok\":false,\"error\":\"JSON parse error\"}");
      return;
    }
    String ssid = doc["ssid"] | "";
    if (ssid.isEmpty()) {
      httpServer.send(400, "application/json", "{\"ok\":false,\"error\":\"SSID is required\"}");
      return;
    }
    prefs.begin("go2cam", false);
    prefs.putString("ssid",     ssid);
    prefs.putString("pass",     doc["pass"]     | "");
    prefs.putString("hostname", doc["hostname"] | DEFAULT_HOSTNAME);
    prefs.end();
    httpServer.send(200, "application/json", "{\"ok\":true}");
    delay(400);
    ESP.restart();
  });

  // Apply camera settings live (also saves to NVS)
  httpServer.on("/save-camera", HTTP_POST, []() {
    if (!httpServer.hasArg("plain")) {
      httpServer.send(400, "application/json", "{\"ok\":false,\"error\":\"No body\"}");
      return;
    }
    JsonDocument doc;
    if (deserializeJson(doc, httpServer.arg("plain"))) {
      httpServer.send(400, "application/json", "{\"ok\":false,\"error\":\"JSON parse error\"}");
      return;
    }
    int res  = doc["resolution"] | cfgResolution;
    int qual = doc["quality"]    | cfgQuality;
    int fps  = doc["fps"]        | cfgFPS;

    // Clamp
    qual = constrain(qual, 4, 40);
    fps  = constrain(fps,  5, 30);

    // Save
    prefs.begin("go2cam", false);
    prefs.putInt("resolution", res);
    prefs.putInt("quality",    qual);
    prefs.putInt("fps",        fps);
    prefs.end();

    cfgResolution = res;
    cfgQuality    = qual;
    cfgFPS        = fps;

    // Apply to sensor without reboot
    sensor_t* s = esp_camera_sensor_get();
    if (s) {
      s->set_quality(s, qual);
      s->set_framesize(s, (framesize_t)res);
    }

    httpServer.send(200, "application/json", "{\"ok\":true}");
  });

  // Restart
  httpServer.on("/restart", HTTP_POST, []() {
    httpServer.send(200, "application/json", "{\"ok\":true}");
    delay(300);
    ESP.restart();
  });

  httpServer.begin();
  Serial.printf("[HTTP] Server on port %d\n", HTTP_PORT);
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== Go2Cam ===");
  Serial.printf("PSRAM: %s  (%d KB free)\n", psramFound() ? "yes" : "no", ESP.getPsramSize() / 1024);

  // Load saved config
  prefs.begin("go2cam", true);
  cfgSSID       = prefs.getString("ssid",       "");
  cfgPass       = prefs.getString("pass",       "");
  cfgHostname   = prefs.getString("hostname",   DEFAULT_HOSTNAME);
  cfgResolution = prefs.getInt   ("resolution", (int)FRAMESIZE_VGA);
  cfgQuality    = prefs.getInt   ("quality",    12);
  cfgFPS        = prefs.getInt   ("fps",        20);
  prefs.end();
  Serial.printf("[CFG] SSID=%s  host=%s  res=%d  q=%d  fps=%d\n",
    cfgSSID.c_str(), cfgHostname.c_str(), cfgResolution, cfgQuality, cfgFPS);

  // Camera
  cameraReady = initCamera();

  // WiFi — try STA, fall back to AP
  if (!connectSTA()) {
    startAP();
  }

  // mDNS
  if (MDNS.begin(cfgHostname.c_str())) {
    MDNS.addService("http", "tcp", HTTP_PORT);
    MDNS.addService("ws",   "tcp", WS_PORT);
    Serial.printf("[mDNS] http://%s.local  ws://%s.local:%d\n",
      cfgHostname.c_str(), cfgHostname.c_str(), WS_PORT);
  }

  // Servers
  wsServer.begin();
  wsServer.onEvent(onWsEvent);
  Serial.printf("[WS]   WebSocket on port %d\n", WS_PORT);

  setupHTTP();

  String ip = apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
  Serial.println("=== Ready ===");
  Serial.printf("  Settings: http://%s  or  http://%s.local\n", ip.c_str(), cfgHostname.c_str());
  Serial.printf("  Stream:   ws://%s:%d  or  ws://%s.local:%d\n",
    ip.c_str(), WS_PORT, cfgHostname.c_str(), WS_PORT);
  if (apMode) {
    Serial.println("  *** AP MODE — connect to Go2Cam-XXXX WiFi to configure ***");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loop
// ─────────────────────────────────────────────────────────────────────────────
void loop() {
  httpServer.handleClient();
  wsServer.loop();

  // Send camera frame to all connected WebSocket clients
  static unsigned long lastFrame = 0;
  unsigned long now = millis();
  unsigned long interval = 1000UL / (unsigned long)cfgFPS;

  if (cameraReady && wsClients > 0 && (now - lastFrame) >= interval) {
    lastFrame = now;
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) {
      wsServer.broadcastBIN(fb->buf, fb->len);
      esp_camera_fb_return(fb);
    }
  }
}
