const colors = {
  waiting:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  serving:   'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  skipped:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  recalled:  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${colors[status] || colors.waiting}`}>
      {status?.charAt(0).toUpperCase() + status?.slice(1)}
    </span>
  );
}
