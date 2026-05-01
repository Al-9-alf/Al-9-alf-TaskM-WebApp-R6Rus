import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import TaskCard from './TaskCard';
import TaskForm from './TaskForm';
import { PlusIcon, ViewColumnsIcon, ListBulletIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const fetchTasks = async () => {
  const response = await axios.get('http://localhost:8000/api/tasks/?limit=100');
  return response.data;
};

const updateTaskStatus = async ({ id, status }) => {
  const response = await axios.post(`http://localhost:8000/api/tasks/${id}/status`, null, {
    params: { status }
  });
  return response.data;
};

const TaskBoard = () => {
  const [view, setView] = useState('kanban');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const { isManager, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery('tasks', fetchTasks);

  const updateStatusMutation = useMutation(updateTaskStatus, {
    onSuccess: () => {
      queryClient.invalidateQueries('tasks');
      toast.success('Статус задачи обновлён');
    },
  });

  const handleStatusChange = (taskId, newStatus) => {
    updateStatusMutation.mutate({ id: taskId, status: newStatus });
  };

  const columns = {
    new: { title: 'Новые', tasks: tasks.filter(t => t.status === 'new') },
    in_progress: { title: 'В работе', tasks: tasks.filter(t => t.status === 'in_progress') },
    in_review: { title: 'На проверке', tasks: tasks.filter(t => t.status === 'in_review') },
    completed: { title: 'Завершённые', tasks: tasks.filter(t => t.status === 'completed') },
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
          <p className="text-gray-600">Управляйте и отслеживайте свои задачи</p>
        </div>
        <div className="flex space-x-3">
          <div className="flex space-x-2 border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={`p-2 ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <ViewColumnsIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
            >
              <ListBulletIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-2 ${view === 'table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
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

      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(columns).map(([key, column]) => (
            <div key={key} className="bg-gray-100 rounded-lg p-4">
              <h2 className="font-semibold text-lg mb-3">
                {column.title}
                <span className="ml-2 text-sm text-gray-500">({column.tasks.length})</span>
              </h2>
              <div className="space-y-3">
                {column.tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} />
          ))}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Срок</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map(task => (
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(task.deadline).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTaskForm && <TaskForm onClose={() => setShowTaskForm(false)} />}
    </div>
  );
};

export default TaskBoard;