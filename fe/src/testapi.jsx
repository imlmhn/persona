// src/App.jsx
import { useState } from 'react';
import { sendMessageToServer } from './api';

function Testapi() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');

  const sendMessage = async () => {
    try {
      const result = await sendMessageToServer(input);
      setResponse(result);
    } catch (err) {
      console.error('메시지 전송 실패:', err);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>React → Flask 통신</h1>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="메시지 입력"
      />
      <button onClick={sendMessage}>보내기</button>
      <p>서버 응답: {response}</p>
    </div>
  );
}

export default Testapi;