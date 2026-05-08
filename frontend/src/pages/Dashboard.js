import React from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ClockIcon,
  ChartBarIcon
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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const Dashboard = () => {
  const { user, isAdmin, isManager } = useAuth();
  
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
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Панель управления</h1>
        <p className="text-gray-600">С возвращением, {user?.full_name}!</p>
      </div>

      {(isAdmin || isManager) && teamSummary && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-8">
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
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded mb-8">
          <p className="text-blue-700">
            Как администратор, у вас нет личных задач. Перейдите в раздел <strong>Аналитика</strong> для детальной статистики команды, или в <strong>Задачи</strong> для управления всеми задачами.
          </p>
        </div>
      )}

      {!isAdmin && analytics && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
        </>
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