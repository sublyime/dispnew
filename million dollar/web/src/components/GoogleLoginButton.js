import React from 'react';

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const REDIRECT_URI = process.env.REACT_APP_GOOGLE_REDIRECT_URI;
const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

function GoogleLoginButton({ onAuth }) {
  const handleLogin = () => {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=token&scope=${encodeURIComponent(SCOPE)}`;
    window.location.href = url;
  };

  return (
    <button onClick={handleLogin} style={{ margin: 12, padding: 12, background: '#4285F4', color: '#fff', border: 'none', borderRadius: 4 }}>
      Sign in with Google
    </button>
  );
}

export default GoogleLoginButton;
