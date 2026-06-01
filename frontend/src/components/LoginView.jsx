import { useState } from 'react';
import { KeyRound, Mail, User, AlertCircle, Sparkles } from 'lucide-react';

export function LoginView({ onSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const url = isRegister ? '/api/auth/register' : '/api/auth/login';
    const body = isRegister 
      ? { username, email, password } 
      : { email, password };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Algo salió mal. Inténtalo de nuevo.');
      }

      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0c0c0d',
      fontFamily: "'Inter', sans-serif",
      color: '#e0e0e0',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Neon Gradients */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '40%',
        height: '40%',
        borderRadius: '50%',
        backgroundColor: 'rgba(124, 58, 237, 0.08)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '40%',
        height: '40%',
        borderRadius: '50%',
        backgroundColor: 'rgba(239, 68, 68, 0.04)',
        filter: 'blur(100px)',
        pointerEvents: 'none'
      }} />

      {/* Login Card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: 'rgba(28, 28, 30, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '20px',
        padding: '40px 32px',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
        zIndex: 1,
        transition: 'all 0.3s ease'
      }}>
        {/* Logo and Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.3)',
            color: '#ffffff',
            marginBottom: '16px'
          }}>
            <Sparkles size={24} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.03em', marginBottom: '8px' }}>
            {isRegister ? 'Crear tu Cuenta' : 'Cockpit ToDo'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#9e9e9e' }}>
            {isRegister 
              ? 'Regístrate para organizar tu día de forma inteligente.' 
              : 'Bienvenido de vuelta. Tu productividad te espera.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 500,
            marginBottom: '20px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Username (Only for Register) */}
          {isRegister && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nombre de Usuario</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }}>
                  <User size={16} />
                </span>
                <input 
                  type="text"
                  required
                  placeholder="Tu nombre"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo Electrónico</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }}>
                <Mail size={16} />
              </span>
              <input 
                type="email"
                required
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 42px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9e9e9e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#666' }}>
                <KeyRound size={16} />
              </span>
              <input 
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 42px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)',
              transition: 'transform 0.15s, opacity 0.2s',
              marginTop: '10px',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {loading 
              ? (isRegister ? 'Creando cuenta...' : 'Iniciando sesión...') 
              : (isRegister ? 'Registrarse' : 'Iniciar Sesión')}
          </button>
        </form>

        {/* Toggle Mode Link */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button 
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#7c3aed',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          >
            {isRegister 
              ? '¿Ya tienes una cuenta? Inicia Sesión' 
              : '¿No tienes una cuenta? Regístrate'}
          </button>
        </div>

      </div>
    </div>
  );
}
