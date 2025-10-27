# DataTable Component

A reusable, mobile-first table component based on the free-react-tailwind-admin-dashboard design.

## Features

✅ **Mobile-First Design**
- Responsive table for desktop (md+)
- Card-based layout for mobile
- Custom mobile card renderer support

✅ **Built-in Functionality**
- Search/Filter
- Column sorting
- Pagination
- Loading states
- Empty states

✅ **Customizable**
- Custom cell renderers
- Custom mobile card layout
- Flexible styling
- Row click handlers

✅ **TypeScript Support**
- Fully typed with generics
- Type-safe column definitions

## Basic Usage

```tsx
import { DataTable, Column } from '@/components/shared/DataTable'

interface User {
  id: number
  name: string
  email: string
  role: string
}

const users: User[] = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
]

const columns: Column<User>[] = [
  {
    key: 'name',
    header: 'Name',
    accessor: (user) => user.name,
    sortable: true,
  },
  {
    key: 'email',
    header: 'Email',
    accessor: (user) => user.email,
    sortable: true,
  },
  {
    key: 'role',
    header: 'Role',
    accessor: (user) => (
      <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
        {user.role}
      </span>
    ),
  },
]

function UsersPage() {
  return (
    <DataTable
      data={users}
      columns={columns}
      keyExtractor={(user) => user.id}
      searchKeys={['name', 'email']}
      searchPlaceholder="Search users..."
    />
  )
}
```

## Props

### Required Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `T[]` | Array of data items to display |
| `columns` | `Column<T>[]` | Column definitions |
| `keyExtractor` | `(item: T) => string \| number` | Function to extract unique key from each item |

### Optional Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `searchPlaceholder` | `string` | `"Search..."` | Placeholder text for search input |
| `searchKeys` | `(keyof T)[]` | `[]` | Keys to search in |
| `isLoading` | `boolean` | `false` | Show loading state |
| `emptyMessage` | `string` | `"No data available"` | Message when no data |
| `emptyIcon` | `ReactNode` | `<MagnifyingGlassIcon />` | Icon for empty state |
| `showPagination` | `boolean` | `true` | Enable pagination |
| `showSearch` | `boolean` | `true` | Show search bar |
| `pageSize` | `number` | `10` | Items per page |
| `mobileCardRenderer` | `(item: T, index: number) => ReactNode` | `undefined` | Custom mobile card renderer |
| `onRowClick` | `(item: T) => void` | `undefined` | Row click handler |
| `className` | `string` | `undefined` | Additional CSS classes |

## Column Definition

```tsx
interface Column<T> {
  key: string                          // Unique column identifier
  header: string | ReactNode           // Column header content
  accessor: (item: T) => ReactNode     // Function to get cell content
  sortable?: boolean                   // Enable sorting
  className?: string                   // Cell CSS classes
  headerClassName?: string             // Header cell CSS classes
}
```

## Advanced Examples

### Custom Cell Rendering

```tsx
const columns: Column<Node>[] = [
  {
    key: 'name',
    header: 'Node Name',
    accessor: (node) => (
      <div className="flex items-center gap-2">
        <ServerIcon className="w-5 h-5 text-gray-400" />
        <span className="font-medium">{node.metadata.name}</span>
      </div>
    ),
    sortable: true,
  },
  {
    key: 'status',
    header: 'Status',
    accessor: (node) => {
      const isReady = node.status?.conditions?.some(
        (c: any) => c.type === 'Ready' && c.status === 'True'
      )
      return (
        <span className={clsx(
          'px-2 py-1 text-xs rounded-full',
          isReady 
            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        )}>
          {isReady ? 'Ready' : 'Not Ready'}
        </span>
      )
    },
  },
]
```

### Custom Mobile Card

```tsx
<DataTable
  data={nodes}
  columns={columns}
  keyExtractor={(node) => node.metadata.name}
  mobileCardRenderer={(node) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {node.metadata.name}
        </h3>
        <span className={clsx(
          'px-2 py-1 text-xs rounded-full',
          node.status.ready ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        )}>
          {node.status.ready ? 'Ready' : 'Not Ready'}
        </span>
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <div>Version: {node.status.nodeInfo.kubeletVersion}</div>
        <div>IP: {node.status.addresses[0].address}</div>
      </div>
    </div>
  )}
/>
```

### With Actions

```tsx
const columns: Column<Node>[] = [
  // ... other columns
  {
    key: 'actions',
    header: 'Actions',
    accessor: (node) => (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation() // Prevent row click
            handleCordon(node)
          }}
          className="p-1 text-gray-600 hover:text-primary-600"
        >
          <LockClosedIcon className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleDelete(node)
          }}
          className="p-1 text-gray-600 hover:text-red-600"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>
    ),
  },
]
```

### With Row Click

```tsx
<DataTable
  data={nodes}
  columns={columns}
  keyExtractor={(node) => node.metadata.name}
  onRowClick={(node) => {
    console.log('Clicked node:', node)
    // Navigate or open modal
  }}
/>
```

## Styling

The component uses Tailwind CSS and follows the free-react-tailwind-admin-dashboard design system:

- **Desktop**: Clean table with hover effects
- **Mobile**: Card-based layout with tap feedback
- **Dark Mode**: Full dark mode support
- **Responsive**: Breakpoint at `md` (768px)

## Migration Guide

### From Old Table to DataTable

**Before:**
```tsx
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {nodes.map(node => (
      <tr key={node.id}>
        <td>{node.name}</td>
        <td>{node.status}</td>
      </tr>
    ))}
  </tbody>
</table>
```

**After:**
```tsx
<DataTable
  data={nodes}
  columns={[
    {
      key: 'name',
      header: 'Name',
      accessor: (node) => node.name,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (node) => node.status,
    },
  ]}
  keyExtractor={(node) => node.id}
/>
```

## Best Practices

1. **Use `useMemo` for columns** to prevent re-renders:
   ```tsx
   const columns = useMemo(() => [
     { key: 'name', header: 'Name', accessor: (item) => item.name },
   ], [])
   ```

2. **Keep `accessor` functions pure** - no side effects

3. **Use `keyExtractor` with stable IDs** - avoid array indices

4. **Provide meaningful `searchKeys`** for better UX

5. **Customize mobile cards** for complex data structures

6. **Handle loading and empty states** appropriately

## Performance

- ✅ Built-in memoization for filtering, sorting, and pagination
- ✅ Efficient re-renders with proper React keys
- ✅ Lazy evaluation of cell content
- ✅ Optimized for large datasets (tested with 1000+ items)

## Browser Support

- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Mobile browsers: ✅

## License

MIT

