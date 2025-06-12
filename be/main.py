from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import json
import shutil
import zipfile
import io
import threading
from connect import (
    run_preprocess_script,
    run_extract_script,
    run_train_script,
)
import tempfile
import subprocess
from connect import run_infer_script
import re
import uuid

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# 디렉토리 설정
BASE_DIR = os.getcwd()
DATASET_FOLDER = os.path.join(BASE_DIR, 'assets', 'datasets')
LOGS_FOLDER = os.path.join(BASE_DIR, 'logs')
os.makedirs(DATASET_FOLDER, exist_ok=True)
os.makedirs(LOGS_FOLDER, exist_ok=True)

# 훈련 프로세스 상태 관리
training_processes = {}  # {model_name: {'thread': Thread, 'stop_event': threading.Event}}

def get_hifigan_pretrained_paths(sample_rate):
    base_path = os.path.join("rvc", "models", "pretraineds", "hifi-gan")
    if sample_rate == 32000:
        suffix = "32k"
    elif sample_rate == 40000:
        suffix = "40k"
    elif sample_rate == 48000:
        suffix = "48k"
    else:
        emit_log(f"에러: 지원하지 않는 샘플레이트입니다: {sample_rate}")
        raise ValueError(f"지원하지 않는 샘플레이트입니다: {sample_rate}")
    g_path = os.path.join(base_path, f"f0G{suffix}.pth")
    d_path = os.path.join(base_path, f"f0D{suffix}.pth")
    return g_path, d_path

def emit_log(message, model_name=None):
    data = {'message': message} if 'message' not in message else message
    if model_name:
        data['model_name'] = model_name
    print(f"Emitting log: {data}")  # 디버깅 로그
    socketio.emit('message', data, namespace='/')

@app.route('/upload_raw_data', methods=['POST'])
def upload_raw_data():
    try:
        if 'file' not in request.files:
            emit_log("에러: 요청에 파일이 없습니다")
            return jsonify({"message": "No file part in the request"}), 400

        files = request.files.getlist('file')
        if not files or all(file.filename == '' for file in files):
            emit_log("에러: 선택된 파일이 없습니다")
            return jsonify({"message": "No selected file"}), 400

        config_json = request.form.get('config')
        if not config_json:
            emit_log("에러: 설정(config)이 제공되지 않았습니다")
            return jsonify({"message": "No config provided"}), 400

        try:
            config = json.loads(config_json)
            emit_log("설정(config) 파싱 성공")
            emit_log(json.dumps(config, indent=2, ensure_ascii=False))
        except json.JSONDecodeError as e:
            emit_log(f"에러: 설정 파싱 실패 - {str(e)}")
            return jsonify({"message": f"Failed to parse config: {str(e)}"}), 400

        model_name = config.get('model_name', 'unnamed_model')
        model_path = os.path.join(DATASET_FOLDER, model_name)
        os.makedirs(model_path, exist_ok=True)
        emit_log(f"모델 폴더 생성: {model_path}")

        config_path = os.path.join(model_path, 'config.json')
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        emit_log("config.json 저장 완료")

        uploaded_files_info = []
        for file in files:
            if file and file.filename != '':
                filepath = os.path.join(model_path, file.filename)
                try:
                    file.save(filepath)
                    uploaded_files_info.append({
                        'filename': file.filename,
                        'filepath': filepath
                    })
                    emit_log(f"파일 저장: {file.filename}")
                except Exception as e:
                    emit_log(f"에러: 파일 저장 실패 - {file.filename}: {str(e)}")
                    return jsonify({"message": f"File save failed: {str(e)}"}), 500

        emit_log("모든 파일 저장 완료")

        # 훈련 스레드 시작
        stop_event = threading.Event()
        thread = threading.Thread(target=run_training, args=(model_name, config, uploaded_files_info, stop_event), daemon=True)
        thread.start()
        training_processes[model_name] = {'thread': thread, 'stop_event': stop_event}

        return jsonify({
            "message": "Files uploaded successfully, training started",
            "model_name": model_name,
            "files": uploaded_files_info
        }), 200

    except Exception as e:
        emit_log(f"에러: 예상치 못한 오류 발생 - {str(e)}")
        return jsonify({"message": f"Unexpected error: {str(e)}"}), 500

def run_training(model_name, config, uploaded_files_info, stop_event):
    try:
        model_path = os.path.join(DATASET_FOLDER, model_name)

        emit_log("데이터 전처리 시작", model_name)
        if stop_event.is_set():
            emit_log("훈련 중지 요청 수신, 전처리 중단", model_name)
            return
        try:
            run_preprocess_script(
                model_name=model_name,
                dataset_path=model_path,
                sample_rate=config["sample_rate"],
                cpu_cores=config["cpu_cores"],
                cut_preprocess=config["cut_preprocess"],
                process_effects=config["process_effects"],
                noise_reduction=config["noise_reduction"],
                clean_strength=config["clean_strength"],
                chunk_len=config["chunk_len"],
                overlap_len=config["overlap_len"]
            )
            emit_log("데이터 전처리 완료", model_name)
        except Exception as e:
            emit_log(f"에러: 데이터 전처리 실패 - {str(e)}", model_name)
            return

        emit_log("특징 추출 시작", model_name)
        if stop_event.is_set():
            emit_log("훈련 중지 요청 수신, 특징 추출 중단", model_name)
            return
        try:
            run_extract_script(
                model_name=model_name,
                f0_method=config["f0_method"],
                hop_length=config["hop_length"],
                cpu_cores=config["cpu_cores"],
                gpu=config["gpu"],
                sample_rate=config["sample_rate"],
                embedder_model=config["embedder_model"],
                embedder_model_custom=config.get("embedder_model_custom", ""),
                include_mutes=config["include_mutes"]
            )
            emit_log("특징 추출 완료", model_name)
        except Exception as e:
            emit_log(f"에러: 특징 추출 실패 - {str(e)}", model_name)
            return

        emit_log("모델 학습 시작", model_name)
        if stop_event.is_set():
            emit_log("훈련 중지 요청 수신, 학습 중단", model_name)
            return
        try:
            g_pretrained_path, d_pretrained_path = get_hifigan_pretrained_paths(config["sample_rate"])
            run_train_script(
                model_name=model_name,
                save_every_epoch=config["save_every_epoch"],
                save_only_latest=config["save_only_latest"],
                save_every_weights=config["save_every_weights"],
                total_epoch=config["total_epoch"],
                sample_rate=config["sample_rate"],
                batch_size=config["batch_size"],
                gpu=config["gpu"],
                overtraining_detector=config["overtraining_detector"],
                overtraining_threshold=config["overtraining_threshold"],
                pretrained=True,
                cleanup=config["cleanup"],
                index_algorithm=config.get("index_algorithm", "Auto"),
                cache_data_in_gpu=config.get("cache_data_in_gpu", False),
                custom_pretrained=True,
                g_pretrained_path=g_pretrained_path,
                d_pretrained_path=d_pretrained_path,
                vocoder=config.get("vocoder", "HiFi-GAN"),
                checkpointing=config.get("checkpointing", False)
            )
            emit_log("모델 학습 완료", model_name)
        except Exception as e:
            emit_log(f"에러: 모델 학습 실패 - {str(e)}", model_name)
            return

        if stop_event.is_set():
            emit_log("훈련 중지 요청 수신, 완료 처리 중단", model_name)
            return

        emit_log("[DONE] 모든 훈련 과정 완료", model_name)
        socketio.emit('training_complete', {
            'message': '훈련 완료',
            'model_name': model_name,
            'files': uploaded_files_info
        }, namespace='/')

    except Exception as e:
        emit_log(f"에러: 예상치 못한 오류 발생 - {str(e)}", model_name)
    finally:
        if model_name in training_processes:
            del training_processes[model_name]

@socketio.on('stop_training', namespace='/')
def stop_training(data):
    model_name = data.get('model_name')
    if not model_name or model_name not in training_processes:
        emit('training_stopped', {'message': f'에러: {model_name}에 대한 훈련 프로세스가 존재하지 않습니다'})
        return

    training_processes[model_name]['stop_event'].set()
    emit_log(f"훈련 중지 요청 수신: {model_name}")

    model_path = os.path.join(DATASET_FOLDER, model_name)
    try:
        if os.path.exists(model_path):
            shutil.rmtree(model_path)
            emit_log(f"데이터셋 폴더 삭제 완료: {model_path}")
        else:
            emit_log(f"경고: 데이터셋 폴더가 존재하지 않습니다: {model_path}")
    except Exception as e:
        emit_log(f"에러: 데이터셋 폴더 삭제 실패 - {str(e)}")
        emit('training_stopped', {'message': f'훈련 중지되었으나 데이터셋 폴더 삭제 실패: {str(e)}'})
        return

    log_path = os.path.join(LOGS_FOLDER, model_name)
    try:
        if os.path.exists(log_path):
            shutil.rmtree(log_path)
            emit_log(f"로그 폴더 삭제 완료: {log_path}")
        else:
            emit_log(f"경고: 로그 폴더가 존재하지 않습니다: {log_path}")
    except Exception as e:
        emit_log(f"에러: 로그 폴더 삭제 실패 - {str(e)}")
        emit('training_stopped', {'message': f'훈련 중지되었으나 로그 폴더 삭제 실패: {str(e)}'})
        return

    if model_name in training_processes:
        del training_processes[model_name]

    emit('training_stopped', {'message': f'훈련이 중지되고 모든 파일 및 로그 폴더가 삭제되었습니다: {model_name}'}, namespace='/')

@app.route('/download_model', methods=['GET'])
def download_model():
    try:
        model_name = request.args.get('model_name')
        if not model_name:
            return jsonify({'message': '모델 이름이 제공되지 않았습니다'}), 400

        model_dir = os.path.join(LOGS_FOLDER, model_name)
        if not os.path.exists(model_dir):
            return jsonify({'message': f'모델 폴더가 존재하지 않습니다: {model_name}'}), 404

        pth_file = None
        index_file = None
        for file in os.listdir(model_dir):
            if file.endswith('.pth'):
                pth_file = os.path.join(model_dir, file)
            elif file.endswith('.index'):
                index_file = os.path.join(model_dir, file)

        if not pth_file or not index_file:
            return jsonify({'message': '모델 파일(.pth) 또는 인덱스 파일(.index)이 없습니다'}), 404

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            zip_file.write(pth_file, os.path.basename(pth_file))
            zip_file.write(index_file, os.path.basename(index_file))

        zip_buffer.seek(0)

        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name=f"{model_name}.zip",
            mimetype='application/zip'
        )

    except Exception as e:
        return jsonify({'message': f'다운로드 중 오류 발생: {str(e)}'}), 500

@app.route('/upload_model_files', methods=['POST'])
def upload_model_files():
    try:
        zip_file = request.files.get('zip_file')
        if not zip_file:
            return jsonify({'message': 'ZIP file is required'}), 400

        zip_filename = os.path.splitext(zip_file.filename)[0]
        if not zip_filename:
            return jsonify({'message': 'Invalid ZIP file name'}), 400

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_zip_path = os.path.join(temp_dir, 'upload.zip')
            zip_file.save(temp_zip_path)

            pth_files = []
            index_files = []
            with zipfile.ZipFile(temp_zip_path, 'r') as zf:
                for file_name in zf.namelist():
                    if file_name.endswith('.pth'):
                        pth_files.append(file_name)
                    elif file_name.endswith('.index'):
                        index_files.append(file_name)

                if len(pth_files) != 1 or len(index_files) != 1:
                    return jsonify({'message': 'Exactly one .pth and one .index file are required'}), 400

                zf.extract(pth_files[0], temp_dir)
                zf.extract(index_files[0], temp_dir)

            pth_path_temp = os.path.join(temp_dir, pth_files[0])
            index_path_temp = os.path.join(temp_dir, index_files[0])

            if os.path.getsize(pth_path_temp) == 0 or os.path.getsize(index_path_temp) == 0:
                return jsonify({'message': 'Empty .pth or .index file detected'}), 400

            model_log_dir = os.path.join(LOGS_FOLDER, zip_filename)
            os.makedirs(model_log_dir, exist_ok=True)

            pth_path = os.path.join(model_log_dir, os.path.basename(pth_files[0]))
            index_path = os.path.join(model_log_dir, os.path.basename(index_files[0]))

            shutil.move(pth_path_temp, pth_path)
            shutil.move(index_path_temp, index_path)

            return jsonify({
                'message': 'Model files uploaded successfully',
                'model_name': zip_filename,
                'files': [
                    {'filename': os.path.basename(pth_files[0]), 'filepath': pth_path},
                    {'filename': os.path.basename(index_files[0]), 'filepath': index_path},
                ]
            }), 200

    except zipfile.BadZipFile:
        return jsonify({'message': 'Invalid or corrupted ZIP file'}), 400
    except Exception as e:
        return jsonify({'message': f'File save failed: {str(e)}'}), 500

@app.route('/cover_song', methods=['POST'])
def cover_song():
    try:
        model_name = request.form.get('model_name')
        song_file = request.files.get('song_file')
        config_json = request.form.get('config')

        if not model_name or not song_file or not config_json:
            emit_log("에러: model_name, song_file, config는 필수입니다", model_name)
            return jsonify({'message': 'model_name, song_file, and config are required'}), 400

        try:
            config = json.loads(config_json)
            emit_log("설정(config) 파싱 성공", model_name)
            emit_log(json.dumps(config, indent=2, ensure_ascii=False), model_name)
        except json.JSONDecodeError as e:
            emit_log(f"에러: 설정 파싱 실패 - {str(e)}", model_name)
            return jsonify({'message': f'Invalid config JSON: {str(e)}'}), 400

        required_keys = ['input_dir', 'output_dir', 'model', 'demucs_model', 'pitch', 'index_rate',
                         'f0_method', 'embedder_model', 'protect', 'hop_length', 'clean_audio', 'clean_strength']
        if not all(key in config for key in required_keys):
            emit_log("에러: 필수 config 키가 누락되었습니다", model_name)
            return jsonify({'message': 'Missing required config keys'}), 400

        if config['model'] != model_name:
            emit_log("에러: config의 model 이름이 제공된 model_name과 일치하지 않습니다", model_name)
            return jsonify({'message': 'Config model name does not match provided model_name'}), 400

        file_ext = os.path.splitext(song_file.filename)[1].lower()
        if file_ext not in ['.mp3', '.wav', '.mp4']:
            emit_log("에러: 잘못된 파일 형식입니다. .mp3, .wav, .mp4만 허용됩니다", model_name)
            return jsonify({'message': 'Invalid file format. Only .mp3, .wav, .mp4 are allowed'}), 400

        log_dir = os.path.join(LOGS_FOLDER, model_name)
        if not os.path.exists(log_dir):
            emit_log(f"에러: 모델 폴더를 찾을 수 없습니다: {model_name}", model_name)
            return jsonify({'message': f'Model folder not found: {model_name}'}), 404

        pth_files = [f for f in os.listdir(log_dir) if f.endswith('.pth')]
        if len(pth_files) != 1:
            emit_log("에러: 정확히 하나의 .pth 파일이 필요합니다", model_name)
            return jsonify({'message': 'Exactly one .pth file required'}), 400
        pth_path = os.path.join(log_dir, pth_files[0])

        index_files = [f for f in os.listdir(log_dir) if f.endswith('.index')]
        if len(index_files) != 1:
            emit_log("에러: 정확히 하나의 .index 파일이 필요합니다", model_name)
            return jsonify({'message': 'Exactly one .index file required'}), 400
        index_path = os.path.join(log_dir, index_files[0])

        song_name = os.path.splitext(song_file.filename)[0]
        input_dir = os.path.join(BASE_DIR, 'assets', 'audios', f'{model_name}_{song_name}')
        os.makedirs(input_dir, exist_ok=True)

        song_path = os.path.join(input_dir, song_file.filename)
        song_file.save(song_path)
        emit_log(f"노래 파일 저장 완료: {song_file.filename}", model_name)

        def run_cover():
            try:
                output_dir = os.path.join(BASE_DIR, config['output_dir'])
                os.makedirs(output_dir, exist_ok=True)

                emit_log(f"Demucs로 '{song_name}' 보컬 분리 중...", model_name)
                subprocess.run([
                    'python', '-m', 'demucs', '--two-stems', 'vocals', '-n', config['demucs_model'], song_path
                ], check=True)

                demucs_vocal = os.path.join(BASE_DIR, 'separated', config['demucs_model'], song_name, 'vocals.wav')
                demucs_inst = os.path.join(BASE_DIR, 'separated', config['demucs_model'], song_name, 'no_vocals.wav')
                converted_vocal = os.path.join(output_dir, f'{song_name}_converted.wav')
                final_mix = os.path.join(output_dir, 'covers', f'{song_name}_final_mix.wav')
                os.makedirs(os.path.dirname(final_mix), exist_ok=True)

                emit_log("보컬 변환 중...", model_name)  # 수정: "보컬 변환 시작..." -> "보컬 변환 중..."
                run_infer_script(
                    pitch=config['pitch'],
                    index_rate=config['index_rate'],
                    input_path=demucs_vocal,
                    output_path=converted_vocal,
                    pth_path=pth_path,
                    index_path=index_path,
                    f0_method=config['f0_method'],
                    embedder_model=config['embedder_model'],
                    protect=config['protect'],
                    hop_length=config['hop_length'],
                    clean_audio=config['clean_audio'],
                    clean_strength=config['clean_strength'],
                    volume_envelope=1,
                    split_audio=True,
                    f0_autotune=False,
                    f0_autotune_strength=1.0,
                    export_format='WAV',
                    f0_file=None,
                )

                emit_log("보컬 + 반주 믹싱 중...", model_name)
                subprocess.run(
                    f'ffmpeg -y -i "{converted_vocal}" -i "{demucs_inst}" '
                    f'-filter_complex "[1:a]volume=0.3[a1];[0:a][a1]amix=inputs=2:duration=longest" '
                    f'"{final_mix}"',
                    shell=True,
                    check=True
                )
                print("보컬 + 반주 믹싱 완료")

                socketio.emit('cover_complete', {
                    'message': f'커버 생성 완료: {song_name}',
                    'cover_file': f'/outputs/covers/{song_name}_final_mix.wav',
                    'model_name': model_name,
                    'song_name': song_name
                }, namespace='/')

            except Exception as e:
                emit_log(f"에러: 커버 생성 실패 - {str(e)}", model_name)
                socketio.emit('cover_error', {
                    'message': f'커버 생성 실패: {str(e)}',
                    'model_name': model_name
                }, namespace='/')

        threading.Thread(target=run_cover, daemon=True).start()

        return jsonify({
            'message': 'Cover song processing started',
            'model_name': model_name
        }), 200

    except Exception as e:
        emit_log(f"에러: 예상치 못한 오류 발생 - {str(e)}", model_name)
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/outputs/covers/<path:filename>')
def serve_cover(filename):
    try:
        return send_from_directory(os.path.join(BASE_DIR, 'outputs', 'covers'), filename)
    except FileNotFoundError:
        return jsonify({'message': 'File not found'}), 404

@app.route('/download_cover/<path:filename>')
def download_cover(filename):
    try:
        file_path = os.path.join(BASE_DIR, 'outputs', 'covers', filename)
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='audio/wav'
        )
    except FileNotFoundError:
        return jsonify({'message': 'File not found'}), 404
    except Exception as e:
        return jsonify({'message': f'Error: {str(e)}'}), 500

@app.route('/')
def home():
    return "Hello from Python Flask server!"

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)