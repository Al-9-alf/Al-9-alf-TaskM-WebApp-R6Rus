import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { CalendarIcon, UserIcon, ChatBubbleLeftIcon, UserPlusIcon, BuildingOfficeIcon, PlayIcon, PaperAirplaneIcon, CheckCircleIcon, ArrowUturnLeftIcon, ArchiveBoxIcon, TrashIcon } from '@heroicons/react/24/outline';
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

const updateTaskStatus = async ({ id, status }) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`http://localhost:8000/api/tasks/${id}/status`, null, {
    params: { status }
  });
  return response.data;
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

const TaskCard = ({ task }) => {
  const [showComments, setShowComments] = useState(false);
  const [showDelegate, setShowDelegate] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [delegateData, setDelegateData] = useState({ newAssigneeId: '', reason: '' });
  const { isManager, isAdmin, user } = useAuth();
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

  const updateStatusMutation = useMutation(updateTaskStatus, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Статус задачи обновлён');
    },
    onError: (error) => {
      toast.error('Ошибка обновления статуса: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
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
      case 'archived': return 'Архив';
      default: return status;
    }
  };

  const isOverdue = task.deadline 
    ? new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'archived'
    : false;
  
  const isAssignee = task.assigned_to === user?.id;
  const isManagerOfGroup = isManager && !isAdmin;
  
  const canManage = isAdmin || (isManagerOfGroup && task.assignee?.group_id === user?.group_id);
  const canChangeStatus = isAdmin || isAssignee || (isManagerOfGroup && task.assignee?.group_id === user?.group_id);

  const assigneeName = task.assignee?.full_name || (task.assigned_to_name ? `${task.assigned_to_name} (удалён)` : 'Не назначен');
  const creatorName = task.creator?.full_name || (task.created_by_name ? `${task.created_by_name} (удалён)` : 'Неизвестен');

  const handleTakeToWork = () => {
    updateStatusMutation.mutate({ id: task.id, status: 'in_progress' });
  };

  const handleSendToReview = () => {
    updateStatusMutation.mutate({ id: task.id, status: 'in_review' });
  };

  const handleComplete = () => {
    updateStatusMutation.mutate({ id: task.id, status: 'completed' });
  };

  const handleSendToRework = () => {
    updateStatusMutation.mutate({ id: task.id, status: 'in_progress' });
  };

  const handleArchive = () => {
    if (window.confirm('Архивировать эту задачу?')) {
      archiveMutation.mutate(task.id);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Удалить эту задачу навсегда? Это действие необратимо.')) {
      deleteMutation.mutate(task.id);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900">{task.title}</h3>
        <div className="flex space-x-1">
          <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
            {getPriorityText(task.priority)}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full ${
            task.status === 'completed' ? 'bg-green-100 text-green-800' :
            task.status === 'archived' ? 'bg-gray-100 text-gray-800' :
            task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
            task.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
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
          <span>Исполнитель: {assigneeName}</span>
        </div>
        {task.assignee_group_name && task.assignee && !task.assignee.full_name.includes('удалён') && (
          <div className="flex items-center">
            <BuildingOfficeIcon className="h-4 w-4 mr-2" />
            <span>Группа: {task.assignee_group_name}</span>
          </div>
        )}
        <div className="flex items-center">
          <UserIcon className="h-4 w-4 mr-2" />
          <span>Создатель: {creatorName}</span>
        </div>
        <div className={`flex items-center ${isOverdue ? 'text-red-600' : ''}`}>
          <CalendarIcon className="h-4 w-4 mr-2" />
          {task.deadline ? (
            <>
              <span>Срок: {format(new Date(task.deadline), 'dd MMM yyyy HH:mm')}</span>
              {isOverdue && <span className="ml-2 text-red-600 font-medium">(Просрочена)</span>}
            </>
          ) : (
            <span>Без срока</span>
          )}
        </div>
        {task.delegation_reason && (
          <div className="text-xs text-gray-400 mt-1">
            Причина делегирования: {task.delegation_reason}
          </div>
        )}
      </div>

      {isAssignee && task.status !== 'completed' && task.status !== 'archived' && task.assignee && !task.assignee.full_name.includes('удалён') && (
        <div className="mt-3 space-y-2">
          {task.status === 'new' && (
            <button
              onClick={handleTakeToWork}
              disabled={updateStatusMutation.isLoading}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <PlayIcon className="h-4 w-4 mr-2" />
              Взять в работу
            </button>
          )}
          
          {task.status === 'in_progress' && (
            <button
              onClick={handleSendToReview}
              disabled={updateStatusMutation.isLoading}
              className="w-full flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-4 w-4 mr-2" />
              Отправить на проверку
            </button>
          )}
        </div>
      )}

      {canManage && task.status === 'in_review' && (
        <div className="mt-3 space-y-2">
          <button
            onClick={handleComplete}
            disabled={updateStatusMutation.isLoading}
            className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <CheckCircleIcon className="h-4 w-4 mr-2" />
            Завершить работу
          </button>
          
          <button
            onClick={handleSendToRework}
            disabled={updateStatusMutation.isLoading}
            className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
          >
            <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
            Отправить на доработку
          </button>
        </div>
      )}

      <div className="mt-3 flex space-x-3 flex-wrap gap-2">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center text-sm text-gray-600 hover:text-blue-600"
        >
          <ChatBubbleLeftIcon className="h-4 w-4 mr-1" />
          Комментарии ({task.comments?.length || 0})
        </button>
        
        {canManage && task.status !== 'archived' && (
          <button
            onClick={() => setShowDelegate(true)}
            className="flex items-center text-sm text-gray-600 hover:text-green-600"
          >
            <UserPlusIcon className="h-4 w-4 mr-1" />
            Делегировать
          </button>
        )}
        
        {canManage && task.status !== 'archived' && task.status !== 'completed' && (
          <button
            onClick={handleArchive}
            disabled={archiveMutation.isLoading}
            className="flex items-center text-sm text-yellow-600 hover:text-yellow-800"
          >
            <ArchiveBoxIcon className="h-4 w-4 mr-1" />
            Архив
          </button>
        )}
        
        {isAdmin && (
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isLoading}
            className="flex items-center text-sm text-red-600 hover:text-red-800"
          >
            <TrashIcon className="h-4 w-4 mr-1" />
            Удалить
          </button>
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
                      comment.author_role === 'manager' ? 'Руководитель' : 
                      comment.author_role === 'deleted' ? 'Удалён' : 'Сотрудник'})
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
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role === 'manager' ? 'Руководитель' : 'Сотрудник'}) 
                      {u.group_name && ` - ${u.group_name}`}
                    </option>
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