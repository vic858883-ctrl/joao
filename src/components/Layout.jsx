import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, ShoppingBag, DollarSign,
  RotateCcw, Building2, Menu, X, LogOut, TrendingUp, ChevronRight, FileUp, Users2
} from 'lucide-react'
import Notificacoes from './Notificacoes'

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vendas', icon: ShoppingBag, label: 'Vendas' },
  { to: '/comissoes', icon: DollarSign, label: 'Comissões' },
  { to: '/estornos', icon: RotateCcw, label: 'Estornos' },
  { to: '/revendedores', icon: Users2, label: 'Revendedores' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/administradoras', icon: Building2, label: 'Administradoras' },
  { to: '/importar', icon: FileUp, label: 'Importar Excel' },
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={mobile ? 'flex flex-col h-full' : 'hidden lg:flex flex-col w-64 min-h-screen'}
      style={{ background: 'rgba(10,15,30,0.95)', borderRight: '1px solid rgba(99,102,241,0.1)' }}
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            <TrendingUp size={20} color="white" />
          </div>
          <div>
            <div className="font-bold text-white">ConsórcioPRO</div>
            <div className="text-xs text-gray-500">Gestão de Comissões</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
            style={({ isActive }) => isActive ? { background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2))', border: '1px solid rgba(99,102,241,0.3)' } : {}}
          >
            <Icon size={18} />
            <span>{label}</span>
            <ChevronRight size={14} className="ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t" style={{ borderColor: 'rgba(99,102,241,0.1)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Notificacoes />
          <span className="text-xs text-gray-500">Notificações</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            {user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-white font-medium truncate">{user?.email}</div>
            <div className="text-xs text-gray-500">Corretor</div>
          </div>
          <button onClick={handleSignOut} className="text-gray-500 hover:text-red-400 transition-colors" title="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b" style={{ background: 'rgba(10,15,30,0.95)', borderColor: 'rgba(99,102,241,0.1)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="text-gray-400">
              <Menu size={24} />
            </button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
              <TrendingUp size={16} color="white" />
            </div>
            <span className="font-bold">ConsórcioPRO</span>
          </div>
          <Notificacoes />
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
