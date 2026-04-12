#!/usr/bin/env python3
"""
Audio server pre Unitree Go2
Endpoints:
  POST /upload          - nahrá MP3 súbor
  GET  /list            - zoznam všetkých MP3
  POST /play/<filename> - prehrá súbor
  POST /stop            - zastaví prehrávanie
  DELETE /delete/<filename> - zmaže súbor
"""

from flask import Flask, request, jsonify
import os
import subprocess
import threading

app = Flask(__name__)

AUDIO_DIR = "/home/unitree/audio"
os.makedirs(AUDIO_DIR, exist_ok=True)

current_process = None


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"error": "Žiadny súbor"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "Prázdny názov súboru"}), 400

    if not file.filename.lower().endswith(".mp3"):
        return jsonify({"error": "Len MP3 súbory sú podporované"}), 400

    save_path = os.path.join(AUDIO_DIR, file.filename)
    file.save(save_path)

    return jsonify({"success": True, "filename": file.filename}), 200


@app.route("/list", methods=["GET"])
def list_files():
    files = []
    for f in sorted(os.listdir(AUDIO_DIR)):
        if f.lower().endswith(".mp3"):
            full_path = os.path.join(AUDIO_DIR, f)
            size = os.path.getsize(full_path)
            files.append({
                "filename": f,
                "size_kb": round(size / 1024, 1)
            })
    return jsonify({"files": files}), 200


def play_audio(file_path):
    global current_process
    try:
        current_process = subprocess.Popen(
            ["ffplay", "-nodisp", "-autoexit", file_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = current_process.communicate()
        if stderr:
            print("FFPLAY stderr:", stderr.decode())
        if stdout:
            print("FFPLAY stdout:", stdout.decode())
    except Exception as e:
        print("FFPLAY exception:", str(e))


@app.route("/play/<filename>", methods=["POST"])
def play(filename):
    global current_process

    file_path = os.path.join(AUDIO_DIR, filename)

    if not os.path.exists(file_path):
        return jsonify({"error": "Súbor neexistuje"}), 404

    # Zastav aktuálne prehrávanie ak beží
    if current_process and current_process.poll() is None:
        current_process.terminate()

    # Spusti prehrávanie v samostatnom vlákne
    t = threading.Thread(target=play_audio, args=(file_path,))
    t.daemon = True
    t.start()

    return jsonify({"success": True, "playing": filename}), 200


@app.route("/stop", methods=["POST"])
def stop():
    global current_process

    if current_process and current_process.poll() is None:
        current_process.terminate()
        return jsonify({"success": True}), 200

    return jsonify({"success": True, "info": "Nič nehralo"}), 200


@app.route("/delete/<filename>", methods=["DELETE"])
def delete(filename):
    file_path = os.path.join(AUDIO_DIR, filename)

    if not os.path.exists(file_path):
        return jsonify({"error": "Súbor neexistuje"}), 404

    os.remove(file_path)
    return jsonify({"success": True, "deleted": filename}), 200


if __name__ == "__main__":
    print("Audio server štartuje na porte 8888...")
    app.run(host="0.0.0.0", port=8888, debug=False)
