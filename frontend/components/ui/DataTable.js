import EmptyState from './EmptyState';
import styles from './DataTable.module.css';

export default function DataTable({ columns, rows, getRowKey, emptyTitle, emptyDescription, onRowClick }) {
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey ? getRowKey(row) : index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? styles.clickableRow : undefined}
            >
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
