import { useState, useEffect } from 'react';
import { Users, BookOpen, CheckSquare, Trash2, Shield, ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';

export function AdminView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo cargar la lista de usuarios.');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleRole = async (targetUser) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    setActionLoadingId(targetUser.id);
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo actualizar el rol.');
      }
      // Update locally
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setActionLoadingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No se pudo eliminar el usuario.');
      }
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Metrics calculation
  const totalUsers = users.length;
  const totalLists = users.reduce((acc, u) => acc + (u.list_count || 0), 0);
  const totalTasks = users.reduce((acc, u) => acc + (u.task_count || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-secondary)' }}>
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-hover)', marginBottom: '16px' }} />
        <p>Cargando panel de administración...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🛡️ Panel de Administración
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Gestiona las cuentas de usuario registradas en ToDo, cambia sus roles y monitorea su uso.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ padding: '16px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#ef4444', marginBottom: '24px', fontSize: '0.9rem' }}>
          ⚠️ Error: {error}
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '36px' }}>
        {/* Metric 1 */}
        <div style={{
          backgroundColor: 'var(--right-pane-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Cuentas Totales</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalUsers}</div>
          </div>
        </div>

        {/* Metric 2 */}
        <div style={{
          backgroundColor: 'var(--right-pane-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Listas Creadas</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalLists}</div>
          </div>
        </div>

        {/* Metric 3 */}
        <div style={{
          backgroundColor: 'var(--right-pane-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <CheckSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Tareas Guardadas</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalTasks}</div>
          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div style={{
        backgroundColor: 'var(--right-pane-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 4px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cuentas de Usuarios</h3>
          <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            {users.length} registrados
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
                <th style={{ padding: '16px 24px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Usuario</th>
                <th style={{ padding: '16px 24px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rol</th>
                <th style={{ padding: '16px 24px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Listas</th>
                <th style={{ padding: '16px 24px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Tareas</th>
                <th style={{ padding: '16px 24px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fecha Registro</th>
                <th style={{ padding: '16px 24px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isUserAdmin = u.role === 'admin';
                const firstLetter = u.username ? u.username.charAt(0).toUpperCase() : 'U';

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }} className="table-row-hover">
                    {/* User */}
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: isUserAdmin ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)',
                          border: isUserAdmin ? '1px solid rgba(124,58,237,0.3)' : '1px solid var(--border-color)',
                          color: isUserAdmin ? '#a78bfa' : 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '1rem'
                        }}>
                          {firstLetter}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>{u.username}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        backgroundColor: isUserAdmin ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
                        color: isUserAdmin ? '#a78bfa' : 'var(--text-secondary)',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: isUserAdmin ? '1px solid rgba(124,58,237,0.2)' : '1px solid var(--border-color)'
                      }}>
                        {isUserAdmin ? <ShieldCheck size={14} /> : <Shield size={14} />}
                        {isUserAdmin ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>

                    {/* Lists Count */}
                    <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {u.list_count}
                    </td>

                    {/* Tasks Count */}
                    <td style={{ padding: '16px 24px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {u.task_count}
                    </td>

                    {/* Created At */}
                    <td style={{ padding: '16px 24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {/* Toggle Role Button */}
                        <button
                          onClick={() => handleToggleRole(u)}
                          disabled={actionLoadingId !== null}
                          title={isUserAdmin ? "Quitar Privilegios" : "Hacer Administrador"}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isUserAdmin ? '#f59e0b' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          className="action-btn"
                        >
                          {isUserAdmin ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                        </button>

                        {/* Delete User Button */}
                        <button
                          onClick={() => setDeleteTarget(u)}
                          disabled={actionLoadingId !== null}
                          title="Eliminar Cuenta"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '8px',
                            borderRadius: '8px',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          className="action-btn-danger"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--right-pane-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            fontFamily: 'inherit'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
              ⚠️ ¿Eliminar cuenta permanentemente?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              ¿Estás seguro de que deseas eliminar la cuenta de <strong>{deleteTarget.username}</strong> ({deleteTarget.email})? 
              <br /><br />
              Esta acción es **irreversible** y eliminará por completo todos sus proyectos, listas, secciones, tareas y subtareas en la nube de forma permanente.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoadingId !== null}
                style={{
                  padding: '10px 18px',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoadingId !== null}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 12px rgba(239,68,68,0.2)'
                }}
              >
                {actionLoadingId === deleteTarget.id ? <Loader2 size={16} className="animate-spin" /> : 'Eliminar Cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
