import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  UsersIcon, 
  UserPlusIcon, 
  TrashIcon, 
  PencilIcon,
  UserGroupIcon,
  UserMinusIcon,
  ArrowPathIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const fetchGroups = async () => {
  const response = await api.get('/api/groups/');
  return response.data;
};

const fetchMyGroup = async () => {
  try {
    const response = await api.get('/api/groups/my');
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

const fetchUsers = async () => {
  const response = await api.get('/api/users/list');
  return response.data;
};

const fetchGroupMembers = async (groupId) => {
  const response = await api.get(`/api/groups/${groupId}/members`);
  return response.data;
};

const createGroup = async (groupData) => {
  const response = await api.post('/api/groups/', groupData);
  return response.data;
};

const updateGroup = async ({ groupId, groupData }) => {
  const response = await api.put(`/api/groups/${groupId}`, groupData);
  return response.data;
};

const deleteGroup = async (groupId) => {
  await api.delete(`/api/groups/${groupId}`);
};

const addMember = async ({ groupId, userId }) => {
  await api.post(`/api/groups/${groupId}/members`, { user_id: userId });
};

const removeMember = async ({ groupId, userId }) => {
  await api.delete(`/api/groups/${groupId}/members`, {
    data: { user_id: userId }
  });
};

const GroupsPage = () => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leader_id: '',
  });
  const { user: currentUser, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: groups = [], isLoading: groupsLoading } = useQuery(
    'groups', 
    fetchGroups,
    { enabled: isAdmin, retry: 1 }
  );
  
  const { data: myGroup, isLoading: myGroupLoading } = useQuery(
    'myGroup',
    fetchMyGroup,
    { enabled: !isAdmin, retry: 1 }
  );

  const { data: users = [] } = useQuery('usersForGroups', fetchUsers, { enabled: isAdmin, retry: 1 });
  
  const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery(
    ['groupMembers', selectedGroup?.id],
    () => fetchGroupMembers(selectedGroup.id),
    { enabled: !!selectedGroup && isAdmin, retry: 1 }
  );

  const { data: myGroupMembers = [], isLoading: myGroupMembersLoading, refetch: refetchMyGroupMembers } = useQuery(
    ['myGroupMembers', myGroup?.id],
    () => myGroup ? fetchGroupMembers(myGroup.id) : Promise.resolve([]),
    { enabled: !!myGroup && !isAdmin, retry: 1 }
  );

  const createMutation = useMutation(createGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('groups');
      queryClient.invalidateQueries('usersForGroups');
      setShowCreateForm(false);
      setFormData({ name: '', description: '', leader_id: '' });
      toast.success('Группа успешно создана');
    },
    onError: (error) => {
      toast.error('Ошибка создания группы: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    },
  });

  const updateMutation = useMutation(updateGroup, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('groups');
      queryClient.invalidateQueries('usersForGroups');
      
      if (selectedGroup && selectedGroup.id === data.id) {
        setSelectedGroup(data);
      }
      
      if (selectedGroup) {
        refetchMembers();
      }
      
      setShowEditForm(null);
      toast.success('Группа обновлена');
    },
    onError: (error) => {
      toast.error('Ошибка обновления группы: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    },
  });

  const deleteMutation = useMutation(deleteGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('groups');
      queryClient.invalidateQueries('usersForGroups');
      if (selectedGroup) {
        setSelectedGroup(null);
      }
      toast.success('Группа удалена');
    },
    onError: (error) => {
      toast.error('Ошибка удаления группы: ' + (error.response?.data?.detail || 'Неизвестная ошибка'));
    },
  });

  const addMemberMutation = useMutation(addMember, {
    onSuccess: () => {
      queryClient.invalidateQueries(['groupMembers', selectedGroup?.id]);
      queryClient.invalidateQueries('groups');
      queryClient.invalidateQueries('usersForGroups');
      toast.success('Участник добавлен в группу');
    },
    onError: (error) => {
      const errorDetail = error.response?.data?.detail || 'Неизвестная ошибка';
      
      if (errorDetail.includes('уже состоит в другой группе')) {
        toast.error(
          'Невозможно добавить пользователя: он уже состоит в другой группе. ' +
          'Сначала удалите его из текущей группы.',
          { duration: 5000 }
        );
      } else if (errorDetail.includes('Нельзя добавить администратора')) {
        toast.error('Нельзя добавить администратора в группу');
      } else {
        toast.error('Ошибка: ' + errorDetail);
      }
    },
  });

  const removeMemberMutation = useMutation(removeMember, {
    onSuccess: () => {
      queryClient.invalidateQueries(['groupMembers', selectedGroup?.id]);
      queryClient.invalidateQueries('groups');
      queryClient.invalidateQueries('usersForGroups');
      toast.success('Участник удален из группы');
    },
    onError: (error) => {
      const errorDetail = error.response?.data?.detail || 'Неизвестная ошибка';
      
      if (errorDetail.includes('Нельзя удалить руководителя из группы')) {
        toast.error('Нельзя удалить руководителя из группы. Сначала назначьте нового руководителя.', { duration: 5000 });
      } else {
        toast.error('Ошибка: ' + errorDetail);
      }
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('Введите название группы');
      return;
    }
    if (!formData.leader_id) {
      toast.error('Выберите руководителя группы');
      return;
    }
    createMutation.mutate({
      name: formData.name,
      description: formData.description,
      leader_id: parseInt(formData.leader_id),
    });
  };

  const handleEdit = (e) => {
    e.preventDefault();
    const updateData = {
      name: formData.name,
      description: formData.description,
      leader_id: formData.leader_id ? parseInt(formData.leader_id) : null,
    };
    
    updateMutation.mutate({
      groupId: showEditForm.id,
      groupData: updateData,
    });
  };

  const openEditForm = (group) => {
    setFormData({
      name: group.name,
      description: group.description || '',
      leader_id: group.leader_id || '',
    });
    setShowEditForm(group);
  };

  const getAvailableUsers = () => {
    if (!selectedGroup || !users.length) return [];
    
    const memberIds = new Set(members.map(m => m.user_id));
    return users.filter(u => 
      u.role !== 'admin' && 
      !memberIds.has(u.id) && 
      u.group_id === null
    );
  };

  if (!isAdmin) {
    if (myGroupLoading || myGroupMembersLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (!myGroup) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg text-center">
          <UserGroupIcon className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Вы не состоите в группе</h2>
          <p className="text-yellow-700">
            Обратитесь к администратору, чтобы вас добавили в группу.
          </p>
        </div>
      );
    }

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Моя группа</h1>
          <p className="text-gray-600">Просмотр информации о вашей группе</p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{myGroup.name}</h2>
                {myGroup.description && (
                  <p className="text-gray-600 mt-1">{myGroup.description}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  Участников: {myGroup.member_count} | 
                  Руководитель: {myGroup.leader_name || 'Не назначен'}
                </p>
              </div>
              <EyeIcon className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="p-6">
            <h3 className="font-semibold text-lg mb-4">Участники группы</h3>
            {myGroupMembersLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : myGroupMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                В группе нет участников
              </div>
            ) : (
              <div className="grid gap-3">
                {myGroupMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center">
                        <UsersIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="font-medium text-gray-900">{member.full_name}</span>
                        {member.user_id === myGroup.leader_id && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                            Руководитель группы
                          </span>
                        )}
                        {member.user_id === currentUser?.id && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                            Вы
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{member.email}</div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {member.role === 'manager' ? 'Руководитель' : 'Сотрудник'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (groupsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const availableUsers = getAvailableUsers();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Управление группами</h1>
          <p className="text-gray-600">Создавайте группы, назначайте руководителей и управляйте участниками</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary flex items-center"
        >
          <UserGroupIcon className="h-5 w-5 mr-1" />
          Создать группу
        </button>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 rounded">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              💡 <strong>Важно:</strong> 
              Пользователь становится руководителем ТОЛЬКО когда назначен руководителем группы. 
              При удалении группы или снятии с должности руководителя, пользователь автоматически становится сотрудником.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Список групп</h2>
              <button
                onClick={() => queryClient.invalidateQueries('groups')}
                className="p-1 text-gray-400 hover:text-blue-600"
                title="Обновить"
              >
                <ArrowPathIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="divide-y">
              {groups.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  Нет созданных групп
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedGroup?.id === group.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedGroup(group)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {group.member_count} участников
                        </p>
                        {group.leader_name && (
                          <p className="text-xs text-blue-600 mt-1">
                            Руководитель: {group.leader_name}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(group);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Удалить группу "${group.name}"?`)) {
                              deleteMutation.mutate(group.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedGroup ? (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold">{selectedGroup.name}</h2>
                  {selectedGroup.description && (
                    <p className="text-sm text-gray-500 mt-1">{selectedGroup.description}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    refetchMembers();
                    queryClient.invalidateQueries('groups');
                  }}
                  className="p-1 text-gray-400 hover:text-blue-600"
                  title="Обновить"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Участники группы</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Всего: {members.length} участников
                    </p>
                  </div>
                  <div className="relative">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addMemberMutation.mutate({
                            groupId: selectedGroup.id,
                            userId: parseInt(e.target.value),
                          });
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-1 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={availableUsers.length === 0}
                    >
                      <option value="">
                        {availableUsers.length === 0 
                          ? 'Нет доступных пользователей' 
                          : 'Добавить участника'}
                      </option>
                      {availableUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name} (Сотрудник)
                        </option>
                      ))}
                    </select>
                    {availableUsers.length === 0 && members.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Все пользователи уже распределены по группам
                      </p>
                    )}
                  </div>
                </div>

                {membersLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <UsersIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p>В группе нет участников</p>
                    <p className="text-sm mt-1">
                      {availableUsers.length > 0 
                        ? 'Выберите пользователя из выпадающего списка' 
                        : 'Нет пользователей, доступных для добавления'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <div className="flex items-center">
                            <UsersIcon className="h-5 w-5 text-gray-400 mr-2" />
                            <span className="font-medium text-gray-900">{member.full_name}</span>
                            {member.user_id === selectedGroup.leader_id && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                                Руководитель группы
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">{member.email}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            Роль в системе: {member.role === 'manager' ? 'Руководитель' : 'Сотрудник'}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (member.user_id === selectedGroup.leader_id) {
                              toast.error(
                                'Нельзя удалить руководителя из группы. Сначала назначьте нового руководителя через редактирование группы.',
                                { duration: 5000 }
                              );
                              return;
                            }
                            if (window.confirm(`Удалить ${member.full_name} из группы?`)) {
                              await removeMemberMutation.mutateAsync({
                                groupId: selectedGroup.id,
                                userId: member.user_id,
                              });
                              const updatedGroup = groups.find(g => g.id === selectedGroup.id);
                              if (updatedGroup) {
                                setSelectedGroup(updatedGroup);
                              }
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title={member.user_id === selectedGroup.leader_id ? 'Нельзя удалить руководителя' : 'Удалить из группы'}
                        >
                          <UserMinusIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              <UserGroupIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p>Выберите группу для просмотра деталей</p>
            </div>
          )}
        </div>
      </div>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Создать группу</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название группы *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Например: Отдел разработки"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows="3"
                  placeholder="Описание группы"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Руководитель группы *
                </label>
                <select
                  required
                  value={formData.leader_id}
                  onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                  className="input"
                >
                  <option value="">Выберите руководителя</option>
                  {users.filter(u => !u.group_id && u.role !== 'admin').map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} (Сотрудник)
                    </option>
                  ))}
                </select>
                {users.filter(u => !u.group_id && u.role !== 'admin').length === 0 && (
                  <p className="text-xs text-red-600 mt-1">
                    Нет доступных сотрудников для назначения руководителем. Сначала создайте пользователя с ролью Сотрудник.
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary">
                  Отмена
                </button>
                <button 
                  type="submit" 
                  disabled={createMutation.isLoading || users.filter(u => !u.group_id && u.role !== 'admin').length === 0} 
                  className="btn-primary"
                >
                  {createMutation.isLoading ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Редактировать группу</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Название группы *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Руководитель группы
                </label>
                <select
                  value={formData.leader_id}
                  onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                  className="input"
                >
                  <option value="">Не назначен</option>
                  {members.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.full_name} {member.user_id === showEditForm.leader_id ? '(текущий)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ При смене руководителя, старый руководитель потеряет права управления группой
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowEditForm(null)} className="btn-secondary">
                  Отмена
                </button>
                <button type="submit" disabled={updateMutation.isLoading} className="btn-primary">
                  {updateMutation.isLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsPage;