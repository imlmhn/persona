export async function sendMessageToServer(message) {
  try {
    const res = await fetch('http://localhost:5000/api/echo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    return data.response;
  } catch (error) {
    console.error('API 요청 실패:', error);
    throw error;
  }
}