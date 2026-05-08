import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import axios from 'axios';
import { XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const API_URL = 'http://localhost:8000';
const fetchUsersForTask = async () => {
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
  const [noDeadline, setNoDeadline] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deadline_date: '',
    deadline_time: '',
    assigned_to: '',
  });

  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: usersLoading } = useQuery('usersForTask', fetchUsersForTask, {
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

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Название обязательно';
    }
    if (!noDeadline && !formData.deadline_date) {
      newErrors.deadline_date = 'Укажите дату или выберите "Без срока"';
    }
    if (!noDeadline && !formData.deadline_time) {
      newErrors.deadline_time = 'Укажите время или выберите "Без срока"';
    }
    if (!formData.assigned_to) {
      newErrors.assigned_to = 'Исполнитель обязателен';
    }
    if (!noDeadline && formData.deadline_date && formData.deadline_time) {
      const deadlineDateTime = new Date(`${formData.deadline_date}T${formData.deadline_time}`);
      if (isNaN(deadlineDateTime.getTime())) {
        newErrors.deadline_date = 'Некорректная дата';
      } else if (deadlineDateTime < new Date()) {
        newErrors.deadline_date = 'Дата не может быть в прошлом';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Исправьте ошибки в форме');
      return;
    }
    let deadline = null;
    if (!noDeadline && formData.deadline_date && formData.deadline_time) {
      const deadlineDateTime = new Date(`${formData.deadline_date}T${formData.deadline_time}`);
      deadline = deadlineDateTime.toISOString();
    }
    
    const taskData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      assigned_to: parseInt(formData.assigned_to),
      deadline: deadline
    };
    createMutation.mutate(taskData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };

  const handleNoDeadlineChange = (e) => {
    setNoDeadline(e.target.checked);
    if (e.target.checked) {
      setErrors({
        ...errors,
        deadline_date: null,
        deadline_time: null
      });
    }
  };

  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
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
              value={formData.title}
              onChange={handleChange}
              className={`input ${errors.title ? 'border-red-500 focus:ring-red-500' : ''}`}
              placeholder="Название задачи"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Срок выполнения
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noDeadline}
                  onChange={handleNoDeadlineChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Без срока</span>
              </label>
            </div>
            
            {!noDeadline && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Дата</label>
                    <input
                      type="date"
                      name="deadline_date"
                      value={formData.deadline_date}
                      onChange={handleChange}
                      min={getMinDate()}
                      className={`input ${errors.deadline_date ? 'border-red-500 focus:ring-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Время</label>
                    <input
                      type="time"
                      name="deadline_time"
                      value={formData.deadline_time}
                      onChange={handleChange}
                      className={`input ${errors.deadline_time ? 'border-red-500 focus:ring-red-500' : ''}`}
                    />
                  </div>
                </div>
                {(errors.deadline_date || errors.deadline_time) && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.deadline_date || errors.deadline_time}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Укажите дату и время выполнения задачи
                </p>
              </>
            )}
            
            {noDeadline && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-600">
                  📅 Задача будет создана без срока выполнения
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Исполнитель *
            </label>
            <select
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
              className={`input ${errors.assigned_to ? 'border-red-500 focus:ring-red-500' : ''}`}
              disabled={usersLoading}
            >
              <option value="">Выберите исполнителя</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.role === 'manager' ? 'Руководитель' : 'Сотрудник'})
                  {user.group_name && ` - ${user.group_name}`}
                </option>
              ))}
            </select>
            {errors.assigned_to && (
              <p className="mt-1 text-sm text-red-600">{errors.assigned_to}</p>
            )}
            {users.length === 0 && !usersLoading && (
              <p className="mt-1 text-sm text-yellow-600">
                Нет доступных исполнителей. Сначала создайте группу и добавьте в неё сотрудников.
              </p>
            )}
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