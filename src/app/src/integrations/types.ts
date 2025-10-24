export interface IntegrationModule {
  name: string
  displayName: string
  description: string
  icon: string
  category: 'cloud' | 'monitoring' | 'alerts' | 'cost'
  configForm: ConfigFormSchema
  actions: ModuleAction[]
  FormComponent: React.ComponentType<IntegrationFormProps>
}

export interface ConfigFormSchema {
  fields: FormField[]
}

export interface FormField {
  name: string
  type: 'text' | 'textarea' | 'file' | 'select' | 'password'
  label: string
  placeholder?: string
  required: boolean
  validation?: any
  help?: string
  options?: FormOption[]
}

export interface FormOption {
  label: string
  value: string
}

export interface ModuleAction {
  id: string
  label: string
  description: string
  endpoint: string
  method: string
}

export interface IntegrationFormProps {
  onSubmit: (data: any) => void
  onCancel?: () => void
  initialData?: any
  loading?: boolean
}

export interface ModuleMetadataResponse {
  count: number
  modules: Array<{
    name: string
    display_name: string
    description: string
    icon: string
    category: string
    config_form: ConfigFormSchema
    actions: ModuleAction[]
  }>
}

