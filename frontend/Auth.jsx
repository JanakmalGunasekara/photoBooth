import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // To toggle between Login and Sign Up
  const [message, setMessage] = useState('');

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      let error;
      if (isLogin) {
        // Login
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        error = loginError;
      } else {
        // Sign Up
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        error = signUpError;
        if (!error) {
          setMessage('Sign up successful! Please check your email to verify your account.');
        }
      }

      if (error) throw error;

    } catch (error) {
      setMessage(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form-container">
        <h1 className="header">{isLogin ? 'Sign In' : 'Create Account'}</h1>
        <p className="description">
          {isLogin ? 'Sign in to access your photo booth dashboard.' : 'Sign up to get started.'}
        </p>
        {message && <p className="auth-message">{message}</p>}
        <form onSubmit={handleAuth}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input-field"
              type="email"
              placeholder="your@email.com"
              value={email}
              required={true}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input-field"
              type="password"
              placeholder="Your password"
              value={password}
              required={true}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="button-group">
            <button className="button-primary" type="submit" disabled={loading}>
              {loading ? <span>Loading...</span> : <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>}
            </button>
          </div>
        </form>
        <p className="toggle-auth">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span onClick={() => { setIsLogin(!isLogin); setMessage(''); }}>
            {isLogin ? 'Sign Up' : 'Sign In'}
          </span>
        </p>
      </div>
    </div>
  );
}
