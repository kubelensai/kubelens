import { IntegrationModule } from '../types'
import GCPForm from './GCPForm'

const GCPModule: IntegrationModule = {
  name: 'gcp',
  displayName: 'Google Cloud Platform',
  description: 'Connect your GKE clusters from Google Cloud',
  icon: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/googlecloud/googlecloud-original.svg',
  category: 'cloud',
  configForm: {
    fields: [
      {
        name: 'name',
        type: 'text',
        label: 'Integration Name',
        placeholder: 'e.g., My GCP Production',
        required: true,
        help: 'A friendly name to identify this GCP integration',
      },
      {
        name: 'project_id',
        type: 'text',
        label: 'GCP Project ID',
        placeholder: 'my-gcp-project',
        required: true,
        help: 'Your Google Cloud project ID where GKE clusters are located',
      },
      {
        name: 'service_account_json',
        type: 'textarea',
        label: 'Service Account Key (JSON)',
        placeholder: 'Paste your service account JSON key here...',
        required: true,
        help: 'Create a service account with GKE permissions and download the JSON key',
      },
    ],
  },
  actions: [
    {
      id: 'sync_clusters',
      label: 'Sync Clusters',
      description: 'Discover and sync all GKE clusters from this project',
      endpoint: '/api/v1/modules/gcp/sync',
      method: 'POST',
    },
    {
      id: 'validate',
      label: 'Test Connection',
      description: 'Validate GCP credentials and connectivity',
      endpoint: '/api/v1/modules/gcp/validate',
      method: 'POST',
    },
  ],
  FormComponent: GCPForm,
}

export default GCPModule

