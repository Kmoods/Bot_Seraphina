from dotenv import load_dotenv
load_dotenv()
import os
from flask import Flask, request, send_file, jsonify
import yt_dlp
import os
import uuid
API_SECRET = os.getenv("API_SECRET", "@$@##*&!KMODS2025!@#@001a")

app = Flask(__name__)

@app.route('/baixar-audio', methods=['POST'])
def baixar_audio():
    # Proteção por chave secreta
    secret = request.headers.get('X-API-SECRET')
    if secret != API_SECRET:
        return jsonify({'error': 'Acesso não autorizado'}), 401

    data = request.json
    url = data.get('url')
    if not url:
        return jsonify({'error': 'URL não fornecida'}), 400

    file_id = str(uuid.uuid4())
    output_path = f"/tmp/{file_id}.mp3"

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path,
        'quiet': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        return send_file(output_path, mimetype="audio/mpeg", as_attachment=True, download_name="audio.mp3")
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(output_path):
            os.remove(output_path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)