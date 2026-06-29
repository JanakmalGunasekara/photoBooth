import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function UpdatePassword() {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password should be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Your password has been updated successfully! You can now close this page.");
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ flexDirection: 'column', maxWidth: '450px', minHeight: 'auto' }}>
        <div className="auth-form-column">
          <div className="auth-form-container">
            <h1 className="header">Update Password</h1>
            <p className="description">Enter and confirm your new password below.</p>
            {message && <p className="auth-message" style={{ color: 'var(--btn-primary)', borderColor: 'var(--btn-primary)' }}>{message}</p>}
            {error && <p className="auth-message">{error}</p>}
            
            {!message && (
              <form onSubmit={handleUpdatePassword}>
                <div className="input-group">
                  <label htmlFor="password">New Password</label>
                  <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field" />
                </div>
                <div className="input-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="input-field" />
                </div>
                <div className="button-group">
                  <button type="submit" className="button-primary" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}