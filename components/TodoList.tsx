import React, { useEffect, useState } from 'react';
import { Todo } from '../types';
import { api } from '../services/api';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { VoiceAssistant } from './VoiceAssistant';
import { Plus, Trash2, Edit2, Search, LogOut, LayoutList, Calendar, Flag, AlertTriangle } from 'lucide-react';

interface TodoListProps {
  onLogout: () => void;
}

// Helper to format date for input (YYYY-MM-DDThh:mm)
const toInputDate = (isoString: string) => {
  if (!isoString) return '';
  // Take the first 16 chars "YYYY-MM-DDThh:mm"
  return isoString.slice(0, 16);
};

// Helper for display
const formatDate = (isoString: string) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
};

const PriorityBadge = ({ priority }: { priority: string }) => {
  const styles = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };
  const style = styles[priority as keyof typeof styles] || 'bg-slate-100 text-slate-700 border-slate-200';
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${style} capitalize`}>
      {priority}
    </span>
  );
};

export const TodoList: React.FC<TodoListProps> = ({ onLogout }) => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State for Create/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  
  // Modal State for Delete Confirmation
  const [todoToDelete, setTodoToDelete] = useState<Todo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTodos = async () => {
    try {
      const data = await api.getTodos();
      setTodos(data);
    } catch (error) {
      console.error('Failed to fetch todos', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Ensure we have a valid date, default to now + 1 hour if not set
    const dueDatePayload = formDueDate || new Date(Date.now() + 3600000).toISOString();

    try {
      if (editingTodo) {
        const updated = await api.updateTodo(editingTodo.id, {
          title: formTitle,
          description: formDesc,
          priority: formPriority as 'low' | 'medium' | 'high',
          due_date: dueDatePayload
        });
        setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const newTodo = await api.createTodo(formTitle, formDesc, formPriority, dueDatePayload);
        setTodos(prev => [...prev, newTodo]);
      }
      closeModal();
    } catch (error) {
      console.error('Operation failed', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!todoToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteTodo(todoToDelete.id);
      setTodos(prev => prev.filter(t => t.id !== todoToDelete.id));
      setTodoToDelete(null);
    } catch (error) {
      console.error('Failed to delete', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const openModal = (todo?: Todo) => {
    if (todo) {
      setEditingTodo(todo);
      setFormTitle(todo.title);
      setFormDesc(todo.description || '');
      setFormPriority(todo.priority || 'medium');
      setFormDueDate(toInputDate(todo.due_date));
    } else {
      setEditingTodo(null);
      setFormTitle('');
      setFormDesc('');
      setFormPriority('medium');
      // Default to slightly in future for new tasks
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setFormDueDate(now.toISOString().slice(0, 16));
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTodo(null);
  };

  const filteredTodos = todos.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary-600">
            <LayoutList className="w-6 h-6" />
            <h1 className="text-xl font-bold text-slate-900">Render Todo</h1>
          </div>
          <Button variant="ghost" onClick={onLogout} className="text-slate-600">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <Button onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-4">
              <LayoutList className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">No tasks found</h3>
            <p className="text-slate-500 mt-1">Get started by creating a new task above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTodos.map(todo => (
              <div 
                key={todo.id} 
                className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-primary-200"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-slate-900 truncate">
                        {todo.title}
                      </h3>
                      <PriorityBadge priority={todo.priority} />
                    </div>
                    {todo.description && (
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                        {todo.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Due: {formatDate(todo.due_date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-start">
                    <button
                      onClick={() => openModal(todo)}
                      className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setTodoToDelete(todo)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Voice Assistant */}
      <VoiceAssistant todos={todos} onUpdate={fetchTodos} />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingTodo ? 'Edit Task' : 'New Task'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            placeholder="What needs to be done?"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
            autoFocus
          />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            
            <div>
               <label className="block text-sm font-medium text-slate-700 mb-1">
                Due Date
              </label>
              <input
                type="datetime-local"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px] resize-none"
              placeholder="Add more details..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={submitting}>
              {editingTodo ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!todoToDelete}
        onClose={() => setTodoToDelete(null)}
        title="Delete Task"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-red-50 text-red-700 rounded-lg">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">This action cannot be undone.</p>
          </div>
          
          <p className="text-slate-600">
            Are you sure you want to delete <span className="font-medium text-slate-900">"{todoToDelete?.title}"</span>?
          </p>
          
          <div className="flex gap-3 justify-end pt-2">
            <Button 
              variant="ghost" 
              onClick={() => setTodoToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" 
              onClick={handleConfirmDelete}
              isLoading={isDeleting}
            >
              Delete Task
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};