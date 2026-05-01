import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const API_URL = 'http://localhost:8000';

const fetchUsers = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`${API_URL}/api/users/list`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
};

const createTask = async (taskData) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`${API_URL}/api/tasks/`, taskData, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  return response.data;
};

const TaskForm = ({ onClose, taskToEdit }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deadline: '',
    assigned_to: '',
  });

  const queryClient = useQueryClient();
  
  const { data: users = [], isLoading: usersLoading } = useQuery('usersForTask', fetchUsers, {
    onError: (error) => {
      console.error('Error fetching users:', error);
      toast.error('Не удалось загрузить пользователей');
    }
  });

  const createMutation = useMutation(createTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Задача успешно создана');
      onClose();
    },
    onError: (error) => {
      console.error('Error creating task:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
      toast.error(`Ошибка создания задачи: ${errorMessage}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.deadline || !formData.assigned_to) {
      toast.error('Заполните все обязательные поля');
      return;
    }
    
    const taskData = {
      ...formData,
      assigned_to: parseInt(formData.assigned_to),
      deadline: new Date(formData.deadline).toISOString()
    };
    
    createMutation.mutate(taskData);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Создать задачу</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className="input"
              placeholder="Название задачи"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              className="input"
              placeholder="Описание задачи"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Приоритет
            </label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              className="input"
            >
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Срок выполнения *
            </label>
            <input
              type="datetime-local"
              name="deadline"
              required
              value={formData.deadline}
              onChange={handleChange}
              className="input"
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Исполнитель *
            </label>
            <select
              name="assigned_to"
              required
              value={formData.assigned_to}
              onChange={handleChange}
              className="input"
              disabled={usersLoading}
            >
              <option value="">Выберите исполнителя</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role === 'manager' ? 'Руководитель' : 'Сотрудник'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading}
              className="btn-primary"
            >
              {createMutation.isLoading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;