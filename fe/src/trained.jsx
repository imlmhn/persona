import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/app.css';
import musicIcon from './assets/music.png';
import persona from './assets/persona.png';

const Trained = () => {
    const [songFile, setSongFile] = useState(null);
    const [pitchOption, setPitchOption] = useState('default'); // 기본, male_to_female, female_to_male
    const navigate = useNavigate();

    useEffect(() => {
        const modelName = sessionStorage.getItem('model_name');
        if (!modelName) {
            alert('모델 정보가 없습니다. 메인 페이지로 이동합니다.');
            navigate('/');
        }
    }, [navigate]);

    const handleFileUpload = (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (!['.mp3', '.wav', '.mp4'].includes(file.name.toLowerCase().slice(-4))) {
                alert('지원되는 파일 형식은 .mp3, .wav, .mp4입니다.');
                return;
            }
            setSongFile(file);
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (!['.mp3', '.wav', '.mp4'].includes(file.name.toLowerCase().slice(-4))) {
                alert('지원되는 파일 형식은 .mp3, .wav, .mp4입니다.');
                return;
            }
            setSongFile(file);
        }
    };

    const handleCoverSong = async () => {
        if (!songFile) {
            alert('커버할 노래 파일을 업로드해주세요.');
            return;
        }

        const modelName = sessionStorage.getItem('model_name');
        if (!modelName) {
            alert('모델 정보가 없습니다. 메인 페이지로 이동합니다.');
            navigate('/');
            return;
        }

        // 파일 크기 체크
        if (songFile.size > 100 * 1024 * 1024) {
            alert('파일 크기가 100MB를 초과했습니다.');
            return;
        }

        // 피치 옵션에 따른 값 설정
        let pitchValue = 0;
        if (pitchOption === 'male_to_female') {
            pitchValue = 2;
        } else if (pitchOption === 'female_to_male') {
            pitchValue = -2;
        }

        // JSON 구성
        const config = {
            input_dir: 'assets/audios',
            output_dir: 'outputs',
            model: modelName,
            demucs_model: 'htdemucs',
            pitch: pitchValue,
            index_rate: 0.9,
            f0_method: 'rmvpe',
            embedder_model: 'contentvec',
            protect: 0.5,
            hop_length: 256,
            clean_audio: false,
            clean_strength: 0.8
        };

        const formData = new FormData();
        formData.append('song_file', songFile);
        formData.append('model_name', modelName);
        formData.append('config', JSON.stringify(config));

        console.log('Config sent:', JSON.stringify(config)); // 디버깅 로그

        try {
            const response = await fetch('http://localhost:5000/cover_song', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('Server response:', text);
                alert(`커버 시작 실패: 서버에서 ${response.status} 오류가 발생했습니다.`);
                return;
            }

            const result = await response.json();
            console.log('커버 시작:', result);
            alert('노래 파일이 업로드되었습니다. 커버 생성을 시작합니다!');
            sessionStorage.setItem('model_name', result.model_name);
            navigate('/covering');
        } catch (error) {
            console.error('Fetch error:', error);
            alert(`서버와 통신 중 오류가 발생했습니다: ${error.message}`);
        }
    };

    const handleDownloadModel = async () => {
        const modelName = sessionStorage.getItem('model_name');
        if (!modelName) {
            alert('모델 이름을 찾을 수 없습니다. 다시 훈련을 시작해주세요.');
            return;
        }

        try {
            const response = await fetch(`http://localhost:5000/download_model?model_name=${encodeURIComponent(modelName)}`, {
                method: 'GET',
            });

            if (!response.ok) {
                const errorData = await response.json();
                alert(`모델 다운로드 실패: ${errorData.message}`);
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${modelName}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            alert('모델 파일이 성공적으로 다운로드되었습니다!');
        } catch (error) {
            alert(`다운로드 중 오류 발생: ${error.message}`);
        }
    };

    return (
        <div className="page1-container">
            <div className="page1-content">
                <span className="page1-title">
                    <span>Persona</span>
                    <img className="persona_img" src={persona} alt="persona" />
                </span>
                <h1 className="trained-title">
                    당신의 목소리로<br />AI 모델이 훈련되었습니다!
                </h1>
                <button className="trained-download-button" onClick={handleDownloadModel}>
                    모델 다운로드
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="trained-download-icon">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
                <p className="trained-upload-prompt">
                    이제 커버할 노래를 업로드하세요
                </p>
                <div className="page1-upload-section">
                    <div
                        className="page1-upload-box"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <label htmlFor="song-file-input" className="page1-select-file-button">
                            노래 파일 선택
                        </label>
                        <input
                            id="song-file-input"
                            type="file"
                            accept=".mp3,.wav,.mp4"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                        />
                        <div className="page1-upload-area">
                            {songFile ? (
                                <div className="uploaded-file-list">
                                    <div className="uploaded-file-item">{songFile.name}</div>
                                </div>
                            ) : (
                                <>
                                    <div className="page1-icon-container">
                                        <img src={musicIcon} alt="model icon" className="upload-icon-image" />
                                    </div>
                                    <div className="page1-drag-drop-area">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="page1-upload-icon">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="17 8 12 3 7 8"></polyline>
                                            <line x1="12" y1="3" x2="12" y2="15"></line>
                                        </svg>
                                        <p className="page1-or-drag-drop">또는 끌어서 놓기</p>
                                        <p className="page1-file-formats">(.mp3, .wav, .mp4)</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="page1-model-options">
                    <div className="option-item">
                        <label>피치 변환</label>
                        <select value={pitchOption} onChange={(e) => setPitchOption(e.target.value)}>
                            <option value="default">기본</option>
                            <option value="male_to_female">남성 → 여성</option>
                            <option value="female_to_male">여성 → 남성</option>
                        </select>
                    </div>
                </div>
                <button className="page1-train-button" onClick={handleCoverSong}>
                    커버하기
                </button>
            </div>
        </div>
    );
};

export default Trained;