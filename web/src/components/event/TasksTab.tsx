import type { Comment, Task, TaskFile } from '../../types';
import type { TaskFilter } from '../../utils/taskView';
import { noteStatsByTask } from '../../utils/taskView';
import { TaskAside } from './TaskAside';
import { TaskList } from './TaskList';
import './Tasks.css';

interface Props {
  tasks: Task[];
  comments: Comment[];
  files: TaskFile[];
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  currentUserEmail: string | null;
  isAdmin: boolean;
  onToggleComplete: (task: Task) => void;
  onAddTask?: () => void;
  onTaskUpdated: (task: Task) => void;
  onCommentAdded: (comment: Comment) => void;
  onFileAdded: (file: TaskFile) => void;
  onFileRemoved: (fileId: string) => void;
}

export function TasksTab(props: Props) {
  const selected = props.tasks.find((t) => t.taskId === props.selectedTaskId) ?? null;
  return (
    <div className="ws-tasks">
      <TaskList
        tasks={props.tasks}
        filter={props.filter}
        onFilterChange={props.onFilterChange}
        selectedTaskId={props.selectedTaskId}
        onSelect={props.onSelect}
        currentUserEmail={props.currentUserEmail}
        isAdmin={props.isAdmin}
        noteStats={noteStatsByTask(props.comments)}
        onToggleComplete={props.onToggleComplete}
        onAddTask={props.onAddTask}
      />
      <TaskAside
        task={selected}
        comments={props.comments}
        files={props.files}
        onTaskUpdated={props.onTaskUpdated}
        onCommentAdded={props.onCommentAdded}
        onFileAdded={props.onFileAdded}
        onFileRemoved={props.onFileRemoved}
      />
    </div>
  );
}
