import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { 
  PlusIcon, 
  ViewColumnsIcon, 
  ListBulletIcon, 
  TableCellsIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

const fetchTasks = async () => {
  const response = await axios.get('http://localhost:8000/api/tasks/?limit=100');
  return response.data;
};

const TaskBoard = () => {
  const [view, setView] = useState('kanban');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { isManager, user } = useAuth();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    assigned_to: '',
    created_by: '',
    group_name: '',
    hasDeadline: '',
    isOverdue: '',
  });

  const { data: tasks = [], isLoading, refetch } = useQuery('tasks', fetchTasks);
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(task => 
        task.title.toLowerCase().includes(searchLower) ||
        (task.description && task.description.toLowerCase().includes(searchLower))
      );
    }

    if (filters.status) {
      result = result.filter(task => task.status === filters.status);
    }
    if (filters.priority) {
      result = result.filter(task => task.priority === filters.priority);
    }
    if (filters.assigned_to) {
      result = result.filter(task => task.assigned_to === parseInt(filters.assigned_to));
    }

    if (filters.created_by) {
      result = result.filter(task => task.created_by === parseInt(filters.created_by));
    }

    if (filters.group_name) {
      const groupLower = filters.group_name.toLowerCase();
      result = result.filter(task => 
        task.assignee_group_name && 
        task.assignee_group_name.toLowerCase().includes(groupLower)
      );
    }

    if (filters.hasDeadline === 'with') {
      result = result.filter(task => task.deadline !== null);
    } else if (filters.hasDeadline === 'without') {
      result = result.filter(task => task.deadline === null);
    }

    if (filters.isOverdue === 'yes') {
      const now = new Date();
      result = result.filter(task => 
        task.deadline && 
        new Date(task.deadline) < now && 
        task.status !== 'completed' && 
        task.status !== 'archived'
      );
    } else if (filters.isOverdue === 'no') {
      const now = new Date();
      result = result.filter(task => 
        !task.deadline || 
        new Date(task.deadline) >= now || 
        task.status === 'completed' || 
        task.status === 'archived'
      );
    }

    result.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [tasks, filters]);

  const uniqueAssignees = useMemo(() => {
    const assigneesMap = new Map();
    tasks.forEach(task => {
      if (task.assignee && !assigneesMap.has(task.assignee.id)) {
        assigneesMap.set(task.assignee.id, task.assignee);
      }
    });
    return Array.from(assigneesMap.values());
  }, [tasks]);

  const uniqueCreators = useMemo(() => {
    const creatorsMap = new Map();
    tasks.forEach(task => {
      if (task.creator && !creatorsMap.has(task.creator.id)) {
        creatorsMap.set(task.creator.id, task.creator);
      }
    });
    return Array.from(creatorsMap.values());
  }, [tasks]);

  const uniqueGroups = useMemo(() => {
    const groupsSet = new Set();
    tasks.forEach(task => {
      if (task.assignee_group_name) {
        groupsSet.add(task.assignee_group_name);
      }
    });
    return Array.from(groupsSet);
  }, [tasks]);

  const columns = {
    new: { title: 'Новые', tasks: filteredTasks.filter(t => t.status === 'new') },
    in_progress: { title: 'В работе', tasks: filteredTasks.filter(t => t.status === 'in_progress') },
    in_review: { title: 'На проверке', tasks: filteredTasks.filter(t => t.status === 'in_review') },
    completed: { title: 'Завершённые', tasks: filteredTasks.filter(t => t.status === 'completed') },
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      status: '',
      priority: '',
      assigned_to: '',
      created_by: '',
      group_name: '',
      hasDeadline: '',
      isOverdue: '',
    });
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    return value !== '';
  }).length;

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
          <h1 className="text-2xl font-bold text-gray-900">Доска задач</h1>
          <p className="text-gray-600">
            Всего задач: {filteredTasks.length} из {tasks.length}
            {filteredTasks.length !== tasks.length && ' (отфильтровано)'}
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="flex space-x-2 border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={`p-2 ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
              title="Канбан"
            >
              <ViewColumnsIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
              title="Список"
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-2 ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
              title="Таблица"
            >
              <TableCellsIcon className="h-5 w-5" />
            </button>
          </div>
          {isManager && (
            <button
              onClick={() => setShowTaskForm(true)}
              className="btn-primary flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-1" />
              Создать задачу
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию или описанию..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-2 border rounded-lg transition-colors ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-5 w-5 mr-2" />
              Фильтры
              {activeFiltersCount > 0 && (
                <span className="ml-2 bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex items-center px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
              >
                <XMarkIcon className="h-4 w-4 mr-1" />
                Сбросить
              </button>
            )}

            <button
              onClick={() => refetch()}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="Обновить"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Статус</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все статусы</option>
                    <option value="new">Новые</option>
                    <option value="in_progress">В работе</option>
                    <option value="in_review">На проверке</option>
                    <option value="completed">Завершённые</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Приоритет</label>
                  <select
                    value={filters.priority}
                    onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все приоритеты</option>
                    <option value="high">Высокий</option>
                    <option value="medium">Средний</option>
                    <option value="low">Низкий</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Исполнитель</label>
                  <select
                    value={filters.assigned_to}
                    onChange={(e) => setFilters({ ...filters, assigned_to: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все исполнители</option>
                    {uniqueAssignees.map(assignee => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Создатель</label>
                  <select
                    value={filters.created_by}
                    onChange={(e) => setFilters({ ...filters, created_by: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все создатели</option>
                    {uniqueCreators.map(creator => (
                      <option key={creator.id} value={creator.id}>
                        {creator.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {uniqueGroups.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Группа</label>
                    <select
                      value={filters.group_name}
                      onChange={(e) => setFilters({ ...filters, group_name: e.target.value })}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Все группы</option>
                      {uniqueGroups.map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Срок выполнения</label>
                  <select
                    value={filters.hasDeadline}
                    onChange={(e) => setFilters({ ...filters, hasDeadline: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все задачи</option>
                    <option value="with">Со сроком</option>
                    <option value="without">Без срока</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Просрочка</label>
                  <select
                    value={filters.isOverdue}
                    onChange={(e) => setFilters({ ...filters, isOverdue: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Все</option>
                    <option value="yes">Просроченные</option>
                    <option value="no">Не просроченные</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <p className="text-sm text-blue-700">
          📋 Вы видите все задачи системы. Используйте поиск и фильтры для навигации.
          {activeFiltersCount > 0 && (
            <span className="font-medium">
              Применено фильтров: {activeFiltersCount}. Показано {filteredTasks.length} из {tasks.length} задач.
            </span>
          )}
        </p>
      </div>

      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {Object.entries(columns).map(([key, column]) => (
            <div key={key} className="bg-gray-100 rounded-lg p-4">
              <h2 className="font-semibold text-lg mb-3">
                {column.title}
                <span className="ml-2 text-sm text-gray-500">({column.tasks.length})</span>
              </h2>
              <div className="space-y-3">
                {column.tasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {column.tasks.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Нет задач
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-3">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FunnelIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Нет задач, соответствующих фильтрам</p>
              {activeFiltersCount > 0 && (
                <button
                  onClick={resetFilters}
                  className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'table' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Приоритет</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Исполнитель</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Группа</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Срок</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Создана</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTasks.length > 0 ? (
                filteredTasks.map(task => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        task.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {task.status === 'new' ? 'Новая' :
                         task.status === 'in_progress' ? 'В работе' :
                         task.status === 'in_review' ? 'На проверке' :
                         task.status === 'completed' ? 'Завершена' : task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority === 'high' ? 'Высокий' :
                         task.priority === 'medium' ? 'Средний' : 'Низкий'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.assignee?.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {task.assignee_group_name ? (
                        <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                          {task.assignee_group_name}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {task.deadline ? (
                        <span className={new Date(task.deadline) < new Date() && task.status !== 'completed' ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          {new Date(task.deadline).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">Без срока</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(task.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    <FunnelIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p>Нет задач, соответствующих фильтрам</p>
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={resetFilters}
                        className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Сбросить фильтры
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showTaskForm && <TaskForm onClose={() => setShowTaskForm(false)} />}
    </div>
  );
};

export default TaskBoard;