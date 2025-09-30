import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function GoogleAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Parse access_token from URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (token) {
      localStorage.setItem('google_access_token', token);
      navigate('/drive');
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return <div>Authenticating with Google...</div>;
}

export default GoogleAuthCallback;
