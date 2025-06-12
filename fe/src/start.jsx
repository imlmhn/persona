import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/app.css';
import persona from './assets/persona.png';
import singIcon from './assets/sing.png';
import modelIcon from './assets/model.png';

const Start = () => {
    const [activeTab, setActiveTab] = useState('voice');
    const [voiceFiles, setVoiceFiles] = useState([]);
    const [modelFiles, setModelFiles] = useState([]);
    const [modelName, setModelName] = useState('');
    const [f0Method, setF0Method] = useState('rmvpe');
    const [totalEpoch, setTotalEpoch] = useState(1);
    const navigate = useNavigate();

    useEffect(() => {
        // 메인 페이지 로드 시 sessionStorage 초기화
        sessionStorage.clear();
    }, []);

    const handleFileChange = (event, type) => {
        const files = Array.from(event.target.files);
        if (type === 'voice') {
            const newFiles = [...voiceFiles, ...files].slice(0, 5);
            setVoiceFiles(newFiles);
        } else {
            // ZIP 파일 하나만 허용
            setModelFiles(files.slice(0, 1));
        }
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDrop = (event, type) => {
        event.preventDefault();
        event.stopPropagation();
        const files = Array.from(event.dataTransfer.files);
        if (type === 'voice') {
            const newFiles = [...voiceFiles, ...files].slice(0, 5);
            setVoiceFiles(newFiles);
        } else {
            // ZIP 파일 하나만 허용
            setModelFiles(files.slice(0, 1));
        }
    };

    const handleTrainModel = async () => {
        if (activeTab === 'voice') {
            if (voiceFiles.length === 0) {
                alert('업로드할 음성 파일을 선택해주세요.');
                return;
            }

            const formData = new FormData();
            voiceFiles.forEach((file) => formData.append('file', file));
            formData.append('type', 'voice');

            // 설정값 JSON 구성
            const config = {
                model_name: modelName || 'default_model',
                dataset_path: 'assets/datasets',
                sample_rate: 40000,
                cpu_cores: 4,
                cut_preprocess: 'Automatic',
                process_effects: false,
                noise_reduction: false,
                clean_strength: 0.8,
                chunk_len: 3.0,
                overlap_len: 0.3,
                f0_method: f0Method,
                hop_length: 128,
                gpu: '0',
                embedder_model: 'contentvec',
                embedder_model_custom: '',
                include_mutes: 2,
                save_every_epoch: 5,
                save_only_latest: true,
                save_every_weights: true,
                total_epoch: totalEpoch,
                batch_size: 4,
                overtraining_detector: false,
                overtraining_threshold: 3,
                pretrained: true,
                cleanup: false,
                index_algorithm: 'Auto',
                cache_data_in_gpu: false,
                custom_pretrained: true,
                vocoder: 'HiFi-GAN',
                checkpointing: false,
            };
            formData.append('config', JSON.stringify(config));

            try {
                const response = await fetch('http://localhost:5000/upload_raw_data', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('음성 파일 업로드 성공:', result);
                    alert('음성 파일이 성공적으로 업로드되었습니다. 학습을 시작합니다!');
                    sessionStorage.setItem('model_name', result.model_name);
                    navigate('/training');
                } else {
                    const errorData = await response.json();
                    alert(`파일 업로드 실패: ${errorData.message || response.statusText}`);
                }
            } catch (error) {
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
        } else {
            // 모델 탭
            if (modelFiles.length === 0 || !modelFiles[0].name.endsWith('.zip')) {
                alert('ZIP 파일(.zip)을 업로드해주세요.');
                return;
            }

            const formData = new FormData();
            formData.append('zip_file', modelFiles[0]);
            formData.append('type', 'model');

            try {
                const response = await fetch('http://localhost:5000/upload_model_files', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('모델 ZIP 파일 업로드 성공:', result);
                    alert('모델 파일이 성공적으로 업로드되었습니다!');
                    sessionStorage.setItem('model_name', result.model_name);
                    navigate('/trained');
                } else {
                    const errorData = await response.json();
                    alert(`파일 업로드 실패: ${errorData.message || response.statusText}`);
                }
            } catch (error) {
                alert('서버와 통신 중 오류가 발생했습니다.');
            }
        }
    };

    return (
        <div className="page1-container">
            <div className="page1-content">
                <span className="page1-title">
                    <span>Persona</span>
                    <img className="persona_img" src={persona} alt="persona" />
                </span>
                <br />
                <span className="page1-description">
                    당신의 목소리로 좋아하는<br /> 노래의 AI 커버를 만들어보세요
                </span>
                <p className="page1-sub-description">시작하려면 음성 녹음 또는 모델을 업로드하세요</p>

                <div className="notice-box">
                    <div className="notice-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                    </div>
                    <div className="notice-content">
                        {activeTab === 'voice' && (
                            <>
                                <p>음성 파일은 <strong>최대 5개</strong>까지, <strong>총 20분 이내</strong>로 업로드 가능합니다.</p>
                                <p>학습에는 <strong>최대 1시간까지</strong> 소요될 수 있습니다.</p>
                            </>
                        )}
                        {activeTab === 'model' && (
                            <>
                                <p>모델 업로드는 <strong>ZIP 파일(.zip)</strong>로, <strong>모델(.pth)</strong> 파일과 <strong>인덱스(.index)</strong> 파일을 포함해야 합니다.</p>
                                <p><strong>1개의 ZIP 파일</strong>만 업로드할 수 있으며, 학습 과정을 <strong>생략</strong>합니다.</p>
                            </>
                        )}
                    </div>
                </div>

                <div className="page1-tabs">
                    <button
                        className={`page1-tab-button ${activeTab === 'voice' ? 'active' : ''}`}
                        onClick={() => setActiveTab('voice')}
                    >
                        음성
                    </button>
                    <button
                        className={`page1-tab-button ${activeTab === 'model' ? 'active' : ''}`}
                        onClick={() => setActiveTab('model')}
                    >
                        모델
                    </button>
                </div>

                {activeTab === 'voice' && (
                    <div className="page1-voice-section page1-upload-section">
                        <div
                            className="page1-upload-box"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'voice')}
                        >
                            <label htmlFor="voice-file-input" className="page1-select-file-button">
                                음성 파일 선택
                            </label>
                            <input
                                id="voice-file-input"
                                type="file"
                                accept=".mp3,.wav"
                                multiple
                                onChange={(e) => handleFileChange(e, 'voice')}
                                style={{ display: 'none' }}
                            />
                            <div className="page1-upload-area">
                                {voiceFiles.length > 0 ? (
                                    <div className="uploaded-file-list">
                                        {voiceFiles.map((file, index) => (
                                            <div key={index} className="uploaded-file-item">{file.name}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <div className="page1-icon-container">
                                            <img src={singIcon} alt="sing icon" className="upload-icon-image" />
                                        </div>
                                        <div className="page1-drag-drop-area">
                                            <p className="page1-or-drag-drop">또는 끌어서 놓기</p>
                                            <p className="page1-file-formats">(.mp3, .wav)</p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="page1-model-options">
                                <div className="option-item">
                                    <label>모델 이름</label>
                                    <input
                                        type="text"
                                        value={modelName}
                                        onChange={(e) => setModelName(e.target.value)}
                                        placeholder="예: myvoice"
                                    />
                                </div>
                                <div className="option-item">
                                    <label>F0 변환 방식</label>
                                    <select value={f0Method} onChange={(e) => setF0Method(e.target.value)}>
                                        <option value="rmvpe">rmvpe</option>
                                        <option value="harvest">harvest</option>
                                        <option value="crepe">crepe</option>
                                    </select>
                                </div>
                                <div className="option-item">
                                    <label>에포크 수</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={totalEpoch}
                                        onChange={(e) => setTotalEpoch(parseInt(e.target.value) || 1)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'model' && (
                    <div className="page1-model-section page1-upload-section">
                        <div
                            className="page1-upload-box"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'model')}
                        >
                            <label htmlFor="model-file-input" className="page1-select-file-button">
                                ZIP 파일 선택
                            </label>
                            <input
                                id="model-file-input"
                                type="file"
                                accept=".zip"
                                onChange={(e) => handleFileChange(e, 'model')}
                                style={{ display: 'none' }}
                            />
                            <div className="page1-upload-area">
                                {modelFiles.length > 0 ? (
                                    <div className="uploaded-file-list">
                                        {modelFiles.map((file, index) => (
                                            <div key={index} className="uploaded-file-item">{file.name}</div>
                                        ))}
                                    </div>
                                ) : (
                                    <>
                                        <div className="page1-icon-container">
                                            <img src={modelIcon} alt="model icon" className="upload-icon-image" />
                                        </div>
                                        <div className="page1-drag-drop-area">
                                            <p className="page1-or-drag-drop">또는 끌어서 놓기</p>
                                            <p className="page1-file-formats">(.zip)</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <button className="page1-train-button" onClick={handleTrainModel}>
                    {activeTab === 'voice' ? '학습하기' : '모델 업로드'}
                </button>
            </div>
        </div>
    );
};

export default Start;