import { useState } from 'react'
import { IntegrationFormProps } from '../types'

export default function GCPForm({ onSubmit, onCancel, initialData, loading }: IntegrationFormProps) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    project_id: initialData?.project_id || '',
    service_account_json: initialData?.service_account_json || '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Integration name is required'
    }

    if (!formData.project_id.trim()) {
      newErrors.project_id = 'Project ID is required'
    }

    if (!formData.service_account_json.trim()) {
      newErrors.service_account_json = 'Service account JSON is required'
    } else {
      try {
        JSON.parse(formData.service_account_json)
      } catch (e) {
        newErrors.service_account_json = 'Invalid JSON format'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Integration Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Integration Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., My GCP Production"
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          A friendly name to identify this GCP integration
        </p>
      </div>

      {/* Project ID */}
      <div>
        <label htmlFor="project_id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          GCP Project ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="project_id"
          name="project_id"
          value={formData.project_id}
          onChange={handleChange}
          placeholder="my-gcp-project"
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
            errors.project_id ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.project_id && <p className="mt-1 text-sm text-red-500">{errors.project_id}</p>}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your Google Cloud project ID where GKE clusters are located
        </p>
      </div>

      {/* Service Account JSON */}
      <div>
        <label
          htmlFor="service_account_json"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Service Account Key (JSON) <span className="text-red-500">*</span>
        </label>
        <textarea
          id="service_account_json"
          name="service_account_json"
          value={formData.service_account_json}
          onChange={handleChange}
          placeholder="Paste your service account JSON key here..."
          rows={8}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm ${
            errors.service_account_json ? 'border-red-500' : 'border-gray-300'
          }`}
          disabled={loading}
        />
        {errors.service_account_json && (
          <p className="mt-1 text-sm text-red-500">{errors.service_account_json}</p>
        )}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Create a service account with GKE permissions (container.clusters.list, container.clusters.get) and download
          the JSON key
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {loading && (
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {loading ? 'Saving...' : 'Save Integration'}
        </button>
      </div>
    </form>
  )
}

