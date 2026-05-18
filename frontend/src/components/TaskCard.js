import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  CalendarIcon, 
  UserIcon, 
  ChatBubbleLeftIcon, 
  UserPlusIcon, 
  BuildingOfficeIcon, 
  PlayIcon, 
  PaperAirplaneIcon, 
  CheckCircleIcon, 
  ArrowUturnLeftIcon, 
  ArchiveBoxIcon, 
  TrashIcon, 
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
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

const restoreTask = async (id) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`http://localhost:8000/api/tasks/${id}/restore`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const updateTaskStatus = async ({ id, status }) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`http://localhost:8000/api/tasks/${id}/status`, null, {
    params: { status },
    headers: { Authorization: `Bearer ${token}` }
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

const TaskCard = ({ task, onRestore, onUpdate, draggable = true, onDragStart }) => {
  const [isExpanded, setIsExpanded] = useState(false);
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
      queryClient.invalidateQueries('archivedTasks');
      queryClient.invalidateQueries('myDashboardTasks');
      toast.success('Задача удалена');
      if (onUpdate) onUpdate();
    },
  });

  const archiveMutation = useMutation(archiveTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('archivedTasks');
      queryClient.invalidateQueries('myDashboardTasks');
      toast.success('Задача архивирована');
      if (onUpdate) onUpdate();
    },
  });

  const restoreMutation = useMutation(restoreTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('archivedTasks');
      queryClient.invalidateQueries('myDashboardTasks');
      toast.success('Задача восстановлена из архива');
      if (onRestore) onRestore();
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error('Ошибка восстановления: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    },
  });

  const updateStatusMutation = useMutation(updateTaskStatus, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('archivedTasks');
      queryClient.invalidateQueries('myDashboardTasks');
      toast.success('Статус задачи обновлён');
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error('Ошибка обновления статуса: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    },
  });

  const delegateMutation = useMutation(delegateTask, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('archivedTasks');
      queryClient.invalidateQueries('myDashboardTasks');
      setShowDelegate(false);
      toast.success('Задача успешно переделегирована');
      if (onUpdate) onUpdate();
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
        queryClient.invalidateQueries('archivedTasks');
        queryClient.invalidateQueries('myDashboardTasks');
        setNewComment('');
        toast.success('Комментарий добавлен');
        if (onUpdate) onUpdate();
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'in_review': return 'bg-yellow-100 text-yellow-800';
      case 'archived': return 'bg-gray-300 text-gray-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = task.deadline 
    ? new Date(task.deadline) < new Date() && task.status !== 'completed' && task.status !== 'archived'
    : false;
  
  const isAssignee = task.assigned_to === user?.id;
  const isManagerOfGroup = isManager && !isAdmin;
  const isAdminUser = isAdmin;
  const isArchived = task.status === 'archived';
  const canManage = isAdmin || (isManager && task.assignee?.group_id === user?.group_id);
  const canArchive = canManage && !isArchived;
  const canAssigneeChangeStatus = isAssignee && (task.status === 'new' || task.status === 'in_progress');
  const canManagerChangeReviewStatus = (isAdmin || (isManager && task.assignee?.group_id === user?.group_id)) && task.status === 'in_review';
  const canChangeStatus = canAssigneeChangeStatus || canManagerChangeReviewStatus;
  const assigneeName = task.assignee?.full_name || (task.assigned_to_name ? `${task.assigned_to_name} (удалён)` : 'Не назначен');
  const creatorName = task.creator?.full_name || (task.created_by_name ? `${task.created_by_name} (удалён)` : 'Неизвестен');

  const handleTakeToWork = () => {
    if (canAssigneeChangeStatus && task.status === 'new') {
      updateStatusMutation.mutate({ id: task.id, status: 'in_progress' });
    }
  };

  const handleSendToReview = () => {
    if (canAssigneeChangeStatus && task.status === 'in_progress') {
      updateStatusMutation.mutate({ id: task.id, status: 'in_review' });
    }
  };

  const handleComplete = () => {
    if (canManagerChangeReviewStatus) {
      updateStatusMutation.mutate({ id: task.id, status: 'completed' });
    }
  };

  const handleSendToRework = () => {
    if (canManagerChangeReviewStatus) {
      updateStatusMutation.mutate({ id: task.id, status: 'in_progress' });
    }
  };

  const handleArchive = () => {
    if (window.confirm('Архивировать эту задачу?')) {
      archiveMutation.mutate(task.id);
    }
  };

  const handleRestore = () => {
    if (window.confirm('Восстановить эту задачу из архива? Она вернётся в тот статус, в котором была до архивации.')) {
      restoreMutation.mutate(task.id);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Удалить эту задачу навсегда? Это действие необратимо.')) {
      deleteMutation.mutate(task.id);
    }
  };

  const getShortDescription = (description, maxLength = 60) => {
    if (!description) return '';
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  };

  const handleDragStart = (e) => {
    if (!draggable || isArchived) return;
    
    if (!canChangeStatus) {
      e.preventDefault();
      if (task.status === 'in_review' && isAssignee) {
        toast.error('Только руководитель может изменять статус задачи на проверке');
      } else if (task.status === 'new' || task.status === 'in_progress') {
        if (!isAssignee) {
          toast.error('Только исполнитель может изменять статус задачи в работе');
        } else {
          toast.error('У вас нет прав для изменения статуса этой задачи');
        }
      } else {
        toast.error('У вас нет прав для изменения статуса этой задачи');
      }
      return;
    }
    
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('currentStatus', task.status);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(e);
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow p-3 hover:shadow-md transition-shadow ${isArchived ? 'opacity-75 bg-gray-50' : ''} ${draggable && !isArchived && canChangeStatus ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={draggable && !isArchived && canChangeStatus}
      onDragStart={handleDragStart}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 text-sm">
              {task.title}
            </h3>
            <span className={`px-2 py-0.5 text-xs rounded-full ${getPriorityColor(task.priority)}`}>
              {getPriorityText(task.priority)}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(task.status)}`}>
              {getStatusText(task.status)}
            </span>
            {isOverdue && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                Просрочена
              </span>
            )}
          </div>
          
          {task.description && (
            <p className="text-xs text-gray-500 mt-1">
              {getShortDescription(task.description)}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <div className="flex items-center">
              <UserIcon className="h-3 w-3 mr-1" />
              <span>{assigneeName}</span>
            </div>
            {task.deadline ? (
              <div className={`flex items-center ${isOverdue ? 'text-red-600' : ''}`}>
                <CalendarIcon className="h-3 w-3 mr-1" />
                <span>{format(new Date(task.deadline), 'dd.MM.yyyy HH:mm')}</span>
              </div>
            ) : (
              <div className="flex items-center text-gray-400">
                <CalendarIcon className="h-3 w-3 mr-1" />
                <span>Без срока</span>
              </div>
            )}
            {task.assignee_group_name && (
              <div className="flex items-center text-gray-400">
                <BuildingOfficeIcon className="h-3 w-3 mr-1" />
                <span>{task.assignee_group_name}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {task.description && (
            <p className="text-sm text-gray-600 mb-3">{task.description}</p>
          )}
          
          <div className="space-y-1 text-sm text-gray-500 mb-3">
            <div className="flex items-center">
              <UserIcon className="h-4 w-4 mr-2" />
              <span>Создатель: {creatorName}</span>
            </div>
            {task.deadline && (
              <div className={`flex items-center ${isOverdue ? 'text-red-600' : ''}`}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                <span>Срок: {format(new Date(task.deadline), 'dd MMM yyyy HH:mm')}</span>
                {isOverdue && <span className="ml-2 text-red-600 font-medium">(Просрочена)</span>}
              </div>
            )}
            {task.delegation_reason && (
              <div className="text-xs text-gray-400 mt-1">
                Причина делегирования: {task.delegation_reason}
              </div>
            )}
          </div>

          {!isArchived && (
            <>
              {canAssigneeChangeStatus && (
                <div className="mt-3 space-y-2">
                  {task.status === 'new' && (
                    <button
                      onClick={handleTakeToWork}
                      disabled={updateStatusMutation.isLoading}
                      className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                    >
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Взять в работу
                    </button>
                  )}
                  
                  {task.status === 'in_progress' && (
                    <button
                      onClick={handleSendToReview}
                      disabled={updateStatusMutation.isLoading}
                      className="w-full flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 text-sm"
                    >
                      <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                      Отправить на проверку
                    </button>
                  )}
                </div>
              )}

              {canManagerChangeReviewStatus && (
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleComplete}
                    disabled={updateStatusMutation.isLoading}
                    className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Завершить работу
                  </button>
                  
                  <button
                    onClick={handleSendToRework}
                    disabled={updateStatusMutation.isLoading}
                    className="w-full flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
                  >
                    <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                    Отправить на доработку
                  </button>
                </div>
              )}
            </>
          )}

          <div className="mt-3 flex space-x-3 flex-wrap gap-2">
            <button
              onClick={() => setShowComments(!showComments)}
              className="flex items-center text-xs text-gray-600 hover:text-blue-600"
            >
              <ChatBubbleLeftIcon className="h-3 w-3 mr-1" />
              Комментарии ({task.comments?.length || 0})
            </button>
            
            {!isArchived && canManage && task.status !== 'archived' && (
              <button
                onClick={() => setShowDelegate(true)}
                className="flex items-center text-xs text-gray-600 hover:text-green-600"
              >
                <UserPlusIcon className="h-3 w-3 mr-1" />
                Делегировать
              </button>
            )}
            
            {canArchive && (
              <button
                onClick={handleArchive}
                disabled={archiveMutation.isLoading}
                className="flex items-center text-xs text-yellow-600 hover:text-yellow-800"
              >
                <ArchiveBoxIcon className="h-3 w-3 mr-1" />
                Архив
              </button>
            )}
            
            {isArchived && canManage && (
              <button
                onClick={handleRestore}
                disabled={restoreMutation.isLoading}
                className="flex items-center text-xs text-green-600 hover:text-green-800"
              >
                <ArrowPathIcon className="h-3 w-3 mr-1" />
                Восстановить
              </button>
            )}
            
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isLoading}
                className="flex items-center text-xs text-red-600 hover:text-red-800"
              >
                <TrashIcon className="h-3 w-3 mr-1" />
                Удалить
              </button>
            )}
          </div>

          {showComments && (
            <div className="mt-3 pt-3 border-t">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {task.comments?.map((comment) => (
                  <div key={comment.id} className="text-xs">
                    <span className="font-medium">
                      {comment.author_name || `Пользователь #${comment.author_id}`}
                      <span className="text-gray-400 ml-1">
                        ({comment.author_role === 'admin' ? 'Администратор' : 
                          comment.author_role === 'manager' ? 'Руководитель' : 
                          comment.author_role === 'deleted' ? 'Удалён' : 'Сотрудник'})
                      </span>:
                    </span>
                    <span className="text-gray-600 ml-1">{comment.content}</span>
                    <div className="text-gray-400 text-[10px] mt-0.5">
                      {format(new Date(comment.created_at), 'dd MMM, HH:mm')}
                    </div>
                  </div>
                ))}
                {(!task.comments || task.comments.length === 0) && (
                  <p className="text-xs text-gray-500">Нет комментариев</p>
                )}
              </div>
              <div className="mt-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Добавить комментарий..."
                  className="w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="2"
                />
                <button
                  onClick={() => addCommentMutation.mutate({ taskId: task.id, content: newComment })}
                  disabled={!newComment.trim()}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                >
                  Отправить
                </button>
              </div>
            </div>
          )}
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