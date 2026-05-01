import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { CalendarIcon, UserIcon, ChatBubbleLeftIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const deleteTask = async (id) => {
  const token = localStorage.getItem('token');
  await axios.delete(`http://localhost:8000/api/tasks/${id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

const archiveTask = async (id) => {
  const token = localStorage.getItem('token');
  await axios.put(`http://localhost:8000/api/tasks/${id}`, { status: 'archived' }, {
    headers: { Authorization: `Bearer ${token}` }
  });
};

const delegateTask = async ({ id, newAssigneeId, reason }) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`http://localhost:8000/api/tasks/${id}/delegate`, {
    new_assignee_id: newAssigneeId,
    reason: reason
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const TaskCard = ({ task, onStatusChange }) => {
  const [showComments, setShowComments] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [delegateData, setDelegateData] = useState({ newAssigneeId: '', reason: '' });
  const { isManager, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery('usersForDelegate', async () => {
    const token = localStorage.getItem('token');
    const response = await axios.get('http://localhost:8000/api/users/list', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  });

  const deleteMutation = useMutation(deleteTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Задача удалена');
    },
  });

  const archiveMutation = useMutation(archiveTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Задача архивирована');
    },
  });

  const delegateMutation = useMutation(delegateTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      setShowDelegate(false);
      toast.success('Задача успешно переделегирована');
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || 'Ошибка при делегировании';
      toast.error(msg);
    }
  });

  const addCommentMutation = useMutation(
    async ({ taskId, content }) => {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8000/api/tasks/${taskId}/comments`, { content }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tasks');
        setNewComment('');
        toast.success('Комментарий добавлен');
      },
    }
  );

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high': return 'Высокий';
      case 'medium': return 'Средний';
      case 'low': return 'Низкий';
      default: return priority;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'new': return 'Новая';
      case 'in_progress': return 'В работе';
      case 'in_review': return 'На проверке';
      case 'completed': return 'Завершена';
      default: return status;
    }
  };

  const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'archived';

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900">{task.title}</h3>
        <div className="flex space-x-1">
          <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
            {getPriorityText(task.priority)}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800`}>
            {getStatusText(task.status)}
          </span>
        </div>
      </div>

      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="space-y-1 text-sm text-gray-500">
        <div className="flex items-center">
          <UserIcon className="h-4 w-4 mr-2" />
          <span>Исполнитель: {task.assignee?.full_name}</span>
        </div>
        <div className={`flex items-center ${isOverdue ? 'text-red-600' : ''}`}>
          <CalendarIcon className="h-4 w-4 mr-2" />
          <span>Срок: {format(new Date(task.deadline), 'dd MMM yyyy')}</span>
          {isOverdue && <span className="ml-2 text-red-600 font-medium">(Просрочена)</span>}
        </div>
      </div>

      {task.assigned_to === user?.id && task.status !== 'completed' && task.status !== 'archived' && (
        <div className="mt-3">
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="in_review">На проверке</option>
            <option value="completed">Завершена</option>
          </select>
        </div>
      )}

      <div className="mt-3 flex space-x-3">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center text-sm text-gray-600 hover:text-blue-600"
        >
          <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
          Комментарии ({task.comments?.length || 0})
        </button>
        {isManager && task.status !== 'archived' && (
          <>
            <button
              onClick={() => setShowDelegate(true)}
              className="flex items-center text-sm text-gray-600 hover:text-green-600"
            >
              <UserPlusIcon className="h-4 w-4 mr-1" />
              Делегировать
            </button>
            <button
              onClick={() => {
                if (window.confirm('Архивировать эту задачу?')) {
                  archiveMutation.mutate(task.id);
                }
              }}
              className="text-sm text-yellow-600 hover:text-yellow-800"
            >
              Архив
            </button>
            <button
              onClick={() => {
                if (window.confirm('Удалить эту задачу навсегда?')) {
                  deleteMutation.mutate(task.id);
                }
              }}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Удалить
            </button>
          </>
        )}
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {task.comments?.map((comment) => (
              <div key={comment.id} className="text-sm">
                <span className="font-medium">
                  {comment.author_name || `Пользователь #${comment.author_id}`}
                  <span className="text-xs text-gray-400 ml-1">
                    ({comment.author_role === 'admin' ? 'Администратор' : 
                      comment.author_role === 'manager' ? 'Руководитель' : 'Сотрудник'})
                  </span>:
                </span>
                <span className="text-gray-600 ml-2">{comment.content}</span>
                <div className="text-xs text-gray-400">
                  {format(new Date(comment.created_at), 'dd MMM, HH:mm')}
                </div>
              </div>
            ))}
            {(!task.comments || task.comments.length === 0) && (
              <p className="text-sm text-gray-500">Нет комментариев</p>
            )}
          </div>
          <div className="mt-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Добавить комментарий..."
              className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
            />
            <button
              onClick={() => addCommentMutation.mutate({ taskId: task.id, content: newComment })}
              disabled={!newComment.trim()}
              className="mt-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              Отправить
            </button>
          </div>
        </div>
      )}

      {showDelegate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Делегирование задачи</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Новый исполнитель
                </label>
                <select
                  value={delegateData.newAssigneeId}
                  onChange={(e) => setDelegateData({ ...delegateData, newAssigneeId: e.target.value })}
                  className="input"
                >
                  <option value="">Выберите пользователя</option>
                  {users.filter(u => u.id !== task.assigned_to).map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.role === 'manager' ? 'Руководитель' : 'Сотрудник'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Причина *
                </label>
                <textarea
                  required
                  value={delegateData.reason}
                  onChange={(e) => setDelegateData({ ...delegateData, reason: e.target.value })}
                  className="input"
                  rows="3"
                  placeholder="Укажите причину делегирования"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button onClick={() => setShowDelegate(false)} className="btn-secondary">
                  Отмена
                </button>
                <button
                  onClick={() => {
                    if (delegateData.newAssigneeId && delegateData.reason) {
                      delegateMutation.mutate({
                        id: task.id,
                        newAssigneeId: parseInt(delegateData.newAssigneeId),
                        reason: delegateData.reason
                      });
                    } else {
                      toast.error('Заполните все поля');
                    }
                  }}
                  disabled={delegateMutation.isLoading}
                  className="btn-primary"
                >
                  {delegateMutation.isLoading ? 'Делегирование...' : 'Делегировать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskCard;