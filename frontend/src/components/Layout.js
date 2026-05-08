import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  HomeIcon, 
  ClipboardDocumentListIcon, 
  ChartBarIcon, 
  UsersIcon,
  UserGroupIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import NotificationBell from './NotificationBell';

const Layout = () => {
  const { user, logout, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Панель управления', href: '/dashboard', icon: HomeIcon },
    { name: 'Задачи', href: '/tasks', icon: ClipboardDocumentListIcon },
    ...(isManager || isAdmin ? [{ name: 'Аналитика', href: '/analytics', icon: ChartBarIcon }] : []),
    { name: 'Группа', href: '/groups', icon: UserGroupIcon },
    ...(isAdmin ? [
      { name: 'Пользователи', href: '/users', icon: UsersIcon }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Менеджер задач</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    <item.icon className="h-5 w-5 mr-2" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <div className="flex items-center space-x-3">
                <div className="text-sm text-right">
                  <div className="font-medium text-gray-900">{user?.full_name}</div>
                  <div className="text-gray-500 text-xs capitalize">
                    {user?.role === 'admin' ? 'Администратор' : 
                     user?.role === 'manager' ? 'Руководитель группы' : 'Сотрудник'}
                    {user?.group_name && <span className="ml-1">({user?.group_name})</span>}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4 mr-1" />
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;