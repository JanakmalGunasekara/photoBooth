import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import signinImage from './assets/signin.png';
import signupImage from './assets/signup.png';
import photoboothLogo from './assets/photoboothlogo.png';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true); // To toggle between Login and Sign Up
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        // --- Password Confirmation Check ---
        if (password !== confirmPassword) {
          setMessage('Passwords do not match. Please try again.');
          setLoading(false);
          return;
        }
        // Sign Up
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            },
          },
        });
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

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage('Please enter your email address to reset your password.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin, // Redirects to the app's home page after reset
      });
      if (error) throw error;
      setMessage('Password reset link sent! Please check your email.');
    } catch (error) {
      setMessage(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error) {
      setMessage(error.error_description || error.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-image-column">
          <img src={isLogin ? signinImage : signupImage} alt={isLogin ? 'Sign In illustration' : 'Sign Up illustration'} />
        </div>
        <div className="auth-form-column">
          <div className="auth-form-container">
            <img src={photoboothLogo} alt="Photo Booth Logo" className="auth-logo" />
            <h1 className="header">{isLogin ? 'Login' : 'Create Account'}</h1>

            <div className="social-signup-container">
              <button onClick={handleGoogleSignIn} className="google-btn" disabled={loading}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                {isLogin ? 'Login with Google' : 'Sign Up with Google'}
              </button>
              <div className="divider">
                <span>OR</span>
              </div>
            </div>
            {message && <p className="auth-message">{message}</p>}
            <form onSubmit={handleAuth}>
              {!isLogin && (
                <>
                  <div className="input-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                      id="name"
                      className="input-field"
                      type="text"
                      placeholder="e.g., John Doe"
                      value={name}
                      required={!isLogin}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </>
              )}
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
              {!isLogin && (
                <>
                  <div className="input-group">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      className="input-field"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Your password (min. 6 characters)"
                      value={password}
                      required={!isLogin}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? '🙈' : '👁️'}
                    </span>
                  </div>
                </>
              )}
              <div className="input-group">
                <label htmlFor={isLogin ? 'password' : 'confirm-password'}>
                  {isLogin ? 'Password' : 'Confirm Password'}
                </label>
                <input
                  id={isLogin ? 'password' : 'confirm-password'}
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  value={isLogin ? password : confirmPassword}
                  required={true}
                  onChange={(e) => (isLogin ? setPassword(e.target.value) : setConfirmPassword(e.target.value))}
                />
                <span className="password-toggle-icon" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '🙈' : '👁️'}
                </span>
              </div>
              {isLogin && (
                <div className="forgot-password-link" onClick={handlePasswordReset}>
                  Forgot Password?
                </div>
              )}
              <div className="button-group">
                <button className="button-primary" type="submit" disabled={loading}>
                  {loading ? <span>Loading...</span> : <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>}
                </button>
              </div>
            </form>
            <p className="toggle-auth">
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => { setIsLogin(!isLogin); setMessage(''); }}>
                {isLogin ? 'Sign Up' : 'Login'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
