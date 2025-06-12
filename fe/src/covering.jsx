import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import './css/training.css'; // 동일한 CSS 재활용

const socket = io('http://localhost:5000', {
    autoConnect: false,
    transports: ['websocket', 'polling']
});

const Covering = () => {
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(0); // 0-100 to simulate progress for squares
    const navigate = useNavigate();
    const socketInitialized = useRef(false);
    const logBoxRef = useRef(null); // 로그 박스 스크롤을 위한 Ref

    useEffect(() => {
        const modelName = sessionStorage.getItem('model_name');

        if (!modelName) {
            alert('모델 정보가 없습니다. 메인 페이지로 이동합니다.');
            navigate('/');
            return;
        }

        if (!socketInitialized.current) {
            socketInitialized.current = true;

            socket.on('connect', () => {
                console.log('Socket connected');
                // WebSocket 연결 성공 메시지 제외
                setProgress(0); // 연결 성공 시 초기 진행률 0으로 설정
            });

            socket.on('message', (data) => {
                console.log('Message:', data);
                if (!data.model_name || data.model_name === modelName) {
                    setLogs((prev) => {
                        // 동일한 로그가 중복 추가되는 것을 방지
                        if (prev.length > 0 && prev[prev.length - 1] === data.message) {
                            return prev;
                        }
                        const newLogs = [...prev, data.message];
                        // 메시지에 따라 진행률 업데이트
                        if (data.message.includes("보컬 분리 중...")) {
                            setProgress(25); // 1칸
                        } else if (data.message.includes("보컬 변환 시작...")) {
                            setProgress(50); // 2칸
                        } else if (data.message.includes("보컬 + 반주 믹싱 중...")) {
                            setProgress(75); // 3칸
                        }
                        return newLogs;
                    });
                }
            });

            socket.on('cover_complete', (data) => {
                console.log('Cover complete:', data);
                if (!data.model_name || data.model_name === modelName) {
                    setLogs((prev) => [...prev, '커버 생성 완료!']);
                    setProgress(100); // 4칸
                    sessionStorage.setItem('cover_file', `http://localhost:5000${data.cover_file}`);
                    sessionStorage.setItem('song_name', data.message.split(': ')[1] || 'cover_song');
                    // 최소 1초 딜레이 후 리다이렉트
                    setTimeout(() => {
                        navigate('/covered');
                    }, 1000);
                }
            });

            socket.on('cover_error', (data) => {
                console.log('Cover error:', data);
                if (!data.model_name || data.model_name === modelName) {
                    setLogs((prev) => [...prev, `에러: ${data.message}`]);
                    setProgress(0); // 에러 시 진행률 초기화
                    alert(`커버 생성 실패: ${data.message}`);
                    navigate('/trained');
                }
            });

            socket.on('connect_error', (error) => {
                console.log('Socket connect error:', error.message);
                setLogs((prev) => [...prev, `연결 오류: ${error.message}`]);
                setProgress(0); // 에러 시 진행률 초기화
                alert('서버 연결에 실패했습니다.');
                navigate('/trained');
            });

            socket.connect();
            console.log('Socket connecting...');
        }

        return () => {
            if (socketInitialized.current) {
                socket.off('connect');
                socket.off('message');
                socket.off('cover_complete');
                socket.off('cover_error');
                socket.off('connect_error');
                socket.disconnect();
                socketInitialized.current = false;
            }
        };
    }, [navigate]);

    // 로그가 업데이트될 때마다 스크롤을 최하단으로 이동
    useEffect(() => {
        if (logBoxRef.current) {
            logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
        }
    }, [logs]);

    const filledSquares = Math.floor(progress / 25);
    const mainDisplayText = logs.length > 0 ? logs[logs.length - 1] : "커버 생성 대기 중..."; // 최신 로그 메시지 또는 기본 메시지

    return (
        <div className="page1-container">
            <div className="page1-content">
                <div className="training-container">
                    <div className="status-text">{mainDisplayText}</div> {/* 최신 로그 메시지 출력 */}
                    <div className="progress-squares-container">
                        {[0, 1, 2, 3].map((index) => (
                            <div
                                key={index}
                                className={`progress-square ${index < filledSquares ? 'filled' : ''}`}
                            ></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Covering;