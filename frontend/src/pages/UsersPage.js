import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const fetchUsers = async () => {
  const response = await api.get('/api/users/');
  return response.data;
};

const createUser = async (userData) => {
  const response = await api.post('/api/users/', userData);
  return response.data;
};

const deleteUser = async (userId) => {
  const response = await api.delete(`/api/users/${userId}`);
  return response.data;
};

const UsersPage = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
  });
  const { user: currentUser, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery('users', fetchUsers, {
    retry: 1,
    onError: (error) => {
      const errorMessage = error.response?.data?.detail || error.message;
      toast.error('Ошибка загрузки пользователей: ' + errorMessage);
    }
  });

  const createMutation = useMutation(createUser, {
    onSuccess: () => {
      queryClient.invalidateQueries('users');
      setShowCreateForm(false);
      setFormData({ email: '', full_name: '', password: '' });
      toast.success('Пользователь успешно создан');
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
      toast.error('Ошибка создания пользователя: ' + errorMessage);
    },
  });

  const deleteMutation = useMutation(deleteUser, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('users');
      toast.success(data?.message || 'Пользователь успешно удалён');
    },
    onError: (error) => {
      const errorDetail = error.response?.data?.detail;
      
      if (errorDetail && errorDetail.includes('активными задачами')) {
        toast.error(errorDetail, { duration: 8000 });
      } else if (errorDetail) {
        toast.error('Ошибка удаления пользователя: ' + errorDetail);
      } else {
        toast.error('Ошибка удаления пользователя: ' + (error.message || 'Неизвестная ошибка'));
      }
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.email || !formData.full_name || !formData.password) {
      toast.error('Заполните все поля');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleDeleteClick = async (user) => {
    if (user.id === currentUser?.id) {
      toast.error('Нельзя удалить самого себя');
      return;
    }
    const confirmMessage = `Вы уверены, что хотите удалить пользователя "${user.full_name}"?\n\n` +
      `Внимание: Удаление возможно только если у пользователя нет активных задач (кроме завершённых).\n` +
      `Завершённые задачи останутся в системе для сохранения истории.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        await deleteMutation.mutateAsync(user.id);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Управление пользователями</h1>
          <p className="text-gray-600">Управляйте пользователями системы</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary flex items-center"
        >
          <UserPlusIcon className="h-5 w-5 mr-1" />
          Создать пользователя
        </button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              💡 <strong>Как работает система ролей:</strong><br />
              • Новые пользователи всегда создаются с ролью <strong>Сотрудник</strong><br />
              • Пользователь становится <strong>Руководителем</strong> только когда его назначают руководителем группы<br />
              • Чтобы назначить руководителя, сначала создайте группу, добавьте в неё пользователя, затем отредактируйте группу и выберите руководителя<br />
              • При снятии с роли руководителя группы, пользователь снова становится сотрудником
            </p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              ⚠️ <strong>Важно:</strong> Пользователя можно удалить только если у него нет активных задач<br />
              • <strong>Активные задачи</strong> — задачи со статусами "Новая", "В работе", "На проверке"<br />
              • <strong>Завершённые и архивные задачи</strong> останутся в системе для сохранения истории<br />
              • Перед удалением пользователя переназначьте или завершите его активные задачи
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Полное имя
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Роль
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Группа
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата создания
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                  Нет пользователей. Создайте первого!
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'manager' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role === 'manager' ? 'Руководитель' : 'Сотрудник'}
                    </span>
                    {user.role === 'manager' && user.group_name && (
                      <p className="text-xs text-gray-500 mt-1">
                        (руководитель группы "{user.group_name}")
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.group_name || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleDeleteClick(user)}
                      disabled={deleteMutation.isLoading}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={user.id === currentUser?.id ? "Нельзя удалить себя" : "Удалить пользователя"}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Создать пользователя</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Полное имя *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input"
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль * (минимум 6 символов)
                </label>
                <input
                  type="password"
                  required
                  minLength="6"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input"
                  placeholder="••••••"
                />
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  📌 <strong>Примечание:</strong> Новый пользователь будет создан с ролью <strong>Сотрудник</strong>.
                  Чтобы сделать его руководителем, создайте группу, добавьте пользователя в группу,
                  затем назначьте его руководителем этой группы при редактировании.
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">
                  Отмена
                </button>
                <button type="submit" disabled={createMutation.isLoading} className="btn-primary">
                  {createMutation.isLoading ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;