import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import TaskCard from '../components/TaskCard';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ClockIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import toast from 'react-hot-toast';

const fetchMyAnalytics = async () => {
  const token = localStorage.getItem('token');
  try {
    const response = await axios.get('http://localhost:8000/api/analytics/my/overview', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching my analytics:', error);
    return {
      completion_rate: 0,
      overdue_tasks: 0,
      active_tasks: 0,
      tasks_by_status: {},
      avg_completion_time: null
    };
  }
};

const fetchTeamSummary = async () => {
  const token = localStorage.getItem('token');
  try {
    const response = await axios.get('http://localhost:8000/api/analytics/team/summary', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching team summary:', error);
    return {
      avg_completion_rate: 0,
      total_overdue_tasks: 0,
      total_active_tasks: 0
    };
  }
};

const fetchMyAssignedTasks = async () => {
  const token = localStorage.getItem('token');
  try {
    const response = await axios.get('http://localhost:8000/api/tasks/?limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    return [];
  }
};

const updateTaskStatus = async ({ id, status }) => {
  const token = localStorage.getItem('token');
  const response = await axios.post(`http://localhost:8000/api/tasks/${id}/status`, null, {
    params: { status },
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const Dashboard = () => {
  const { user, isAdmin, isManager } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: analytics, isLoading: analyticsLoading } = useQuery(
    'myAnalytics', 
    fetchMyAnalytics, 
    { 
      enabled: !isAdmin,
      retry: 1,
      onError: (error) => {
        console.error('Analytics query error:', error);
      }
    }
  );

  const { data: teamSummary, isLoading: teamLoading } = useQuery(
    'teamSummary', 
    fetchTeamSummary, 
    {
      enabled: isAdmin || isManager,
      retry: 1,
      onError: (error) => {
        console.error('Team summary query error:', error);
      }
    }
  );

  const { data: allTasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery(
    'myDashboardTasks',
    fetchMyAssignedTasks,
    {
      enabled: !isAdmin,
      retry: 1,
      onError: (error) => {
        console.error('Tasks fetch error:', error);
      }
    }
  );

  const updateStatusMutation = useMutation(updateTaskStatus, {
    onSuccess: () => {
      queryClient.invalidateQueries('myDashboardTasks');
      queryClient.invalidateQueries('myAnalytics');
      toast.success('Статус задачи обновлён');
    },
    onError: (error) => {
      toast.error('Ошибка обновления статуса: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    },
  });

  const refreshData = () => {
    refetchTasks();
    queryClient.invalidateQueries('myAnalytics');
    if (isAdmin || isManager) {
      queryClient.invalidateQueries('teamSummary');
    }
  };

  const myAssignedTasks = allTasks.filter(task => 
    task.assigned_to === user?.id && 
    task.status !== 'completed' && 
    task.status !== 'archived'
  );

  const columns = {
    new: { 
      title: 'Новые', 
      tasks: myAssignedTasks.filter(t => t.status === 'new'),
      bgColor: 'bg-gray-100'
    },
    in_progress: { 
      title: 'В работе', 
      tasks: myAssignedTasks.filter(t => t.status === 'in_progress'),
      bgColor: 'bg-blue-50'
    },
    in_review: { 
      title: 'На проверке', 
      tasks: myAssignedTasks.filter(t => t.status === 'in_review'),
      bgColor: 'bg-yellow-50'
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

  const canDragTask = (task) => {
    const isAssignee = task.assigned_to === user?.id;
    const isManagerOrAdmin = isAdmin || isManager;
    
    if (isAssignee && (task.status === 'new' || task.status === 'in_progress')) {
      return true;
    }
    
    if (isManagerOrAdmin && task.status === 'in_review') {
      return true;
    }
    
    return false;
  };

  const handleDragStart = (e, task) => {
    if (!canDragTask(task)) {
      e.preventDefault();
      if (task.status === 'in_review' && task.assigned_to === user?.id) {
        toast.error('Только руководитель может изменять статус задачи на проверке');
      } else if ((task.status === 'new' || task.status === 'in_progress') && task.assigned_to !== user?.id) {
        toast.error('Только исполнитель может изменять статус этой задачи');
      } else {
        toast.error('У вас нет прав для изменения статуса этой задачи');
      }
      return;
    }
    
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.setData('currentStatus', task.status);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus, targetTitle) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData('taskId'));
    const currentStatus = e.dataTransfer.getData('currentStatus');
    
    const task = myAssignedTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const isAssignee = task.assigned_to === user?.id;
    const isManagerOrAdmin = isAdmin || isManager;
    
    let newStatus = null;
    let errorMessage = null;
    
    if (isAssignee && (currentStatus === 'new' || currentStatus === 'in_progress')) {
      if (currentStatus === 'new' && targetStatus === 'in_progress') {
        newStatus = 'in_progress';
      } else if (currentStatus === 'in_progress' && targetStatus === 'in_review') {
        newStatus = 'in_review';
      } else {
        errorMessage = `Исполнитель может перемещать задачи только: Новая → В работе → На проверке`;
      }
    }
    else if (isManagerOrAdmin && currentStatus === 'in_review') {
      if (targetStatus === 'in_progress') {
        newStatus = 'in_progress';
      } else if (targetStatus === 'completed') {
        newStatus = 'completed';
      } else {
        errorMessage = `Руководитель может перемещать задачи только: На проверке → В работе (доработка) или На проверке → Завершена`;
      }
    } else {
      if (currentStatus === 'in_review' && isAssignee) {
        errorMessage = 'Только руководитель может изменять статус задачи на проверке';
      } else if ((currentStatus === 'new' || currentStatus === 'in_progress') && !isAssignee) {
        errorMessage = 'Только исполнитель может изменять статус этой задачи';
      } else {
        errorMessage = `Невозможно переместить задачу из "${getStatusText(currentStatus)}" в "${targetTitle}"`;
      }
    }
    
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    
    if (newStatus && newStatus !== currentStatus) {
      await updateStatusMutation.mutateAsync({ id: taskId, status: newStatus });
      refreshData();
    }
  };

  if ((analyticsLoading && !isAdmin) || (teamLoading && (isAdmin || isManager))) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const getCompletionRateColor = (rate) => {
    if (rate >= 80) return 'text-green-600';
    if (rate >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const pieData = analytics?.tasks_by_status
    ? Object.entries(analytics.tasks_by_status)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ 
          name: name === 'new' ? 'Новые' :
                name === 'in_progress' ? 'В работе' :
                name === 'in_review' ? 'На проверке' :
                name === 'completed' ? 'Завершённые' : name, 
          value 
        }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Панель управления</h1>
          <p className="text-gray-600">С возвращением, {user?.full_name}!</p>
        </div>
        <button
          onClick={refreshData}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          title="Обновить данные"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Обновить
        </button>
      </div>

      {(isAdmin || isManager) && teamSummary && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Средняя эффективность команды</dt>
                    <dd className={`text-lg font-semibold ${getCompletionRateColor(teamSummary.avg_completion_rate)}`}>
                      {Math.round(teamSummary.avg_completion_rate)}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                  <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Всего просроченных задач</dt>
                    <dd className="text-lg font-semibold text-red-600">
                      {teamSummary.total_overdue_tasks}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                  <ClockIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Всего активных задач</dt>
                    <dd className="text-lg font-semibold text-blue-600">
                      {teamSummary.total_active_tasks}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <p className="text-blue-700">
            Как администратор, у вас нет личных задач. Перейдите в раздел <strong>Аналитика</strong> для детальной статистики команды.
          </p>
        </div>
      )}

      {!isAdmin && analytics && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                  <ChartBarIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Эффективность</dt>
                    <dd className={`text-lg font-semibold ${getCompletionRateColor(analytics.completion_rate)}`}>
                      {Math.round(analytics.completion_rate)}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                  <ClockIcon className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Активных задач</dt>
                    <dd className="text-lg font-semibold text-yellow-600">
                      {analytics.active_tasks}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                  <ExclamationCircleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Просроченных задач</dt>
                    <dd className="text-lg font-semibold text-red-600">
                      {analytics.overdue_tasks}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Завершённых задач</dt>
                    <dd className="text-lg font-semibold text-green-600">
                      {analytics.tasks_by_status?.completed || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold flex items-center">
                  <ClipboardDocumentListIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Мои задачи
                </h2>
                <p className="text-sm text-gray-500">
                  Задачи, назначенные на меня ({myAssignedTasks.length})
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  💡 Перетаскивайте задачи между колонками для изменения статуса
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {tasksLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : myAssignedTasks.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg">Нет назначенных задач</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(columns).map(([key, column]) => (
                  <div 
                    key={key}
                    className={`${column.bgColor} rounded-lg p-4 min-h-[400px] transition-all`}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, key, column.title)}
                  >
                    <div className="flex justify-between items-center mb-3 px-2">
                      <h3 className="font-semibold text-gray-900">
                        {column.title}
                      </h3>
                      <span className="bg-white rounded-full px-2 py-0.5 text-xs font-medium text-gray-600">
                        {column.tasks.length}
                      </span>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {column.tasks.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm bg-white bg-opacity-50 rounded-lg border-2 border-dashed border-gray-300">
                          Перетащите задачу сюда
                        </div>
                      ) : (
                        column.tasks.map(task => (
                          <TaskCard 
                            key={task.id} 
                            task={task} 
                            onUpdate={refreshData}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, task)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!isAdmin && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Задачи по статусам</h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-64 text-gray-500">
                Нет данных о задачах
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Метрики эффективности</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Своевременное выполнение</span>
                  <span className={`text-sm font-medium ${getCompletionRateColor(analytics.completion_rate)}`}>
                    {Math.round(analytics.completion_rate)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      analytics.completion_rate >= 80 ? 'bg-green-600' :
                      analytics.completion_rate >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${analytics.completion_rate}%` }}
                  ></div>
                </div>
              </div>
              
              {analytics.avg_completion_time && (
                <div className="border-t pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Среднее время выполнения</span>
                    <span className="text-sm font-medium text-gray-900">
                      {Math.round(analytics.avg_completion_time)} часов
                    </span>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Быстрая статистика</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="text-2xl font-bold text-blue-600">{analytics.active_tasks}</div>
                    <div className="text-xs text-gray-500">Активных задач</div>
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <div className="text-2xl font-bold text-red-600">{analytics.overdue_tasks}</div>
                    <div className="text-xs text-gray-500">Просроченных задач</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && !analytics && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          <p className="text-yellow-700">
            Нет данных для аналитики. Начните работать над задачами, чтобы увидеть свою эффективность.
          </p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;