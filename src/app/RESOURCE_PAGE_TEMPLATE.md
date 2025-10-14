# Resource Page Template

This template provides the correct structure for creating new resource pages in Kubelens. **Follow this exactly to avoid common mistakes.**

## ⚠️ COMMON MISTAKES TO AVOID

1. **WRONG IMPORT**: `import { formatAge } from '../utils/dateUtils'` ❌
   **CORRECT**: `import { formatAge } from '@/utils/format'` ✅

2. **WRONG**: Using `.map(query => useQuery(query))` ❌
   **CORRECT**: Using `useQueries({ queries: resourceQueries })` ✅

3. **WRONG**: `<Breadcrumb items={...} />` without `items` prop ❌
   **CORRECT**: `<Breadcrumb items={clusterParam ? [{ name: clusterParam, href: ... }, { name: 'Resource' }] : [{ name: 'Resource' }]}` ✅

4. **WRONG**: Passing `sortConfig` object to ResizableTableHeader ❌
   **CORRECT**: Pass `currentSortKey`, `currentSortDirection`, `columnKey`, and `onResizeStart` ✅

5. **WRONG**: Using `handleSort` from `useTableSort` ❌
   **CORRECT**: Using `requestSort` from `useTableSort` ✅

6. **WRONG**: Using `onMouseDown={(e) => startResize(e, 'name')}` ❌
   **CORRECT**: Using `columnKey="name"` and `onResizeStart={handleResizeStart}` ✅

7. **WRONG**: Table wrapper `<div className="bg-white dark:bg-gray-800 ...">` ❌
   **CORRECT**: Table wrapper `<div className="card overflow-hidden">` ✅

8. **WRONG**: Header layout with separate divs for title and search ❌
   **CORRECT**: Use `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4` ✅

9. **WRONG**: Directly importing Editor and Prism for YAML editing ❌
   **CORRECT**: Use `<YamlEditor>` component for consistent theme across all modals:
   ```typescript
   import YamlEditor from '@/components/shared/YamlEditor'
   
   <YamlEditor value={yaml} onChange={setYaml} height="500px" />
   ```

## 📌 Important: Sorting Edge Cases

### sortKey Values
The `useTableSort` hook intelligently handles:

✅ **Nested paths**: `"metadata.name"`, `"spec.replicas"`, `"status.phase"`

✅ **Annotations with dots**: `"metadata.annotations.storageclass.kubernetes.io/is-default-class"`
   - Special handling for annotation keys that contain dots
   - No need to escape or change the format

✅ **Boolean values**: `"allowVolumeExpansion"`, `"spec.paused"`
   - Automatically converts to numbers (true=1, false=0) for proper sorting

✅ **ISO date strings**: `"metadata.creationTimestamp"`, `"status.lastTransitionTime"`
   - Automatically detects and parses ISO date strings
   - Compares as timestamps, not strings
   - Falls back to string comparison if not a valid date

✅ **Numbers**: `"spec.replicas"`, `"spec.minReplicas"`
   - Numeric sorting (not alphabetical)

✅ **Regular strings**: `"metadata.name"`, `"spec.type"`
   - Case-insensitive locale-aware comparison

### Example sortKey Usage:
```typescript
// Simple field
sortKey="provisioner"

// Nested path
sortKey="metadata.name"

// Annotation with dots in key name (works automatically!)
sortKey="metadata.annotations.storageclass.kubernetes.io/is-default-class"

// Boolean field
sortKey="allowVolumeExpansion"

// Date field (ISO string)
sortKey="metadata.creationTimestamp"

// No sorting (e.g., Actions column)
sortKey=""
```

## File Structure

```
frontend/src/
├── pages/
│   └── ResourceName.tsx          # Main page component
└── components/
    └── ResourceName/
        ├── ResourceDetailsModal.tsx
        ├── EditResourceYAMLModal.tsx
        ├── DeleteResourceModal.tsx
        └── [Other action modals].tsx
```

## Complete Page Template

### ⚠️ CRITICAL IMPORTS (Copy these exactly - common mistake!)

```typescript
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { getClusters, getResources } from '@/services/api'  // Replace getResources with your resource API
import { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import ResizableTableHeader from '@/components/shared/ResizableTableHeader'
import ResourceDetailsModal from '@/components/ResourceName/ResourceDetailsModal'
import EditResourceYAMLModal from '@/components/ResourceName/EditResourceYAMLModal'
import DeleteResourceModal from '@/components/ResourceName/DeleteResourceModal'
// ⚠️ CRITICAL: Always use '@/utils/format' NOT '../utils/dateUtils' (which doesn't exist!)
import { formatAge } from '@/utils/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/shared/Pagination'
import { useClusterStore } from '@/stores/clusterStore'
import { useNamespaceStore } from '@/stores/namespaceStore'

export default function ResourceName() {
  const { cluster, namespace } = useParams<{ cluster?: string; namespace?: string }>()
  const queryClient = useQueryClient()
  const [filterText, setFilterText] = useState('')
  const [selectedResource, setSelectedResource] = useState<any>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditYAMLModalOpen, setIsEditYAMLModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // ✅ CRITICAL: Define resizable columns with proper widths
  const { columnWidths, handleMouseDown: handleResizeStart } = useResizableColumns({
    name: 200,
    namespace: 150,
    // ... other columns
    age: 120,
    actions: 180,  // Adjust based on number of action buttons (150 for 2, 180 for 3)
  }, 'resource-column-widths')

  // ✅ CRITICAL: Reset state when cluster or namespace changes
  useEffect(() => {
    setSelectedResource(null)
    setIsDetailsModalOpen(false)
    setIsEditYAMLModalOpen(false)
    setIsDeleteModalOpen(false)
  }, [cluster, namespace])
  
  // ✅ CRITICAL: Fetch clusters first
  const { data: clusters } = useQuery({
    queryKey: ['clusters'],
    queryFn: getClusters,
  })

  // ✅ CRITICAL: Build queries array (NOT calling useQuery in loop!)
  const resourceQueries = useMemo(() => {
    if (!clusters) return []

    if (cluster) {
      return [
        {
          queryKey: ['resources', cluster, namespace || 'all'],
          queryFn: () => getResources(cluster, namespace || 'all'),
          refetchInterval: 5000,
        },
      ]
    }

    return clusters.map((c: any) => ({
      queryKey: ['resources', c.name, namespace || 'all'],
      queryFn: () => getResources(c.name, namespace || 'all'),
      refetchInterval: 5000,
    }))
  }, [clusters, cluster, namespace])

  // ✅ CRITICAL: Use useQueries (NOT .map with useQuery!)
  const resourceResults = useQueries({ queries: resourceQueries })
  const isLoading = resourceResults.some((result) => result.isLoading)

  // Flatten results from all clusters
  const allResources = useMemo(() => {
    return resourceResults.flatMap((result) => result.data || [])
  }, [resourceResults])

  // Filter resources
  const filteredResources = useMemo(() => {
    return allResources.filter((resource: any) => {
      const searchText = filterText.toLowerCase()
      const name = resource.metadata?.name?.toLowerCase() || ''
      const ns = resource.metadata?.namespace?.toLowerCase() || ''
      // Add more searchable fields as needed

      return name.includes(searchText) || ns.includes(searchText)
    })
  }, [allResources, filterText])

  // ✅ CRITICAL: Apply sorting with correct initial sort
  const { sortedData: resources, sortConfig, requestSort } = useTableSort(filteredResources, {
    key: 'metadata.name',
    direction: 'asc'
  })

  // Action handlers
  const handleRowClick = (resource: any) => {
    setSelectedResource(resource)
    setIsDetailsModalOpen(true)
  }

  const handleEditYAMLClick = (resource: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedResource(resource)
    setIsEditYAMLModalOpen(true)
  }

  const handleDeleteClick = (resource: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedResource(resource)
    setIsDeleteModalOpen(true)
  }

  // Loading state
  if (isLoading && allResources.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ✅ CRITICAL: Breadcrumb with items prop */}
      <div>
        <Breadcrumb 
          items={
            cluster
              ? [
                  { name: cluster, href: `/clusters/${cluster}/overview` },
                  { name: 'Resource Name' }
                ]
              : [{ name: 'Resource Name' }]
          }
        />
      </div>
      
      {/* ✅ CRITICAL: Header with gradient-text, correct spacing */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Resource Name</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            All resources across {clusters?.length || 0} cluster(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter by name or namespace..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* ✅ CRITICAL: Table with correct classes */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
            {/* ✅ CRITICAL: thead with dark:bg-gray-800 */}
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {/* ✅ CRITICAL: ResizableTableHeader with CORRECT props */}
                <ResizableTableHeader
                  label="Name"
                  columnKey="name"
                  sortKey="metadata.name"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.name}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Namespace"
                  columnKey="namespace"
                  sortKey="metadata.namespace"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.namespace}
                  onResizeStart={handleResizeStart}
                />
                {/* Add more columns */}
                <ResizableTableHeader
                  label="Age"
                  columnKey="age"
                  sortKey="metadata.creationTimestamp"
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.age}
                  onResizeStart={handleResizeStart}
                />
                <ResizableTableHeader
                  label="Actions"
                  columnKey="actions"
                  sortKey=""
                  currentSortKey={sortConfig?.key as string}
                  currentSortDirection={sortConfig?.direction || null}
                  onSort={requestSort}
                  width={columnWidths.actions}
                  onResizeStart={handleResizeStart}
                  align="right"
                />
              </tr>
            </thead>
            {/* ✅ CRITICAL: tbody with dark:bg-gray-900 and transition-colors on hover */}
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    {filterText ? 'No resources found matching your filter' : 'No resources found'}
                  </td>
                </tr>
              ) : (
                resources.map((resource: any) => (
                  <tr
                    key={`${resource.clusterName}-${resource.metadata?.namespace}-${resource.metadata?.name}`}
                    onClick={() => handleRowClick(resource)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  >
                    <td
                      className="px-2 sm:px-4 py-3 text-sm font-medium text-gray-900 dark:text-white truncate"
                      style={{ width: columnWidths.name, maxWidth: columnWidths.name }}
                    >
                      {resource.metadata?.name}
                    </td>
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate"
                      style={{ width: columnWidths.namespace, maxWidth: columnWidths.namespace }}
                    >
                      {resource.metadata?.namespace}
                    </td>
                    {/* Add more cells */}
                    <td
                      className="px-2 sm:px-4 py-3 text-sm text-gray-500 dark:text-gray-400"
                      style={{ width: columnWidths.age, maxWidth: columnWidths.age }}
                    >
                      {formatAge(resource.metadata?.creationTimestamp)}
                    </td>
                    {/* ✅ CRITICAL: Action buttons with correct styling */}
                    <td
                      className="px-2 sm:px-4 py-3 text-right text-sm font-medium"
                      style={{ width: columnWidths.actions, maxWidth: columnWidths.actions }}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => handleEditYAMLClick(resource, e)}
                          className="p-1.5 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded transition-colors"
                          title="Edit YAML"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(resource, e)}
                          className="p-1.5 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
          onNextPage={goToNextPage}
          onPreviousPage={goToPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
        />
      </div>

      {/* Modals */}
      {selectedResource && (
        <>
          <ResourceDetailsModal
            resource={selectedResource}
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false)
              setSelectedResource(null)
            }}
          />
          <EditResourceYAMLModal
            resource={selectedResource}
            isOpen={isEditYAMLModalOpen}
            onClose={() => {
              setIsEditYAMLModalOpen(false)
              setSelectedResource(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['resources'] })
            }}
          />
          <DeleteResourceModal
            resource={selectedResource}
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false)
              setSelectedResource(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['resources'] })
            }}
          />
        </>
      )}
    </div>
  )
}
```

## Critical Checkpoints

### ✅ 1. Imports
- [ ] `useQuery, useQueries, useQueryClient` from @tanstack/react-query
- [ ] `PencilSquareIcon` for edit (NOT DocumentTextIcon)
- [ ] All modal components imported

### ✅ 2. State Management
- [ ] `useEffect` to reset all modal states on cluster/namespace change
- [ ] All modal open/close states defined

### ✅ 3. Data Fetching (MOST COMMON MISTAKE!)
- [ ] Build queries array in `useMemo`
- [ ] Use `useQueries({ queries: ... })` NOT `.map(q => useQuery(q))`
- [ ] Handle `clusters` being undefined

### ✅ 4. Breadcrumb (ALWAYS FORGOTTEN!)
- [ ] Wrapped in `<div>`
- [ ] Has `items` prop with array
- [ ] Conditional based on cluster selection

### ✅ 5. Header
- [ ] `space-y-4 sm:space-y-6` on container
- [ ] `gradient-text` class on h1
- [ ] `text-2xl sm:text-3xl` responsive sizing
- [ ] `mt-1 sm:mt-2` on description
- [ ] Search input: `w-full sm:w-80`

### ✅ 6. Table Structure
- [ ] Wrapper: `className="card overflow-hidden"`
- [ ] Table: `className="w-full divide-y..."`
- [ ] thead: `className="bg-gray-50 dark:bg-gray-800"`
- [ ] tbody: `className="bg-white dark:bg-gray-900 ..."`

### ✅ 7. ResizableTableHeader Props (CRITICAL!)
```typescript
<ResizableTableHeader
  label="Column Name"
  columnKey="columnKey"              // ← Required!
  sortKey="metadata.name"
  currentSortKey={sortConfig?.key as string}      // ← NOT sortConfig!
  currentSortDirection={sortConfig?.direction || null}  // ← NOT sortConfig!
  onSort={requestSort}               // ← NOT requestSort!
  width={columnWidths.columnKey}
  onResizeStart={handleResizeStart}
/>
```

### ✅ 8. Table Row
- [ ] Hover: `hover:bg-gray-50 dark:hover:bg-gray-800/50`
- [ ] Has `transition-colors`
- [ ] Has `cursor-pointer`

### ✅ 9. Action Buttons
- [ ] Edit: Yellow (text-yellow-600)
- [ ] Delete: Red (text-red-600)
- [ ] Scale/Other: Blue (text-blue-600)
- [ ] All have: `p-1.5`, `hover:bg-{color}-50`, `rounded`, `transition-colors`
- [ ] Icons: `h-4 w-4`

### ✅ 10. Integration Checklist
- [ ] Add routes in App.tsx (namespace-specific, cluster-level, legacy)
- [ ] Add to Layout.tsx sidebar navigation
- [ ] Add to NamespaceSelector route map
- [ ] Add to ClusterSelector route map
- [ ] Add backend API handlers
- [ ] Add backend routes in main.go
- [ ] Add frontend API functions in services/api.ts
- [ ] Add to kubernetes.ts (apiVersion and kind mapping)

## Action Button Color Guide

| Action | Color | Class Prefix |
|--------|-------|-------------|
| Edit | Yellow | `text-yellow-600` |
| Delete | Red | `text-red-600` |
| Scale | Blue | `text-blue-600` |
| Restart | Green | `text-green-600` |
| View/Info | Gray | `text-gray-600` |

## Common Mistakes to AVOID

❌ **DON'T:**
```typescript
// Wrong - calling useQuery in loop
hpaResults = queries.map(q => useQuery(q))

// Wrong - missing items prop
<Breadcrumb />

// Wrong - old ResizableTableHeader props
<ResizableTableHeader
  sortConfig={sortConfig}
  requestSort={requestSort}
/>

// Wrong - tbody background
<tbody className="bg-white dark:bg-gray-800">

// Wrong - using DocumentTextIcon for edit
<DocumentTextIcon className="h-4 w-4" />
```

✅ **DO:**
```typescript
// Correct - useQueries
hpaResults = useQueries({ queries })

// Correct - items prop
<Breadcrumb items={[...]} />

// Correct - ResizableTableHeader props
<ResizableTableHeader
  currentSortKey={sortConfig?.key as string}
  currentSortDirection={sortConfig?.direction || null}
  onSort={requestSort}
/>

// Correct - tbody background
<tbody className="bg-white dark:bg-gray-900">

// Correct - PencilSquareIcon for edit
<PencilSquareIcon className="h-4 w-4" />
```

