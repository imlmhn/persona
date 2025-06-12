import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Start from './start';
import Trained from './trained';
import Training from './training';
import Covered from './covered';
import Covering from './covering';


function App() {
  return (
    // BrowserRouter를 Router로 alias 하여 사용합니다.
    // 전체 애플리케이션을 라우팅 가능한 상태로 만듭니다.
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Start />} /> {/* 기본 경로('/')에 Page1 컴포넌트 연결 */}
          <Route path="/training" element={<Training />} /> {/* 기본 경로('/')에 Page1 컴포넌트 연결 */}
          <Route path="/trained" element={<Trained />} />
          <Route path="/covered" element={<Covered />} />
          <Route path="/covering" element={<Covering />} />

          {/* 404 Not Found 페이지를 위한 라우트 (선택 사항) */}
          {/* <Route path="*" element={<div>404 Not Found</div>} /> */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;