## Persona - 사용자 맞춤 AI 노래 커버 서비스

**Notion 링크 : [Persona 보고서](https://frill-night-b56.notion.site/Persona-20ea2d3a452a80c6afccf6096dd0e2e4)**

## 📽️ 데모 영상 

[![Watch the video](https://img.youtube.com/vi/uwgDTwltX6Q/0.jpg)](https://www.youtube.com/watch?v=uwgDTwltX6Q)

## 👥 팀원 소개 (Team 0010)

| 이름     | 역할 및 담당 |
|----------|---------------|
| 송원석   | AI 메인 담당. 전반적인 모델 설계 및 로직 구현 |
| 김지민   | AI 테스트 담당. 적합한 모델 판별 |
| 이문환   | 프론트엔드, 백엔드 구현 및 AI 연동 |


## 🛠 기술 스택 (Tech Stack)

### AI / 딥러닝
- **PyTorch**: 음성 모델 학습 및 커버 모델 구현
- **CUDA / cuDNN**: GPU 기반 모델 학습 가속화

### Frontend
- **React (Vite)**: 빠른 번들링과 개발 환경 제공
- **Axios**: 비동기 API 요청 처리
- **React Router DOM**: 클라이언트 사이드 라우팅 구현

### Backend
- **Flask**: Python 기반 경량 웹 프레임워크
- **Socket.IO (Flask-SocketIO)**: 실시간 통신 (학습/커버 진행 상황 전송)
- **Python**: 서버 로직 및 AI 모델 제어

## 🚀 주요 기능

### 🧠 1. 내 목소리로 AI 보컬 모델 만들기
- 최대 5개의 `.wav` 또는 `.mp3` 음성 파일을 업로드해 나만의 보컬 모델을 학습
- 학습 설정 직접 입력 가능
- 학습 중지 가능

### 📦 2. 학습 없이 바로 사용 – 사전 학습 모델 업로드
- `.pth`, `.index` 파일이 포함된 `.zip` 파일 업로드로 모델 바로 사용

### 🎶 3. AI 보컬 커버 생성
- 학습된 모델을 사용해 기존 노래 파일을 새로운 음색으로 커버
- 업로드한 노래 파일을 기반으로 AI 커버 음원 생성


## ▶️ 화면 구성 및 서비스 시나리오 설계

###  📄 모델 학습하기 페이지
![Image](https://github.com/user-attachments/assets/95c72fc4-68b8-4937-a2d4-d96027657f77)

![Image](https://github.com/user-attachments/assets/7174282b-0ee7-4829-a9f3-27f96dd52e8a)

![Image](https://github.com/user-attachments/assets/3f5ba2f2-c29a-40db-8269-aea8ae6ba4ce)
### 📂 음성 파일 업로드
**💻 클라이언트**
- `.wav` 또는 `.mp3` 형식의 음성 파일 업로드 (최대 5개)
- 모델 설정 입력 (모델 이름, 학습 횟수)
- **[학습하기]** 버튼 클릭

**🖥️ 서버**
- 모델 이름으로 학습용 폴더 생성
- 음성 파일 및 설정 파일 저장
- 학습 시작  
  → **WebSocket**을 통해 실시간 진행률 전송
- 학습 완료 시 `logs/{모델이름}/` 폴더 생성  
  → 클라이언트로 모델 이름 및 완료 메시지 전송

**✅ 결과**
- 클라이언트는 `sessionStorage`에 모델 이름 저장
- **훈련 완료 페이지**로 이동


### 📂 사전학습 모델 업로드

**💻 클라이언트**
- `.zip` 파일 업로드 (내부에 `.pth`, `.index` 포함)
- **[모델 업로드]** 버튼 클릭

**🖥️ 서버**
- zip 압축 해제 및 유효성 검사
- 모델 이름으로 폴더 생성
- `.pth`, `.index` 파일 저장
- 클라이언트로 모델 이름 전송 (REST API)

**✅ 결과**
- 클라이언트는 `sessionStorage`에 모델 이름 저장
- **훈련 완료 페이지**로 이동



### 📄 2. 훈련 완료 페이지
![Image](https://github.com/user-attachments/assets/155964c8-9a32-4329-9d02-d10ed0f45412)

![Image](https://github.com/user-attachments/assets/9f91fb24-5015-4eba-9772-63c1729ddf17)

### 💾 모델 저장
- **[모델 저장하기]** 클릭  
  → `sessionStorage`에서 모델 이름을 가져와 서버에 다운로드 요청

### 🎶 노래 커버 요청
**💻 클라이언트**
- `.wav` 또는 `.mp3` 형식의 노래 파일 업로드
- Pitch 설정
- **[커버하기]** 버튼 클릭

**🖥️ 서버**
- `sessionStorage`에서 모델 이름 확인
- 커버용 폴더 생성 후 커버 진행  
  → **WebSocket**을 통해 실시간 진행률 전송
- 완료 시 `cover/{파일명}.wav` 생성  
  → 클라이언트로 파일명, URL, 완료 메시지 전송

**✅ 결과**
- `sessionStorage`에 노래 이름과 URL 저장
- **커버 생성 완료 페이지**로 이동


### 📄 3. 커버 생성 완료 페이지
![Image](https://github.com/user-attachments/assets/48ee1fb5-2e66-490c-a26a-cfae658a6e8b)

![Image](https://github.com/user-attachments/assets/3caf4780-d0ef-4794-8e82-c20e4cf7b8d2)

**💾 커버 노래 저장**
- **[노래 저장하기]** 클릭 → 서버에 커버 파일 다운로드 요청

**▶️ 커버 노래 재생**
- `sessionStorage`에 저장된 URL로 오디오 재생
