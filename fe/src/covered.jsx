import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/app.css';
import persona from './assets/persona.png';

const Covered = () => {
    const navigate = useNavigate();
    const coverSongUrl = sessionStorage.getItem('cover_file') || '';
    const songName = sessionStorage.getItem('song_name') || 'cover_song';

    // cover_file 없으면 /trained로 리다이렉트
    useEffect(() => {
        if (!coverSongUrl) {
            alert('Error: 커버 노래 정보가 없습니다. 이전 페이지로 이동합니다.');
            navigate('/trained');
        }
    }, [coverSongUrl, navigate]);

    const handleDownloadCover = async () => {
        console.log('커버 다운로드 버튼 클릭됨');
        if (coverSongUrl) {
            try {
                // cover_file에서 파일명 추출
                const filename = coverSongUrl.split('/').pop();
                const response = await fetch(`http://localhost:5000/download_cover/${filename}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${songName}-커버.wav`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Download error:', error);
                alert('Error: 커버 노래 다운로드에 실패했습니다.');
            }
        } else {
            alert('Error: 다운로드할 커버 노래가 없습니다.');
        }
    };

    const handleAnotherCover = () => {
        console.log('다른 노래 커버하기 버튼 클릭됨');
        console.log('Cover another song clicked');
        navigate('/trained');
    };

    const handleGoHome = () => {
        console.log('홈으로 버튼 클릭됨');
        console.log('Home button pressed');
        // sessionStorage 정리
        sessionStorage.removeItem('cover_file');
        sessionStorage.removeItem('song_name');
        navigate('/');
    };

    return (
        <div className="page1-container">
            <div className="page1-content">
                <span className="page1-title">
                    <span>Persona</span>
                    <img className="persona_img" src={persona} alt="persona" />
                </span>
                <h1 className="trained-title">
                    당신의 목소리로<br />커버 노래가 생성되었습니다!
                </h1>

                <button className="trained-download-button" onClick={handleDownloadCover}>
                    커버 다운로드
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="trained-download-icon">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="1"></line>
                    </svg>
                </button>

                <div className="cover-player-box">
                    <p className="cover-song-name">{`${songName}-커버.wav`}</p>
                    <audio controls className="cover-audio-player">
                        <source src={coverSongUrl} type="audio/wav" />
                        Your browser does not support the audio element.
                    </audio>
                </div>
                <div className="button-group">
                    <button className="cover-action-button primary" onClick={handleAnotherCover}>
                        다른 노래 커버하기
                    </button>

                    <button className="cover-action-button secondary" onClick={handleGoHome}>
                        홈으로
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Covered;