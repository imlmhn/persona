import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './css/training.css';

const socket = io('http://localhost:5000', { autoConnect: false });

const Training = () => {
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(0); // 0-100 to simulate progress for squares
    const navigate = useNavigate();
    const socketInitialized = useRef(false);
    const hasAlerted = useRef(false);
    const stepTimeout = useRef(null); // 단계별 딜레이를 위한 Ref
    const currentStep = useRef(0); // 현재 단계 추적 (0: 대기, 1: 전처리, 2: 특징 추출, 3: 학습 시작, 4: 학습 완료)

    useEffect(() => {
        const modelName = sessionStorage.getItem('model_name');
        if (!modelName && !hasAlerted.current) {
            hasAlerted.current = true;
            alert('모델 정보가 없습니다. 메인 페이지로 이동합니다.');
            navigate('/');
            return;
        }

        const handleBeforeUnload = () => {
            sessionStorage.clear();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        if (!socketInitialized.current) {
            socket.connect();
            socketInitialized.current = true;

            socket.on('connect', () => {
                console.log('Socket connected');
                // WebSocket 연결 성공 메시지 제외
            });

            socket.on('message', (data) => {
                console.log('Message:', data);
                if (!data.model_name || data.model_name === modelName) {
                    if (data.message === "데이터 전처리 완료" && currentStep.current === 0) {
                        currentStep.current = 1;
                        setLogs((prev) => [...prev, data.message]);
                        setProgress(25); // 1칸
                    } else if (data.message === "특징 추출 완료" && currentStep.current === 1) {
                        currentStep.current = 2;
                        setLogs((prev) => [...prev, data.message]);
                        setProgress(50); // 2칸
                    } else if (data.message === "모델 학습 시작" && currentStep.current === 2) {
                        currentStep.current = 3;
                        setLogs((prev) => [...prev, data.message]);
                        setProgress(75); // 3칸
                    }
                }
            });

            socket.on('training_complete', (data) => {
                console.log('Training complete:', data);
                if (!data.model_name || data.model_name === modelName) {
                    if (currentStep.current === 3) {
                        currentStep.current = 4;
                        setLogs((prev) => [...prev, '모델 학습 완료']);
                        setProgress(100); // 4칸 채움
                        // 2초 딜레이 후 리다이렉트
                        setTimeout(() => {
                            navigate('/trained');
                        }, 2000);
                    }
                }
            });

            socket.on('training_stopped', (data) => {
                console.log('Training stopped:', data);
                if (!data.model_name || data.model_name === modelName) {
                    setLogs((prev) => [...prev, data.message]);
                    if (!hasAlerted.current) {
                        hasAlerted.current = true;
                        alert(data.message);
                        sessionStorage.clear();
                        navigate('/');
                    }
                }
            });

            socket.on('connect_error', (error) => {
                console.log('Socket connect error:', error.message);
                setLogs((prev) => [...prev, `연결 오류: ${error.message}`]);
                setProgress(0); // 에러 시 진행률 초기화
                alert('서버 연결에 실패했습니다.');
                navigate('/trained');
            });
        }

        return () => {
            if (socketInitialized.current) {
                socket.off('connect');
                socket.off('message');
                socket.off('training_complete');
                socket.off('training_stopped');
                socket.off('connect_error');
                if (stepTimeout.current) {
                    clearTimeout(stepTimeout.current);
                }
                socket.disconnect();
                socketInitialized.current = false;
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [navigate]);

    const handleStopTraining = () => {
        const modelName = sessionStorage.getItem('model_name');
        if (modelName) {
            socket.emit('stop_training', { model_name: modelName });
        }
    };

    const filledSquares = Math.floor(progress / 25);
    const mainDisplayText = logs.length > 0 ? logs[logs.length - 1] : "모델 생성 및 학습 대기 중...";

    return (
        <div className="page1-container">
            <div className="page1-content">
                <div className="training-container">
                    <div className="status-text">{mainDisplayText}</div>
                    <div className="progress-squares-container">
                        {[0, 1, 2, 3].map((index) => (
                            <div
                                key={index}
                                className={`progress-square ${index < filledSquares ? 'filled' : ''}`}
                            ></div>
                        ))}
                    </div>
                    <button className="stop-button" onClick={handleStopTraining}>
                        훈련 중지
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Training;