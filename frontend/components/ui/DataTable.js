import EmptyState from './EmptyState';
import styles from './DataTable.module.css';

export default function DataTable({ columns, rows, getRowKey, emptyTitle, emptyDescription, onRowClick, canClickRow, className = '' }) {
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={`${styles.tableWrap} ${className}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.key === 'actions' ? styles.actionCell : undefined}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowIsClickable = onRowClick && (!canClickRow || canClickRow(row));
            const handleKeyDown = rowIsClickable
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick(row);
                  }
                }
              : undefined;
            return (
              <tr
                key={getRowKey ? getRowKey(row) : index}
                onClick={rowIsClickable ? () => onRowClick(row) : undefined}
                onKeyDown={handleKeyDown}
                tabIndex={rowIsClickable ? 0 : undefined}
                className={rowIsClickable ? styles.clickableRow : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.key === 'actions' ? styles.actionCell : undefined}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
