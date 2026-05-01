import React, { useState } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { XMarkIcon } from '@heroicons/react/24/outline';

const fetchMyAnalytics = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get('http://localhost:8000/api/analytics/my/overview', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const fetchTeamOverview = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get('http://localhost:8000/api/analytics/team/overview', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const fetchTeamSummary = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get('http://localhost:8000/api/analytics/team/summary', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const fetchRanking = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get('http://localhost:8000/api/analytics/team/ranking', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const fetchUserDetail = async (userId) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(`http://localhost:8000/api/analytics/team/user/${userId}/overview`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const AnalyticsPage = () => {
  const { isManager, isAdmin } = useAuth();
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  
  const { data: myAnalytics, isLoading: myLoading } = useQuery('myAnalytics', fetchMyAnalytics, {
    enabled: !isAdmin,
  });
  
  const { data: teamOverview = [], isLoading: overviewLoading } = useQuery('teamOverview', fetchTeamOverview, {
    enabled: isManager || isAdmin,
  });
  const { data: teamSummary } = useQuery('teamSummary', fetchTeamSummary, {
    enabled: isManager || isAdmin,
  });
  const { data: ranking = [] } = useQuery('ranking', fetchRanking, {
    enabled: isManager || isAdmin,
  });

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    try {
      const detail = await fetchUserDetail(user.user_id);
      setUserDetail(detail);
    } catch (error) {
      console.error('Error fetching user detail:', error);
    }
  };

  if (!isManager && !isAdmin) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <p className="text-yellow-700">
          У вас нет прав для просмотра аналитики. Только руководители и администраторы могут просматривать эту страницу.
        </p>
      </div>
    );
  }

  if (overviewLoading || myLoading) {
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

  const getBarColor = (rate) => {
    if (rate >= 80) return '#10B981';
    if (rate >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
        <p className="text-gray-600">Метрики эффективности и аналитика</p>
      </div>

      {teamSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Средняя эффективность команды</h3>
            <p className={`text-2xl font-bold ${getCompletionRateColor(teamSummary.avg_completion_rate)}`}>
              {Math.round(teamSummary.avg_completion_rate)}%
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Всего просроченных задач</h3>
            <p className="text-2xl font-bold text-red-600">
              {teamSummary.total_overdue_tasks}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Всего активных задач</h3>
            <p className="text-2xl font-bold text-blue-600">
              {teamSummary.total_active_tasks}
            </p>
          </div>
        </div>
      )}

      {!isAdmin && myAnalytics && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Моя эффективность</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">Эффективность</div>
              <div className={`text-2xl font-bold ${getCompletionRateColor(myAnalytics.completion_rate)}`}>
                {Math.round(myAnalytics.completion_rate)}%
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">Активных задач</div>
              <div className="text-2xl font-bold text-blue-600">{myAnalytics.active_tasks}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">Просроченных задач</div>
              <div className="text-2xl font-bold text-red-600">{myAnalytics.overdue_tasks}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded">
              <div className="text-sm text-gray-500">Среднее время выполнения</div>
              <div className="text-2xl font-bold text-gray-600">
                {myAnalytics.avg_completion_time ? `${Math.round(myAnalytics.avg_completion_time)}ч` : 'Н/Д'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Эффективность команды</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сотрудник
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Эффективность
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Просрочено
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Активных задач
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Среднее время
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teamOverview.map((member) => (
                <tr
                  key={member.user_id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleUserClick(member)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {member.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${
                            member.completion_rate >= 80 ? 'bg-green-600' :
                            member.completion_rate >= 50 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${member.completion_rate}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-medium ${getCompletionRateColor(member.completion_rate)}`}>
                        {Math.round(member.completion_rate)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                    {member.overdue_tasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {member.active_tasks}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.avg_completion_time
                      ? `${Math.round(member.avg_completion_time)}ч`
                      : 'Н/Д'}
                  </td>
                </tr>
              ))}
              {teamOverview.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    Нет данных о членах команды
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">🏆 Рейтинг сотрудников</h2>
            <p className="text-xs text-gray-500">Основан на своевременном выполнении задач</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {ranking.slice(0, 5).map((member, index) => (
                <div key={member.user_id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      index === 2 ? 'bg-orange-400 text-orange-900' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="ml-3 text-gray-900 font-medium">{member.full_name}</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{ width: `${member.completion_rate}%` }}
                      ></div>
                    </div>
                    <span className={`text-sm font-medium ${getCompletionRateColor(member.completion_rate)}`}>
                      {Math.round(member.completion_rate)}%
                    </span>
                  </div>
                </div>
              ))}
              {ranking.length === 0 && (
                <p className="text-center text-gray-500 py-4">Нет данных для рейтинга</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">📊 Распределение нагрузки</h2>
            <p className="text-xs text-gray-500">Активные задачи по членам команды</p>
          </div>
          <div className="p-6">
            {teamOverview.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={teamOverview} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="full_name" />
                  <Tooltip />
                  <Bar dataKey="active_tasks" fill="#3B82F6" name="Активных задач">
                    {teamOverview.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.completion_rate)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex justify-center items-center h-64 text-gray-500">
                Нет данных о нагрузке
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedUser && userDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{selectedUser.full_name} - Детали</h2>
              <button onClick={() => setSelectedUser(null)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-500">Эффективность</div>
                  <div className={`text-2xl font-bold ${getCompletionRateColor(userDetail.completion_rate)}`}>
                    {Math.round(userDetail.completion_rate)}%
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-500">Активных задач</div>
                  <div className="text-2xl font-bold text-blue-600">{userDetail.active_tasks}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-500">Просроченных задач</div>
                  <div className="text-2xl font-bold text-red-600">{userDetail.overdue_tasks}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-500">Среднее время выполнения</div>
                  <div className="text-2xl font-bold text-gray-600">
                    {userDetail.avg_completion_time ? `${Math.round(userDetail.avg_completion_time)}ч` : 'Н/Д'}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Задачи по статусам</h3>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(userDetail.tasks_by_status || {}).map(([status, count]) => (
                    <div key={status} className="bg-gray-50 p-2 rounded text-center">
                      <div className="text-lg font-bold">{count}</div>
                      <div className="text-xs text-gray-500">
                        {status === 'new' ? 'Новые' :
                         status === 'in_progress' ? 'В работе' :
                         status === 'in_review' ? 'На проверке' :
                         status === 'completed' ? 'Завершённые' : status}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;