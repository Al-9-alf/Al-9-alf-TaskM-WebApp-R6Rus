import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from 'react-query';
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
  ArrowPathIcon,
  ArchiveBoxIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const fetchTasks = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get('http://localhost:8000/api/tasks/?limit=100', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

const fetchArchivedTasks = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get('http://localhost:8000/api/tasks/archived?limit=200', {
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

const TaskBoard = () => {
  const [activeTab, setActiveTab] = useState('active');
  const [view, setView] = useState('kanban');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { isManager, isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
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

  const { data: tasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useQuery(
    'tasks', 
    fetchTasks,
    { 
      onError: (error) => {
        console.error('Error fetching tasks:', error);
        toast.error('Ошибка загрузки задач');
      }
    }
  );
  
  const { data: archivedTasks = [], isLoading: archivedLoading, refetch: refetchArchived } = useQuery(
    'archivedTasks', 
    fetchArchivedTasks,
    { 
      onError: (error) => {
        console.error('Error fetching archived tasks:', error);
        toast.error('Ошибка загрузки архива');
      }
    }
  );
  
  const isLoading = activeTab === 'active' ? tasksLoading : archivedLoading;
  
  const refetch = () => {
    refetchTasks();
    refetchArchived();
  };

  const updateStatusMutation = useMutation(updateTaskStatus, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      queryClient.invalidateQueries('archivedTasks');
      toast.success('Статус задачи обновлён');
    },
    onError: (error) => {
      toast.error('Ошибка обновления статуса: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    },
  });

  const currentData = activeTab === 'active' ? tasks : archivedTasks;
  
  const filteredTasks = useMemo(() => {
    let result = [...currentData];
    
    if (activeTab === 'active') {
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
    } else {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(task => 
          task.title.toLowerCase().includes(searchLower) ||
          (task.description && task.description.toLowerCase().includes(searchLower))
        );
      }
      if (filters.priority) {
        result = result.filter(task => task.priority === filters.priority);
      }
      if (filters.assigned_to) {
        result = result.filter(task => task.assigned_to === parseInt(filters.assigned_to));
      }
      if (filters.group_name) {
        const groupLower = filters.group_name.toLowerCase();
        result = result.filter(task => 
          task.assignee_group_name && 
          task.assignee_group_name.toLowerCase().includes(groupLower)
        );
      }
    }

    result.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [currentData, filters, activeTab]);

  const uniqueAssignees = useMemo(() => {
    const assigneesMap = new Map();
    tasks.forEach(task => {
      if (task.assignee && !assigneesMap.has(task.assignee.id)) {
        assigneesMap.set(task.assignee.id, task.assignee);
      }
    });
    archivedTasks.forEach(task => {
      if (task.assignee && !assigneesMap.has(task.assignee.id)) {
        assigneesMap.set(task.assignee.id, task.assignee);
      }
    });
    return Array.from(assigneesMap.values());
  }, [tasks, archivedTasks]);

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
    archivedTasks.forEach(task => {
      if (task.assignee_group_name) {
        groupsSet.add(task.assignee_group_name);
      }
    });
    return Array.from(groupsSet);
  }, [tasks, archivedTasks]);

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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetFilters();
    if (tab === 'archived') {
      setView('list');
    } else {
      setView('kanban');
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
    
    // Исполнитель может перетаскивать только свои задачи в статусе "Новая" или "В работе"
    if (isAssignee && (task.status === 'new' || task.status === 'in_progress')) {
      return true;
    }
    
    // Руководитель/админ может перетаскивать только задачи в статусе "На проверке"
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
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const isAssignee = task.assigned_to === user?.id;
    const isManagerOrAdmin = isAdmin || isManager;
    
    let newStatus = null;
    let errorMessage = null;
    
    // Логика для исполнителя
    if (isAssignee && (currentStatus === 'new' || currentStatus === 'in_progress')) {
      if (currentStatus === 'new' && targetStatus === 'in_progress') {
        newStatus = 'in_progress';
      } else if (currentStatus === 'in_progress' && targetStatus === 'in_review') {
        newStatus = 'in_review';
      } else {
        errorMessage = `Исполнитель может перемещать задачи только: Новая → В работе → На проверке`;
      }
    }
    // Логика для руководителя/админа (только задачи на проверке)
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
      refetch();
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
          <h1 className="text-2xl font-bold text-gray-900">Доска задач</h1>
          <p className="text-gray-600">
            {activeTab === 'active' 
              ? `Активных задач: ${filteredTasks.length} из ${tasks.length}`
              : `Архивных задач: ${filteredTasks.length} из ${archivedTasks.length}`
            }
            {filteredTasks.length !== currentData.length && ' (отфильтровано)'}
          </p>
        </div>
        <div className="flex space-x-3">
          <div className="flex space-x-2 border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              disabled={activeTab === 'archived'}
              className={`p-2 ${view === 'kanban' && activeTab === 'active' ? 'bg-blue-600 text-white' : 
                activeTab === 'archived' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-600'}`}
              title={activeTab === 'archived' ? 'Канбан недоступен для архива' : 'Канбан'}
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
          {isManager && activeTab === 'active' && (
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

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => handleTabChange('active')}
            className={`pb-4 px-1 flex items-center space-x-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardDocumentListIcon className="h-5 w-5" />
            <span>Активные задачи</span>
            <span className="ml-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {tasks.length}
            </span>
          </button>
          <button
            onClick={() => handleTabChange('archived')}
            className={`pb-4 px-1 flex items-center space-x-2 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'archived'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ArchiveBoxIcon className="h-5 w-5" />
            <span>Архив</span>
            <span className="ml-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {archivedTasks.length}
            </span>
          </button>
        </nav>
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
            
            {activeTab === 'active' && (
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
            )}

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
              onClick={refetch}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
              title="Обновить"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
          </div>

          {activeTab === 'active' && showFilters && (
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

      {activeTab === 'active' && view === 'kanban' && (
        <>
          {filteredTasks.length === 0 && tasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет задач</h3>
              <p className="text-gray-500 mb-4">Создайте свою первую задачу</p>
              {isManager && (
                <button
                  onClick={() => setShowTaskForm(true)}
                  className="btn-primary inline-flex items-center"
                >
                  <PlusIcon className="h-5 w-5 mr-1" />
                  Создать задачу
                </button>
              )}
            </div>
          ) : filteredTasks.length === 0 && tasks.length > 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FunnelIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Нет задач, соответствующих фильтрам</p>
              <button
                onClick={resetFilters}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {Object.entries(columns).map(([key, column]) => (
                <div 
                  key={key}
                  className="bg-gray-100 rounded-lg p-4 transition-all"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, key, column.title)}
                >
                  <h2 className="font-semibold text-lg mb-3">
                    {column.title}
                    <span className="ml-2 text-sm text-gray-500">({column.tasks.length})</span>
                  </h2>
                  <div className="space-y-3">
                    {column.tasks.map(task => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        onUpdate={refetch}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, task)}
                      />
                    ))}
                    {column.tasks.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-300 rounded-lg">
                        Перетащите задачу сюда
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'active' && view === 'list' && (
        <>
          {filteredTasks.length === 0 && tasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет задач</h3>
              <p className="text-gray-500 mb-4">Создайте свою первую задачу</p>
              {isManager && (
                <button
                  onClick={() => setShowTaskForm(true)}
                  className="btn-primary inline-flex items-center"
                >
                  <PlusIcon className="h-5 w-5 mr-1" />
                  Создать задачу
                </button>
              )}
            </div>
          ) : filteredTasks.length === 0 && tasks.length > 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FunnelIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Нет задач, соответствующих фильтрам</p>
              <button
                onClick={resetFilters}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} onUpdate={refetch} draggable={false} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'active' && view === 'table' && (
        <>
          {filteredTasks.length === 0 && tasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Нет задач</h3>
              <p className="text-gray-500 mb-4">Создайте свою первую задачу</p>
              {isManager && (
                <button
                  onClick={() => setShowTaskForm(true)}
                  className="btn-primary inline-flex items-center"
                >
                  <PlusIcon className="h-5 w-5 mr-1" />
                  Создать задачу
                </button>
              )}
            </div>
          ) : filteredTasks.length === 0 && tasks.length > 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FunnelIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Нет задач, соответствующих фильтрам</p>
              <button
                onClick={resetFilters}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
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
                  {filteredTasks.map(task => {
                    const isOverdue = task.deadline && new Date(task.deadline) < new Date();
                    return (
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
                            <span className={isOverdue && task.status !== 'completed' ? 'text-red-600 font-medium' : 'text-gray-500'}>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'archived' && view === 'list' && (
        <>
          {filteredTasks.length === 0 && archivedTasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ArchiveBoxIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Архив пуст</h3>
              <p className="text-gray-500">Завершённые задачи можно отправить в архив</p>
            </div>
          ) : filteredTasks.length === 0 && archivedTasks.length > 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FunnelIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Нет задач, соответствующих фильтрам</p>
              <button
                onClick={resetFilters}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onRestore={() => {
                    refetchTasks();
                    refetchArchived();
                  }}
                  onUpdate={() => {
                    refetchTasks();
                    refetchArchived();
                  }}
                  draggable={false}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'archived' && view === 'table' && (
        <>
          {filteredTasks.length === 0 && archivedTasks.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <ArchiveBoxIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Архив пуст</h3>
              <p className="text-gray-500">Завершённые задачи можно отправить в архив</p>
            </div>
          ) : filteredTasks.length === 0 && archivedTasks.length > 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <FunnelIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Нет задач, соответствующих фильтрам</p>
              <button
                onClick={resetFilters}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Название</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Приоритет</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Исполнитель</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Группа</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Архивирована</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {task.title}
                        {task.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                        )}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.updated_at ? new Date(task.updated_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={async () => {
                            if (window.confirm('Восстановить эту задачу из архива?')) {
                              try {
                                const token = localStorage.getItem('token');
                                await axios.post(`http://localhost:8000/api/tasks/${task.id}/restore`, {}, {
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                refetchTasks();
                                refetchArchived();
                                toast.success('Задача восстановлена');
                              } catch (error) {
                                toast.error('Ошибка восстановления: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
                              }
                            }
                          }}
                          className="text-green-600 hover:text-green-800"
                        >
                          Восстановить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showTaskForm && <TaskForm onClose={() => setShowTaskForm(false)} />}
    </div>
  );
};

export default TaskBoard;