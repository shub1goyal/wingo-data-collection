const API_BASE_URL = '/api';

export const fetcher = async (url: string, body?: any) => {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};
